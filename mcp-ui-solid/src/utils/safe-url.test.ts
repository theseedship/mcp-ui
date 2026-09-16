/**
 * `safeUrl` — allow-list for values bound into `href` / `src` (v6.19.0).
 *
 * These attributes never pass through `sanitizeHtml` (that only guards
 * `innerHTML`), so this function is the whole boundary for them.
 */

import { describe, it, expect } from 'vitest'
import { safeUrl } from './safe-url'

describe('safeUrl — allowed schemes', () => {
  it.each([
    'https://example.test/a.png',
    'http://example.test/a.png',
    'HTTPS://example.test/a.png',
    'mailto:someone@example.test',
    'tel:+33123456789',
  ])('allows %s', (url) => {
    expect(safeUrl(url)).toBe(url)
  })

  it('returns the string unchanged (relative URLs keep resolving against the document)', () => {
    expect(safeUrl('https://example.test/a?b=1#c')).toBe('https://example.test/a?b=1#c')
  })

  it('trims surrounding whitespace', () => {
    expect(safeUrl('  https://example.test/  ')).toBe('https://example.test/')
  })
})

describe('safeUrl — relative forms', () => {
  it.each(['/abs/path.png', './rel.png', '../up.png', '#anchor', '?q=1', 'bare/path.png'])(
    'allows %s',
    (url) => {
      expect(safeUrl(url)).toBe(url)
    }
  )
})

describe('safeUrl — blocked schemes', () => {
  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)',
    'jAvAsCrIpT:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'blob:https://example.test/1234',
    'about:blank',
    'ftp://example.test/x',
  ])('rejects %s', (url) => {
    expect(safeUrl(url)).toBeUndefined()
  })

  it('rejects a scheme broken up by a newline (browsers would re-join it)', () => {
    expect(safeUrl('java\nscript:alert(1)')).toBeUndefined()
  })

  it('rejects control characters anywhere in the string', () => {
    expect(safeUrl('java\tscript:alert(1)')).toBeUndefined()
    expect(safeUrl('https://example.test/\u0000evil')).toBeUndefined()
    expect(safeUrl('https://example.test/a\rb')).toBeUndefined()
  })

  it('rejects empty / whitespace-only / non-string input', () => {
    expect(safeUrl('')).toBeUndefined()
    expect(safeUrl('   ')).toBeUndefined()
    expect(safeUrl(undefined as unknown as string)).toBeUndefined()
    expect(safeUrl(null as unknown as string)).toBeUndefined()
    expect(safeUrl(42 as unknown as string)).toBeUndefined()
  })
})

describe('safeUrl — data: images', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('rejects data: images by default', () => {
    expect(safeUrl(png)).toBeUndefined()
  })

  it.each([
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/jpeg;base64,/9j/4AAQ',
    'data:image/jpg;base64,/9j/4AAQ',
    'data:image/gif;base64,R0lGODlh',
    'data:image/webp;base64,UklGRg==',
    'DATA:IMAGE/PNG;BASE64,iVBORw0KGgo=',
  ])('allows %s with allowDataImage', (url) => {
    expect(safeUrl(url, { allowDataImage: true })).toBe(url)
  })

  it('still rejects non-image data: URLs with allowDataImage', () => {
    expect(safeUrl('data:text/html;base64,PHNjcmlwdD4=', { allowDataImage: true })).toBeUndefined()
    expect(safeUrl('data:image/svg+xml;base64,PHN2Zz4=', { allowDataImage: true })).toBeUndefined()
    expect(safeUrl('data:image/png,<script>', { allowDataImage: true })).toBeUndefined()
  })
})
