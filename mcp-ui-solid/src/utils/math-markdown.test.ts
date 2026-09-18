import { describe, expect, it, vi } from 'vitest'
import type { MathRenderer } from '../context/MCPUIMathContext'
import { renderKatexMath } from '../plugins/katex'
import { MATH_MARKDOWN_LIMITS, parseMathMarkdown } from './math-markdown'

const math: MathRenderer = (tex, { displayMode }) =>
  `<span class="katex"><math display="${displayMode ? 'block' : 'inline'}"><semantics><mrow><mi>${tex}</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>`

describe('parseMathMarkdown', () => {
  it('renders closed inline and display expressions before Markdown underscore parsing', () => {
    const out = parseMathMarkdown('($V_{th}$)\n\n$$\nx^2\n$$', math, 'prose')
    expect(out).toContain('<mi>V_{th}</mi>')
    expect(out).toContain('display="block"')
    expect(out).not.toContain('<em>')
  })

  it('drops annotation subtrees, styles and hostile renderer markup', () => {
    const hostile: MathRenderer = () => '<math style="color:red"><annotation>secret</annotation><mrow onclick="x()"><mi>x</mi></mrow></math><script>alert(1)</script>'
    const out = parseMathMarkdown('$x$', hostile, 'prose')
    expect(out).toContain('<math>')
    expect(out).not.toContain('secret')
    expect(out).not.toContain('style=')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('alert')
  })

  it('preserves KaTeX phantom semantics instead of exposing hidden content', () => {
    const out = parseMathMarkdown('$\\phantom{x}+y$', renderKatexMath, 'prose')
    expect(out).toContain('<mphantom><mi>x</mi></mphantom>')
  })

  it('keeps an escaped dollar inside TeX without treating it as the closer', () => {
    const out = parseMathMarkdown('$\\text{\\$5}$', renderKatexMath, 'prose')
    expect(out).toContain('<math')
    expect(out).toContain('<mtext>$5</mtext>')
  })

  it('keeps a formula with only an escaped closing dollar incomplete and literal', () => {
    const source = '$x\\$'
    const renderer = vi.fn(renderKatexMath)
    const out = parseMathMarkdown(source, renderer, 'prose')
    expect(renderer).not.toHaveBeenCalled()
    expect(out).toContain('$x$')
  })

  it.each(['$5', '$5-$10', '$5-$', '\\$20', '$5 and $10'])('keeps currency or incomplete input literal: %s', (source) => {
    const renderer = vi.fn(math)
    const out = parseMathMarkdown(source, renderer, 'prose')
    expect(renderer).not.toHaveBeenCalled()
    expect(out).toContain(source.replace('\\$', '$'))
  })

  it.each(['`$x$`', '```tex\n$x$\n```', '<span title="$x$">safe</span>', '[link](https://example.test/$x$)'])(
    'does not parse math inside protected Markdown/HTML syntax: %s',
    (source) => {
      const renderer = vi.fn(math)
      parseMathMarkdown(source, renderer, 'prose')
      expect(renderer).not.toHaveBeenCalled()
    },
  )

  it('sanitizes a citation transform while retaining citation attributes in cells', () => {
    const out = parseMathMarkdown('$x$ [CITE]', math, 'cellMarkdown', (html) =>
      html.replace('[CITE]', '<button data-citation-page="3" onclick="x()">source</button>'))
    expect(out).toContain('<math')
    expect(out).toContain('data-citation-page="3"')
    expect(out).not.toContain('onclick')
  })

  it('transforms adjacent citation text without touching TeX optional arguments', () => {
    const transform = vi.fn((text: string) =>
      text.replace('[1]', '<button data-citation-page="1">source</button>'))
    const out = parseMathMarkdown('$\\sqrt[3]{x}$ [1]', math, 'cellMarkdown', transform)
    expect(out).toContain('<mi>\\sqrt[3]{x}</mi>')
    expect(out).toContain('data-citation-page="1"')
    expect(transform).not.toHaveBeenCalledWith(expect.stringContaining('sqrt'))
  })

  it('does not double-escape Markdown entities when a text transform is active', () => {
    const out = parseMathMarkdown('A &amp; B **bold** $x$ [1]', math, 'cellMarkdown', (text) =>
      text.replace('[1]', '<button data-citation-page="1">source</button>'))
    const host = document.createElement('div')
    host.innerHTML = out
    expect(host.textContent).toContain('A & B bold')
    expect(host.textContent).not.toContain('&amp;')
  })

  it('keeps escaped hostile HTML literal when a text transform is active', () => {
    const out = parseMathMarkdown(
      '\\<img src=x onerror=alert(1)> $x$ [1]',
      math,
      'cellMarkdown',
      (text) => text.replace('[1]', '<button data-citation-page="1">source</button>'),
    )
    const host = document.createElement('div')
    host.innerHTML = out
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(host.querySelector('[data-citation-page="1"]')).not.toBeNull()
  })

  it('transforms only leaf text inside a list, not nested math or code', () => {
    const out = parseMathMarkdown(
      '- $\\sqrt[3]{x}$ `[3]` [1]',
      renderKatexMath,
      'cellMarkdown',
      (text) => text.replace(/\[(\d+)\]/g, '<button data-citation-page="$1">source</button>'),
    )
    const host = document.createElement('div')
    host.innerHTML = out
    expect(host.querySelector('math mroot')).not.toBeNull()
    expect(host.querySelector('code')?.textContent).toBe('[3]')
    expect(host.querySelector('[data-citation-page="3"]')).toBeNull()
    expect(host.querySelector('[data-citation-page="1"]')).not.toBeNull()
  })

  it('falls back to the literal token when the renderer fails or returns null', () => {
    expect(parseMathMarkdown('$x$', () => null, 'prose')).toContain('$x$')
    expect(parseMathMarkdown('$y$', () => { throw new Error('boom') }, 'prose')).toContain('$y$')
  })

  it('preserves the complete invalid TeX token with the real adapter', () => {
    const source = '$\\notARealCommand{$'
    const out = parseMathMarkdown(source, renderKatexMath, 'prose')
    expect(out).toContain(source)
    expect(out).not.toContain('<math')
  })

  it('bounds expression length, expression count and total source work', () => {
    const renderer = vi.fn(math)
    const oversized = `$${'x'.repeat(MATH_MARKDOWN_LIMITS.expressionLength + 1)}$`
    parseMathMarkdown(oversized, renderer, 'prose')
    expect(renderer).not.toHaveBeenCalled()

    const many = Array.from({ length: MATH_MARKDOWN_LIMITS.expressionCount + 2 }, (_, i) => `$x_${i}$`).join(' ')
    parseMathMarkdown(many, renderer, 'prose')
    expect(renderer).toHaveBeenCalledTimes(MATH_MARKDOWN_LIMITS.expressionCount)

    renderer.mockClear()
    parseMathMarkdown(`${'plain '.repeat(MATH_MARKDOWN_LIMITS.sourceLength)} $x$`, renderer, 'prose')
    expect(renderer).not.toHaveBeenCalled()
  })
})
