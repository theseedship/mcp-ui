#!/usr/bin/env node
/** Qualify packed stable packages from a fresh, non-workspace consumer. */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, realpath, readdir, stat, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const names = { spec: '@seed-ship/mcp-ui-spec', solid: '@seed-ship/mcp-ui-solid', cli: '@seed-ship/mcp-ui-cli' }
const entries = {
  spec: ['.', './schemas'],
  solid: ['.', './components', './hooks', './types', './validation', './types-only', './adapters', './adapters/presentation', './plugins/duckdb', './plugins/katex'],
  cli: ['.'],
}
const options = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1]
  assert(key?.startsWith('--') && value && !value.startsWith('--'), `Expected --name value, got ${key ?? '<end>'}`)
  assert(!options.has(key), `Duplicate argument ${key}`)
  options.set(key, value)
}
const get = key => { const value = options.get(`--${key}`); assert(value, `Missing --${key}`); return value }
const profile = options.get('--profile') ?? 'full'
assert(['full', 'optional-absent'].includes(profile), 'Profile must be full or optional-absent')
const tarballs = Object.fromEntries(Object.keys(names).map(kind => [kind, resolve(get(kind))]))
const expected = Object.fromEntries(Object.keys(names).map(kind => [kind, get(`expect-${kind}`)]))
const browserDeps = options.get('--browser-deps') ? resolve(options.get('--browser-deps')) : undefined
const browserEnabled = options.get('--browser') !== 'false'
const consumer = await mkdtemp(join(tmpdir(), 'mcpui-zod4-consumer-'))
const report = { profile, consumer, packages: {}, probes: {}, browser: null, failures: [] }
const run = (command, args, cwd = consumer) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, CI: 'true', npm_config_auto_install_peers: 'false' }, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.signal})\n${result.stdout}\n${result.stderr}`)
  return result.stdout.trim()
}
const inside = (path, directory) => path === directory || path.startsWith(directory + sep)
const semverAtLeast466 = value => {
  const parts = /^([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(value)
  return !!parts && (Number(parts[1]) > 4 || (Number(parts[1]) === 4 && (Number(parts[2]) > 6 || (Number(parts[2]) === 6 && Number(parts[3]) >= 6))))
}

async function tarball(kind) {
  const path = tarballs[kind]
  assert((await stat(path)).isFile(), `${kind} tarball is not a file`)
  const bytes = await readFile(path)
  assert(bytes.length < 64 * 1024 * 1024, `${kind} tarball exceeds 64 MiB`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const members = execFileSync('tar', ['-tzf', path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split('\n')
  assert(members.every(name => name.startsWith('package/') && !name.split('/').includes('..')), `${kind} has unsafe tar paths`)
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 }))
  assert.equal(manifest.name, names[kind], `${kind} package name`)
  assert.equal(manifest.version, expected[kind], `${kind} version`)
  if (kind !== 'spec') {
    assert.equal(manifest.dependencies?.[names.spec], '^6.0.0', `${kind} must declare the new public Spec minimum`)
  }
  for (const group of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[group] ?? {})) {
      assert(!/^(workspace:|link:|file:)/.test(version), `${kind} leaves ${name} at ${version}`)
    }
  }
  for (const entry of entries[kind]) assert(manifest.exports?.[entry], `${kind} lacks public export ${entry}`)
  report.packages[kind] = { name: manifest.name, version: manifest.version, sha256, tarball: path, dependencies: manifest.dependencies }
}

async function scanLegacy(path) {
  const hits = []
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, item.name)
      if (item.isDirectory()) await walk(file)
      else if (item.isFile() && /\.(?:[cm]?js|[cm]?ts|tsx)$/.test(item.name)) {
        const data = await readFile(file, 'utf8')
        if (/['"]zod\/v3(?:\/[^'"]*)?['"]|['"]zod\/lib\//.test(data)) hits.push(file.slice(path.length + 1))
      }
    }
  }
  await walk(path)
  assert.deepEqual(hits, [], `Legacy Zod imports in packed ${path}: ${hits.join(', ')}`)
}

async function packageRoot(entry, name) {
  for (let directory = dirname(entry); directory !== dirname(directory); directory = dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
      if (manifest.name === name) return await realpath(directory)
    } catch { /* continue to parent */ }
  }
  throw new Error(`Cannot locate installed ${name} from ${entry}`)
}

async function probeInstalled() {
  const require = createRequire(join(consumer, 'package.json'))
  for (const [kind, name] of Object.entries(names)) {
    const installed = await realpath(join(consumer, 'node_modules', ...name.split('/')))
    assert(inside(installed, consumer), `${kind} resolves outside independent consumer: ${installed}`)
    const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
    assert.equal(manifest.version, expected[kind], `${kind} installed version`)
    await scanLegacy(installed)
    const entry = require.resolve(name)
    const zodManifest = createRequire(entry).resolve('zod/package.json')
    const zod = JSON.parse(await readFile(zodManifest, 'utf8'))
    assert(semverAtLeast466(zod.version), `${kind} resolves unpatched Zod ${zod.version}`)
    assert(inside(await realpath(zodManifest), consumer), `${kind} Zod resolves outside consumer`)
    report.packages[kind].installed = installed
    report.packages[kind].zod = { version: zod.version, path: await realpath(zodManifest) }
    report.packages[kind].cjsEntry = entry
  }
  for (const kind of ['solid', 'cli']) {
    const resolved = createRequire(report.packages[kind].cjsEntry).resolve(names.spec)
    assert.equal(await packageRoot(resolved, names.spec), report.packages.spec.installed, `${kind} resolves another Spec`)
  }
  const lock = await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8')
  assert(/^lockfileVersion: ['"]?6(?:\.0)?['"]?/m.test(lock), 'Independent consumer did not use pnpm 8 lockfile v6')
  assert(!/(?:^|\s)(?:workspace:|link:)/m.test(lock), 'Consumer lock has workspace/link references')
  assert(lock.includes(tarballs.spec), 'Consumer lock did not bind unpublished Spec to the exact local tarball')
}

async function probeEntries() {
  const ids = []
  for (const [kind, name] of Object.entries(names)) {
    for (const entry of entries[kind]) {
      const id = name + (entry === '.' ? '' : entry.slice(1))
      ids.push({ kind, entry, id })
    }
  }
  const checks = `
    if (item.id === '@seed-ship/mcp-ui-spec/schemas' && typeof m.GridPositionSchema?.parse !== 'function') throw Error('Spec schemas runtime missing');
    if (item.id === '@seed-ship/mcp-ui-solid/validation' && typeof m.validateComponent !== 'function') throw Error('Solid validation runtime missing');
    if (item.id === '@seed-ship/mcp-ui-cli' && ['validateCommand','generateTypesCommand','testExamplesCommand','diffCommand'].some(key => typeof m[key] !== 'function')) throw Error('CLI command export missing');`
  const body = format => `const ids = ${JSON.stringify(ids)}; const results=[];
