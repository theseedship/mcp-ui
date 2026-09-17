/**
 * `formatMCPUIString` — the chrome-string template helper, runtime-free.
 *
 * @since v6.20.0 (extracted from `MCPUIStringsContext` so the pure adapters
 * under `src/adapters` can interpolate their own message templates without
 * importing `solid-js`). `MCPUIStringsContext` re-exports it, so every
 * existing import path — including the root barrel — keeps working.
 *
 * This module imports nothing. It must stay that way: `src/adapters/*` is
 * published as a dedicated subpath that never pulls in the renderer.
 */

/**
 * Substitutes `{name}` placeholders in a chrome string template.
 *
 * Only the keys present in `vars` are replaced; an unknown placeholder is
 * left verbatim so a mistyped or locale-specific template degrades to
 * visible text rather than to `undefined`.
 *
 * @example
 * ```ts
 * formatMCPUIString('Sort by {column}', { column: 'Revenue' }) // 'Sort by Revenue'
 * formatMCPUIString('Export CSV ({count} rows)', { count: 42 }) // 'Export CSV (42 rows)'
 * ```
 */
export function formatMCPUIString(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  )
}
