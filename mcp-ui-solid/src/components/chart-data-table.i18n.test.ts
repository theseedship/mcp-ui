/**
 * `chartToDataTable` — injectable column headers (v6.20.0, 5th i18n pass).
 *
 * The helper is pure and has no access to `MCPUIStrings`, so `ChartJSRenderer`
 * feeds it the wording. The `labels` parameter is a trailing optional, so the
 * pre-v6.20.0 call shape still produces the same English table.
 */

import { describe, it, expect } from 'vitest'
import { chartToDataTable, CHART_DATA_TABLE_LABELS } from './chart-data-table'

describe('chart-data-table labels', () => {
  it('ships English defaults, with the Chart.js point keys left as-is', () => {
    expect(CHART_DATA_TABLE_LABELS).toEqual({
      series: 'Series',
      point: 'Point',
      label: 'Label',
      seriesName: 'Series {n}',
      x: 'x',
      y: 'y',
      r: 'r',
    })
  })

  it('keeps the English headers when no labels are passed', () => {
    const categorical = chartToDataTable({
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] },
    })
    expect(categorical.columns).toEqual(['Label', 'Series 1'])

    const points = chartToDataTable({
      type: 'scatter',
      data: { datasets: [{ data: [{ x: 1, y: 2 }] }] },
    })
    expect(points.columns).toEqual(['Series', 'Point', 'x', 'y'])
  })

  it('overrides the categorical headers and the unlabelled series name', () => {
    const t = chartToDataTable(
      { type: 'bar', data: { labels: ['A'], datasets: [{ data: [1] }, { label: 'Revenue', data: [2] }] } },
      { label: 'Libellé', seriesName: 'Série {n}' }
    )
    expect(t.columns).toEqual(['Libellé', 'Série 1', 'Revenue'])
  })

  it('overrides the per-point headers', () => {
    const t = chartToDataTable(
      { type: 'bubble', data: { labels: ['A'], datasets: [{ data: [{ x: 1, y: 2, r: 3 }] }] } },
      { series: 'Série', point: 'Point n°', label: 'Libellé' }
    )
    expect(t.columns).toEqual(['Série', 'Point n°', 'Libellé', 'x', 'y', 'r'])
    // `seriesName` was NOT overridden here: the per-row dataset name keeps
    // its own key, independent of the column header.
    expect(t.rows[0][0]).toBe('Series 1')
  })

  it('leaves the row data untouched by a label override', () => {
    const base = chartToDataTable({
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ label: 'R', data: [1, 2] }] },
    })
    const localized = chartToDataTable(
      { type: 'bar', data: { labels: ['A', 'B'], datasets: [{ label: 'R', data: [1, 2] }] } },
      { label: 'Libellé' }
    )
    expect(localized.rows).toEqual(base.rows)
  })
})
