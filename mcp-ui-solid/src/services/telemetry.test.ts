/**
 * Tests for createTelemetryDispatcher (B.5 — v5.6.0).
 * Spec: MCP-UI-AUDIT-2026-04-26.md §M.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTelemetryDispatcher, type TelemetryEvent, type TelemetrySink } from './telemetry'

function evt(type: TelemetryEvent['type'], id = 'cmp-1'): TelemetryEvent {
  const base = { id, componentType: 'metric' as const, ts: 1_700_000_000_000 }
  switch (type) {
    case 'component:rendered':
      return { type, durationMs: 4, ...base }
    case 'validation:failed':
      return { type, errorCount: 1, firstErrorCode: 'INVALID_METRIC', ...base }
    case 'render:error':
      return { type, errorMessage: 'boom', ...base }
    case 'action:dispatched':
      return { type, actionName: 'submit', ...base }
    default:
      return { type, ...base }
  }
}

describe('createTelemetryDispatcher (v5.6.0 — B.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers events as a BATCH (array), even with bufferMs=0', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { bufferMs: 0 })
    d.dispatch(evt('component:mounted'))
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0][0]).toHaveLength(1)
    expect(Array.isArray(sink.mock.calls[0][0])).toBe(true)
  })

  it('buffers and flushes after bufferMs', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { bufferMs: 100 })
    d.dispatch(evt('component:mounted', 'a'))
    d.dispatch(evt('component:mounted', 'b'))
    d.dispatch(evt('component:mounted', 'c'))
    expect(sink).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0][0]).toHaveLength(3)
  })

  it('forces flush when bufferMax reached', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { bufferMs: 5_000, bufferMax: 3 })
    d.dispatch(evt('component:mounted', 'a'))
    d.dispatch(evt('component:mounted', 'b'))
    expect(sink).not.toHaveBeenCalled()
    d.dispatch(evt('component:mounted', 'c')) // hits bufferMax
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0][0]).toHaveLength(3)
  })

  it('flush() is idempotent on empty buffer (no sink call)', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { bufferMs: 1_000 })
    d.flush()
    d.flush()
    expect(sink).not.toHaveBeenCalled()
  })

  it('manual flush() clears the pending bufferMs timer', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { bufferMs: 1_000 })
    d.dispatch(evt('component:mounted'))
    d.flush()
    expect(sink).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2_000)
    // timer was cleared — no second call
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('FAIL-OPEN — sink throw does NOT propagate', () => {
    const sink = vi.fn<TelemetrySink>(() => {
      throw new Error('sink down')
    })
    const d = createTelemetryDispatcher(sink, { bufferMs: 0 })
    expect(() => d.dispatch(evt('component:mounted'))).not.toThrow()
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('FAIL-OPEN — sink rejected promise does NOT throw at dispatch site', async () => {
    const sink = vi.fn<TelemetrySink>(async () => {
      throw new Error('async sink down')
    })
    const d = createTelemetryDispatcher(sink, { bufferMs: 0 })
    expect(() => d.dispatch(evt('component:mounted'))).not.toThrow()
    // Microtask flush — should NOT bubble unhandled rejection
    await Promise.resolve()
    await Promise.resolve()
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('sampleRate 0 drops every event', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { sampleRate: 0, bufferMs: 0 })
    for (let i = 0; i < 100; i++) d.dispatch(evt('component:mounted'))
    expect(sink).not.toHaveBeenCalled()
  })

  it('sampleRate 1 keeps every event', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, { sampleRate: 1, bufferMs: 0 })
    for (let i = 0; i < 5; i++) d.dispatch(evt('component:mounted'))
    expect(sink).toHaveBeenCalledTimes(5)
  })

  it('sampleByType overrides sampleRate per event type', () => {
    const sink = vi.fn<TelemetrySink>()
    const d = createTelemetryDispatcher(sink, {
      sampleRate: 0, // would drop everything
      sampleByType: { 'render:error': 1.0 }, // ...except errors
      bufferMs: 0,
    })
    d.dispatch(evt('component:mounted')) // dropped
    d.dispatch(evt('render:error')) // kept
    d.dispatch(evt('validation:failed')) // dropped
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0][0][0].type).toBe('render:error')
  })
})
