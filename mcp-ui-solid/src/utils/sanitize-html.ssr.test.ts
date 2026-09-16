// @vitest-environment node
/**
 * SSR contract for `sanitizeHtml` (S1).
 *
 * Documents the reason this module exists: in a Node environment dompurify's
 * factory bails out (`isSupported === false`, `sanitize` not even defined), so
 * a direct `DOMPurify.sanitize()` call is either a no-op or a TypeError — and
 * Solid's SSR renderer writes `innerHTML` props verbatim into the response.
 *
 * `sanitizeHtml` must therefore emit escaped plain text on the server.
 */

import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { isServer } from 'solid-js/web'
import { sanitizeHtml, SANITIZE_PROFILES } from './sanitize-html'

const HOSTILE = '<img src=x onerror=alert(1)>hello <b>x</b>'

describe('sanitizeHtml — server / no-DOM environment', () => {
  it('documents that DOMPurify is inert without a window', () => {
    expect(DOMPurify.isSupported).toBe(false)
    // dompurify 3.4.x returns the *factory* when there is no document, so
    // `sanitize` is undefined rather than a pass-through no-op. Either shape
    // is unsafe for an innerHTML sink — hence the guard in sanitizeHtml.
    expect(typeof DOMPurify.sanitize).not.toBe('function')
  })

  it('documents which guard branch fires under vitest `environment: node`', () => {
    // Observed: vite-plugin-solid resolves `solid-js/web` to the CLIENT build
    // even under `environment: node`, so `isServer` is false here and the
    // `!DOMPurify.isSupported` branch is the one that keeps us safe. Both
    // guards are individually sufficient; the assertion stays on the
    // disjunction so a future resolution change does not fail the file, while
    // the security assertions below still pin the behaviour.
    expect(isServer || !DOMPurify.isSupported).toBe(true)
  })

  it('emits no markup at all — escaped text only', () => {
    const out = sanitizeHtml(HOSTILE)
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    // v6.19.0: nothing is stripped any more, so the tag survives as inert,
    // escaped text. `onerror` appearing as literal characters is expected —
    // it can never be parsed as an attribute.
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(out).toContain('hello')
  })

  it('does not delete text that merely looks like a tag (stripTags regression)', () => {
    // The removed `stripTags()` pre-pass turned this into `values 5`.
    expect(sanitizeHtml('values < 10 and > 5')).toBe('values &lt; 10 and &gt; 5')
  })

  it('escapes the five significant characters instead of dropping them', () => {
    expect(sanitizeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;')
  })

  it('never emits markup whichever profile is passed', () => {
    for (const profile of Object.values(SANITIZE_PROFILES)) {
      expect(sanitizeHtml(HOSTILE, profile)).not.toContain('<')
    }
  })

  it('is total on empty / nullish input', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeHtml(null as unknown as string)).toBe('')
  })
})
