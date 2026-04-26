/**
 * Tests for performance markers — v5.4.0 (B.4)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { markRenderStart, markRenderEnd, PERF_PREFIX } from './perf'

describe('performance marks (v5.4.0 — B.4)', () => {
  beforeEach(() => {
    if (typeof performance !== 'undefined' && typeof performance.clearMarks === 'function') {
      performance.clearMarks()
    }
    if (typeof performance !== 'undefined' && typeof performance.clearMeasures === 'function') {
      performance.clearMeasures()
    }
  })

  it('PERF_PREFIX is the documented namespace', () => {
    expect(PERF_PREFIX).toBe('mcp-ui:component:')
  })

  it('markRenderStart writes a `:render-start` mark with the component id', () => {
    markRenderStart('cmp-A')
    const entries = performance.getEntriesByName('mcp-ui:component:cmp-A:render-start')
    expect(entries.length).toBe(1)
    expect(entries[0].entryType).toBe('mark')
  })

  it('markRenderEnd writes both `:render-end` mark and a `:render` measure', () => {
    markRenderStart('cmp-B')
    markRenderEnd('cmp-B')

    const endEntries = performance.getEntriesByName('mcp-ui:component:cmp-B:render-end')
    expect(endEntries.length).toBe(1)

    const measureEntries = performance.getEntriesByName('mcp-ui:component:cmp-B:render')
    expect(measureEntries.length).toBe(1)
    expect(measureEntries[0].entryType).toBe('measure')
    expect(measureEntries[0].duration).toBeGreaterThanOrEqual(0)
  })

  it('markRenderEnd without a preceding markRenderStart still writes the end mark (no throw)', () => {
    expect(() => markRenderEnd('cmp-orphan')).not.toThrow()
    const endEntries = performance.getEntriesByName('mcp-ui:component:cmp-orphan:render-end')
    expect(endEntries.length).toBe(1)
    // measure may or may not be created, but it must NOT crash the render path
  })

  it('mark functions are no-ops when performance is undefined (SSR-safe)', () => {
    const originalPerf = (globalThis as any).performance
    ;(globalThis as any).performance = undefined
    try {
      expect(() => markRenderStart('ssr')).not.toThrow()
      expect(() => markRenderEnd('ssr')).not.toThrow()
    } finally {
      ;(globalThis as any).performance = originalPerf
    }
  })
})
