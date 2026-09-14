import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import { GridRenderer } from './GridRenderer'
import { RenderProvider } from './RenderContext'
import type { UIComponent, UILayout } from '../types'

const observers: Array<{
  callback: ResizeObserverCallback
  element?: Element
  disconnect: ReturnType<typeof vi.fn>
}> = []

function resize(element: Element, width: number) {
  const observer = observers.find((item) => item.element === element)
  expect(observer).toBeDefined()
  observer!.callback([{ target: element, contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
}

function textComponent(id: string, colStart = 1, colSpan = 6): UIComponent {
  return { id, type: 'text', position: { colStart, colSpan, rowStart: 2, rowSpan: 2 }, params: { content: id } }
}

function layout(): UILayout {
  return { id: 'responsive-test', grid: { columns: 12, gap: '1rem' }, components: [textComponent('first'), textComponent('second', 7)] }
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('ResizeObserver', class {
    item: typeof observers[number]
    constructor(callback: ResizeObserverCallback) {
      this.item = { callback, disconnect: vi.fn() }
      observers.push(this.item)
    }
    observe(element: Element) { this.item.element = element }
    disconnect() { this.item.disconnect() }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('responsive read-only grids', () => {
  it('stacks inside a narrow container and restores explicit desktop positions without mutating input', () => {
    const input = layout()
    const original = JSON.stringify(input)
    const { container } = render(() => <UIResourceRenderer content={input} />)
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    const first = grid.children[0] as HTMLElement
    const second = grid.children[1] as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))')
    resize(grid, 420)
    expect(grid.dataset.mcpUiStacked).toBe('true')
    expect(grid.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')
    expect(first.style.gridColumn).toBe('1 / -1')
    expect(second.style.gridRow).toBe('auto')
    expect(grid.textContent!.indexOf('first')).toBeLessThan(grid.textContent!.indexOf('second'))
    resize(grid, 640)
    expect(grid.dataset.mcpUiStacked).toBe('false')
    expect(second.style.gridColumn).toBe('7 / span 6')
    expect(second.style.gridRow).toBe('2 / span 2')
    expect(JSON.stringify(input)).toBe(original)
  })

  it('uses the container width on initial mount, independently of the viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 360 } as DOMRect)
    const { container } = render(() => <UIResourceRenderer content={layout()} />)
    expect(window.innerWidth).toBeGreaterThan(640)
    expect(container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!.dataset.mcpUiStacked).toBe('true')
  })

  it('does not switch on hidden or invalid observer measurements and disconnects on unmount', () => {
    const { container, unmount } = render(() => <UIResourceRenderer content={layout()} />)
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    resize(grid, 320)
    for (const width of [0, -1, Number.NaN]) resize(grid, width)
    expect(grid.dataset.mcpUiStacked).toBe('true')
    const observer = observers.find((item) => item.element === grid)!
    unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
  })

  it('keeps components without a position inside the configured column count', () => {
    const input = layout()
    input.grid.columns = 2
    input.components = [{ id: 'unpositioned', type: 'text', params: { content: 'Full width' } } as UIComponent]
    const { container } = render(() => <UIResourceRenderer content={input} />)
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    expect((grid.children[0] as HTMLElement).style.gridColumn).toBe('1 / -1')
  })

  it('measures nested grids independently and removes named areas only while stacked', () => {
    const input: UIComponent = {
      id: 'nested', type: 'grid', position: { colStart: 1, colSpan: 12 },
      params: { columns: 2, areas: [['left', 'right']], children: [textComponent('left', 1, 1), textComponent('right', 2, 1)] },
    }
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={input} />
      </RenderProvider>
    ))
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    expect(grid.style.gridTemplateAreas).toBe('"left right"')
    resize(grid, 500)
    expect(grid.style.gridTemplateAreas).toBe('')
    expect((grid.children[1] as HTMLElement).style.gridColumn).toBe('1 / -1')
    resize(grid, 800)
    expect(grid.style.gridTemplateAreas).toBe('"left right"')
    expect((grid.children[1] as HTMLElement).style.gridColumn).toBe('2 / span 1')
  })

  it('updates layout components while retaining the narrow-container presentation', () => {
    const [input, setInput] = createSignal(layout())
    const { container } = render(() => <UIResourceRenderer content={input()} />)
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    resize(grid, 400)
    setInput({ ...layout(), components: [textComponent('replacement')] })
    expect(grid.children.length).toBe(1)
    expect(grid.textContent).toContain('replacement')
    expect((grid.children[0] as HTMLElement).style.gridColumn).toBe('1 / -1')
  })

  it('falls back to window resize when ResizeObserver is unavailable and cleans up', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    let width = 900
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect)
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const { container, unmount } = render(() => <UIResourceRenderer content={layout()} />)
    const grid = container.querySelector<HTMLElement>('[data-mcp-ui-grid]')!
    width = 400
    window.dispatchEvent(new Event('resize'))
    expect(grid.dataset.mcpUiStacked).toBe('true')
    unmount()
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
