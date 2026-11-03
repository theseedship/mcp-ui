/**
 * v6.14.0 — audit P1.7: the quickchart.io fallback must be an explicit host
 * opt-in, never an implicit external network call.
 *
 * We drive the decision with `renderer: 'iframe'` (an explicit request for the
 * external image path) — that branch is gated purely on `allowQuickchartFallback`
 * and is independent of whether the `chart.js` peer happens to be installed in
 * the test env. Default (no opt-in) → no quickchart URL, degrades to a local
 * table; with opt-in → the quickchart.io image URL is produced.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { createStore, flush } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import type { ChartComponentParams, UIComponent } from '../types'

afterEach(cleanup)

const chart: UIComponent = {
  id: 'c1',
  type: 'chart',
  position: { colStart: 1, colSpan: 12 },
  params: {
    type: 'bar',
    title: 'Sensitive revenue',
    renderer: 'iframe', // explicit external render request
    data: {
      labels: ['Q1', 'Q2'],
      datasets: [{ label: 'Revenue', data: [100, 200] }],
    },
  } as any,
}

function quickchartImg(container: HTMLElement): HTMLImageElement | null {
  return (
    (Array.from(container.querySelectorAll('img')).find((img) =>
      (img.getAttribute('src') ?? '').includes('quickchart.io')
    ) as HTMLImageElement | undefined) ?? null
  )
}

describe('Chart quickchart fallback is opt-in (P1.7)', () => {
  it('does NOT call quickchart.io by default — degrades instead', async () => {
    const { container } = render(() => <UIResourceRenderer content={chart} />)

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('Interactive chart unavailable')
    })

    expect(quickchartImg(container)).toBeNull()
    // The degraded table surfaces the underlying series data.
    expect(container.textContent).toContain('Revenue')
  })

  it('uses quickchart.io only when the host opts in', async () => {
    const { container } = render(() => (
      <UIResourceRenderer content={chart} allowQuickchartFallback />
    ))

    await waitFor(() => {
      expect(quickchartImg(container)).not.toBeNull()
    })

    const src = quickchartImg(container)?.getAttribute('src') ?? ''
    expect(src).toContain('https://quickchart.io/chart?c=')
  })
})

type LiveChart = UIComponent & {
  params: ChartComponentParams & {
    options: { plugins: { legend: { display: boolean } } }
  }
}

function liveChart(id: string): LiveChart {
  return {
    ...structuredClone(chart),
    id,
    params: {
      ...structuredClone(chart.params as ChartComponentParams),
      options: { plugins: { legend: { display: true } } },
    },
  }
}

function quickchartConfig(container: HTMLElement): ChartComponentParams {
  const image = quickchartImg(container)
  expect(image).not.toBeNull()
  const url = new URL(image!.getAttribute('src')!)
  expect(url.origin).toBe('https://quickchart.io')
  const config = url.searchParams.get('c')
  expect(config).not.toBeNull()
  return JSON.parse(config!) as ChartComponentParams
}

function observeReactivityDiagnostics(): () => string[] {
  // Spies retain the real console implementation: diagnostics are not hidden.
  const warnings = vi.spyOn(console, 'warn')
  const errors = vi.spyOn(console, 'error')
  return () => [...warnings.mock.calls, ...errors.mock.calls]
    .flat().map(String)
    .filter((message) => /\[(?:STRICT_READ_UNTRACKED|NO_OWNER_EFFECT|REACTIVE_WRITE[^\]]*)\]/.test(message))
}

describe('Chart quickchart fallback follows the live store configuration', () => {
  afterEach(() => vi.restoreAllMocks())

  it('updates the decoded image URL when only the chart type changes', async () => {
    const diagnostics = observeReactivityDiagnostics()
    const [payload, setPayload] = createStore(liveChart('quickchart-live-type'))
    const { container } = render(() => <UIResourceRenderer content={payload} allowQuickchartFallback />)
    await waitFor(() => expect(quickchartConfig(container).type).toBe('bar'))
    const image = quickchartImg(container)!
    const before = image.getAttribute('src')

    setPayload((draft) => { draft.params.type = 'line' })
    flush()

    await waitFor(() => expect(quickchartConfig(container).type).toBe('line'))
    expect(quickchartImg(container)!.getAttribute('src')).not.toBe(before)
    expect(quickchartImg(container)).toBe(image)
    expect(diagnostics()).toEqual([])
  })

  it('updates the decoded image URL for an in-place nested dataset edit', async () => {
    const diagnostics = observeReactivityDiagnostics()
    const [payload, setPayload] = createStore(liveChart('quickchart-live-data'))
    const { container } = render(() => <UIResourceRenderer content={payload} allowQuickchartFallback />)
    await waitFor(() => expect(quickchartConfig(container).data.datasets[0]!.data[0]).toBe(100))
    const image = quickchartImg(container)!
    const before = image.getAttribute('src')

    setPayload((draft) => { draft.params.data.datasets[0]!.data[0] = 375 })
    flush()

    await waitFor(() => expect(quickchartConfig(container).data.datasets[0]!.data[0]).toBe(375))
    expect(quickchartImg(container)!.getAttribute('src')).not.toBe(before)
    expect(quickchartImg(container)).toBe(image)
    expect(diagnostics()).toEqual([])
  })

  it('updates the decoded image URL for an in-place nested options edit', async () => {
    const diagnostics = observeReactivityDiagnostics()
    const [payload, setPayload] = createStore(liveChart('quickchart-live-options'))
    const { container } = render(() => <UIResourceRenderer content={payload} allowQuickchartFallback />)
    await waitFor(() => expect(quickchartConfig(container).options?.plugins.legend.display).toBe(true))
    const image = quickchartImg(container)!
    const before = image.getAttribute('src')

    setPayload((draft) => { draft.params.options.plugins.legend.display = false })
    flush()

    await waitFor(() => expect(quickchartConfig(container).options?.plugins.legend.display).toBe(false))
    expect(quickchartImg(container)!.getAttribute('src')).not.toBe(before)
    expect(quickchartImg(container)).toBe(image)
    expect(diagnostics()).toEqual([])
  })
})
