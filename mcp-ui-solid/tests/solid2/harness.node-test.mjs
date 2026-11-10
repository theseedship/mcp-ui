import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { manifestFor, pins, enginePins, validateDestination, hasMigrationDiagnostic, hasBareZoomImport, subprocess } from './run.mjs'
import { EXPECTED_STREAM_ERROR, isExpectedStreamError } from './browser.mjs'
import { hasMathServerMigrationDiagnostic, processHandle } from '../katex/run.mjs'

test('RC.21 consumers use the current Vite plugin Node server option', async () => {
  for (const relative of ['./consumer/vite.config.ts', '../katex/consumer/vite.config.ts']) {
    const config = await readFile(new URL(relative, import.meta.url), 'utf8')
    assert.match(config, /nodeServer:\s*true/)
    assert.doesNotMatch(config, /\bnode:\s*true/)
  }
})

test('full host pins runtime/compiler and explicit optional engines without workspace dependencies', () => {
  const manifest = manifestFor('/durable/solid.tgz', '/durable/spec.tgz')
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-solid'], 'file:/durable/solid.tgz')
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-spec'], 'file:/durable/spec.tgz')
  assert.equal(manifest.pnpm.overrides['@seed-ship/mcp-ui-spec'], 'file:/durable/spec.tgz')
  for (const [key, value] of Object.entries(pins)) assert.equal({ ...manifest.dependencies, ...manifest.devDependencies }[key], value)
  for (const [key, value] of Object.entries(enginePins)) assert.equal(manifest.dependencies[key], value)
  assert(!JSON.stringify(manifest).includes('workspace:'))
})

test('production consumer explicitly retains the client manifest inspected by the runner', async () => {
  const config = await readFile(new URL('./consumer/vite.config.ts', import.meta.url), 'utf8')
  assert.match(config, /build:\s*\{\s*manifest:\s*true\s*\}/)
})
test('optional-absent host declares no optional engines and fixes Spec version', () => {
  const manifest = manifestFor('/durable/solid.tgz', undefined, 'optional-absent')
  for (const key of Object.keys(enginePins)) assert.equal(manifest.dependencies[key], undefined)
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-spec'], '6.0.0')
})
test('rejects unsafe/ambiguous inputs before creating a consumer', () => {
  assert.throws(() => manifestFor('relative.tgz'))
  assert.throws(() => manifestFor('/durable/solid.tgz', undefined, 'unknown'))
  for (const path of ['.', '/', '/tmp', '/tmp/ephemeral-consumer', process.env.HOME]) assert.throws(() => validateDestination(path))
  assert.doesNotThrow(() => validateDestination('/home/nico/worktrees/mcp-ui-solid2-consumer'))
})
test('server gate rejects ownership and both hydration namespace failure diagnostics', () => {
  for (const text of ['[NO_OWNER_EFFECT] scope missing', 'Hydration key miss for "42"',
    'Hydration completed with 29 unclaimed server-rendered nodes', '[STRICT_READ_UNTRACKED]',
    '[REACTIVE_WRITE_IN_OWNED_SCOPE]', '[EFFECT_RELAY_TEAR]',
    '[EFFECT_WRITES_OWN_SOURCE]', '[SSR_UNSAFE_WRITE]']) assert(hasMigrationDiagnostic(text), text)
  assert(!hasMigrationDiagnostic('SSR ready; HTTP 200'))
})
test('RC.21 CAUGHT_REACTIVE_READ remains fatal in general and KaTeX SSR gates', () => {
  for (const guard of [hasMigrationDiagnostic, hasMathServerMigrationDiagnostic]) {
    assert(guard('[CAUGHT_REACTIVE_READ] read was caught by an error boundary'))
    assert(!guard('SSR ready; HTTP 200'))
  }
})
for (const [name, start, guard] of [
  ['Solid 2 runner', subprocess, hasMigrationDiagnostic],
  ['KaTeX runner', processHandle, hasMathServerMigrationDiagnostic],
]) {
  test(`${name} waits for a delayed log finalization before done and stop settle`, async () => {
    let releaseFinal, finalStarted
    const finalizing = new Promise(resolve => { finalStarted = resolve })
    const chunks = []
    const output = new Writable({
      write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback() },
      final(callback) { releaseFinal = callback; finalStarted() },
    })
    const handle = start(process.execPath, ['-e', "process.stderr.write('[CAUGHT_REACTIVE_READ] tail')"],
      process.cwd(), 'unused-test-log', {}, () => output)
    let doneSettled = false, stopSettled = false
    void handle.done.then(() => { doneSettled = true }, () => { doneSettled = true })
    await finalizing
    assert.equal(doneSettled, false, 'done settled before the writable finalized')
    assert(guard(Buffer.concat(chunks).toString('utf8')), 'stderr diagnostic tail was not captured')
    const stopped = handle.stop()
    void stopped.then(() => { stopSettled = true }, () => { stopSettled = true })
    await Promise.resolve()
    assert.equal(stopSettled, false, 'stop settled before the writable finalized')
    releaseFinal()
    assert.deepEqual(await handle.done, { code: 0, signal: null })
    await stopped
    assert(doneSettled && stopSettled, 'done and stop did not settle after finalization')
  })
}
test('only the exact intentional SSE scope/message is classified as expected', () => {
  assert(isExpectedStreamError({ type: 'error', text: EXPECTED_STREAM_ERROR }))
  assert(!isExpectedStreamError({ type: 'warning', text: EXPECTED_STREAM_ERROR }))
  assert(!isExpectedStreamError({ type: 'error', text: EXPECTED_STREAM_ERROR.replace('useStreamingUI', 'otherScope') }))
  assert(!isExpectedStreamError({ type: 'error', text: EXPECTED_STREAM_ERROR.replace('Local fixture failed', 'Unexpected server failure') }))
  assert(!isExpectedStreamError({ type: 'error', text: '[REACTIVE_WRITE_IN_OWNED_SCOPE] unrelated error' }))
})
test('optimized zoom graph guard rejects bare imports in all literal spellings', () => {
  for (const code of ["import('chartjs-plugin-zoom')", 'import("chartjs-plugin-zoom")',
    'import(`chartjs-plugin-zoom`)', "import(/* @vite-ignore */ 'chartjs-plugin-zoom')"]) assert(hasBareZoomImport(code), code)
  assert(!hasBareZoomImport('import("./assets/chartjs-plugin-zoom-C8m.js")'))
  assert(!hasBareZoomImport('const name = "chartjs-plugin-zoom"'))
})
