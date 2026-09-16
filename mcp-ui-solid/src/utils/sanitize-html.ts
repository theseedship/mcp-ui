/**
 * SSR-safe HTML sanitizer — the single entry point for every value that this
 * package binds into an `innerHTML` sink.
 *
 * ## Why this module exists (the SSR contract)
 *
 * `dompurify` is a DOM-bound library. When it is loaded in an environment
 * without a real `window.document` (Node / SSR), `createDOMPurify()` bails out
 * early: it sets `DOMPurify.isSupported = false` and returns a *factory*
 * object on which **`sanitize` is not even defined** (dompurify 3.4.x,
 * `purify.es.mjs` ~L370). Depending on the version that means the call either
 * throws (`sanitize is not a function`) or silently returns the input
 * unchanged — neither is acceptable:
 *
 *  - Solid's SSR renderer writes an `innerHTML` prop **raw** into the HTML
 *    response, so an unsanitized string becomes live markup in the document.
 *  - `solid-js/web`'s `setProperty(node, 'innerHTML', v)` returns early while
 *    hydrating (`if (isHydrating(node)) return`), so whatever the server
 *    emitted survives hydration untouched until the value changes.
 *
 * The contract implemented here:
 *
 *  - **Server (or any environment where DOMPurify cannot run):** never emit
 *    markup. Strip tags cosmetically, then `escapeHtml()` the remainder. The
 *    security property comes from `escapeHtml` alone — `stripTags` only keeps
 *    the server-rendered text from being littered with visible `<b>` noise.
 *  - **Client:** run the real DOMPurify with the caller's profile, and let
 *    `<SafeHtml>` re-apply the rich version after hydration (its `onMount`
 *    patches `el.innerHTML` when the hydrated DOM differs from the current
 *    value, covering the skipped `setProperty`).
 *
 * Net effect: the server ships escaped plain text (safe, readable, no layout
 * shift beyond inline formatting), the client upgrades it to sanitized rich
 * HTML on mount.
 *
 * @see ./escape-html for the escaper
 * @see ../components/SafeHtml for the hydration fix-up
 */

import DOMPurify, { type Config } from 'dompurify'
import { isServer } from 'solid-js/web'
import { escapeHtml } from './escape-html'

/** DOMPurify configuration object (re-exported so call sites need not import dompurify). */
export type SanitizeConfig = Config

/**
 * Cosmetic tag removal for the server path. NOT a security boundary — the
 * output is always run through `escapeHtml` afterwards.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Named DOMPurify profiles used across the package.
 *
 * `cellLink` / `cellMarkdown` / `cellHtml` are the *exact* configs that lived
 * inline in `renderCellValue` — table-cell behaviour (citation chips rely on
 * `data-citation-*`, `<button>`, `<svg>`, `<path>`) must not drift.
 */
export const SANITIZE_PROFILES = {
  /**
   * Rich prose for `TextRenderer` (markdown output *and* raw `content`).
   *
   * Starts from DOMPurify's default HTML profile so markdown tables, images,
   * `<hr>`, `<del>`, `<sup>`/`<sub>` and task-list checkboxes survive, then
   * removes the tags/attributes that have no business in LLM-authored prose.
   *
   * `<input>` is intentionally left allowed: DOMPurify's default attribute
   * allow-list keeps `type` / `checked` / `disabled` (what `marked` emits for
   * task lists) and drops every event handler, and `<form>` is forbidden here
   * so nothing can be submitted. See `sanitize-html.test.ts`.
   */
  prose: {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'form', 'textarea', 'select', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  },

  /** Markdown-link rewrite inside a table cell (`[text](url)` → `<a>`). */
  cellLink: {
    ADD_ATTR: ['target', 'rel'],
  },

  /** `marked` output inside a table cell. */
  cellMarkdown: {
    ALLOWED_TAGS: ['a', 'strong', 'em', 'b', 'i', 'code', 'span', 'br', 'button', 'svg', 'path', 'p', 'ul', 'ol', 'li', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-citation-page', 'data-citation-source', 'data-citation-doc', 'data-citation-verified', 'title', 'fill', 'stroke', 'viewBox', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'd'],
    ADD_ATTR: ['target', 'rel'],
  },

  /** Raw HTML found in a table cell value. */
  cellHtml: {
    ALLOWED_TAGS: ['a', 'strong', 'em', 'b', 'i', 'code', 'span', 'br', 'button', 'svg', 'path'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-citation-page', 'data-citation-source', 'data-citation-doc', 'data-citation-verified', 'title', 'fill', 'stroke', 'viewBox', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'd'],
    ADD_ATTR: ['target', 'rel'],
  },

  /** `UIResourceHtmlRenderer` — DOMPurify defaults, unchanged from v6.18.0. */
  resource: {},
} satisfies Record<string, SanitizeConfig>

/**
 * Sanitize `html` for binding into an `innerHTML` sink.
 *
 * @param html   Untrusted markup (LLM output, tool payload, user input).
 * @param config A `SANITIZE_PROFILES` entry, or an ad-hoc DOMPurify config.
 * @returns Sanitized markup on the client; escaped plain text on the server
 *          or whenever DOMPurify cannot run.
 */
export function sanitizeHtml(html: string, config?: SanitizeConfig): string {
  if (html === null || html === undefined) return ''
  const input = typeof html === 'string' ? html : String(html)

  // Server, or a client where DOMPurify bailed out (no document, jsdom-less
  // worker, CSP-sandboxed iframe…): never emit markup.
  if (isServer || !DOMPurify.isSupported || typeof DOMPurify.sanitize !== 'function') {
    return escapeHtml(stripTags(input))
  }

  return DOMPurify.sanitize(input, config ?? {}) as unknown as string
}
