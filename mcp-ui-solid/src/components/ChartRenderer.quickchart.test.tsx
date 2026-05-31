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
