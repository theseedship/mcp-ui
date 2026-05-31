/**
 * v6.14.0 — audit P1.7: the quickchart.io fallback must be an explicit host
 * opt-in, never an implicit external network call.
 *
 * jsdom has no `chart.js` peer, so `isChartJSAvailable()` resolves false and
 * the renderer hits the fallback path. We assert that by default NO
 * `quickchart.io` URL is produced (the chart degrades to a data table), and
 * that it only appears once the host sets `allowQuickchartFallback`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import type { UIComponent } from '../types'

afterEach(cleanup)

const chart: UIComponent = {
  id: 'c1',
  type: 'chart',
  position: { colStart: 1, colSpan: 12 },
  params: {
    type: 'bar',
    title: 'Sensitive revenue',
    data: {
      labels: ['Q1', 'Q2'],
      datasets: [{ label: 'Revenue', data: [100, 200] }],
    },
  } as any,
}

function quickchartImg(container: HTMLElement): HTMLImageElement | null {
  return Array.from(container.querySelectorAll('img')).find((img) =>
    (img.getAttribute('src') ?? '').includes('quickchart.io')
  ) as HTMLImageElement | null
}

describe('Chart quickchart fallback is opt-in (P1.7)', () => {
  it('does NOT call quickchart.io by default — degrades to a data table', async () => {
    const { container } = render(() => <UIResourceRenderer content={chart} />)

    // Give the async availability check a tick to resolve + render the fallback.
    await waitFor(() => {
      expect(container.textContent ?? '').toContain('data table')
    })

    expect(quickchartImg(container)).toBeNull()
    // The degraded table surfaces the underlying data.
    expect(container.textContent).toContain('Revenue')
  })

  it('uses quickchart.io only when the host opts in', async () => {
    const { container } = render(() => (
      <UIResourceRenderer content={chart} allowQuickchartFallback />
    ))

    await waitFor(() => {
      expect(quickchartImg(container)).not.toBeNull()
    })

    const src = quickchartImg(container)!.getAttribute('src') ?? ''
    expect(src).toContain('https://quickchart.io/chart?c=')
  })
})
