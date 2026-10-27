#!/usr/bin/env node
/** Prove a packed CLI uses patched fast-uri despite Ajv resolving legacy 3.1.8. */
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'

const names = { spec: '@seed-ship/mcp-ui-spec', cli: '@seed-ship/mcp-ui-cli' }
const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1]
  assert(key?.startsWith('--') && value && !value.startsWith('--'), `Expected --name value, got ${key ?? '<end>'}`)
  assert(!args.has(key), `Duplicate argument ${key}`)
  args.set(key, value)
}
for (const key of args.keys()) assert(['--spec', '--cli', '--report'].includes(key), `Unknown argument ${key}`)
const get = key => { const value = args.get(`--${key}`); assert(value, `Missing --${key}`); return value }
const archives = { spec: resolve(get('spec')), cli: resolve(get('cli')) }
const consumer = await mkdtemp(join(tmpdir(), 'mcpui-fast-uri-consumer-'))
const reportPath = args.has('--report') ? resolve(get('report')) : join(consumer, 'report.json')
const report = { status: 'running', consumer, archives: {}, toolchain: {}, install: {},
  resolutions: {}, probes: {}, artifacts: {}, failures: [] }
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const inside = path => path === consumer || path.startsWith(consumer + sep)

function run(command, commandArgs, timeout = 180_000) {
  const started = Date.now()
  const result = spawnSync(command, commandArgs, { cwd: consumer, encoding: 'utf8', timeout,
    maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: 'true', npm_config_auto_install_peers: 'false' } })
  const summary = { command, args: commandArgs, status: result.status, signal: result.signal,
    durationMs: Date.now() - started, stdout: result.stdout?.slice(-4000), stderr: result.stderr?.slice(-4000) }
  if (result.error) throw new Error(`${command} failed: ${result.error.message}`)
  return summary
}

