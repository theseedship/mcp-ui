/**
 * v6.6.0 — Streaming/static rendering parity (Gap 1 of ROADMAP-opendata-macro-mcpui).
 *
 * Before v6.6.0, `StreamingUIRenderer` used an inline simplified renderer
 * (`StreamingComponentRenderer`) that only showed a component's type label +
 * title — a streamed `table` did NOT render a real `<table>`. v6.6.0 deletes
 * that and delegates each streamed `UIComponent` to the real
 * `<UIResourceRenderer>`.
 *
 * These tests pin the parity : a component rendered through the streaming
 * path produces the SAME functional DOM as the static path, and the legacy
 * "type + title placeholder" markers are gone.
 *
 * `useStreamingUI` is mocked so components can be injected directly, without
 * standing up an SSE endpoint.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'

// ── Mock the SSE hook : inject a fixed component list ─────────────
const streamedComponents = vi.fn<() => unknown[]>(() => [])

vi.mock('../hooks/useStreamingUI', () => ({
  useStreamingUI: () => ({
    components: streamedComponents,
    isLoading: () => false,
    isStreaming: () => false,
    error: () => null,
    progress: () => ({ message: '', receivedCount: 0, totalCount: null }),
    metadata: () => null,
    startStreaming: () => {},
    stopStreaming: () => {},
  }),
}))

// Imported AFTER the mock declaration so the mock is in effect.
const { StreamingUIRenderer } = await import('./StreamingUIRenderer')
const { UIResourceRenderer } = await import('./UIResourceRenderer')

const TABLE_COMPONENT = {
  id: 'tbl-1',
  type: 'table' as const,
  position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Prix au m2',
    columns: [
      { key: 'ville', label: 'Ville' },
      { key: 'prix', label: 'Prix/m2' },
    ],
    rows: [
      { ville: 'Toulouse', prix: 3200 },
      { ville: 'Montpellier', prix: 3600 },
    ],
  },
}

const METRIC_COMPONENT = {
  id: 'mtr-1',
  type: 'metric' as const,
  position: { colStart: 1, colSpan: 4 },
  params: { title: 'Prix median', value: 3400, unit: 'EUR/m2' },
}

const ACTION_GROUP_COMPONENT = {
  id: 'ag-1',
  type: 'action-group' as const,
  position: { colStart: 1, colSpan: 12 },
  params: {
    actions: [
      { label: 'Comparer avec Paris', action: 'tool-call', toolName: 'datagouv.search' },
      { label: 'Charger le dataset', action: 'tool-call', toolName: 'datagouv.load' },
    ],
  },
}

describe('StreamingUIRenderer parity (v6.6.0)', () => {
  beforeEach(() => {
    cleanup()
    streamedComponents.mockReturnValue([])
  })

  it('streams a real <table>, not a type-label placeholder', () => {
    streamedComponents.mockReturnValue([TABLE_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="immobilier toulouse" spaceIds={[]} />
    ))
    // Real TableRenderer output — an actual <table> with the rows.
    const table = container.querySelector('table')
    expect(table).toBeTruthy()
    expect(container.textContent).toContain('Toulouse')
    expect(container.textContent).toContain('Montpellier')
  })

  it('does NOT emit the legacy simplified-renderer markers', () => {
    streamedComponents.mockReturnValue([TABLE_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="immobilier toulouse" spaceIds={[]} />
    ))
    // The pre-v6.6.0 inline renderer printed "Component ID: xxxxxxxx..."
    expect(container.textContent).not.toContain('Component ID:')
  })

  it('streamed table DOM matches the static UIResourceRenderer path', () => {
    streamedComponents.mockReturnValue([TABLE_COMPONENT])
    const streamed = render(() => (
      <StreamingUIRenderer query="q" spaceIds={[]} />
    ))
    const streamedTableCells = streamed.container.querySelectorAll('table td, table th').length

    cleanup()

    const staticRender = render(() => <UIResourceRenderer content={TABLE_COMPONENT} />)
    const staticTableCells = staticRender.container.querySelectorAll('table td, table th').length

    expect(streamedTableCells).toBeGreaterThan(0)
    expect(streamedTableCells).toBe(staticTableCells)
  })

  it('streams a real metric value', () => {
    streamedComponents.mockReturnValue([METRIC_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="prix" spaceIds={[]} />
    ))
    expect(container.textContent).toContain('3400')
    expect(container.textContent).toContain('Prix median')
  })

  it('streams a real action-group with clickable buttons', () => {
    streamedComponents.mockReturnValue([ACTION_GROUP_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="immobilier" spaceIds={[]} />
    ))
    const buttons = Array.from(container.querySelectorAll('button'))
    const labels = buttons.map((b) => b.textContent?.trim())
    expect(labels).toContain('Comparer avec Paris')
    expect(labels).toContain('Charger le dataset')
  })

  it('renders every streamed component (multi-component layout)', () => {
    streamedComponents.mockReturnValue([TABLE_COMPONENT, METRIC_COMPONENT, ACTION_GROUP_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="dashboard" spaceIds={[]} />
    ))
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.textContent).toContain('Prix median')
    expect(container.textContent).toContain('Comparer avec Paris')
  })

  it('carries data-mcp-ui-component-id on streamed components (v6.5.0 identity)', () => {
    streamedComponents.mockReturnValue([TABLE_COMPONENT])
    const { container } = render(() => (
      <StreamingUIRenderer query="q" spaceIds={[]} />
    ))
    // Delegation to UIResourceRenderer means the v6.5.0 identity attrs apply.
    expect(container.querySelector('[data-mcp-ui-component-id="tbl-1"]')).toBeTruthy()
  })
})
