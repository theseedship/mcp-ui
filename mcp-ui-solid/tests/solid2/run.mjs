#!/usr/bin/env node
/** Creates a genuine tarball host. No implicit install, pack, publish, or workspace links. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, cp, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { qualifyBrowser } from './browser.mjs'

const here = dirname(fileURLToPath(import.meta.url)), sourceRoot = resolve(here, '../../..')
export const hasMigrationDiagnostic = text => /\[(?:STRICT_READ_UNTRACKED|REACTIVE_WRITE_IN_OWNED_SCOPE|EFFECT_RELAY_TEAR|EFFECT_WRITES_OWN_SOURCE|PRIMITIVE_IN_[A-Z_]+|MISSING_EFFECT_FN|NO_OWNER_[A-Z_]+|SSR_[A-Z_]+)\]|hydration (?:key miss|completed[^\n]*unclaimed|mismatch|error)/i.test(text)
export const hasBareZoomImport = text => /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?(['"`])chartjs-plugin-zoom\1\s*\)/.test(text)

async function auditClientZoomGraph(root) {
  const javascript = [], bareImports = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        javascript.push(relative(root, path))
        if (hasBareZoomImport(await readFile(path, 'utf8'))) bareImports.push(relative(root, path))
      }
    }
  }
  await visit(root)
  return { javascript, bareImports }
}
export const pins = Object.freeze({
  'solid-js': '2.0.0-rc.19', '@solidjs/web': '2.0.0-rc.19', '@solidjs/signals': '2.0.0-rc.19',
  '@solidjs/compiler': '2.0.0-rc.19', '@solidjs/babel-plugin': '2.0.0-rc.19',
  '@solidjs/vite-plugin': '3.0.0-next.51', '@babel/core': '7.29.6', '@types/node': '22.19.11', vite: '8.3.5', typescript: '5.9.3',
  '@tailwindcss/vite': '4.3.3', tailwindcss: '4.3.3',
})
export const enginePins = Object.freeze({
  '@antv/g6': '5.1.0', '@duckdb/duckdb-wasm': '1.32.0', '@tanstack/virtual-core': '3.13.18',
  'chart.js': '4.5.1', 'chartjs-plugin-zoom': '2.2.0', 'highlight.js': '11.11.1',
  katex: '0.18.4', leaflet: '1.9.4', 'leaflet.markercluster': '1.5.3', 'protomaps-leaflet': '4.1.1',
})
export function manifestFor(tarball, specTarball, profile = 'full') {
  assert(isAbsolute(tarball), 'Tarball path must be absolute')
  assert(['full', 'optional-absent'].includes(profile), 'Unknown profile')
  return { name: 'mcp-ui-solid2-tarball-consumer', version: '0.0.0', private: true, type: 'module',
    packageManager: 'pnpm@8.15.0', scripts: { dev: 'vite', build: 'vite build', serve: 'node dist/server/node.js', typecheck: 'tsc --noEmit' },
    dependencies: { '@seed-ship/mcp-ui-solid': `file:${tarball}`,
      '@seed-ship/mcp-ui-spec': specTarball ? `file:${specTarball}` : '6.0.0',
      'solid-js': pins['solid-js'], '@solidjs/web': pins['@solidjs/web'], ...(profile === 'full' ? enginePins : {}) },
    devDependencies: Object.fromEntries(Object.entries(pins).filter(([key]) => !['solid-js', '@solidjs/web'].includes(key))),
    // Pin the Solid 2 compiler/runtime family, never alias a Solid 1 package.
    pnpm: { overrides: {
      ...Object.fromEntries(Object.entries(pins).filter(([key]) => key.startsWith('@solidjs/') || key === 'solid-js')),
      ...(specTarball ? { '@seed-ship/mcp-ui-spec': `file:${specTarball}` } : {}),
    } },
  }
}
export function validateDestination(path) {
  assert(path && isAbsolute(path), '--consumer must be an absolute dedicated durable directory')
  const rel = relative(sourceRoot, path)
  assert(rel.startsWith(`..${sep}`) || isAbsolute(rel), 'Consumer must be outside this repository')
  assert(![sep, process.env.HOME, '/tmp'].includes(path) && !path.startsWith('/tmp/'), 'Choose a dedicated durable directory, not a broad or temporary destination')
}
async function artifact(path) {
  assert(path && isAbsolute(path) && path.endsWith('.tgz') && (await stat(path)).isFile(), 'Expected absolute regular .tgz')
  return { path: await realpath(path), sha256: createHash('sha256').update(await readFile(path)).digest('hex') }
}
async function prepare(options) {
  validateDestination(options.consumer)
  const tarball = await artifact(options.tarball), spec = options['spec-tarball'] ? await artifact(options['spec-tarball']) : undefined
  const consumer = resolve(options.consumer), profile = options.profile || 'full'
  await mkdir(consumer, { recursive: true })
  validateDestination(await realpath(consumer))
  assert.equal((await readdir(consumer)).length, 0, 'Consumer must be empty; existing files are never overwritten')
  const manifest = manifestFor(tarball.path, spec?.path, profile)
  for (const entry of await readdir(resolve(here, 'consumer'))) {
    await cp(resolve(here, 'consumer', entry), resolve(consumer, entry), { recursive: true, errorOnExist: true, force: false,
      filter: path => profile === 'full' || !path.endsWith(`${sep}Engines.tsx`),
    })
  }
  if (profile === 'optional-absent') await cp(resolve(here, 'optional/App.tsx'), resolve(consumer, 'src/App.tsx'))
  await cp(resolve(here, 'import-probe.mjs'), resolve(consumer, 'import-probe.mjs'))
  await writeFile(resolve(consumer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(resolve(consumer, '.npmrc'), 'auto-install-peers=false\nstrict-peer-dependencies=true\n')
  await writeFile(resolve(consumer, 'qualification-input.json'), JSON.stringify({ tarball, spec, profile, pins, preparedAt: new Date().toISOString() }, null, 2) + '\n')
  console.log(JSON.stringify({ consumer, profile, tarball, installed: false,
    next: 'Install explicitly with pnpm install --ignore-scripts, then use probe/run. No installation was performed.' }, null, 2))
}
async function verifyConsumer(consumer) {
  validateDestination(consumer)
  const input = JSON.parse(await readFile(resolve(consumer, 'qualification-input.json'), 'utf8'))
  assert.equal((await artifact(input.tarball.path)).sha256, input.tarball.sha256, 'Tarball changed after preparation')
  if (input.spec) assert.equal((await artifact(input.spec.path)).sha256, input.spec.sha256, 'Spec tarball changed after preparation')
  const packageRoot = await realpath(resolve(consumer, 'node_modules/@seed-ship/mcp-ui-solid'))
  assert(packageRoot.startsWith((await realpath(consumer)) + sep), 'Package realpath escapes the isolated consumer')
  const installed = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  assert.equal(installed.version, '8.0.0-solid2.0', 'Review harness pins for another preview version')
  const req = createRequire(resolve(consumer, 'package.json')), actualPins = {}
  for (const [name, expected] of Object.entries(pins)) {
    let entry
    try { entry = req.resolve(`${name}/package.json`) }
    catch { entry = req.resolve(name) }
    let dir = dirname(entry)
    for (;;) {
      let pkg
      try { pkg = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8')) } catch { /* ascend */ }
      if (pkg?.name === name) { actualPins[name] = pkg.version; break }
      const parent = dirname(dir); assert.notEqual(parent, dir, `Manifest missing for ${name}`); dir = parent
    }
    assert.equal(actualPins[name], expected, `Unexpected installed ${name}`)
  }
  return { input, packageRoot, version: installed.version, actualPins }
}
async function freePort() {
  const server = createServer()
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()))
  return port
}
function subprocess(command, args, cwd, log, env = {}) {
  const output = createWriteStream(log, { flags: 'wx' }), child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false })
  let settled = false
  const done = new Promise((accept, reject) => {
    child.once('error', error => { settled = true; output.end(); reject(error) })
    child.once('close', (code, signal) => { settled = true; output.end(); accept({ code, signal }) })
  })
  void done.catch(() => {})
  return { child, done, async stop() {
    if (settled) return
    process.kill(-child.pid, 'SIGTERM')
    await Promise.race([done, new Promise(done => setTimeout(done, 3000))])
    if (!settled) { process.kill(-child.pid, 'SIGKILL'); await done }
  } }
}
async function ready(url, handle) {
  for (let attempt = 0; attempt < 160; attempt++) {
    assert.equal(handle.child.exitCode, null, 'Consumer server exited early; inspect its log')
    try {
      const response = await fetch(url, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(2000) })
      if (response.ok) return await response.text()
      if (response.status >= 500) throw Error(`SSR failed ${response.status}: ${(await response.text()).slice(0, 1200)}`)
    } catch (error) { if (error.message.startsWith('SSR failed')) throw error }
    await new Promise(done => setTimeout(done, 250))
  }
  throw Error('Consumer readiness exceeded 40 seconds')
}
async function probe(consumer) {
  const info = await verifyConsumer(consumer)
  const child = spawn(process.execPath, [resolve(consumer, 'import-probe.mjs'), info.input.profile], { cwd: consumer, stdio: 'inherit' })
  const code = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done) })
  assert.equal(code, 0, 'Public import probe failed; see consumer/import-probe-result.json')
}
async function run(options) {
  const consumer = options.consumer, info = await verifyConsumer(consumer), mode = options.mode || 'both'
  assert(['dev', 'production', 'both'].includes(mode), 'Use --mode dev|production|both')
  const resultDir = resolve(consumer, 'qualification-results', new Date().toISOString().replaceAll(':', '-'))
  await mkdir(resultDir, { recursive: true })
  const report = { startedAt: new Date().toISOString(), node: process.version, ...info, modes: {}, status: 'running' }
  try {
    for (const current of mode === 'both' ? ['dev', 'production'] : [mode]) {
      if (current === 'production') {
        const build = subprocess('pnpm', ['exec', 'vite', 'build'], consumer, resolve(resultDir, 'production-build.log'))
        assert.equal((await build.done).code, 0, 'Optimized consumer build failed')
        for (const path of ['dist/server/server.js', 'dist/server/node.js', 'dist/client/.vite/manifest.json']) await access(resolve(consumer, path))
        report.productionZoomGraph = await auditClientZoomGraph(resolve(consumer, 'dist/client'))
        assert.deepEqual(report.productionZoomGraph.bareImports, [], 'Optimized client retained a bare chartjs-plugin-zoom import')
      }
      const port = await freePort(), url = `http://127.0.0.1:${port}/`, log = resolve(resultDir, `${current}-server.log`)
      const server = current === 'dev'
        ? subprocess('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], consumer, log)
        : subprocess(process.execPath, ['dist/server/node.js'], consumer, log, { PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' })
      try {
        const html = await ready(url, server)
        await writeFile(resolve(resultDir, `${current}-ssr.html`), html)
        const markers = info.input.profile === 'full'
          ? ['ssr-sentinel', 'Hydrated fixture text', 'Fixture values', 'proof.pdf']
          : ['ssr-sentinel', 'Optional consumer text', 'Optional values']
        for (const marker of markers) assert(html.includes(marker), `SSR omitted ${marker}`)
        report.modes[current] = await qualifyBrowser({ url, resultDir, mode: current, profile: info.input.profile })
      } finally { await server.stop() }
      assert(!hasMigrationDiagnostic(await readFile(log, 'utf8')), 'SSR migration diagnostics emitted; inspect server log')
    }
    report.status = 'passed'
  } catch (error) { report.status = 'failed'; report.error = error.stack || String(error); throw error }
  finally { await writeFile(resolve(resultDir, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(`Evidence: ${resultDir}`) }
}
export async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv, options = {}
  for (let index = 0; index < rest.length; index += 2) {
    assert(rest[index].startsWith('--') && rest[index + 1] && !rest[index + 1].startsWith('--'), 'Expected --key value')
    options[rest[index].slice(2)] = rest[index + 1]
  }
  if (command === 'prepare') return prepare(options)
  if (command === 'probe') return probe(options.consumer)
  if (command === 'run') return run(options)
  throw Error('Usage: run.mjs prepare --tarball /absolute/solid.tgz --consumer /durable/empty/path [--spec-tarball /absolute/spec.tgz] [--profile full|optional-absent]\nrun.mjs probe --consumer /durable/path\nrun.mjs run --consumer /durable/path [--mode dev|production|both]')
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error); process.exitCode = 1 })
