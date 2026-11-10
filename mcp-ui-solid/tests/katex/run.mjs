#!/usr/bin/env node
/** Test-only real-tarball consumer. prepare never installs, packs, or publishes. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { cp, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { qualifyBrowser } from './browser.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const expectedVersion = '8.0.0-solid2.3'
const expectedPeer = '0.18.4 || 0.18.5'
const pins = Object.freeze({
  'solid-js': '2.0.0-rc.21', '@solidjs/web': '2.0.0-rc.21',
  '@solidjs/signals': '2.0.0-rc.21', '@solidjs/compiler': '2.0.0-rc.21',
  '@solidjs/babel-plugin': '2.0.0-rc.21', '@solidjs/vite-plugin': '3.0.0-next.57',
  '@babel/core': '7.29.6', '@types/node': '22.19.11',
  vite: '8.3.5', typescript: '5.9.3',
})
const migration = /\[(?:CAUGHT_REACTIVE_READ|STRICT_READ_UNTRACKED|REACTIVE_WRITE_IN_OWNED_SCOPE|EFFECT_RELAY_TEAR|EFFECT_WRITES_OWN_SOURCE|PRIMITIVE_IN_[A-Z_]+|MISSING_EFFECT_FN|NO_OWNER_[A-Z_]+|SSR_[A-Z_]+)\]|hydration (?:key miss|completed[^\n]*unclaimed|mismatch|error)/i
export const hasMathServerMigrationDiagnostic = text => migration.test(text)

function destination(path) {
  assert(path && isAbsolute(path), '--consumer needs an absolute dedicated directory')
  const rel = relative(repo, path)
  assert(rel.startsWith(`..${sep}`) || isAbsolute(rel), 'Consumer must be outside the repository')
  assert(![sep, process.env.HOME, '/tmp'].includes(path) && !path.startsWith('/tmp/'), 'Consumer must be durable and dedicated')
}
async function artifact(path) {
  assert(path && isAbsolute(path) && path.endsWith('.tgz') && (await stat(path)).isFile(), 'Expected absolute regular .tgz')
  const actual = await realpath(path)
  return { path: actual, sha256: createHash('sha256').update(await readFile(actual)).digest('hex') }
}
function manifest(tarball, spec, version) {
  const dependencies = {
    '@seed-ship/mcp-ui-solid': `file:${tarball}`, '@seed-ship/mcp-ui-spec': `file:${spec}`,
    'solid-js': pins['solid-js'], '@solidjs/web': pins['@solidjs/web'],
    ...(version === 'absent' ? {} : { katex: version }),
  }
  return { name: `mcp-ui-solid2-katex-${version}-consumer`, version: '0.0.0', private: true, type: 'module',
    packageManager: 'pnpm@8.15.0',
    scripts: { dev: 'vite', build: 'vite build', serve: 'node dist/server/node.js' },
    dependencies, devDependencies: Object.fromEntries(Object.entries(pins).filter(([key]) => !['solid-js', '@solidjs/web'].includes(key))),
  }
}
async function prepare(options) {
  const { consumer, version } = options
  destination(consumer)
  assert(['0.18.4', '0.18.5', 'absent'].includes(version), '--version must be 0.18.4, 0.18.5, or absent')
  const tarball = await artifact(options.tarball), spec = await artifact(options['spec-tarball'])
  await mkdir(consumer, { recursive: true })
  destination(await realpath(consumer))
  assert.equal((await readdir(consumer)).length, 0, 'Consumer must be empty')
  for (const entry of await readdir(resolve(here, 'consumer'))) {
    await cp(resolve(here, 'consumer', entry), resolve(consumer, entry), { recursive: true, errorOnExist: true, force: false })
  }
  if (version === 'absent') {
    await cp(resolve(consumer, 'src/AbsentApp.tsx'), resolve(consumer, 'src/App.tsx'), { force: true })
  }
  await cp(resolve(here, 'import-probe.mjs'), resolve(consumer, 'import-probe.mjs'))
  await writeFile(resolve(consumer, 'package.json'), JSON.stringify(manifest(tarball.path, spec.path, version), null, 2) + '\n')
  await writeFile(resolve(consumer, '.npmrc'), 'auto-install-peers=false\nstrict-peer-dependencies=true\n')
  await writeFile(resolve(consumer, 'qualification-input.json'), JSON.stringify({ version, tarball, spec, pins, preparedAt: new Date().toISOString() }, null, 2) + '\n')
  console.log(JSON.stringify({ consumer, version, installed: false, tarball, spec, next: 'Explicitly run pnpm --dir CONSUMER install --ignore-scripts, then probe and run.' }, null, 2))
}
async function installedPackage(consumer, name) {
  const packageRoot = await realpath(resolve(consumer, 'node_modules', name))
  assert(packageRoot.startsWith((await realpath(consumer)) + sep), `${name} escaped consumer`)
  return JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
}
async function verify(consumer) {
  destination(consumer)
  const input = JSON.parse(await readFile(resolve(consumer, 'qualification-input.json'), 'utf8'))
  assert(['0.18.4', '0.18.5', 'absent'].includes(input.version))
  assert.equal((await artifact(input.tarball.path)).sha256, input.tarball.sha256, 'Solid tarball changed')
  assert.equal((await artifact(input.spec.path)).sha256, input.spec.sha256, 'Spec tarball changed')
  const pkg = await installedPackage(consumer, '@seed-ship/mcp-ui-solid')
  assert.equal(pkg.version, expectedVersion)
  assert.equal(pkg.peerDependencies?.katex, expectedPeer)
  assert.equal(pkg.peerDependenciesMeta?.katex?.optional, true)
  assert(pkg.exports?.['.']?.import && pkg.exports?.['.']?.require && pkg.exports?.['./plugins/katex']?.import && pkg.exports?.['./plugins/katex']?.require,
    'Original root and plugin public exports missing')
  const actualPins = {}
  for (const [name, version] of Object.entries(pins)) {
    const installed = await installedPackage(consumer, name)
    actualPins[name] = installed.version
    assert.equal(installed.version, version, `Unexpected ${name}`)
  }
  const req = createRequire(resolve(consumer, 'package.json'))
  const pluginRequire = createRequire(req.resolve('@seed-ship/mcp-ui-solid/plugins/katex'))
  let pluginKatexVersion = null
  if (input.version !== 'absent') {
    assert.equal((await installedPackage(consumer, 'katex')).version, input.version)
    const resolvedManifest = await realpath(pluginRequire.resolve('katex/package.json'))
    assert(resolvedManifest.startsWith((await realpath(consumer)) + sep), 'Plugin KaTeX escaped consumer')
    pluginKatexVersion = JSON.parse(await readFile(resolvedManifest, 'utf8')).version
    assert.equal(pluginKatexVersion, input.version, 'Plugin resolves another KaTeX version')
  } else {
    await assert.rejects(() => realpath(resolve(consumer, 'node_modules/katex')), { code: 'ENOENT' })
    assert.throws(() => pluginRequire.resolve('katex'), { code: 'MODULE_NOT_FOUND' })
  }
  assert(req.resolve('@seed-ship/mcp-ui-solid'))
  return { input, installedVersion: pkg.version, peer: pkg.peerDependencies.katex, optional: true, actualPins, pluginKatexVersion }
}
async function freePort() {
  const server = createServer()
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok) })
  const port = server.address().port
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()))
  return port
}
export function processHandle(command, args, cwd, log, env = {}, outputFactory = path => createWriteStream(path, { flags: 'wx' })) {
  const output = outputFactory(log)
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false })
  let closed = false
  const done = new Promise((ok, fail) => {
    let finishing = false
    output.once('error', fail)
    const finish = (result, childError) => {
      if (finishing) return
      finishing = true; closed = true
      output.end(logError => childError || logError ? fail(childError || logError) : ok(result))
    }
    child.once('error', error => finish(undefined, error))
    child.once('close', (code, signal) => finish({ code, signal }))
  })
  void done.catch(() => {})
  return { child, done, async stop() {
    if (closed) return await done
    process.kill(-child.pid, 'SIGTERM')
    await Promise.race([done, new Promise(ok => setTimeout(ok, 3000))])
    if (!closed) process.kill(-child.pid, 'SIGKILL')
    return await done
  } }
}
async function ready(url, handle) {
  for (let i = 0; i < 160; i++) {
    assert.equal(handle.child.exitCode, null, 'Consumer server exited; inspect log')
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return await response.text()
      if (response.status >= 500) throw Error(`SSR ${response.status}: ${(await response.text()).slice(0, 1000)}`)
    } catch (error) { if (String(error).includes('SSR 5')) throw error }
    await new Promise(ok => setTimeout(ok, 250))
  }
  throw Error('Consumer server did not become ready')
}
async function probe(consumer) {
  await verify(consumer)
  const child = spawn(process.execPath, [resolve(consumer, 'import-probe.mjs')], { cwd: consumer, stdio: 'inherit' })
  const code = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok) })
  assert.equal(code, 0, 'Node ESM/CJS public import probe failed')
}
async function run(consumer) {
  const info = await verify(consumer)
  const resultDir = resolve(consumer, 'qualification-results', new Date().toISOString().replaceAll(':', '-'))
  await mkdir(resultDir, { recursive: true })
  const report = { startedAt: new Date().toISOString(), node: process.version, ...info, modes: {}, status: 'running' }
  try {
    for (const mode of ['dev', 'production']) {
      if (mode === 'production') {
        const build = processHandle('pnpm', ['exec', 'vite', 'build'], consumer, resolve(resultDir, 'build.log'))
        assert.equal((await build.done).code, 0, 'Consumer production build failed')
      }
      const port = await freePort(), url = `http://127.0.0.1:${port}/`
      const log = resolve(resultDir, `${mode}-server.log`)
      const server = mode === 'dev'
        ? processHandle('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], consumer, log)
        : processHandle(process.execPath, ['dist/server/node.js'], consumer, log, { PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' })
      try {
        const html = await ready(url, server)
        await writeFile(resolve(resultDir, `${mode}-ssr.html`), html)
        assert(html.includes('ssr-sentinel') && html.includes('$x_1$'), 'SSR escaped source/sentinel missing')
        assert(!html.includes('<math'), 'SSR unexpectedly ran the math adapter')
        assert(!html.includes('<img src=x'), 'SSR emitted live hostile markup')
        report.modes[mode] = await qualifyBrowser({ url, mode, version: info.input.version, resultDir })
      } finally { await server.stop() }
      assert(!hasMathServerMigrationDiagnostic(await readFile(log, 'utf8')), 'SSR migration/hydration diagnostic; inspect server log')
    }
    report.status = 'passed'
  } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); throw error }
  finally { await writeFile(resolve(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(`Evidence: ${resultDir}`) }
}
async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv, options = {}
  for (let i = 0; i < rest.length; i += 2) {
    assert(rest[i]?.startsWith('--') && rest[i + 1] && !rest[i + 1].startsWith('--'), 'Expected --key value')
    options[rest[i].slice(2)] = rest[i + 1]
  }
  if (command === 'prepare') return prepare(options)
  if (command === 'probe') return probe(options.consumer)
  if (command === 'run') return run(options.consumer)
  throw Error('Usage: run.mjs prepare --tarball ABS.tgz --spec-tarball ABS.tgz --consumer ABS --version 0.18.4|0.18.5|absent; run.mjs probe|run --consumer ABS')
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error); process.exitCode = 1 })
