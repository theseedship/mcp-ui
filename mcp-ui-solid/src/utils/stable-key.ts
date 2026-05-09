/**
 * Stable identity key for UIResource payloads (v6.5.0).
 *
 * Consumers need a way to derive a deterministic key from a layout/component
 * payload — for `<For>` keys, dedup detection, telemetry correlation, etc.
 *
 * Spec semantics : `UILayout.id` and `UIComponent.id` are obligatoires for
 * any well-formed payload. When they are present and non-empty, this helper
 * returns them as-is. When they are missing (e.g. consumer passing a "bare"
 * chart payload `{ type: 'chart', params: {...} }` without wrapping it in
 * a layout), the helper derives a stable key from the *content* — never
 * from a timestamp or counter.
 *
 * The hash is FNV-1a 32-bit on a deterministically stringified form of the
 * payload (sorted keys, undefined entries skipped). This is intentionally
 * synchronous and dependency-free so consumers can call it inside a Solid
 * memo or render function without ceremony.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a(str: string): string {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

/**
 * Deterministic JSON-like serialization. Object keys are sorted ; entries
 * with `undefined` values are skipped (mirroring `JSON.stringify` semantics
 * but with a stable order). Used as the input to `fnv1a()`.
 */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  )
}

/**
 * Strip fields that should NOT contribute to identity :
 *   - top-level `id` : we're computing the absent identity
 *   - `metadata.generatedAt` : timestamp of generation, not of identity
 */
function normalizeForHash(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const { id: _id, ...rest } = input as Record<string, unknown>
  void _id
  if (rest.metadata && typeof rest.metadata === 'object' && !Array.isArray(rest.metadata)) {
    const meta = rest.metadata as Record<string, unknown>
    const { generatedAt: _t, ...metaRest } = meta
    void _t
    rest.metadata = Object.keys(metaRest).length > 0 ? metaRest : undefined
  }
  return rest
}

/**
 * Returns a stable identity key for a UIResource payload.
 *
 * - If `input.id` is a non-empty string, returns it verbatim. This is the
 *   path taken by well-formed payloads (cf. spec §Identity).
 * - Otherwise, returns a 7-char base36 FNV-1a hash of the normalized
 *   content. Stable across renders, identical for structurally identical
 *   payloads.
 *
 * The hash is NOT cryptographic ; it's a dedup/correlation key. Collisions
 * are theoretically possible but vanishingly rare for the payload shapes
 * MCP-UI emits in practice.
 */
export function getUiResourceStableKey(input: unknown): string {
  if (input && typeof input === 'object') {
    const id = (input as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) return id
  }
  return fnv1a(stableStringify(normalizeForHash(input)))
}
