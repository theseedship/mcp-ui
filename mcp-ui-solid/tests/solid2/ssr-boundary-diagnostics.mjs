import assert from 'node:assert/strict'

const code = 'SSR_RENDER_ERROR_CONTAINED'
const message = 'Render error caught by <Errored>: Error: <mcpui-fixture-ssr-error>'
const stack = '<Document> › <App> › <BoundaryProbe> › <GenerativeUIErrorBoundary> › <Errored> › <ThrowingChild>'
const sourceLine = /^  at (src\/BoundaryProbe\.tsx:[1-9]\d*:[1-9]\d*)$/
const explanation = [
  '[SSR_RENDER_ERROR_CONTAINED] what it means and how to fix it: https://docs.solidjs.com/reference/solid-js/diagnostics/ssr-render-error-contained',
  '[SSR_RENDER_ERROR_CONTAINED] agent repair guide: node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md#ssr_render_error_contained — https://github.com/solidjs/solid/blob/next/packages/solid/skills/reactivity-diagnostics/SKILL.md#ssr_render_error_contained',
]

/**
 * Produce a view for the existing migration guard; the raw server log is
 * always retained. Only the intentional full-profile negative fixture can
 * classify a native SSR diagnostic as expected, never optional or prod SSR.
 */
export function assessSSRBoundaryDiagnostics(log, { profile, mode, documentRequests }) {
  const expectedContainedErrors = []
  if (profile !== 'full' || mode !== 'dev') return { checkedLog: log, expectedContainedErrors }

  // Keep line endings and preserve all unmatched text byte for byte.
  const lines = log.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const contents = lines.map(line => line.replace(/\r?\n$/, ''))
  const retained = []
  for (let index = 0; index < lines.length;) {
    const source = contents[index] === '[' + code + '] ' + message &&
      contents[index + 1] === '  in ' + stack && sourceLine.exec(contents[index + 2] ?? '')
    if (!source) {
      retained.push(lines[index++])
      continue
    }

    // Solid 2.0.4 prints its exact two help lines once, on the first
    // occurrence of this code in the freshly started development server.
    const explanationFooter = expectedContainedErrors.length === 0
    if (explanationFooter) {
      assert.deepEqual(contents.slice(index + 3, index + 5), explanation,
        'First intentional SSR boundary diagnostic must carry the exact Solid 2.0.4 help footer')
    }
    expectedContainedErrors.push({ code, message, stack, source: source[1], explanationFooter })
    index += explanationFooter ? 5 : 3
  }
  // Bind to actual document requests (at least readiness, raw SSR and Chromium),
  // not an assumed request count that dependency optimization may change.
  assert(Number.isInteger(documentRequests) && documentRequests >= 3, 'Full dev SSR document request count is missing')
  assert.equal(expectedContainedErrors.length, documentRequests, 'Full dev SSR must report exactly one intentional boundary throw per document request')
  return { checkedLog: retained.join(''), expectedContainedErrors }
}
