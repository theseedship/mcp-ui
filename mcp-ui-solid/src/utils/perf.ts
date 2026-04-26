/**
 * Performance markers for component renders (v5.4.0)
 *
 * Emits `performance.mark()` entries that show up automatically in Chrome
 * DevTools "Performance" panel under user timings. Consumers can also
 * query them via `performance.getEntriesByName(...)` for custom tracing.
 *
 * Naming convention :
 *   `mcp-ui:component:<id>:render-start`
 *   `mcp-ui:component:<id>:render-end`
 *   `mcp-ui:component:<id>:render`         (a `measure` between the two)
 *
 * Always-on: marks are cheap (sub-microsecond) and only matter when a
 * profiler is recording. SSR-safe (`performance` is guarded).
 */

export const PERF_PREFIX = 'mcp-ui:component:'

function hasPerf(): boolean {
  return typeof performance !== 'undefined' && typeof performance.mark === 'function'
}

export function markRenderStart(componentId: string): void {
  if (!hasPerf()) return
  try {
    performance.mark(`${PERF_PREFIX}${componentId}:render-start`)
  } catch {
    // Ignore — performance.mark can throw on malformed names; not worth crashing the render.
  }
}

export function markRenderEnd(componentId: string): void {
  if (!hasPerf()) return
  try {
    performance.mark(`${PERF_PREFIX}${componentId}:render-end`)
    if (typeof performance.measure === 'function') {
      try {
        performance.measure(
          `${PERF_PREFIX}${componentId}:render`,
          `${PERF_PREFIX}${componentId}:render-start`,
          `${PERF_PREFIX}${componentId}:render-end`
        )
      } catch {
        // Start mark may be missing if the render path was short-circuited — ignore.
      }
    }
  } catch {
    // Ignore.
  }
}
