import assert from 'node:assert/strict'
import test from 'node:test'
import { intentionalBoundaryError } from './browser.mjs'

const userAgent = 'Fixture Browser/1.0'
const prefix = '[@seed-ship/mcp-ui-solid:generative-ui] Component render failed: text '
const clientContext = {
  componentId: 'packed-client-boundary',
  componentType: 'text',
  errorMessage: '<mcpui-fixture-client-error>',
  errorStack: 'Error: <mcpui-fixture-client-error>\n    at ThrowingChild (/fixture.tsx:9:9)',
  renderDuration: 1.25,
  retryCount: 0,
  timestamp: '2026-11-18T12:00:00.000Z',
  userAgent,
  viewport: { width: 1440, height: 1100 },
}
const entry = (context, heading = prefix, type = 'error') => ({ type, text: heading + JSON.stringify(context) })

test('only exact intentional packed boundary error shape can be classified as expected', () => {
  assert.deepEqual(intentionalBoundaryError(entry(clientContext), userAgent), clientContext)
  const ssrContext = {
    ...clientContext,
    componentId: 'packed-ssr-boundary',
    errorMessage: '<mcpui-fixture-ssr-error>',
    errorStack: clientContext.errorStack.replace('client-error', 'ssr-error'),
  }
  assert.deepEqual(intentionalBoundaryError(entry(ssrContext), userAgent), ssrContext)

  for (const wrong of [
    entry(clientContext, prefix, 'warning'),
    entry(clientContext, prefix.replace('generative-ui', 'other-logger')),
    entry(clientContext, prefix.replace('failed: text', 'failed: graph')),
    entry({ ...clientContext, componentType: 'graph' }),
    entry({ ...clientContext, componentId: 'random-boundary' }),
    entry({ ...clientContext, errorMessage: 'Unexpected render failure' }),
    entry({ ...clientContext, errorStack: 'Error: something else' }),
    entry({ ...clientContext, renderDuration: -1 }),
    entry({ ...clientContext, retryCount: 1 }),
    entry({ ...clientContext, timestamp: 'not-a-date' }),
    entry({ ...clientContext, userAgent: 'Unexpected Browser/2.0' }),
    entry({ ...clientContext, viewport: { width: 1440, height: 0 } }),
    entry({ ...clientContext, viewport: { ...clientContext.viewport, extra: true } }),
    entry({ ...clientContext, otherFailure: 'Unexpected field' }),
    { type: 'error', text: prefix + 'bad structured output' },
  ]) {
    assert.equal(intentionalBoundaryError(wrong, userAgent), null, wrong.text)
  }
})

test('intentional boundary proof never classifies migration or random diagnostics as expected', () => {
  for (const diagnostic of ['[CAUGHT_REACTIVE_READ] caught reactive read', '[NO_OWNER_EFFECT] scope missing',
    '[STRICT_READ_UNTRACKED] illegal read', 'Hydration completed with unclaimed nodes', 'unrelated runtime error']) {
    assert.equal(intentionalBoundaryError({ type: 'error', text: diagnostic }, userAgent), null)
    if (diagnostic !== 'unrelated runtime error') {
      assert.equal(intentionalBoundaryError(entry({ ...clientContext, errorStack: clientContext.errorStack + '\n' + diagnostic }), userAgent), null)
    }
  }
})
