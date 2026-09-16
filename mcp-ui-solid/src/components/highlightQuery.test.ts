/**
 * `highlightQuery` — search-match `<mark>` wrapping (v6.19.0, DOM-based).
 *
 * The previous regex tokenizer spliced `<mark>` into HTML entities and into
 * attribute text. These tests pin the DOM-based replacement: only text nodes
 * are touched, entities survive, attributes are never rewritten.
 */

import { describe, it, expect } from 'vitest'
import { highlightQuery } from './UIResourceRenderer'

const MARK_OPEN = '<mark class="bg-yellow-200 dark:bg-[#222F49] text-inherit rounded px-0.5">'

describe('highlightQuery — no-op cases', () => {
  it('returns the html unchanged for an empty query', () => {
    expect(highlightQuery('<p>hello</p>', '')).toBe('<p>hello</p>')
    expect(highlightQuery('<p>hello</p>', '   ')).toBe('<p>hello</p>')
  })

  it('returns the html unchanged when nothing matches', () => {
    expect(highlightQuery('<p>hello</p>', 'zzz')).toBe('<p>hello</p>')
  })
})

describe('highlightQuery — text matches', () => {
  it('wraps a plain match', () => {
    const out = highlightQuery('<p>hello world</p>', 'world')
    expect(out).toBe(`<p>hello ${MARK_OPEN}world</mark></p>`)
  })

  it('matches case-insensitively and keeps the original casing', () => {
    const out = highlightQuery('<p>Hello World</p>', 'world')
    expect(out).toContain(`${MARK_OPEN}World</mark>`)
  })

  it('wraps every match, in several text nodes', () => {
    const out = highlightQuery('<p>ab</p><p>cab and ab</p>', 'ab')
    expect(out.split('<mark ').length - 1).toBe(3)
    expect(out).toContain('<p>' + MARK_OPEN + 'ab</mark></p>')
  })

  it('keeps the surrounding element structure intact', () => {
    const out = highlightQuery('<ul><li><b>one</b></li><li>two</li></ul>', 'o')
    expect(out).toContain('<ul><li><b>')
    expect(out).toContain('</b></li><li>')
    expect(out.split('<mark ').length - 1).toBe(2)
  })

  it('treats regex metacharacters in the query literally', () => {
    expect(highlightQuery('<p>a.b</p>', '.')).toBe(`<p>a${MARK_OPEN}.</mark>b</p>`)
    expect(highlightQuery('<p>cost is $5 (net)</p>', '$5')).toContain(`${MARK_OPEN}$5</mark>`)
    expect(highlightQuery('<p>a+b</p>', 'a+b')).toContain(`${MARK_OPEN}a+b</mark>`)
    // A metachar that would otherwise match everything
    expect(highlightQuery('<p>abc</p>', '.*')).toBe('<p>abc</p>')
  })
})

describe('highlightQuery — corruption regressions', () => {
  it('does not splice a <mark> inside an HTML entity', () => {
    // `&amp;` contains the literal substring "amp": the regex tokenizer used
    // to produce `&<mark>amp</mark>;`, which no longer parses as an entity.
    const out = highlightQuery('<td>Tom &amp; Jerry</td>', 'amp')
    expect(out).toContain('&amp;')
    expect(out).not.toContain('<mark')
    expect(out).toBe('<td>Tom &amp; Jerry</td>')
  })

  it('marks the decoded character when the query is the character itself', () => {
    const out = highlightQuery('<td>Tom &amp; Jerry</td>', '&')
    expect(out).toContain(`${MARK_OPEN}&amp;</mark>`)
  })

  it('does not mark inside attribute text', () => {
    const out = highlightQuery('<a href="https://foo.test" title="foo">bar</a>', 'foo')
    expect(out).toBe('<a href="https://foo.test" title="foo">bar</a>')
    expect(out).not.toContain('<mark')
  })

  it('marks the body text while leaving a matching attribute alone', () => {
    const out = highlightQuery('<a href="https://foo.test" title="foo">foo</a>', 'foo')
    expect(out).toContain('title="foo"')
    expect(out).toContain('href="https://foo.test"')
    expect(out).toContain(`>${MARK_OPEN}foo</mark></a>`)
    expect(out.split('<mark ').length - 1).toBe(1)
  })

  it('does not break hljs span markup (CodeBlockRenderer path)', () => {
    const out = highlightQuery(
      '<span class="hljs-keyword">const</span> constant = 1',
      'const'
    )
    expect(out).toContain('<span class="hljs-keyword">')
    expect(out.split('<mark ').length - 1).toBe(2)
  })

  it('escapes a match that contains markup characters instead of emitting them', () => {
    const out = highlightQuery('<td>a &lt;b&gt; c</td>', '<b>')
    expect(out).toContain(`${MARK_OPEN}&lt;b&gt;</mark>`)
    expect(out).not.toContain('<b>')
  })
})
