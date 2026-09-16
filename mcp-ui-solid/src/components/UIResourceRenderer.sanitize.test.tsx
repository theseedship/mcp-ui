/**
 * S1 — XSS closure for the `text` component and the other innerHTML sinks of
 * `<UIResourceRenderer>`.
 *
 * `text` is the component type producers emit most, and `params.content` is
 * LLM-generated. Before S1 the markdown path went `marked.parse()` →
 * `innerHTML` and the non-markdown path went straight to `innerHTML`, both
 * with no sanitizer at all.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'

afterEach(() => cleanup())

const textComponent = (params: Record<string, unknown>) => ({
  id: 'text-1',
  type: 'text' as const,
  position: { colStart: 1, colSpan: 12 },
  params,
})

describe('TextRenderer — markdown path', () => {
  it('keeps the markdown formatting but drops the injected handler', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '**ok** <img src=x onerror=alert(1)>', markdown: true })}
      />
    ))

    expect(container.querySelector('strong')?.textContent).toBe('ok')
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img!.getAttribute('onerror')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
  })

  it('drops <script> from markdown content', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: 'hi\n\n<script>alert(1)</script>', markdown: true })}
      />
    ))

    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('alert(1)')
    expect(container.textContent).toContain('hi')
  })

  it('drops javascript: links from markdown content', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '[click](javascript:alert(1))', markdown: true })}
      />
    ))

    expect(container.innerHTML).not.toContain('javascript:')
  })

  it('regression — a markdown table still renders a <table>', () => {
    const md = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n')
    const { container } = render(() => (
      <UIResourceRenderer content={textComponent({ content: md, markdown: true })} />
    ))

    const table = container.querySelector('table')
    expect(table).toBeTruthy()
    expect(table!.querySelectorAll('th').length).toBe(2)
    expect(table!.querySelectorAll('td').length).toBe(2)
  })

  it('regression — markdown links keep href/target/rel', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '[x](https://example.test)', markdown: true })}
      />
    ))

    const a = container.querySelector('a[href="https://example.test"]')
    expect(a).toBeTruthy()
  })

  it('regression — markdown task lists still render a checkbox', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '- [x] done\n- [ ] todo', markdown: true })}
      />
    ))

    const boxes = container.querySelectorAll('input[type="checkbox"]')
    expect(boxes.length).toBe(2)
    // Documented decision: `<input>` survives the prose profile, but it is
    // disabled, carries no handler, and has no <form> to submit to.
    expect((boxes[0] as HTMLInputElement).hasAttribute('disabled')).toBe(true)
    expect(container.querySelector('form')).toBeNull()
  })
})

describe('TextRenderer — non-markdown path', () => {
  it('drops raw <script> content (previously bound to innerHTML unfiltered)', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '<script>alert(1)</script>safe', markdown: false })}
      />
    ))

    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('alert(1)')
    expect(container.textContent).toContain('safe')
  })

  it('drops inline handlers on raw HTML content', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '<img src=x onerror=alert(1)><b>keep</b>', markdown: false })}
      />
    ))

    expect(container.innerHTML).not.toContain('onerror')
    expect(container.querySelector('b')?.textContent).toBe('keep')
  })

  it('drops <iframe> from raw content', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={textComponent({ content: '<iframe src="https://evil.test"></iframe>text' })}
      />
    ))

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain('text')
  })

  it('renders plain text unchanged', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={textComponent({ content: 'Hello world' })} />
    ))
    expect(container.textContent).toContain('Hello world')
  })

  it('tolerates missing content', () => {
    const { container } = render(() => <UIResourceRenderer content={textComponent({})} />)
    expect(container.innerHTML).not.toContain('undefined')
  })
})

describe('UIResourceHtmlRenderer — rawHtml resource', () => {
  it('renders sanitized resource HTML and drops scripts', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={{
          uri: 'ui://deposium/health',
          content: {
            type: 'rawHtml',
            htmlString: '<h3>Health</h3><script>alert(1)</script><p onclick="alert(2)">ok</p>',
          },
        }}
      />
    ))

    // `.prose` is the resource body; the outer <h3> is the title bar.
    expect(container.querySelector('.prose h3')?.textContent).toBe('Health')
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('onclick')
    expect(container.textContent).toContain('ok')
  })
})

describe('TableRenderer cells — routed through <SafeHtml>', () => {
  it('renders sanitized cell HTML and drops handlers', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={{
          id: 'table-1',
          type: 'table' as const,
          position: { colStart: 1, colSpan: 12 },
          params: {
            columns: [{ key: 'c', label: 'C' }],
            rows: [{ c: '<a href="https://example.test" onclick="alert(1)">link</a>' }],
          },
        }}
      />
    ))

    const a = container.querySelector('td a')
    expect(a?.textContent).toBe('link')
    expect(a?.getAttribute('onclick')).toBeNull()
    expect(container.innerHTML).not.toContain('alert(1)')
  })
})

describe('TextRenderer — chrome hooks (v6.19.0)', () => {
  it('exposes the inline copy button through data-mcp-ui-action="copy" with an accessible name', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={textComponent({ content: 'plain', markdown: false })} />
    ))
    const copy = container.querySelector('button[data-mcp-ui-action="copy"]')
    expect(copy).not.toBeNull()
    expect(copy!.getAttribute('type')).toBe('button')
    expect(copy!.getAttribute('aria-label')).toBe('Copy text')
  })
})
