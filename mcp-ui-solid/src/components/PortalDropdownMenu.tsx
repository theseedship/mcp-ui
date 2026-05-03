/**
 * PortalDropdownMenu (v6.4.0) — generic dropdown that mounts via
 * `<Portal>` on `document.body` instead of an in-tree `position: absolute`
 * sibling. Eliminates two pain points around the legacy in-tree pattern :
 *
 *   1. **`overflow: hidden` clipping** — when the trigger lives inside a
 *      chat bubble or a card with `overflow: hidden`, an absolutely
 *      positioned menu sibling gets clipped at the ancestor's boundary.
 *      Mounting on `document.body` escapes the clip stack entirely.
 *   2. **`z-index` wars** — chat surfaces stack composer / message rails
 *      above the message list, and ancestor `z-index` creates a new
 *      stacking context that captures the in-tree menu. A portal is a
 *      sibling of the document, so a single `z-index: 9999` wins.
 *
 * The menu is positioned with `position: fixed` from the trigger's
 * `getBoundingClientRect()`. We re-measure on `scroll` (capture phase, so
 * nested scrollables also fire) and `resize` to keep the menu pinned
 * while the user interacts with surrounding chrome.
 *
 * Close affordances : click outside, Escape, programmatic via `onClose`.
 */

import { Component, JSX, Show, createSignal, createEffect, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'

export interface PortalDropdownMenuProps {
  /**
   * Whether the menu is currently open. Controlled by the parent.
   */
  open: boolean

  /**
   * Called when the menu wants to close (outside click / Escape / item
   * click — it's the parent's job to actually flip `open` to false).
   */
  onClose: () => void

  /**
   * Trigger element used as the positioning anchor. The menu's right
   * edge is aligned to the trigger's right edge, top to its bottom + 4px.
   */
  trigger: HTMLElement | undefined

  /**
   * Menu width in pixels. Used to compute the left coordinate so the menu's
   * right edge aligns with the trigger's right edge. Default : `144` (the
   * legacy table menu width — `w-36`).
   */
  width?: number

  /**
   * Menu content. Wrapped in the rounded / shadowed container — keep
   * children minimal (just the items).
   */
  children: JSX.Element

  /**
   * Optional additional class names for the menu container, appended after
   * the default Tailwind classes. Useful to override width or padding.
   */
  class?: string
}

export const PortalDropdownMenu: Component<PortalDropdownMenuProps> = (props) => {
  const [position, setPosition] = createSignal({ top: 0, left: 0 })
  let menuRef: HTMLDivElement | undefined

  const updatePosition = () => {
    const t = props.trigger
    if (!t) return
    const rect = t.getBoundingClientRect()
    const w = props.width ?? 144
    setPosition({
      top: rect.bottom + 4,
      left: rect.right - w,
    })
  }

  // Measure once when the menu opens, then react to viewport changes.
  createEffect(() => {
    if (!props.open) return
    updatePosition()

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef?.contains(target) || props.trigger?.contains(target)) return
      props.onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    const onScrollOrResize = () => updatePosition()

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Capture phase so scrolls inside nested containers (e.g. chat virtual
    // list) also re-position the menu. `passive: true` because we never
    // preventDefault here.
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true })
    window.addEventListener('resize', onScrollOrResize)

    onCleanup(() => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, { capture: true })
      window.removeEventListener('resize', onScrollOrResize)
    })
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: `${position().top}px`,
            left: `${position().left}px`,
            'z-index': 9999,
            width: `${props.width ?? 144}px`,
          }}
          class={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 text-sm ${props.class ?? ''}`}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  )
}
