import { createEffect, onCleanup } from 'solid-js'

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
export function bindPortalTheme(portal: HTMLElement, source: () => HTMLElement | undefined): void {
  createEffect(() => {
    const anchor = source()
    const view = anchor?.ownerDocument.defaultView
    if (!anchor || !view) return
    const copied = new Set<string>()
    const sync = () => {
      const style = view.getComputedStyle(anchor)
      const inherited = portal.parentElement ? view.getComputedStyle(portal.parentElement) : undefined
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
        if (!values.has(name)) portal.style.removeProperty(name)
      }
      copied.clear()
      for (const [name, value] of values) {
        if (portal.style.getPropertyValue(name) !== value) portal.style.setProperty(name, value)
        copied.add(name)
      }
      portal.classList.toggle('dark', anchor.closest('.dark') !== null)
    }
    sync()
    const stop = observeTheme(anchor, sync)
    onCleanup(() => {
      stop()
      for (const name of copied) portal.style.removeProperty(name)
      portal.classList.remove('dark')
    })
  })
}
