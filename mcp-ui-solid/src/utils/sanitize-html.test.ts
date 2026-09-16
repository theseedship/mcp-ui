/**
 * Client-side behaviour of `sanitizeHtml` + `SANITIZE_PROFILES` (S1).
 *
 * The SSR half of the contract lives in `sanitize-html.ssr.test.ts`, which
 * opts into the node environment via its own leading docblock pragma. Do NOT
 * write that pragma's name anywhere in THIS file: vitest regex-scans the file
 * for it and would silently run this suite without a DOM.
 */

import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { sanitizeHtml, canSanitizeHtml, SANITIZE_PROFILES } from './sanitize-html'

const prose = (html: string) => sanitizeHtml(html, SANITIZE_PROFILES.prose)

describe('sanitizeHtml — jsdom baseline', () => {
  it('runs the real DOMPurify here (guard does not fire)', () => {
    expect(DOMPurify.isSupported).toBe(true)
    expect(canSanitizeHtml()).toBe(true)
    expect(sanitizeHtml('<b>hi</b>')).toBe('<b>hi</b>')
  })

  it('is total on empty / nullish input', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeHtml(null as unknown as string)).toBe('')
  })
})

describe('SANITIZE_PROFILES.prose — strips', () => {
  it('drops <script>', () => {
    const out = prose('<p>safe</p><script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('safe')
  })

  it('drops event handlers', () => {
    const out = prose('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
    expect(out).toContain('<img')
  })

  it('drops javascript: hrefs', () => {
    const out = prose('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('drops <style> and style attributes', () => {
    const out = prose('<style>body{display:none}</style><p style="color:red">x</p>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('display:none')
    expect(out).not.toContain('style=')
    expect(out).toContain('x')
  })

  it('drops <iframe>, <object>, <embed>, <form>, <button>', () => {
    const out = prose(
      '<iframe src="https://evil.test"></iframe>' +
        '<object data="x"></object>' +
        '<embed src="x">' +
        '<form action="/steal"><button>go</button></form>' +
        '<p>kept</p>'
    )
    for (const tag of ['<iframe', '<object', '<embed', '<form', '<button']) {
      expect(out).not.toContain(tag)
    }
    expect(out).toContain('kept')
  })
})

describe('SANITIZE_PROFILES.prose — keeps', () => {
  it('keeps markdown tables', () => {
    const out = prose('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>')
    expect(out).toContain('<table>')
    expect(out).toContain('<td>1</td>')
  })

  it('keeps https images', () => {
    const out = prose('<img src="https://example.test/a.png" alt="a">')
    expect(out).toContain('src="https://example.test/a.png"')
    expect(out).toContain('alt="a"')
  })

  it('keeps target/rel on links (ADD_ATTR)', () => {
    const out = prose('<a href="https://example.test" target="_blank" rel="noopener noreferrer">x</a>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('href="https://example.test"')
  })

  it('keeps hr / del / sup / sub / code / blockquote', () => {
    const out = prose('<hr><del>d</del><sup>1</sup><sub>2</sub><code>c</code><blockquote>q</blockquote>')
    for (const tag of ['<hr', '<del>', '<sup>', '<sub>', '<code>', '<blockquote>']) {
      expect(out).toContain(tag)
    }
  })

  /**
   * Decision (documented, not incidental): `<input>` stays allowed so `marked`
   * task lists render. DOMPurify keeps only `type`/`checked`/`disabled` from
   * that markup and strips every handler, and `<form>` is forbidden by this
   * profile, so nothing is submittable.
   */
  it('keeps task-list checkboxes but nothing submittable', () => {
    const out = prose('<ul><li><input checked="" disabled="" type="checkbox"> done</li></ul>')
    expect(out).toContain('<input')
    expect(out).toContain('type="checkbox"')
    expect(out).toContain('disabled')
    expect(out).not.toContain('<form')
  })

  it('strips handlers from an input while keeping it', () => {
    const out = prose('<input type="checkbox" onclick="alert(1)" formaction="/x">')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('alert(1)')
  })
})

describe('SANITIZE_PROFILES.cellHtml / cellMarkdown — citation chips', () => {
  const chip =
    '<button class="citation-btn" data-citation-page="5" data-citation-doc="report.pdf" ' +
    'data-citation-source="s" data-citation-verified="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7z"/></svg>p.5</button>'

  it('cellHtml keeps data-citation-* and svg/path', () => {
    const out = sanitizeHtml(chip, SANITIZE_PROFILES.cellHtml)
    expect(out).toContain('data-citation-page="5"')
    expect(out).toContain('data-citation-doc="report.pdf"')
    expect(out).toContain('data-citation-source="s"')
    expect(out).toContain('data-citation-verified="true"')
    expect(out).toContain('<svg')
    expect(out).toContain('<path')
    expect(out).toContain('<button')
  })

  it('cellMarkdown keeps data-citation-* and svg/path', () => {
    const out = sanitizeHtml(`<p>${chip}</p>`, SANITIZE_PROFILES.cellMarkdown)
    expect(out).toContain('data-citation-page="5"')
    expect(out).toContain('<svg')
    expect(out).toContain('<path')
    expect(out).toContain('<p>')
  })

  it('cell profiles still drop scripts, handlers and images', () => {
    for (const profile of [SANITIZE_PROFILES.cellHtml, SANITIZE_PROFILES.cellMarkdown]) {
      const out = sanitizeHtml('<script>alert(1)</script><img src=x onerror=alert(1)><b>ok</b>', profile)
      expect(out).not.toContain('<script')
      expect(out).not.toContain('onerror')
      expect(out).not.toContain('<img')
      expect(out).toContain('ok')
    }
  })

  it('cellLink keeps target/rel on a rewritten markdown link', () => {
    const out = sanitizeHtml(
      '<a href="https://example.test" target="_blank" rel="noopener noreferrer">x</a>',
      SANITIZE_PROFILES.cellLink
    )
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})

describe('SANITIZE_PROFILES.prose — iframe stays forbidden', () => {
  it('never lets prose embed an iframe (the `iframe` component type is the supported way)', () => {
    // Deliberate: embedding is done with the `iframe` COMPONENT, which runs
    // through `getIframeSandbox()` / `validateComponent()`. An iframe smuggled
    // through markdown or raw `content` would bypass that validation entirely.
    expect(SANITIZE_PROFILES.prose.FORBID_TAGS).toContain('iframe')
    const out = prose('<iframe src="https://evil.test"></iframe>text')
    expect(out).not.toContain('<iframe')
    expect(out).toContain('text')
  })
})

describe('SANITIZE_PROFILES.cellLink — hardened (v6.19.0)', () => {
  const cellLink = (html: string) => sanitizeHtml(html, SANITIZE_PROFILES.cellLink)

  it('drops a <style> smuggled through an attacker-controlled link label', () => {
    // The label of `{ url, name }` is LLM/tool data: a name of
    // `<svg><style>…</style></svg>` used to inject a document-wide stylesheet
    // because this profile was bare DOMPurify defaults.
    const out = cellLink(
      '<a href="https://example.test"><svg><style>body *{visibility:hidden}</style></svg>label</a>'
    )
    expect(out).not.toContain('<style')
    expect(out).not.toContain('visibility:hidden')
    expect(out).toContain('label')
  })

  it('drops the inline style attribute', () => {
    const out = cellLink('<a href="https://example.test" style="position:fixed;inset:0">x</a>')
    expect(out).not.toContain('style=')
    expect(out).toContain('href="https://example.test"')
  })

  it('drops form / iframe / object / embed / textarea / select', () => {
    for (const tag of ['form', 'iframe', 'object', 'embed', 'textarea', 'select']) {
      const out = cellLink(`<${tag}>ok</${tag}>`)
      expect(out).not.toContain(`<${tag}`)
    }
  })

  it('still keeps the rewritten anchor intact (regression)', () => {
    const out = cellLink(
      '<a href="https://example.test" target="_blank" rel="noopener noreferrer">x</a>'
    )
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('href="https://example.test"')
  })
})

describe('SANITIZE_PROFILES.resource — hardened (v6.19.0)', () => {
  const resource = (html: string) => sanitizeHtml(html, SANITIZE_PROFILES.resource)

  it('keeps rich structural markup and drops scripts (regression)', () => {
    const out = resource(
      '<div class="card"><h3>Health</h3><table><tr><td>ok</td></tr></table><script>alert(1)</script></div>'
    )
    expect(out).toContain('<h3>Health</h3>')
    expect(out).toContain('<table>')
    expect(out).toContain('class="card"')
    expect(out).not.toContain('<script')
  })

  it('drops <style> injected by a ui:// rawHtml resource', () => {
    const out = resource('<style>body *{visibility:hidden}</style><p>ok</p>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('visibility:hidden')
    expect(out).toContain('<p>ok</p>')
  })

  it('drops the inline style attribute', () => {
    const out = resource('<div style="position:fixed;inset:0;z-index:9999">overlay</div>')
    expect(out).not.toContain('style=')
    expect(out).toContain('overlay')
  })

  it('drops a phishing <form> with its inputs and submit button', () => {
    const out = resource(
      '<form action="https://evil.test"><input name="password" type="password"><button>Sign in</button></form>'
    )
    expect(out).not.toContain('<form')
    expect(out).not.toContain('<input')
    expect(out).not.toContain('<button')
    expect(out).not.toContain('evil.test')
  })

  it('drops formaction / form attributes', () => {
    const out = resource('<div formaction="https://evil.test" form="f">x</div>')
    expect(out).not.toContain('formaction')
    expect(out).not.toContain('form=')
  })

  it('drops iframe / object / embed / textarea / select', () => {
    for (const tag of ['iframe', 'object', 'embed', 'textarea', 'select']) {
      expect(resource(`<${tag}>ok</${tag}>`)).not.toContain(`<${tag}`)
    }
  })
})
