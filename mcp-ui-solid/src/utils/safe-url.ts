/**
 * URL allow-list for attributes that the browser *navigates* or *fetches*
 * (`href`, `src`).
 *
 * `sanitizeHtml` only protects `innerHTML` sinks. Values that are bound into
 * a JSX attribute never touch DOMPurify, so an LLM-authored URL reaches the
 * DOM verbatim — `[![x](https://ok/1.png)](javascript:alert(1)) *credit*` used
 * to produce a clickable `javascript:` anchor in `TextRenderer`'s image
 * branch.
 *
 * This module is an **allow-list**, not a blocklist: anything that is not
 * provably one of the permitted forms is rejected.
 */

/** Schemes that may appear in an `href`. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** Relative forms that never carry a scheme. */
const RELATIVE_PREFIXES = ['/', './', '../', '#', '?']

/** `data:` images small enough to be inlined by a producer. */
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]*$/i

/**
 * Control characters (including CR/LF/TAB). Browsers strip these while parsing
 * a URL, so `java&#10;script:alert(1)` would otherwise sneak past a scheme
 * check and still execute.
 */
const CONTROL_CHARS_RE = /\p{Cc}/u

export interface SafeUrlOptions {
  /** Also allow `data:image/(png|jpeg|jpg|gif|webp);base64,…` (for `<img src>`). */
  allowDataImage?: boolean
}

/**
 * Return `url` unchanged when it is safe to bind into `href`/`src`, or
 * `undefined` when it is not.
 *
 * Allowed: relative URLs (`/`, `./`, `../`, `#`, `?` and bare paths) and
 * absolute URLs whose scheme is `http:`, `https:`, `mailto:` or `tel:` —
 * plus base64 `data:` images when `allowDataImage` is set.
 *
 * Rejected: `javascript:`, `data:text/html`, `vbscript:`, `file:`, `blob:`,
 * anything unparseable, and any string containing control characters or
 * newlines (`java\nscript:` normalizes back to `javascript:` in a browser).
 *
 * The original (trimmed) string is returned so relative URLs keep resolving
 * against the document, not against the internal parse base.
 */
export function safeUrl(url: string, opts?: SafeUrlOptions): string | undefined {
  if (typeof url !== 'string') return undefined

  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (CONTROL_CHARS_RE.test(trimmed)) return undefined

  if (RELATIVE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return trimmed

  if (DATA_IMAGE_RE.test(trimmed)) return opts?.allowDataImage ? trimmed : undefined

  let protocol: string
  try {
    // A base is required so bare relative paths (`docs/a.png`) parse; an
    // absolute URL ignores it and keeps its own scheme.
    protocol = new URL(trimmed, 'https://mcp-ui.invalid/').protocol
  } catch {
    return undefined
  }

  return ALLOWED_PROTOCOLS.has(protocol.toLowerCase()) ? trimmed : undefined
}
