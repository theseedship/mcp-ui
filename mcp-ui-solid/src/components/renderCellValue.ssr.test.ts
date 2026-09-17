// @vitest-environment node
/**
 * SSR contract for `renderCellValue` (v6.19.0).
 *
 * Every string this function returns is bound into a `<SafeHtml>` innerHTML
 * sink, and Solid's SSR renderer writes `innerHTML` props verbatim into the
 * HTML response. So on the server — where `sanitizeHtml` degrades to
 * `escapeHtml` — *no* branch of `renderCellValue` may emit a `<`, including
 * the composed-anchor branch that builds markup of its own.
 */

import { describe, it, expect } from 'vitest'

// `UIResourceRenderer` pulls in Solid's CLIENT build (vite-plugin-solid
// resolves it that way even under `environment: node`), whose `delegateEvents`
// touches `window.document` at module scope. Stub the bare minimum BEFORE the
// import. The stub is deliberately not a real document: `document.nodeType`
// is undefined, so dompurify still bails out with `isSupported === false` and
// we exercise the genuine no-DOM path.
const noop = () => {}
const fakeDocument = { addEventListener: noop, removeEventListener: noop } as unknown as Document
;(globalThis as unknown as { document: Document }).document = fakeDocument
;(globalThis as unknown as { window: unknown }).window = {
  document: fakeDocument,
  addEventListener: noop,
  removeEventListener: noop,
}

const { renderCellValue } = await import('./UIResourceRenderer')
const { DEFAULT_MCPUI_STRINGS } = await import('../context/MCPUIStringsContext')

describe('renderCellValue — server / no-DOM environment', () => {
  it('emits no markup for a link-like object (the branch that composes an anchor)', () => {
    const out = renderCellValue({ url: 'https://x.test', name: 'Doc' })
    expect(out).not.toContain('<')
    expect(out).toContain('Doc')
    expect(out).toContain('x.test')
  })

  it('emits no markup for raw HTML in a cell value', () => {
    const out = renderCellValue('<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<')
    expect(out).toContain('&lt;img')
  })

  it('emits no markup for a markdown cell value', () => {
    expect(renderCellValue('**bold** and `code`')).not.toContain('<')
  })

  it('emits no markup for a markdown link', () => {
    expect(renderCellValue('[x](javascript:alert(1))')).not.toContain('<')
  })

  it('emits no markup for the JSON last-resort branch', () => {
    const out = renderCellValue({ details: '<img src=x onerror=alert(1)>' })
    expect(out).not.toContain('<')
  })
})

/**
 * v6.20.0 — the unresolved-citation placeholder used to be a hardcoded
 * French `[réf. N]`. It now resolves through `CitationCtx.unresolvedLabel`,
 * defaulting to `DEFAULT_MCPUI_STRINGS.citationUnresolved` — reachable with
 * no provider and no Solid context, which is exactly what this
 * `renderCellValue`-as-a-pure-function contract needs.
 */
describe('renderCellValue — unresolved citation placeholder', () => {
  it('empty map, no override → the English default `[ref. N]`', () => {
    expect(renderCellValue('[7]', { map: {} })).toContain('[ref. 7]')
  })

  it('empty map, no override → never the former French literal', () => {
    expect(renderCellValue('[7]', { map: {} })).not.toContain('réf')
  })

  it('the default equals DEFAULT_MCPUI_STRINGS.citationUnresolved', () => {
    expect(DEFAULT_MCPUI_STRINGS.citationUnresolved).toBe('[ref. {id}]')
  })

  it('`unresolvedLabel` overrides the default and interpolates {id}', () => {
    expect(renderCellValue('[7]', { map: {}, unresolvedLabel: 'source n°{id}' })).toContain(
      'source n°7'
    )
  })

  it('a NON-empty map still drops an unresolved marker (override is irrelevant)', () => {
    const out = renderCellValue('[99]', {
      map: { '1': { page: 2 } },
      unresolvedLabel: '[ref. {id}]',
    })
    expect(out).not.toContain('99')
  })
})
