/**
 * `<SafeHtml>` — the only place in this package that binds a string to
 * `innerHTML`.
 *
 * Two jobs:
 *
 *  1. Render the (already sanitized — see `sanitizeHtml`) markup through the
 *     `innerHTML` prop, so SSR still emits content and client renders/updates
 *     stay reactive.
 *  2. Repair the hydration hole. `solid-js/web`'s `setProperty(node,
 *     'innerHTML', v)` returns early while hydrating, so the server-rendered
 *     content (escaped plain text, per the SSR contract) would otherwise stay
 *     in the DOM forever. `onMount` runs client-side only, after hydration, and
 *     re-applies `html()` when the live DOM disagrees with it.
 *
 * @see ../utils/sanitize-html
 */

import { onMount, splitProps, type JSX } from 'solid-js'

export interface SafeHtmlProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /**
   * Accessor returning **already sanitized** HTML. Kept as an accessor (not a
   * plain string) so the value stays reactive through `splitProps`.
   */
  html: () => string
}

/**
 * Apply `html` to `el` when the live DOM content differs.
 *
 * Exported for tests: the hydration path it exists for cannot be reproduced in
 * jsdom, so the fix-up is unit-tested directly against a "stale" element.
 *
 * @returns `true` when the DOM was patched.
 * @internal
 */
export function _applySafeHtml(el: HTMLElement | undefined, html: string): boolean {
  if (!el) return false
  const next = html ?? ''
  if (el.innerHTML === next) return false
  el.innerHTML = next
  return true
}

export function SafeHtml(props: SafeHtmlProps): JSX.Element {
  const [local, rest] = splitProps(props, ['html'])
  let el: HTMLDivElement | undefined

  onMount(() => {
    _applySafeHtml(el, local.html())
  })

  // `innerHTML` is written last on purpose: it must win over anything the
  // caller spreads in. Later reactive updates ride the prop's render effect.
  return <div ref={el} {...rest} innerHTML={local.html()} />
}
