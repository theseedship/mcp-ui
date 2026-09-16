// @vitest-environment node
/**
 * Proves that the `isServer` clause of the guard is, on its own, sufficient.
 *
 * `sanitize-html.ssr.test.ts` runs in the node environment but — as it
 * documents — vite-plugin-solid resolves `solid-js/web` to the CLIENT build
 * there, so `isServer` is false and only the `!DOMPurify.isSupported` branch
 * actually fires. That leaves the `isServer` half untested: if someone deleted
 * it, every existing test would still pass while a real SSR host (where
 * dompurify *does* find a DOM, e.g. jsdom-backed SolidStart) would start
 * emitting live markup into the HTML response.
 *
 * This file pins the missing half: `isServer` is forced true and dompurify is
 * mocked as fully working *and* a pass-through. The only thing that can keep
 * the output inert is the `isServer` clause.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('solid-js/web', () => ({ isServer: true }))
vi.mock('dompurify', () => ({
  default: {
    isSupported: true,
    // Deliberately inert: a pass-through "sanitizer" that would happily
    // forward the payload if the guard ever stopped short-circuiting.
    sanitize: (s: string) => s,
  },
}))

const { sanitizeHtml, canSanitizeHtml, SANITIZE_PROFILES } = await import('./sanitize-html')

const HOSTILE = '<img src=x onerror=alert(1)>hello <b>x</b>'

describe('sanitizeHtml — isServer clause in isolation', () => {
  it('reports that no real sanitize is possible', () => {
    expect(canSanitizeHtml()).toBe(false)
  })

  it('emits no markup even though DOMPurify is supported and would pass it through', () => {
    const out = sanitizeHtml(HOSTILE)
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(out).toContain('hello')
  })

  it('holds for every profile', () => {
    for (const profile of Object.values(SANITIZE_PROFILES)) {
      expect(sanitizeHtml(HOSTILE, profile)).not.toContain('<')
    }
  })

  it('escapes rather than strips', () => {
    expect(sanitizeHtml('values < 10 and > 5')).toBe('values &lt; 10 and &gt; 5')
  })
})
