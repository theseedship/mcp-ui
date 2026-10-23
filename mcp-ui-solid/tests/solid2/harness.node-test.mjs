import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manifestFor, pins, enginePins, validateDestination, hasMigrationDiagnostic, hasBareZoomImport } from './run.mjs'
import { EXPECTED_STREAM_ERROR, isExpectedStreamError } from './browser.mjs'

test('full host pins runtime/compiler and explicit optional engines without workspace dependencies', () => {
  const manifest = manifestFor('/durable/solid.tgz', '/durable/spec.tgz')
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-solid'], 'file:/durable/solid.tgz')
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-spec'], 'file:/durable/spec.tgz')
  for (const [key, value] of Object.entries(pins)) assert.equal({ ...manifest.dependencies, ...manifest.devDependencies }[key], value)
  for (const [key, value] of Object.entries(enginePins)) assert.equal(manifest.dependencies[key], value)
  assert(!JSON.stringify(manifest).includes('workspace:'))
})
test('optional-absent host declares no optional engines and fixes Spec version', () => {
  const manifest = manifestFor('/durable/solid.tgz', undefined, 'optional-absent')
  for (const key of Object.keys(enginePins)) assert.equal(manifest.dependencies[key], undefined)
  assert.equal(manifest.dependencies['@seed-ship/mcp-ui-spec'], '5.7.0')
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
    '[REACTIVE_WRITE_IN_OWNED_SCOPE]', '[SSR_UNSAFE_WRITE]']) assert(hasMigrationDiagnostic(text), text)
  assert(!hasMigrationDiagnostic('SSR ready; HTTP 200'))
})
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
