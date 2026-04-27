/**
 * Integration tests for MCPUITelemetryProvider + dispatch wiring (B.5 — v5.6.0)
 *
 * Verifies that the Provider correctly wraps a dispatcher and that dispatches
 * from real renderer components arrive at the consumer sink — without the
 * Provider, no events should fire (existing tests prove this implicitly,
 * but we lock it explicitly here).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { UIResourceRenderer } from '../components/UIResourceRenderer'
import { MCPUITelemetryProvider } from './MCPUITelemetryContext'
import type { TelemetryEvent, TelemetrySink } from '../services/telemetry'
import type { UIComponent } from '../types'

const validMetric: UIComponent = {
  id: 'metric-1',
  type: 'metric',
  position: { colStart: 1, colSpan: 6 },
  params: { title: 'OK', value: 42 },
}

const invalidMetric: UIComponent = {
  id: 'metric-bad',
  type: 'metric',
  position: { colStart: 1, colSpan: 6 },
  params: {} as any, // missing title + value → validation:failed
}

describe('MCPUITelemetryProvider — integration with renderers (v5.6.0)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('NO Provider = no events dispatched (renderer works as before)', () => {
    // Render without Provider — should not throw, no events anywhere
    expect(() => render(() => <UIResourceRenderer content={validMetric} />)).not.toThrow()
    // No way to assert "no dispatch" without a sink; but the absence of
    // throws + Provider's null-check semantics is what we lock here.
  })

  it('Provider receives component:mounted event for a valid component', async () => {
    const events: TelemetryEvent[] = []
    const sink: TelemetrySink = (batch) => {
      events.push(...batch)
    }

    render(() => (
      <MCPUITelemetryProvider sink={sink} options={{ bufferMs: 0 }}>
        <UIResourceRenderer content={validMetric} />
      </MCPUITelemetryProvider>
    ))

    const mounted = events.find((e) => e.type === 'component:mounted')
    expect(mounted).toBeDefined()
    expect(mounted?.id).toBe('metric-1')
    expect(mounted?.componentType).toBe('metric')
    expect(typeof mounted?.ts).toBe('number')
  })

  it('Provider receives validation:failed event with errorCount + firstErrorCode (NO error message)', async () => {
    const events: TelemetryEvent[] = []
    const sink: TelemetrySink = (batch) => {
      events.push(...batch)
    }

    render(() => (
      <MCPUITelemetryProvider sink={sink} options={{ bufferMs: 0 }}>
        <UIResourceRenderer content={invalidMetric} errorMode="silent" />
      </MCPUITelemetryProvider>
    ))

    const failed = events.find((e) => e.type === 'validation:failed')
    expect(failed).toBeDefined()
    expect(failed).toMatchObject({
      type: 'validation:failed',
      id: 'metric-bad',
      componentType: 'metric',
      firstErrorCode: 'INVALID_METRIC',
    })
    if (failed?.type === 'validation:failed') {
      expect(failed.errorCount).toBeGreaterThan(0)
    }

    // Privacy hard rule: NO `errorMessage`, NO `errors` array, NO payload
    // fields anywhere on the validation:failed event.
    const failedKeys = failed ? Object.keys(failed) : []
    expect(failedKeys.sort()).toEqual(
      ['componentType', 'errorCount', 'firstErrorCode', 'id', 'ts', 'type'].sort()
    )
  })

  it('FAIL-OPEN — sink that throws does NOT crash the renderer', () => {
    const sink: TelemetrySink = () => {
      throw new Error('sink down hard')
    }

    expect(() =>
      render(() => (
        <MCPUITelemetryProvider sink={sink} options={{ bufferMs: 0 }}>
          <UIResourceRenderer content={validMetric} />
        </MCPUITelemetryProvider>
      ))
    ).not.toThrow()
  })

  it('options.sampleRate=0 results in no events at the sink (everything dropped)', () => {
    const sink = vi.fn<TelemetrySink>()

    render(() => (
      <MCPUITelemetryProvider sink={sink} options={{ sampleRate: 0, bufferMs: 0 }}>
        <UIResourceRenderer content={validMetric} />
      </MCPUITelemetryProvider>
    ))

    expect(sink).not.toHaveBeenCalled()
  })
})
