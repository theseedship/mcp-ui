import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as core from '@tanstack/virtual-core'
import { createTableVirtualizer, type TableVirtualizerConfig, type TableVirtualizerHandle } from './solid2-virtualizer'

// Only the browser's layout sensor is simulated. The adapter runs the real
// pinned TanStack core, including its observers, range extraction and timers.
const observers = new Set<LayoutObserver>()
class LayoutObserver {
  readonly targets = new Set<Element>()
  constructor(readonly callback: ResizeObserverCallback) { observers.add(this) }
  observe(target: Element) { this.targets.add(target) }
  unobserve(target: Element) { this.targets.delete(target) }
  disconnect() { this.targets.clear() }
}

function viewport(initialHeight = 100) {
  const element = document.createElement('div')
  let height = initialHeight
  Object.defineProperties(element, {
    offsetHeight: { get: () => height },
    offsetWidth: { get: () => 300 },
  })
  element.scrollTo = vi.fn((options: ScrollToOptions | number, y?: number) => {
    element.scrollTop = typeof options === 'number' ? y ?? 0 : options.top ?? element.scrollTop
  }) as typeof element.scrollTo
  const add = vi.spyOn(element, 'addEventListener')
  const remove = vi.spyOn(element, 'removeEventListener')
  document.body.appendChild(element)
  return {
    element, add, remove,
    scroll(top: number) {
      element.scrollTop = top
      element.dispatchEvent(new Event('scroll'))
    },
    resize(nextHeight: number) {
      height = nextHeight
      for (const observer of observers) if (observer.targets.has(element)) {
        observer.callback([
          { target: element, borderBoxSize: [{ inlineSize: 300, blockSize: height }] } as unknown as ResizeObserverEntry,
        ], observer as unknown as ResizeObserver)
      }
    },
    subscriptions() {
      const added = add.mock.calls.filter(([name]) => name === 'scroll').length
      const removed = remove.mock.calls.filter(([name]) => name === 'scroll').length
      return added - removed
    },
  }
}

