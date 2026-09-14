import { describe, expect, it } from 'vitest'
import {
  createComparisonLayout,
  createEvidenceLayout,
  createGeographyLayout,
  type ChartComponent,
  type LinkComponent,
  type MapComponent,
  type MetricComponent,
  type TableComponent,
  type TextComponent,
} from './presentation'

const chart: ChartComponent = {
  id: 'caller-chart', type: 'chart',
  params: { type: 'scatter', data: { labels: ['A'], datasets: [{ label: 'score', data: [{ x: 1, y: 2 }] }] } },
  metadata: { generatedAt: '2026-09-14T00:00:00.000Z', confidence: 0.8 },
}
const table: TableComponent = {
  id: 'caller-table', type: 'table',
  params: {
    columns: [{ key: 'claim', label: 'Claim' }], rows: [{ claim: '[📄 CITATION 1]' }],
    citationMap: { '1': { page: 3, file: 'source.pdf' } },
  },
}
const map: MapComponent = {
  id: 'caller-map', type: 'map',
  params: { geojson: { type: 'FeatureCollection', features: [] }, fitBounds: true },
}
const summary: TextComponent = {
  id: 'caller-summary', type: 'text',
  params: { content: 'Caller-provided conclusion.', markdown: true },
}
const metric = (id: string): MetricComponent => ({
  id, type: 'metric', params: { title: id, value: 1 },
})
const source = (id: string): LinkComponent => ({
  id, type: 'link', params: { url: 'https://example.test', label: id },
})

describe('presentation recipes', () => {
  it('creates a deterministic comparison with preserved source params and metadata', () => {
    const metadata = { query: 'compare', generatedAt: '2026-09-14T00:00:00.000Z', totalComponents: 5 }
    const input = { id: 'comparison-q3', chart, table, metrics: [metric('m-one'), metric('m-two')], summary, metadata }
    const first = createComparisonLayout(input)
    const second = createComparisonLayout(input)

    expect(first).toEqual(second)
    expect(first.components.map((component) => component.id)).toEqual(['caller-summary', 'm-one', 'm-two', 'caller-chart', 'caller-table'])
    expect(first.components.at(-2)?.position).toEqual({ colStart: 1, colSpan: 7, rowStart: 3 })
    expect(first.components.at(-1)?.position).toEqual({ colStart: 8, colSpan: 5, rowStart: 3 })
    expect(first.components.at(-1)?.params).toEqual(table.params)
    expect(first.components.at(-2)?.metadata).toEqual(chart.metadata)
    expect(first.metadata).toEqual(metadata)
    expect(table.position).toBeUndefined()
  })

  it('creates a geography overview with map before its tabular detail', () => {
    const layout = createGeographyLayout({ id: 'geography-q3', map, table, metrics: [metric('geo-metric')] })
    expect(layout.components.map((component) => component.type)).toEqual(['metric', 'map', 'table'])
    expect(layout.components[1].position).toEqual({ colStart: 1, colSpan: 8, rowStart: 2 })
    expect(layout.components[2].position).toEqual({ colStart: 9, colSpan: 4, rowStart: 2 })
    expect(layout.components[1].params).toEqual(map.params)
  })

  it('keeps evidence source order and caller ids', () => {
    const layout = createEvidenceLayout({ id: 'evidence-q3', summary, table, sources: [source('first'), source('second')] })
    expect(layout.components.map((component) => component.id)).toEqual(['caller-summary', 'caller-table', 'first', 'second'])
    expect(layout.components[2].params).toEqual(source('first').params)
    expect(layout.components[3].params).toEqual(source('second').params)
  })

  it('wraps metrics and source links onto later rows without overlapping positions', () => {
    const comparison = createComparisonLayout({
      id: 'many-metrics', chart, table,
      metrics: ['one', 'two', 'three', 'four', 'five'].map(metric),
    })
    expect(comparison.components.slice(0, 5).map((component) => component.position)).toEqual([
      { colStart: 1, colSpan: 3, rowStart: 1 },
      { colStart: 4, colSpan: 3, rowStart: 1 },
      { colStart: 7, colSpan: 3, rowStart: 1 },
      { colStart: 10, colSpan: 3, rowStart: 1 },
      { colStart: 1, colSpan: 3, rowStart: 2 },
    ])
    expect(comparison.components.at(-2)?.position?.rowStart).toBe(3)

    const evidence = createEvidenceLayout({
      id: 'many-sources', summary, table,
      sources: ['one', 'two', 'three', 'four'].map(source),
    })
    expect(evidence.components.slice(2).map((component) => component.position)).toEqual([
      { colStart: 1, colSpan: 4, rowStart: 3 },
      { colStart: 5, colSpan: 4, rowStart: 3 },
      { colStart: 9, colSpan: 4, rowStart: 3 },
      { colStart: 1, colSpan: 4, rowStart: 4 },
    ])
  })

  it('rejects incompatible types and duplicate ids, including nested grid children', () => {
    expect(() => createComparisonLayout({ id: 'bad', chart: { ...table, id: 'wrong-chart' } as unknown as ChartComponent, table })).toThrow('chart must be a chart component')
    expect(() => createEvidenceLayout({ id: 'evidence-q3', summary, table, sources: [source('dup'), source('dup')] })).toThrow('Duplicate component id: dup')
    const nestedGrid = {
      id: 'nested-grid', type: 'grid', position: { colStart: 1, colSpan: 12 },
      params: { children: [{ ...metric('nested-dup') }, { ...metric('nested-dup') }] },
    }
    expect(() => createComparisonLayout({ id: 'nested', chart, table, metrics: [nestedGrid as unknown as MetricComponent] })).toThrow('Duplicate component id: nested-dup')
  })

  it('rejects ids that cannot be safely used as stable component keys', () => {
    expect(() => createGeographyLayout({ id: 'Not stable', map, table })).toThrow('Presentation layout id')
    expect(() => createGeographyLayout({ id: undefined as unknown as string, map, table })).toThrow('Presentation layout id')
    expect(() => createGeographyLayout({ id: 123 as unknown as string, map, table })).toThrow('Presentation layout id')
  })
})
