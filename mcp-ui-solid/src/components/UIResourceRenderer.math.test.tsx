import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MCPUIMathProvider, type MathRenderer } from '../context/MCPUIMathContext'
import { UIResourceRenderer, highlightQuery } from './UIResourceRenderer'

vi.mock('@tanstack/solid-virtual', () => ({
  createVirtualizer: () => ({
    getVirtualItems: () => [{ index: 0, key: 0, start: 0, size: 48, end: 48, lane: 0 }],
    getTotalSize: () => 48,
  }),
}))

afterEach(() => cleanup())

const renderMath: MathRenderer = (tex, { displayMode }) =>
  `<math class="test-math" display="${displayMode ? 'block' : 'inline'}"><mrow><mtext>${tex}</mtext></mrow></math>`

const textComponent = (content: string, markdown = true) => ({
  id: 'text-math',
  type: 'text' as const,
  position: { colStart: 1, colSpan: 12 },
  params: { content, markdown },
})

const tableComponent = (value: string, extraParams: Record<string, unknown> = {}) => ({
  id: 'table-math',
  type: 'table' as const,
  position: { colStart: 1, colSpan: 12 },
  params: {
    columns: [{ key: 'value', label: 'Value' }],
    rows: [{ value }],
    ...extraParams,
  },
})

const renderWithMath = (content: ReturnType<typeof textComponent> | ReturnType<typeof tableComponent>) =>
  render(() => (
    <MCPUIMathProvider renderMath={renderMath}>
      <UIResourceRenderer content={content} />
    </MCPUIMathProvider>
  ))