for (const item of ids) { try { const m = ${format === 'esm' ? 'await import(item.id)' : 'require(item.id)'}; ${checks}
  results.push({ ...item, status: 'passed' });
} catch(error) { results.push({ ...item, status: 'failed', error: error.message, code: error.code }); } }
console.log(JSON.stringify(results));`
  await writeFile(join(consumer, 'probe.mjs'), body('esm'))
  await writeFile(join(consumer, 'probe.cjs'), body('cjs'))
  const matrix = {}
  for (const [format, file] of [['esm', 'probe.mjs'], ['cjs', 'probe.cjs']]) {
    const results = JSON.parse(run('node', [file]))
    assert.equal(results.length, ids.length, `${format} entry count changed`)
    for (const result of results) {
      if (result.status === 'passed') continue
      if (result.kind === 'solid' && ['.', './components'].includes(result.entry) && /Client-only API called on the server side/.test(result.error)) {
        result.status = 'baseline-client-only-node-condition'
      } else if (profile === 'optional-absent' && result.id === '@seed-ship/mcp-ui-solid/plugins/katex' && /katex/.test(result.error)) {
        result.status = 'expected-missing-optional-katex'
      }
    }
    matrix[format] = results
  }
  report.probes.entries = matrix
  const failures = Object.values(matrix).flat().filter(item => item.status === 'failed')
  assert.deepEqual(failures, [], `Unexpected public-entry failures: ${JSON.stringify(failures)}`)
  for (const format of ['esm', 'cjs']) {
    assert.equal(matrix[format].filter(item => item.status === 'baseline-client-only-node-condition').length, 2, `Solid Node client-only baseline classification changed in ${format}`)
  }
}

async function probeCLI() {
  const registry = { version: '1.0.0', components: [{ id: 'metric-card', type: 'metric', name: 'Metric Card', schema: { type: 'object', properties: {} }, examples: [{ name: 'Example', params: { title: 'Score', value: 1 } }] }] }
  await writeFile(join(consumer, 'registry.json'), JSON.stringify(registry))
  await writeFile(join(consumer, 'registry-ajv-invalid.json'), JSON.stringify({ ...registry, components: [{ ...registry.components[0], security: { allowedDomains: ['not a hostname!'] } }] }))
  const outcomes = {}
  for (const [format, flag, code] of [
    ['esm', '--input-type=module', "import { validateCommand } from '@seed-ship/mcp-ui-cli'; await validateCommand(process.argv[1], { strict: true })"],
    ['cjs', '-e', "const { validateCommand } = require('@seed-ship/mcp-ui-cli'); validateCommand(process.argv[1], { strict: true })"],
  ]) {
    outcomes[format] = {}
    for (const [caseName, file, expectedExit] of [['valid', 'registry.json', 0], ['ajv-hostname-invalid', 'registry-ajv-invalid.json', 1]]) {
      const args = format === 'esm' ? [flag, '-e', code, file] : [flag, code, file]
      const result = spawnSync('node', args, { cwd: consumer, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 })
      if (result.error) throw result.error
      assert.equal(result.status, expectedExit, `${format} CLI ${caseName}: ${result.stdout}\n${result.stderr}`)
      if (caseName === 'valid') assert(/Registry is valid/.test(result.stdout + result.stderr), `${format} CLI did not confirm valid registry`)
      else assert(/allowedDomains\/0.*hostname/.test(result.stdout + result.stderr), `${format} CLI did not reach Ajv hostname validation`)
      outcomes[format][caseName] = { exit: result.status, output: (result.stdout + result.stderr).trim().slice(-500) }
    }
  }
  report.probes.cli = outcomes
}

async function probeTypes() {
  const source = `import { GridPositionSchema, SecurityConstraintsSchema, MacroRunOutcomeSchema } from '${names.spec}/schemas';