const handles: TableVirtualizerHandle[] = []
function mount(getElement: () => HTMLDivElement | null, config: TableVirtualizerConfig, change = vi.fn()) {
  const handle = createTableVirtualizer(getElement, config, change, core)
  handles.push(handle)
  return { handle, change }
}
const indices = (handle: TableVirtualizerHandle) => handle.getVirtualItems().map((item) => item.index)
const config = { count: 100, rowHeight: 20, overscan: 2 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', LayoutObserver)
})
afterEach(() => {
  for (const handle of handles.splice(0)) handle.dispose()
  vi.runOnlyPendingTimers()
  observers.clear()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Solid 2 table bridge over real TanStack virtual-core', () => {
  it('computes visible rows, overscan, row geometry and total size', () => {
    const view = viewport()
    const { handle } = mount(() => view.element, config)
    expect(handle.getTotalSize()).toBe(2000)
    expect(indices(handle)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(handle.getVirtualItems()[0]).toMatchObject({ index: 0, start: 0, end: 20, size: 20 })
    expect(view.subscriptions()).toBe(1)
  })

  it('responds to scroll events without rendering the entire collection', () => {
    const view = viewport()
    const { handle, change } = mount(() => view.element, config)
    change.mockClear()
    view.scroll(200)
    expect(indices(handle)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
    expect(handle.getVirtualItems()[0].start).toBe(160)
    expect(change).toHaveBeenCalled()
    view.scroll(1900)
    expect(indices(handle)).toEqual([93, 94, 95, 96, 97, 98, 99])
    expect(handle.getTotalSize()).toBe(2000)
  })

  it('updates count, estimated row height and overscan without adding listeners', () => {
    const view = viewport()
    const { handle } = mount(() => view.element, config)
    handle.update({ count: 10, rowHeight: 40, overscan: 0 })
    expect(handle.getTotalSize()).toBe(400)
    expect(indices(handle)).toEqual([0, 1, 2])
    expect(handle.getVirtualItems()[1]).toMatchObject({ start: 40, end: 80, size: 40 })
    handle.update({ count: 10, rowHeight: 40, overscan: 3 })
    expect(indices(handle)).toEqual([0, 1, 2, 3, 4, 5])
    view.scroll(200)
    handle.update({ count: 3, rowHeight: 40, overscan: 3 })
    expect(handle.getTotalSize()).toBe(120)
    expect(indices(handle)).toEqual([0, 1, 2])
    handle.update({ count: 0, rowHeight: 40, overscan: 3 })
    expect(handle.getTotalSize()).toBe(0)
    expect(indices(handle)).toEqual([])
    expect(view.add.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1)
    expect(view.subscriptions()).toBe(1)
  })

  it('responds to the real core ResizeObserver callback', () => {
    const view = viewport(100)
    const { handle } = mount(() => view.element, { ...config, overscan: 0 })
    expect(indices(handle)).toEqual([0, 1, 2, 3, 4])
    view.resize(200)
    expect(indices(handle)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('moves subscriptions when the scroll element changes', () => {
    const first = viewport()
    const second = viewport(200)
    let current = first.element
    const { handle, change } = mount(() => current, config)
    current = second.element
    handle.update(config)
    expect(first.subscriptions()).toBe(0)
    expect(second.subscriptions()).toBe(1)
    expect(indices(handle)).toHaveLength(12)
    change.mockClear()
    first.scroll(400)
    expect(change).not.toHaveBeenCalled()
    second.scroll(400)
    expect(change).toHaveBeenCalled()
    expect(handle.getVirtualItems()[0].index).toBe(18)
  })

  it('disposes listeners and layout observers exactly once and ignores late notifications or updates', () => {
    const view = viewport()
    const { handle, change } = mount(() => view.element, config)
    view.scroll(200) // A scroll-end debounce remains in flight in the core.
    handle.dispose()
    handle.dispose()
    expect(view.subscriptions()).toBe(0)
    expect(view.remove.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1)
    expect([...observers].every((observer) => !observer.targets.has(view.element))).toBe(true)
    change.mockClear()
    view.scroll(400)
    view.resize(300)
    vi.advanceTimersByTime(1000)
    handle.update({ count: 1, rowHeight: 100, overscan: 0 })
    expect(change).not.toHaveBeenCalled()
    expect(view.subscriptions()).toBe(0)
  })

  it('keeps two instances independent even when they share a scroll element', () => {
    const view = viewport()
    const first = mount(() => view.element, { ...config, overscan: 0 })
    const second = mount(() => view.element, { count: 30, rowHeight: 50, overscan: 1 })
    expect(view.subscriptions()).toBe(2)
    expect(first.handle.getTotalSize()).toBe(2000)
    expect(second.handle.getTotalSize()).toBe(1500)
    view.scroll(200)
    expect(indices(first.handle)).toEqual([10, 11, 12, 13, 14])
    expect(indices(second.handle)).toEqual([3, 4, 5, 6])
    first.handle.dispose()
    first.change.mockClear()
    second.change.mockClear()
    view.scroll(400)
    expect(first.change).not.toHaveBeenCalled()
    expect(second.change).toHaveBeenCalled()
    expect(indices(second.handle)).toEqual([7, 8, 9, 10])
    expect(view.subscriptions()).toBe(1)
    second.handle.dispose()
    expect(view.subscriptions()).toBe(0)
  })

  it('allows mounting before the viewport exists and attaches on update', () => {
    const view = viewport()
    let current: HTMLDivElement | null = null
    const { handle } = mount(() => current, config)
    expect(indices(handle)).toEqual([])
    expect(view.subscriptions()).toBe(0)
    current = view.element
    handle.update(config)
    expect(indices(handle)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(view.subscriptions()).toBe(1)
  })
})