describe('UIResourceRenderer math integration', () => {
  it('does not inject HTML search highlights into MathML', () => {
    const html = '<span>x</span><math><mi>x</mi><mphantom><mi>x</mi></mphantom></math>'
    const result = document.createElement('div')
    result.innerHTML = highlightQuery(html, 'x')
    expect(result.querySelector('span > mark')?.textContent).toBe('x')
    expect(result.querySelector('math')?.outerHTML).toBe('<math><mi>x</mi><mphantom><mi>x</mi></mphantom></math>')
  })

  it('renders inline and display math in Markdown text', () => {
    const { container } = renderWithMath(textComponent('Inline $x + 1$\n\n$$\\sum_{i=1}^n i$$'))

    const formulas = container.querySelectorAll('math.test-math')
    expect(formulas).toHaveLength(2)
    expect(formulas[0].getAttribute('display')).toBe('inline')
    expect(formulas[0].textContent).toBe('x + 1')
    expect(formulas[1].getAttribute('display')).toBe('block')
    expect(formulas[1].textContent).toBe('\\sum_{i=1}^n i')
  })

  it('does not interpret math when markdown is false', () => {
    const { container } = renderWithMath(textComponent('Price $x$ stays literal', false))

    expect(container.querySelector('math')).toBeNull()
    expect(container.textContent).toContain('Price $x$ stays literal')
  })

  it('renders simple math in a standard table cell without relying on underscores', () => {
    const { container } = renderWithMath(tableComponent('Result: $x + 1$'))

    expect(container.querySelector('tbody math')?.textContent).toBe('x + 1')
    expect(container.querySelector('tbody')?.textContent).toContain('Result:')
  })

  it('threads the provider renderer through the virtualized table path', async () => {
    const { container } = renderWithMath(tableComponent('$x + 2$', { virtualize: true }))

    await waitFor(() => expect(container.querySelector('tbody math')?.textContent).toBe('x + 2'))
  })

  it('composes math, Markdown links, and citations in one table cell', () => {
    const { container } = renderWithMath(tableComponent(
      '$x + 1$ [documentation](https://example.test/docs) [1]',
      { citationMap: { 1: { page: 7, file: 'proof.pdf' } } },
    ))

    expect(container.querySelector('tbody math')?.textContent).toBe('x + 1')
    const link = container.querySelector('tbody a')
    expect(link?.getAttribute('href')).toBe('https://example.test/docs')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link?.className).toBe('text-blue-600 dark:text-blue-400 hover:underline')
    expect(container.querySelector('[data-citation-page="7"]')).not.toBeNull()
  })

  it('composes nested math in a cell link with a citation', () => {
    const { container } = renderWithMath(tableComponent(
      '[formula $x + 1$](https://example.test/math) [1]',
      { citationMap: { 1: { page: 11, file: 'nested.pdf' } } },
    ))

    const link = container.querySelector('tbody a')
    expect(link?.querySelector('math')?.textContent).toBe('x + 1')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(container.querySelector('[data-citation-page="11"]')).not.toBeNull()
  })

  it('drops dangerous Markdown link destinations in math cells', () => {
    const { container } = renderWithMath(tableComponent('$x$ [unsafe](javascript:alert(1))'))
    const link = container.querySelector('tbody a')

    expect(link).not.toBeNull()
    expect(link?.hasAttribute('href')).toBe(false)
    expect(container.innerHTML).not.toContain('javascript:')
  })

  it('preserves Markdown entities and nested emphasis when citations share a math cell', () => {
    const source = 'A &amp; B **bold** $x$ [1]'
    const withoutCitations = renderWithMath(tableComponent(source))
    const baselineCell = withoutCitations.container.querySelector('tbody td')
    expect(baselineCell?.textContent).toContain('A & B bold x [1]')
    expect(baselineCell?.querySelector('strong')?.textContent).toBe('bold')
    cleanup()

    const withCitations = renderWithMath(tableComponent(source, {
      citationMap: { 1: { page: 9, file: 'entities.pdf' } },
    }))
    const citedCell = withCitations.container.querySelector('tbody td')
    expect(citedCell?.textContent).toContain('A & B bold x')
    expect(citedCell?.textContent).not.toContain('&amp;')
    expect(citedCell?.querySelector('strong')?.textContent).toBe('bold')
    expect(citedCell?.querySelector('[data-citation-page="9"]')).not.toBeNull()
  })

  it('does not mistake TeX optional arguments for citations', () => {
    const { container } = renderWithMath(tableComponent(
      '$\\sqrt[3]{x}$ [1]',
      { citationMap: { 1: { page: 4, file: 'source.pdf' } } },
    ))

    expect(container.querySelector('math')?.textContent).toBe('\\sqrt[3]{x}')
    expect(container.querySelector('[data-citation-page="4"]')).not.toBeNull()
    expect(container.textContent).not.toContain('ref. 3')
  })

  it('leaves inline and fenced code containing dollar delimiters unchanged', () => {
    const spy = vi.fn(renderMath)
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={spy}>
        <UIResourceRenderer content={textComponent('`$x$`\n\n```tex\n$y$\n```')} />
      </MCPUIMathProvider>
    ))

    expect(spy).not.toHaveBeenCalled()
    expect(container.querySelector('code')?.textContent).toBe('$x$')
    expect(container.querySelector('pre code')?.textContent).toContain('$y$')
  })

  it.each(['$5', '$5-$10'])('preserves currency or incomplete ranges: %s', (source) => {
    const spy = vi.fn(renderMath)
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={spy}>
        <UIResourceRenderer content={textComponent(source)} />
      </MCPUIMathProvider>
    ))

    expect(spy).not.toHaveBeenCalled()
    expect(container.textContent).toContain(source)
  })

  it.each(['Cost $5 then ($x$)', 'Cost $5,($x$)', 'Cost $5 + ($x$)'])(
    'preserves currency while rendering a later formula: %s',
    (source) => {
      const { container } = renderWithMath(textComponent(source))
      expect(container.textContent).toContain('Cost $5')
      expect(container.querySelector('math')?.textContent).toBe('x')
    },
  )

  it('sanitizes hostile markup returned by the math renderer', () => {
    const hostile: MathRenderer = () =>
      '<math style="color:red"><annotation>secret</annotation><mrow onclick="alert(1)"><mi>x</mi></mrow></math><script>alert(2)</script>'
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={hostile}>
        <UIResourceRenderer content={textComponent('$x$')} />
      </MCPUIMathProvider>
    ))

    const math = container.querySelector('math')
    expect(math).not.toBeNull()
    expect(container.querySelector('script, annotation')).toBeNull()
    expect(container.innerHTML).not.toContain('onclick')
    expect(math?.hasAttribute('style')).toBe(false)
    expect(container.textContent).not.toContain('secret')
  })

  it('sanitizes math and citation callback output before mounting a table cell', () => {
    const hostileMath: MathRenderer = () => '<math><mrow onmouseover="x()"><mi>x</mi></mrow></math>'
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={hostileMath}>
        <UIResourceRenderer content={tableComponent('$x$ [1]', {
          citationMap: { 1: { page: 8, file: 'safe.pdf' } },
          citationRender: () => '<button data-citation-page="8" onclick="alert(1)">source</button><script>alert(2)</script>',
        })} />
      </MCPUIMathProvider>
    ))

    expect(container.querySelector('math')).not.toBeNull()
    expect(container.querySelector('[data-citation-page="8"]')).not.toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/onclick|onmouseover/)
  })

  it('reacts when the provider renderer changes', async () => {
    const first: MathRenderer = (tex) => `<math class="first"><mi>${tex}</mi></math>`
    const second: MathRenderer = (tex) => `<math class="second"><mi>${tex}</mi></math>`
    const [renderer, setRenderer] = createSignal<MathRenderer>(first)
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={renderer()}>
        <UIResourceRenderer content={textComponent('$x$')} />
      </MCPUIMathProvider>
    ))

    expect(container.querySelector('math.first')).not.toBeNull()
    setRenderer(() => second)
    await Promise.resolve()
    expect(container.querySelector('math.first')).toBeNull()
    expect(container.querySelector('math.second')).not.toBeNull()
  })

  it('renders a formula when streamed text changes from incomplete to complete', async () => {
    const [content, setContent] = createSignal(textComponent('Streaming $x_'))
    const { container } = render(() => (
      <MCPUIMathProvider renderMath={renderMath}>
        <UIResourceRenderer content={content()} />
      </MCPUIMathProvider>
    ))

    expect(container.querySelector('math')).toBeNull()
    expect(container.textContent).toContain('Streaming $x_')
    setContent(textComponent('Streaming $x_1$'))
    await waitFor(() => expect(container.querySelector('math')?.textContent).toBe('x_1'))
  })
})
