import { createEffect } from 'solid-js'

const THEME_PREFIX = '--mcp-ui-'

/** Read only explicitly supplied host tokens; blank values retain engine defaults. */
export function readThemeTokens(
  element: Element | undefined,
  names: readonly string[],
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  const view = element?.ownerDocument.defaultView
  const style = element && view ? view.getComputedStyle(element) : undefined
  for (const name of names) result[name] = style?.getPropertyValue(name).trim() || undefined
  return result
}

/** Observe inherited theme changes, including moving a mounted renderer into a portal. */
export function observeTheme(element: HTMLElement, callback: () => void): () => void {
  const view = element.ownerDocument.defaultView
  if (!view?.MutationObserver) return () => {}
  let stopped = false
  let pending = false
  const schedule = () => {
    if (pending || stopped) return
    pending = true
    queueMicrotask(() => {
      pending = false
      if (!stopped) callback()
    })
  }
  const observer = new view.MutationObserver((records) => {
    if (records.some((record) => {
      if (record.type === 'attributes') {
        return record.target instanceof view.Element && record.target.contains(element)
      }
      return [...record.addedNodes, ...record.removedNodes].some(
        (node) => node === element || node.contains(element),
      )
    })) schedule()
  })
  // Attribute names are deliberately not filtered: hosts may use any data-* selector.
  observer.observe(element.ownerDocument.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  })
  return () => {
    stopped = true
    observer.disconnect()
  }
}

/**
 * A body portal cannot inherit a local host theme. Copy only our effective
 * custom properties and dark state from its stationary anchor, and keep them
 * synchronized for the lifetime of the Solid owner. Geometry stays unchanged.
 */
export function bindPortalTheme(
  portal: HTMLElement | (() => HTMLElement | undefined),
  source: () => HTMLElement | undefined,
  enabled: () => boolean = () => true,
): void {
  // Install in the component owner, never from a ref callback. Resolve the DOM
  // ref in the imperative phase, after the conditional portal has committed.
  createEffect(() => ({ anchor: source(), enabled: enabled() }), ({ anchor, enabled }) => {
    const element = typeof portal === 'function' ? portal() : portal
    const view = anchor?.ownerDocument.defaultView
    if (!enabled || !element || !anchor || !view) return
    const copied = new Set<string>()
    const sync = () => {
      const style = view.getComputedStyle(anchor)
      const inherited = element.parentElement ? view.getComputedStyle(element.parentElement) : undefined
      const names = new Set(copied)
      for (const computed of [style, inherited]) {
        if (!computed) continue
        for (let index = 0; index < computed.length; index++) {
          const name = computed.item(index)
          if (name.startsWith(THEME_PREFIX)) names.add(name)
        }
      }
      const values = new Map<string, string>()
      for (const name of names) {
        const value = style.getPropertyValue(name).trim()
        if (value) values.set(name, value)
        // Empty setProperty removes a declaration. Explicitly block a body
        // token when the local scope reset it to the guaranteed-invalid value.
        else if (inherited?.getPropertyValue(name).trim()) values.set(name, 'initial')
      }
      for (const name of copied) {
        if (!values.has(name)) element.style.removeProperty(name)
      }
      copied.clear()
      for (const [name, value] of values) {
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value)
        copied.add(name)
      }
      element.classList.toggle('dark', anchor.closest('.dark') !== null)
    }
    sync()
    const stop = observeTheme(anchor, sync)
    return () => {
      stop()
      for (const name of copied) element.style.removeProperty(name)
      element.classList.remove('dark')
    }
  })
}
