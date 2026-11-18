/** Imperative TanStack core bridge; the owning Solid 2 component owns signals. */
import type { VirtualItem } from '@tanstack/virtual-core'
type VirtualCore = typeof import('@tanstack/virtual-core')

export interface TableVirtualizerConfig {
  count: number
  rowHeight: number
  overscan: number
}

export interface TableVirtualizerHandle {
  getVirtualItems(): VirtualItem[]
  getTotalSize(): number
  update(config: TableVirtualizerConfig): void
  dispose(): void
}

/** Called only after the browser scroll element exists; no reactive root is hidden here. */
export function createTableVirtualizer(
  getScrollElement: () => HTMLDivElement | null,
  config: TableVirtualizerConfig,
  onChange: () => void,
  core: VirtualCore,
): TableVirtualizerHandle {
  let disposed = false
  // The component loads the optional namespace dynamically. A static named
  // import here would fail an optimized Vite build against its absent-peer
  // stub before the component's fallback catch could run.
  const instance = new core.Virtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: config.count,
    estimateSize: () => config.rowHeight,
    overscan: config.overscan,
    getScrollElement,
    scrollToFn: core.elementScroll,
    observeElementRect: core.observeElementRect,
    observeElementOffset: core.observeElementOffset,
    onChange: () => { if (!disposed) onChange() },
  })
  const stop = instance._didMount()
  try {
    instance._willUpdate()
  } catch (error) {
    stop()
    throw error
  }
  return {
    getVirtualItems: () => instance.getVirtualItems(),
    getTotalSize: () => instance.getTotalSize(),
    update(next) {
      if (disposed) return
      instance.setOptions({ ...instance.options, count: next.count,
        overscan: next.overscan, estimateSize: () => next.rowHeight })
      instance.measure()
      instance._willUpdate()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
    },
  }
}
