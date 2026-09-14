import { describe, expect, it } from 'vitest'
import type {
  ChartComponentParams,
  ChartType,
  GraphComponentParams,
  GraphLayout,
  GraphLayoutName,
  TableComponentParams,
} from './index'

describe('public visualization contracts', () => {
  it('types all eight chart variants, point data, and time-axis options', () => {
    const chartTypes: ChartType[] = [
      'bar',
      'line',
      'pie',
      'doughnut',
      'radar',
      'scatter',
      'bubble',
      'polarArea',
    ]
    const params: ChartComponentParams = {
      type: 'bubble',
      data: {
        labels: [],
        datasets: [{ label: 'Points', data: [{ x: '2026-09-14', y: 3, r: 8 }] }],
      },
      timeAxis: { unit: 'day', parser: 'yyyy-MM-dd' },
    }

    expect(chartTypes).toHaveLength(8)
    expect(params.timeAxis?.unit).toBe('day')
  })

  it('types the table search and context-aware paging controls', () => {
    const params: TableComponentParams = {
      columns: [{ key: 'name', label: 'Name', sortable: true }],
      rows: [{ name: 'Ada' }],
      searchable: true,
      searchPlaceholder: 'Filter records',
      pageSize: 30,
      chatPageSize: 10,
      initialPage: 0,
    }

    expect(params).toMatchObject({ searchable: true, pageSize: 30, chatPageSize: 10 })
  })

  it('types the seven canonical graph layouts and object-form options', () => {
    const canonical: GraphLayoutName[] = [
      'force',
      'dagre',
      'mindmap',
      'tree',
      'circular',
      'grid',
      'concentric',
    ]
    const layout: GraphLayout = { type: 'dagre', options: { rankdir: 'TB' } }
    const params: GraphComponentParams = { nodes: [{ id: 'root' }], layout }

    expect(canonical).toHaveLength(7)
    expect(params.layout).toEqual(layout)
  })
})
