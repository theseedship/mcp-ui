/**
 * Tests for renderCellValue — P1.1: HTML/link preservation in table cells
 */

import { describe, it, expect } from 'vitest'
import { renderCellValue } from './UIResourceRenderer'

describe('renderCellValue', () => {
  // Basic values
  it('returns "-" for null', () => {
    expect(renderCellValue(null)).toBe('-')
  })

  it('returns "-" for undefined', () => {
    expect(renderCellValue(undefined)).toBe('-')
  })

  it('returns plain text as-is', () => {
    expect(renderCellValue('Hello world')).toBe('Hello world')
  })

  it('returns number as string', () => {
    expect(renderCellValue(42)).toBe('42')
  })

  // Object with URL (existing behavior)
  it('renders object with url as link', () => {
    const result = renderCellValue({ url: 'https://example.com', name: 'Example' })
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('Example')
    expect(result).toContain('<a ')
  })

  // Markdown links
  it('converts markdown links to HTML', () => {
    const result = renderCellValue('[Google](https://google.com)')
    expect(result).toContain('href="https://google.com"')
    expect(result).toContain('Google')
    expect(result).toContain('<a ')
  })

  it('handles multiple markdown links in same value', () => {
    const result = renderCellValue('See [Google](https://google.com) and [GitHub](https://github.com)')
    expect(result).toContain('Google')
    expect(result).toContain('GitHub')
    expect((result.match(/<a /g) || []).length).toBe(2)
  })

  // Raw HTML links (P1.1 fix)
  it('preserves raw HTML <a> tags', () => {
    const result = renderCellValue('<a href="https://example.com">Click here</a>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('Click here')
    expect(result).toContain('<a ')
  })

  it('preserves citation links with data attributes', () => {
    const result = renderCellValue('<a href="#p5" data-citation-page="5">Source [5]</a>')
    expect(result).toContain('data-citation-page="5"')
    expect(result).toContain('Source [5]')
    expect(result).toContain('<a ')
  })

  it('preserves mixed text and HTML links', () => {
    const result = renderCellValue('Revenue: $1.2M <a href="/report">details</a>')
    expect(result).toContain('Revenue: $1.2M')
    expect(result).toContain('href="/report"')
    expect(result).toContain('details')
  })

  it('preserves multiple HTML links', () => {
    const result = renderCellValue('<a href="/a">Link A</a> and <a href="/b">Link B</a>')
    expect(result).toContain('Link A')
    expect(result).toContain('Link B')
    expect((result.match(/<a /g) || []).length).toBe(2)
  })

  // HTML sanitization (security)
  it('strips dangerous tags from HTML', () => {
    const result = renderCellValue('<script>alert("xss")</script>Safe text')
    expect(result).not.toContain('<script>')
    expect(result).toContain('Safe text')
  })

  it('strips onclick handlers from links', () => {
    const result = renderCellValue('<a href="#" onclick="alert(1)">Link</a>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('Link')
  })

  it('strips iframe tags', () => {
    const result = renderCellValue('<iframe src="https://evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  // Allowed inline HTML
  it('preserves <strong> and <em> tags', () => {
    const result = renderCellValue('<strong>Bold</strong> and <em>italic</em>')
    expect(result).toContain('<strong>Bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })

  it('preserves <code> tags', () => {
    const result = renderCellValue('Use <code>npm install</code>')
    expect(result).toContain('<code>npm install</code>')
  })

  // Citation buttons with SVG (P1.2)
  it('preserves citation <button> with data-citation-page', () => {
    const result = renderCellValue('<button data-citation-page="5" class="citation-btn"><svg viewBox="0 0 24 24"><path d="M12 2L2 7v10l10 5 10-5V7z"/></svg></button>')
    expect(result).toContain('<button')
    expect(result).toContain('data-citation-page="5"')
    expect(result).toContain('<svg')
    expect(result).toContain('<path')
  })

  it('preserves citation button with data-citation-doc and data-citation-verified', () => {
    const result = renderCellValue('<button data-citation-page="3" data-citation-doc="report.pdf" data-citation-verified="true">p.3</button>')
    expect(result).toContain('data-citation-page="3"')
    expect(result).toContain('data-citation-doc="report.pdf"')
    expect(result).toContain('data-citation-verified="true"')
  })

  it('preserves mixed text with citation button', () => {
    const result = renderCellValue('See source <button data-citation-page="7">[7]</button> for details')
    expect(result).toContain('See source')
    expect(result).toContain('<button')
    expect(result).toContain('data-citation-page="7"')
    expect(result).toContain('for details')
  })

  // Plain text XSS prevention
  it('sanitizes plain text that looks like HTML injection', () => {
    const result = renderCellValue('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('onerror')
  })

  // Undefined cleanup
  it('cleans up "Text – undefined" patterns', () => {
    expect(renderCellValue('Paris – undefined')).toBe('Paris')
  })

  it('returns "-" for standalone "undefined"', () => {
    expect(renderCellValue('undefined')).toBe('-')
  })
})
