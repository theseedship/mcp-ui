import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_ENTRIES, assertCompiledModule, browserConditions, browserEntrySource, validateConsumerPath } from './dist-browser.mjs'

test('the exact ten public entry points are imported by plain JavaScript, without a compiler plugin', () => {
  assert.equal(PUBLIC_ENTRIES.length, 10)
  const code = browserEntrySource()
  for (const entry of PUBLIC_ENTRIES) {
    const specifier = '@seed-ship/mcp-ui-solid' + (entry === '.' ? '' : entry.slice(1))
    assert(code.includes(JSON.stringify(specifier)))
  }
  assert(code.includes('createComponent(public0.UIResourceRenderer'))
  assert(!code.includes('@solidjs/vite-plugin'))
  assert(!code.includes('/src/'))
  assert(!code.includes('createDuckDB'))
  assert(!code.includes('<UIResourceRenderer'))
})
test('browser resolution never advertises solid, node or worker conditions', () => {
  assert.deepEqual(browserConditions('dev'), ['browser', 'development'])
  assert.deepEqual(browserConditions('production'), ['browser', 'production'])
})
test('the provenance guard rejects package source and server output but allows compiler primitives', () => {
  const root = '/durable/consumer/node_modules/@seed-ship/mcp-ui-solid'
  assert.equal(assertCompiledModule(root + '/dist/index.js', root), true)
  assert.equal(assertCompiledModule(root + '/dist/hooks.js?foo=1', root), true)
  assert.throws(() => assertCompiledModule(root + '/src/index.ts', root), /forbidden MCPUI source/)
  assert.throws(() => assertCompiledModule(root + '/dist/server/index.js', root), /server distribution/)
  assert.throws(() => assertCompiledModule(root + '/dist/file.tsx', root), /Non-JavaScript/)
  assert.equal(assertCompiledModule('/durable/consumer/node_modules/@solidjs/web/src/index.ts', root), false)
})
test('rejects workspace and broad destinations', () => {
  for (const value of ['.', '/', '/tmp', '/tmp/probe', process.env.HOME]) assert.throws(() => validateConsumerPath(value))
  assert.throws(() => validateConsumerPath(new URL('../../..', import.meta.url).pathname))
  assert.doesNotThrow(() => validateConsumerPath('/home/nico/worktrees/mcp-ui-solid2-consumer-full-q2-20261023'))
})