async function inspectArchive(kind) {
  const path = archives[kind]
  assert((await stat(path)).isFile(), `${kind} archive is not a file`)
  const bytes = await readFile(path)
  assert(bytes.length < 64 * 1024 * 1024, `${kind} archive exceeds 64 MiB`)
  const members = execFileSync('tar', ['-tzf', path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split('\n')
  assert(members.every(name => name.startsWith('package/') && !name.split('/').includes('..')), `${kind} has unsafe archive paths`)
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8' }))
  assert.equal(manifest.name, names[kind], `${kind} archive identity`)
  report.archives[kind] = { path, sha256: sha256(bytes), name: manifest.name,
    version: manifest.version, dependencies: manifest.dependencies }
}

async function installed(requireFrom, name) {
  const entry = await realpath(requireFrom.resolve(name))
  assert(inside(entry), `${name} escaped isolated consumer: ${entry}`)
  for (let directory = dirname(entry); directory !== dirname(directory); directory = dirname(directory)) {
    const manifestPath = join(directory, 'package.json')
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      if (manifest.name === name) return { version: manifest.version, manifestPath, entry }
    } catch { /* continue to package parent */ }
  }
  throw new Error(`Cannot locate installed manifest for ${name} from ${entry}`)
}

async function inspectResolutions() {
  const fromConsumer = createRequire(join(consumer, 'package.json'))
  const cli = await installed(fromConsumer, names.cli)
  const spec = await installed(fromConsumer, names.spec)
  assert.equal(cli.version, report.archives.cli.version, 'Installed CLI differs from archive')
  assert.equal(spec.version, report.archives.spec.version, 'Installed Spec differs from archive')
  const fromCli = createRequire(cli.entry)
  const ajv = await installed(fromCli, 'ajv')
  const patchedRoot = await installed(fromConsumer, 'fast-uri')
  const legacyAjv = await installed(createRequire(ajv.entry), 'fast-uri')
  let directCli = null
  try { directCli = await installed(fromCli, 'fast-uri') } catch { /* baseline CLI may not declare fast-uri */ }
  report.resolutions = { cli, spec, ajv, patchedRoot, directCli, legacyAjv }
  assert.equal(ajv.version, '8.18.0', 'Consumer Ajv override did not apply')
  assert.equal(patchedRoot.version, '3.1.9', 'Consumer patched fast-uri missing')
  assert.equal(legacyAjv.version, '3.1.8', 'Legacy Ajv fast-uri was not isolated')
  assert.notEqual(legacyAjv.entry, patchedRoot.entry, 'Legacy Ajv URI module was deduplicated')
  const lock = await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8')
  assert(/^lockfileVersion: ['"]?6(?:\.0)?['"]?/m.test(lock), 'Expected pnpm 8 lockfile')
  assert(lock.includes(archives.spec), 'Unpublished Spec is not bound to its exact archive')
}

const probeSource = `const { createRequire } = require('node:module')
const rootRequire = createRequire(__filename)
const cliEntry = rootRequire.resolve('@seed-ship/mcp-ui-cli')
const fromCli = createRequire(cliEntry)
const AjvModule = fromCli('ajv')
const Ajv = typeof AjvModule === 'function' ? AjvModule : AjvModule.default
const directUri = rootRequire('fast-uri')
const counts = { parse: 0, serialize: 0, resolve: 0 }
for (const key of Object.keys(counts)) {
  const original = directUri[key]
  directUri[key] = function (...args) { counts[key]++; return original.apply(this, args) }
}
const compiled = []
const originalCompile = Ajv.prototype.compile
Ajv.prototype.compile = function (schema, ...args) {
  compiled.push({ schemaId: schema && schema.$id || null,
    patchedResolver: this.opts.uriResolver === directUri,
    resolverParse: typeof this.opts.uriResolver?.parse })
  return originalCompile.call(this, schema, ...args)
}
const originalExit = process.exit
process.exit = function (code) {
  process.stdout.write('MCPUI_FAST_URI_PROBE=' + JSON.stringify({ compiled, counts, exit: code }) + '\\n')
  return originalExit.call(process, code)
}
;(async () => {
  const [format, command, file] = process.argv.slice(2)
  const cli = format === 'esm' ? await import('@seed-ship/mcp-ui-cli') : rootRequire('@seed-ship/mcp-ui-cli')
  if (command === 'validate') await cli.validateCommand(file, { strict: true })
  else if (command === 'test-examples') await cli.testExamplesCommand(file, {})
  else throw Error('Unknown probe command: ' + command)
})().catch(error => { console.error(error); process.exit(2) })
`

async function probeRuntime() {
  const registry = { version: '1.0.0', components: [{ id: 'metric-card', type: 'metric', name: 'Metric Card',
    schema: { $id: 'https://mcp-ui.dev/tests/fast-uri-component.json', type: 'object',
      definitions: { Score: { type: 'integer' } },
      properties: { value: { $ref: '#/definitions/Score' } },
      required: ['value'], additionalProperties: false },
    examples: [{ name: 'Good', params: { value: 7 } }, { name: 'Bad', params: { value: 'wrong' } }] }] }
  const registryPath = join(consumer, 'registry.json')
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n')
  await writeFile(join(consumer, 'probe.cjs'), probeSource)
  const failures = []
  for (const format of ['esm', 'cjs']) for (const command of ['validate', 'test-examples']) {
    const result = run('node', ['probe.cjs', format, command, registryPath], 20_000)
    const output = result.stdout + '\n' + result.stderr
    const line = result.stdout?.split('\n').findLast(value => value.startsWith('MCPUI_FAST_URI_PROBE='))
    const evidence = line ? JSON.parse(line.slice('MCPUI_FAST_URI_PROBE='.length)) : null
    report.probes[`${format}:${command}`] = { ...result, evidence }
    const expectedExit = command === 'validate' ? 0 : 1
    if (result.status !== expectedExit || !evidence || evidence.exit !== expectedExit) failures.push(`${format}:${command} exit or marker`)
    if (!evidence?.compiled.length || !evidence.compiled.every(item => item.patchedResolver && item.resolverParse === 'function')) failures.push(`${format}:${command} did not compile with patched resolver`)
    if (!evidence || evidence.counts.parse < 1 || evidence.counts.serialize < 1 || evidence.counts.resolve < 1) failures.push(`${format}:${command} did not call patched parse/serialize/resolve`)
    if (command === 'validate' && !/Registry is valid/.test(output)) failures.push(`${format}:validate did not accept registry`)
    if (command === 'test-examples' && (!/1 passed/.test(output) || !/1 failed/.test(output) ||
      !/must be integer/.test(output) || /Unexpected error/.test(output))) failures.push(`${format}:test-examples did not distinguish examples`)
  }
  assert.deepEqual(failures, [], `Runtime resolver proof failed: ${failures.join('; ')}`)
  assert.equal(report.resolutions.directCli?.version, '3.1.9', 'CLI does not resolve patched fast-uri')
  assert.equal(report.resolutions.directCli?.entry, report.resolutions.patchedRoot.entry, 'CLI resolver is not direct patched module')
  assert.equal(report.archives.cli.dependencies?.['fast-uri'], '^3.1.9', 'Published CLI must declare its corrected resolver floor')
}

try {
  for (const kind of Object.keys(names)) await inspectArchive(kind)
  const manifest = { name: 'mcpui-fast-uri-independent-consumer', private: true, version: '0.0.0',
    type: 'module', packageManager: 'pnpm@8.15.0',
    dependencies: { [names.spec]: `file:${archives.spec}`, [names.cli]: `file:${archives.cli}`,
      'fast-uri': '3.1.9' },
    pnpm: { overrides: { [names.spec]: `file:${archives.spec}`, ajv: '8.18.0',
      [`${names.cli}>fast-uri`]: '3.1.9',
      'ajv@8.18.0>fast-uri': '3.1.8' } } }
  await writeFile(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  report.toolchain.node = run('node', ['--version'])
  report.toolchain.pnpm = run('pnpm', ['--version'])
  assert.equal(report.toolchain.pnpm.stdout.trim(), '8.15.0', 'Consumer must use pnpm 8.15.0')
  report.install = run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile', '--config.auto-install-peers=false'])
  assert.equal(report.install.status, 0, `Consumer install failed: ${report.install.stderr}`)
  await inspectResolutions()
  await probeRuntime()
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failures.push(error.stack ?? String(error))
} finally {
  await mkdir(dirname(reportPath), { recursive: true })
  for (const [name, file, suffix] of [
    ['consumerManifest', join(consumer, 'package.json'), '.consumer-package.json'],
    ['lock', join(consumer, 'pnpm-lock.yaml'), '.lock.yaml'],
  ]) {
    try {
      const bytes = await readFile(file)
      const target = reportPath + suffix
      await writeFile(target, bytes)
      report.artifacts[name] = { path: target, sha256: sha256(bytes) }
    } catch (error) {
      report.failures.push(`${name} artifact unavailable: ${error.message}`)
      if (report.status === 'passed') report.status = 'failed'
    }
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
  console.log(`MCPUI_FAST_URI_REPORT=${reportPath}`)
  console.log(JSON.stringify({ status: report.status, consumer, report: reportPath, failures: report.failures }, null, 2))
  if (report.status !== 'passed') process.exitCode = 1
}