import type { GridPosition, SecurityConstraints } from '${names.spec}';
import { validateComponent } from '${names.solid}/validation';
import type { UIComponent, ValidationResult } from '${names.solid}/validation';
import { UIResourceRenderer } from '${names.solid}';
import { UIResourceRenderer as SubpathRenderer } from '${names.solid}/components';
import { useStreamingUI } from '${names.solid}/hooks';
import type { UILayout as PublicLayout } from '${names.solid}/types';
import type { UILayout as TypesOnlyLayout } from '${names.solid}/types-only';
import { connectorResultToUILayout } from '${names.solid}/adapters';
import { createEvidenceLayout } from '${names.solid}/adapters/presentation';
import { createDuckDBPlugin } from '${names.solid}/plugins/duckdb';
${profile === 'full' ? `import { renderKatexMath } from '${names.solid}/plugins/katex';` : ''}
import type { z } from 'zod';
import * as cli from '${names.cli}';
type IsAny<T> = 0 extends (1 & T) ? true : false;
type Assert<T extends true> = T;
type _RootPropsNotAny = Assert<IsAny<Parameters<typeof UIResourceRenderer>[0]> extends false ? true : false>;
type _SubpathPropsNotAny = Assert<IsAny<Parameters<typeof SubpathRenderer>[0]> extends false ? true : false>;
type _RootReturnNotAny = Assert<IsAny<ReturnType<typeof UIResourceRenderer>> extends false ? true : false>;
const raw: z.input<typeof GridPositionSchema> = { colStart: 1, colSpan: 12 };
const position: GridPosition = GridPositionSchema.parse(raw);
const security: SecurityConstraints = SecurityConstraintsSchema.parse({});
const outcome: z.output<typeof MacroRunOutcomeSchema> = MacroRunOutcomeSchema.parse({ kind: 'raw', content: 'ok' });
const component: UIComponent = { id: 't', type: 'table', position, params: { columns: [{ key: 'v', label: 'Value' }], rows: [{ v: 'ok' }] } };
const result: ValidationResult = validateComponent(component);
const props: Parameters<typeof UIResourceRenderer>[0] = { content: component };
const publicLayout: PublicLayout | TypesOnlyLayout = { id: 'layout', components: [component], grid: { columns: 12, gap: '1rem' } };
void [security, outcome, result, props, publicLayout, cli, SubpathRenderer, useStreamingUI, connectorResultToUILayout, createEvidenceLayout, createDuckDBPlugin${profile === 'full' ? ', renderKatexMath' : ''}];
`
  await writeFile(join(consumer, 'contract.mts'), source)
  await writeFile(join(consumer, 'contract.cts'), source)
  for (const [mode, module, moduleResolution, files] of [
    ['nodenext', 'NodeNext', 'NodeNext', ['contract.mts', 'contract.cts']],
    ['bundler', 'ESNext', 'Bundler', ['contract.mts']],
  ]) {
    await writeFile(join(consumer, `tsconfig.${mode}.json`), JSON.stringify({ compilerOptions: { target: 'ES2022', module, moduleResolution, strict: true, noEmit: true, skipLibCheck: false, types: [] }, include: files }, null, 2))
    run(join(consumer, 'node_modules/.bin/tsc'), ['-p', `tsconfig.${mode}.json`, '--pretty', 'false'])
    report.probes[`${mode}Types`] = 'passed'
  }
}

try {
  for (const kind of Object.keys(names)) await tarball(kind)
  const manifest = {
    name: 'mcpui-zod4-independent-consumer', private: true, version: '0.0.0', type: 'module', packageManager: 'pnpm@8.15.0',
    dependencies: Object.fromEntries(Object.entries(names).map(([kind, name]) => [name, `file:${tarballs[kind]}`])),
    pnpm: { overrides: { [names.spec]: `file:${tarballs.spec}` } },
    devDependencies: { typescript: '5.9.3', 'solid-js': '1.9.17', zod: '4.6.6', vite: '6.4.5', 'vite-plugin-solid': '2.11.10' },
  }
  if (profile === 'full') Object.assign(manifest.devDependencies, { '@antv/g6': '5.1.0', leaflet: '1.9.4', 'leaflet.markercluster': '1.5.3', katex: '0.18.4' })
  await writeFile(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  report.toolchain = { node: run('node', ['--version']), pnpm: run('pnpm', ['--version']) }
  assert.equal(report.toolchain.pnpm, '8.15.0', 'Independent consumer must run producer pnpm 8.15.0')
  report.probes.install = run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile', '--config.auto-install-peers=false']).split('\n').slice(-3)
  await probeInstalled()
  if (options.get('--types-only') !== 'true') await probeEntries()
  await probeTypes()
  if (options.get('--types-only') !== 'true') await probeCLI()
  if (browserEnabled) {
    assert(browserDeps, 'Browser gate requires --browser-deps external node_modules path')
    const browser = spawnSync('node', [join(here, 'browser.mjs'), '--consumer', consumer, '--browser-deps', browserDeps, '--profile', profile], { cwd: consumer, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
    if (browser.error) throw browser.error
    const line = browser.stdout.trim().split('\n').findLast(line => line.startsWith('MCPUI_BROWSER_REPORT='))
    assert(line, 'Browser report is missing')
    report.browser = JSON.parse(line.slice('MCPUI_BROWSER_REPORT='.length))
    if (browser.status !== 0) throw new Error(`Browser gate failed: ${report.browser.failure ?? browser.stderr}`)
  }
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failures.push(error.stack ?? String(error))
} finally {
  const path = options.get('--report') ? resolve(options.get('--report')) : join(consumer, 'report.json')
  await mkdir(dirname(path), { recursive: true })
  report.artifacts = {}
  for (const [name, source, suffix] of [
    ['lock', join(consumer, 'pnpm-lock.yaml'), '.lock.yaml'],
    ['consumerManifest', join(consumer, 'package.json'), '.consumer-package.json'],
  ]) {
    try {
      const bytes = await readFile(source)
      const target = path + suffix
      await writeFile(target, bytes)
      report.artifacts[name] = { path: target, sha256: createHash('sha256').update(bytes).digest('hex') }
    } catch (error) {
      if (report.status === 'passed') { report.status = 'failed'; report.failures.push(`${name} evidence copy failed: ${error}`) }
    }
  }
  if (report.browser) {
    const target = path + '.browser.json'
    const bytes = JSON.stringify(report.browser, null, 2) + '\n'
    await writeFile(target, bytes)
    report.artifacts.browser = { path: target, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  await writeFile(path, JSON.stringify(report, null, 2) + '\n')
  console.log(`MCPUI_CONSUMER_REPORT=${path}`)
  console.log(JSON.stringify({ status: report.status, profile, consumer, report: path, failures: report.failures }, null, 2))
  if (report.status === 'passed' && options.get('--keep') === 'false' && options.has('--report')) await rm(consumer, { recursive: true })
  if (report.status !== 'passed') process.exitCode = 1
}
