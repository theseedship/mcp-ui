import assert from 'node:assert/strict'
import test from 'node:test'
import { assessSSRBoundaryDiagnostics } from './ssr-boundary-diagnostics.mjs'
import { hasMigrationDiagnostic } from './run.mjs'

const code = 'SSR_RENDER_ERROR_CONTAINED'
const message = 'Render error caught by <Errored>: Error: <mcpui-fixture-ssr-error>'
const stack = '<Document> › <App> › <BoundaryProbe> › <GenerativeUIErrorBoundary> › <Errored> › <ThrowingChild>'
const source = 'src/BoundaryProbe.tsx:37:7'
const footer = [
  '[SSR_RENDER_ERROR_CONTAINED] what it means and how to fix it: https://docs.solidjs.com/reference/solid-js/diagnostics/ssr-render-error-contained',
  '[SSR_RENDER_ERROR_CONTAINED] agent repair guide: node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md#ssr_render_error_contained — https://github.com/solidjs/solid/blob/next/packages/solid/skills/reactivity-diagnostics/SKILL.md#ssr_render_error_contained',
].join('\n') + '\n'
const block = '[' + code + '] ' + message + '\n  in ' + stack + '\n  at ' + source + '\n'
const logger = '[@seed-ship/mcp-ui-solid:generative-ui] Component render failed: text {"componentId":"packed-ssr-boundary"}\n'
const raw = 'VITE ready\n' + block + footer + logger + 'page reload\n' + block + logger + block + logger + 'done'
const fullDev = { profile: 'full', mode: 'dev', documentRequests: 3 }

test('qualifies the three native dev SSR negative fixtures; only first has the exact help footer', () => {
  for (const eol of ['\n', '\r\n']) {
    const original = raw.replaceAll('\n', eol)
    assert(hasMigrationDiagnostic(original), 'Raw evidence must retain the native diagnostic')
    const { checkedLog, expectedContainedErrors } = assessSSRBoundaryDiagnostics(original, fullDev)
    assert.equal(checkedLog, ('VITE ready\n' + logger + 'page reload\n' + logger + logger + 'done').replaceAll('\n', eol))
    assert.deepEqual(expectedContainedErrors, [true, false, false].map(explanationFooter => ({
      code, message, stack, source, explanationFooter,
    })))
    assert(!hasMigrationDiagnostic(checkedLog))
  }
  const dynamic = assessSSRBoundaryDiagnostics(raw.replaceAll(source, 'src/BoundaryProbe.tsx:128:13'), fullDev)
  assert.equal(dynamic.expectedContainedErrors[2].source, 'src/BoundaryProbe.tsx:128:13')
})

test('full production and optional profiles have zero exceptions and pass the raw log to the migration guard', () => {
  for (const options of [{ profile: 'full', mode: 'production' },
    { profile: 'optional-absent', mode: 'dev' }, { profile: 'optional-absent', mode: 'production' }]) {
    assert.deepEqual(assessSSRBoundaryDiagnostics(raw, options), { checkedLog: raw, expectedContainedErrors: [] })
    assert(hasMigrationDiagnostic(assessSSRBoundaryDiagnostics(raw, options).checkedLog))
  }
})

test('missing, extra, wrong scope and malformed native records cannot satisfy the exception', () => {
  for (const corrupted of [
    raw.replace(block + footer, ''),
    raw + '\n' + block,
    raw.replace('mcpui-fixture-ssr-error', 'unrelated SSR bug'),
    raw.replace('› <BoundaryProbe>', '› <DifferentBoundary>'),
    raw.replace('› <Errored>', '› <Loading>'),
    raw.replace('src/BoundaryProbe.tsx:37:7', 'src/AnotherProbe.tsx:37:7'),
    raw.replace('src/BoundaryProbe.tsx:37:7', 'src/BoundaryProbe.tsx:0:7'),
    raw.replace('src/BoundaryProbe.tsx:37:7', '/other/src/BoundaryProbe.tsx:37:7'),
    raw.replace(stack, stack + ' [CAUGHT_REACTIVE_READ]'),
    raw.replace('guide: node_modules/', 'guide: http://unknown/'),
    raw.replace('how to fix it: https://docs.solidjs.com', 'how to fix it: https://example.com'),
    raw.replace(footer, ''),
  ]) assert.throws(() => assessSSRBoundaryDiagnostics(corrupted, fullDev), /exact Solid 2\.0\.4 help footer|exactly one/)
})

test('containment count must match independently measured SSR document requests', () => {
  assert.equal(assessSSRBoundaryDiagnostics(raw + '\n' + block, { ...fullDev, documentRequests: 4 }).expectedContainedErrors.length, 4)
  for (const documentRequests of [undefined, 0, 2, 4, NaN, 3.5]) {
    assert.throws(() => assessSSRBoundaryDiagnostics(raw, { ...fullDev, documentRequests }))
  }
})

test('other SSR, ownership and hydration diagnostics remain visible to the existing guard', () => {
  for (const diagnostic of [
    '[SSR_UNSAFE_WRITE] unrelated SSR write',
    '[SSR_RENDER_ERROR_CONTAINED] Render error caught by <Errored>: Error: unrelated',
    '[SSR_RENDER_ERROR_CONTAINED] unexpected footer',
    '[CAUGHT_REACTIVE_READ] illegal read',
    '[NO_OWNER_EFFECT] scope missing',
    'Hydration completed with 4 unclaimed server-rendered nodes',
  ]) {
    const corrupted = raw.replace('page reload\n', 'page reload\n' + diagnostic + '\n')
    const { checkedLog, expectedContainedErrors } = assessSSRBoundaryDiagnostics(corrupted, fullDev)
    assert.equal(expectedContainedErrors.length, 3)
    assert(checkedLog.includes(diagnostic))
    assert(hasMigrationDiagnostic(checkedLog), diagnostic)
  }
})
