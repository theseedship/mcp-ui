/**
 * UI telemetry sink (B.5 — v5.6.0)
 *
 * Minimal OpenTelemetry-like Provider that lets a consumer (e.g. deposium
 * `/admin/ui-telemetry`) collect lifecycle + error + action events from
 * mcp-ui components without imposing any API change on apps that don't use
 * it. Spec'd in `MCP-UI-AUDIT-2026-04-26.md` §M.6.
 *
 * Three hard rules:
 *   1. Provider is OPTIONAL. When absent, `useTelemetry()` returns `null`
 *      and dispatch sites no-op. Existing apps see zero behavior change.
 *   2. Sink is FAIL-OPEN. A `sink()` throw or rejected promise is caught
 *      silently — telemetry never crashes the renderer.
 *   3. Events carry NO payload data. Only meta (type + id + counts + timing)
 *      to avoid PII / data leaks in centralized logs.
 */

import type { ComponentType } from '../types'

interface TelemetryEventBase {
  /** Component instance id (from `UIComponent.id` or auto-generated). */
  id: string
  /** ComponentType, e.g. 'chart' / 'metric' / 'iframe'. */
  componentType: ComponentType
  /** Wall-clock timestamp (ms epoch) for cross-stack correlation. */
  ts: number
}

/**
 * Discriminated union of all telemetry events emitted by mcp-ui.
 * See §M.6.2 for field semantics + privacy rules.
 */
export type TelemetryEvent =
  | ({ type: 'component:mounted' } & TelemetryEventBase)
  | ({ type: 'component:rendered'; durationMs: number } & TelemetryEventBase)
  | ({ type: 'component:unmounted' } & TelemetryEventBase)
  | ({
      type: 'validation:failed'
      errorCount: number
      firstErrorCode: string | null
    } & TelemetryEventBase)
  | ({ type: 'render:error'; errorMessage: string } & TelemetryEventBase)
  | ({ type: 'action:dispatched'; actionName: string } & TelemetryEventBase)

/**
 * Consumer-supplied sink. Receives a batch of events (always an array,
 * even for `bufferMs: 0` — single-element array in that case). Errors
 * and rejected promises are caught silently by the dispatcher.
 */
export interface TelemetrySink {
  (events: TelemetryEvent[]): void | Promise<void>
}

export interface TelemetryOptions {
  /** Per-event base sampling rate, 0..1, default 1.0 (all events). */
  sampleRate?: number
  /** Buffer events and flush after N ms (default 100). 0 = no buffer. */
  bufferMs?: number
  /** Max buffered events before forced flush (default 50). */
  bufferMax?: number
  /** Per-event-type override on sampling (high-volume types can be lower). */
  sampleByType?: Partial<Record<TelemetryEvent['type'], number>>
}

/**
 * Dispatcher returned by `createTelemetryDispatcher`. Used internally by
 * the Provider, exposed only so tests can drive it without React/Solid.
 */
export interface TelemetryDispatcher {
  /**
   * Push an event. Sampling + buffering applied transparently. Never throws.
   */
  dispatch(event: TelemetryEvent): void
  /**
   * Force-flush the buffer. Useful on tab-hidden / unload, or for tests.
   * Never throws.
   */
  flush(): void
}

const DEFAULT_BUFFER_MS = 100
const DEFAULT_BUFFER_MAX = 50

function shouldSample(
  eventType: TelemetryEvent['type'],
  options: TelemetryOptions | undefined
): boolean {
  const perTypeRate = options?.sampleByType?.[eventType]
  const rate = perTypeRate !== undefined ? perTypeRate : (options?.sampleRate ?? 1.0)
  if (rate >= 1) return true
  if (rate <= 0) return false
  return Math.random() < rate
}

/**
 * Create a telemetry dispatcher. Pure function, no Solid context — exists
 * separately from the Provider so it can be unit-tested in isolation.
 */
export function createTelemetryDispatcher(
  sink: TelemetrySink,
  options?: TelemetryOptions
): TelemetryDispatcher {
  const buffer: TelemetryEvent[] = []
  const bufferMs = options?.bufferMs ?? DEFAULT_BUFFER_MS
  const bufferMax = options?.bufferMax ?? DEFAULT_BUFFER_MAX
  let flushTimer: ReturnType<typeof setTimeout> | undefined

  function deliver(batch: TelemetryEvent[]): void {
    try {
      const result = sink(batch)
      // Promise rejections are silenced too (fail-open, §M.6.1).
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch(() => {
          /* silent */
        })
      }
    } catch {
      /* silent */
    }
  }

  function flush(): void {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer)
      flushTimer = undefined
    }
    if (buffer.length === 0) return
    const batch = buffer.splice(0, buffer.length)
    deliver(batch)
  }

  function dispatch(event: TelemetryEvent): void {
    if (!shouldSample(event.type, options)) return
    buffer.push(event)
    if (buffer.length >= bufferMax) {
      flush()
      return
    }
    if (bufferMs <= 0) {
      flush()
      return
    }
    if (flushTimer === undefined) {
      flushTimer = setTimeout(flush, bufferMs)
    }
  }

  return { dispatch, flush }
}
