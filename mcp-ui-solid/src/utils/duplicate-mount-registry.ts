/**
 * Opt-in duplicate-mount registry (v6.5.0).
 *
 * Tracks how many times each `getUiResourceStableKey()` has been mounted
 * concurrently across all `<UIResourceRenderer>` instances. When the same
 * key is mounted more than once, registered reporters fire so consumers
 * can detect double-render bugs in their parent framework.
 *
 * **Opt-in by design** : the registry is always populated (cheap), but
 * notifications only fire when a consumer has wired one of the two opt-in
 * paths :
 *   - module-level `setDuplicateMountReporter(fn)` (app-wide telemetry)
 *   - per-instance `<UIResourceRenderer onMountDuplicate={fn}>` prop
 *
 * **What this does NOT do** : visual deduplication. The renderer never
 * hides or replaces a duplicate mount automatically — that would mask
 * parent-framework bugs and could remove legitimate co-mounts (e.g. drawer
 * + main panel showing the same card). Consumers who want dedup implement
 * it on top of the reported events.
 */

export interface DuplicateMountInfo {
  /** Stable key from `getUiResourceStableKey(content)`. */
  key: string
  /**
   * Current concurrent mount count. The reporter fires whenever this
   * crosses 2 (i.e. on the 2nd, 3rd, etc. mount of the same key while
   * earlier mounts are still alive).
   */
  count: number
  /** `Date.now()` of the FIRST mount of this key (telemetry, not identity). */
  firstMountedAt: number
}

export type DuplicateMountReporter = (info: DuplicateMountInfo) => void

const registry = new Map<string, { count: number; firstMountedAt: number }>()
let moduleReporter: DuplicateMountReporter | null = null

/**
 * Wire a module-level reporter for duplicate mount events. Pass `null` to
 * unwire. Only one module reporter at a time (replaces any previous one).
 *
 * @example
 * ```ts
 * import { setDuplicateMountReporter } from '@seed-ship/mcp-ui-solid'
 *
 * setDuplicateMountReporter(({ key, count }) => {
 *   telemetry.warn('mcp-ui.duplicate-mount', { key, count })
 * })
 * ```
 */
export function setDuplicateMountReporter(reporter: DuplicateMountReporter | null): void {
  moduleReporter = reporter
}

/**
 * Internal — read by `<UIResourceRenderer>` to dispatch on mount. Not part
 * of the public API.
 *
 * @internal
 */
export function getDuplicateMountReporter(): DuplicateMountReporter | null {
  return moduleReporter
}

/**
 * Internal — registers a mount for `key` and returns the resulting state.
 * The caller decides whether to surface a notification based on `count > 1`.
 *
 * @internal
 */
export function _registerMount(key: string): DuplicateMountInfo {
  const entry = registry.get(key) ?? { count: 0, firstMountedAt: Date.now() }
  entry.count += 1
  registry.set(key, entry)
  return { key, count: entry.count, firstMountedAt: entry.firstMountedAt }
}

/**
 * Internal — undoes a prior `_registerMount(key)`. Removes the entry when
 * the count reaches zero so the registry never leaks across mount/unmount
 * cycles of unique keys.
 *
 * @internal
 */
export function _unregisterMount(key: string): void {
  const entry = registry.get(key)
  if (!entry) return
  entry.count -= 1
  if (entry.count <= 0) registry.delete(key)
}

/**
 * Internal — clears the registry and unwires any module reporter. Used by
 * tests to ensure isolation between cases.
 *
 * @internal
 */
export function _resetRegistry(): void {
  registry.clear()
  moduleReporter = null
}

/**
 * Internal — read the current count for a key (0 if not mounted). Useful
 * for tests and for consumers building their own debug overlays.
 *
 * @internal
 */
export function _getMountCount(key: string): number {
  return registry.get(key)?.count ?? 0
}
