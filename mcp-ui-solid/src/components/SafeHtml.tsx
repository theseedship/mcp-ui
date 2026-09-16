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
 *     content (escaped plain text, per the SSR contract — block structure is
 *     lost until this fix-up runs) would otherwise stay in the DOM forever.
 *     `onMount` runs client-side only, after hydration, and re-applies
 *     `html()` when the live DOM disagrees with it.
 *
 * Every sink carrying untrusted markup goes through this component: `text`
 * component content, table cells and `ui://` rawHtml resources. One sink is
 * deliberately outside it — `CodeBlockRenderer` binds highlight.js output (or
 * `escapeHtml(code)` when highlight.js is missing or throws) straight into its
 * own `<code innerHTML>`, a string that is markup-safe by construction and
 * never passes through `sanitizeHtml`.
 *
 * @see ../utils/sanitize-html
 * @see ./CodeBlockRenderer for the one innerHTML sink outside this component
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
