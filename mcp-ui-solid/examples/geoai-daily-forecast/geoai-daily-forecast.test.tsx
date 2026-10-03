/**
 * End-to-end checks of the GeoAI daily-forecast example against the brief's
 * validation criteria (section 7, brief 2026-10-03).
 *
 * SYNTHETIC FIXTURE — NOT REAL WEATHER. LOCAL EXAMPLE: not a published API,
 * not the version Deposium installs, not behaviour observed in the chat.
 *
 * Sections a-e check the layouts as data (validation, parity, coordinates,
 * threshold, provenance). Section f renders them with UIResourceRenderer and
 * checks the shared DOM contract of the missing-value work: table cells
 * `[data-mcp-missing-value]`, `[data-mcp-missing-legend]`, and the chart notes
 * `[data-mcp-chart-notes]` / `[data-mcp-chart-note=…]`; it also checks what the
 * thresholds table displays (unrounded decimals, the host's verdict) and what
 * the daily table exports (CSV empty field, JSON null, the real zero as "0").
 */

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChartComponentParamsSchema,
  LinkComponentParamsSchema,
  MapComponentParamsSchema,
  MetricComponentParamsSchema,
  TableComponentParamsSchema,
  TextComponentParamsSchema,
} from '@seed-ship/mcp-ui-spec'
import type { ZodTypeAny } from 'zod'
import { UIResourceRenderer } from '../../src/components/UIResourceRenderer'
import { DEFAULT_MCPUI_STRINGS } from '../../src/context/MCPUIStringsContext'
import { validateComponent, validateLayout } from '../../src/services/validation'
import type {
  ChartComponentParams,
  MapComponentParams,
  TableComponentParams,
  TextComponentParams,
  UIComponent,
  UILayout,
} from '../../src/types'
import {
  UNAVAILABLE,
  buildAllLayouts,
  buildComparisonLayout,
  buildChartLayout,
  buildThresholdsLayout,
  successfulPlaces,
  type NamedLayout,
} from './build-layouts'
import { FORECAST_FIXTURE, type ForecastModel, type VariableKey } from './fixture'

// ─── Mocks (same chart.js/auto mock as src/components/ChartJSRenderer.test.tsx) ──

const chartHarness = vi.hoisted(() => ({
  configs: [] as Array<{
    type?: string
    data?: { labels?: string[]; datasets?: Array<{ label?: string; data?: unknown[]; spanGaps?: unknown }> }
    options?: unknown
  }>,
}))

vi.mock('chart.js/auto', () => {
  class FakeChart {
    destroy = vi.fn()
    resize = vi.fn()
    constructor(_canvas: HTMLCanvasElement, config: never) {
      chartHarness.configs.push(config)
    }
  }
  return { default: FakeChart }
})

const leafletHarness = vi.hoisted(() => ({ markerCalls: [] as unknown[] }))

vi.mock('leaflet', () => {
  const map = {
    setView: vi.fn().mockReturnThis(),
    eachLayer: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
    getZoom: vi.fn(() => 13),
    fitBounds: vi.fn().mockReturnThis(),
    addLayer: vi.fn(),
  }
  const chain = {
    addTo: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({ pad: vi.fn(), isValid: vi.fn(() => true) })),
  }
  return {
    default: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => chain),
      marker: vi.fn((position: unknown) => {
        leafletHarness.markerCalls.push(position)
        return chain
      }),
      featureGroup: vi.fn(() => chain),
      control: { attribution: vi.fn(() => chain), layers: vi.fn(() => chain) },
      geoJSON: vi.fn(() => chain),
      circleMarker: vi.fn(() => chain),
      GeoJSON: class {},
      CircleMarker: class {},
      Marker: class {},
      Icon: { Default: { prototype: { _getIconUrl: vi.fn() }, mergeOptions: vi.fn() } },
    },
  }
})
vi.mock('leaflet/dist/leaflet.css', () => ({}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const model = FORECAST_FIXTURE
const layouts = buildAllLayouts(model)
const byKey = (key: NamedLayout['key']): UILayout => layouts.find((l) => l.key === key)!.layout
const components = (layout: UILayout): UIComponent[] => layout.components
const ofType = (layout: UILayout, type: string): UIComponent[] =>
  components(layout).filter((c) => c.type === type)
const only = <T,>(list: T[]): T => {
  expect(list).toHaveLength(1)
  return list[0]
}
const chartOf = (layout: UILayout) => only(ofType(layout, 'chart')).params as ChartComponentParams
const tableOf = (layout: UILayout) => only(ofType(layout, 'table')).params as TableComponentParams
const textOf = (layout: UILayout) => (only(ofType(layout, 'text')).params as TextComponentParams).content
const allText = (layout: UILayout) =>
  ofType(layout, 'text').map((c) => (c.params as TextComponentParams).content).join('\n')

const SCHEMAS: Record<string, ZodTypeAny> = {
  chart: ChartComponentParamsSchema,
  table: TableComponentParamsSchema,
  map: MapComponentParamsSchema,
  text: TextComponentParamsSchema,
  metric: MetricComponentParamsSchema,
  link: LinkComponentParamsSchema,
}

const okPlaces = successfulPlaces(model)
const VARIABLES: VariableKey[] = ['precipitation', 'wind_speed']

// ─── a. validation ───────────────────────────────────────────────────────────

describe('a. every component validates', () => {
  it('builds the nine pilot views', () => {
    expect(layouts.map((l) => l.key)).toEqual([
      'header',
      'daily',
      'chart-rain',
      'chart-wind',
      'comparison-rain',
      'comparison-wind',
      'geography',
      'thresholds',
      'evidence',
    ])
  })

  it.each(layouts.map((l) => [l.key, l.layout] as const))(
    '%s passes validateLayout, validateComponent and its spec schema',
    (_key, layout) => {
      expect(validateLayout(layout)).toEqual({ valid: true, errors: undefined })
      for (const c of layout.components) {
        expect(validateComponent(c), c.id).toEqual({ valid: true, errors: undefined })
        const schema = SCHEMAS[c.type]
        expect(schema, `no spec schema for ${c.type}`).toBeDefined()
        const parsed = schema.safeParse(c.params)
        expect(parsed.success, `${c.id}: ${parsed.success ? '' : parsed.error.message}`).toBe(true)
      }
    }
  )

  it('keeps component ids lower-case and unique across all views', () => {
    const ids = layouts.flatMap((l) => l.layout.components.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/))
    const layoutIds = layouts.map((l) => l.layout.id)
    expect(new Set(layoutIds).size).toBe(layoutIds.length)
  })

  it('stays inside the size limits: tables < 100 rows, charts < 1000 points', () => {
    for (const { layout } of layouts) {
      for (const c of ofType(layout, 'table')) {
        expect((c.params as TableComponentParams).rows.length).toBeLessThan(100)
      }
      for (const c of ofType(layout, 'chart')) {
        const params = c.params as ChartComponentParams
        const points = params.data.datasets.reduce((n, d) => n + d.data.length, 0)
        expect(points).toBeLessThan(1000)
      }
    }
  })

  it('uses category ISO labels: no timeAxis, no iframe renderer', () => {
    for (const { layout } of layouts) {
      for (const c of ofType(layout, 'chart')) {
        const params = c.params as ChartComponentParams
        expect(params.timeAxis).toBeUndefined()
        expect(params.renderer).not.toBe('iframe')
      }
    }
  })
})

// ─── b. parity ───────────────────────────────────────────────────────────────

describe('b. parity between model, daily table and charts', () => {
  const daily = tableOf(byKey('daily'))
  const cell = (placeLabel: string, date: string, key: VariableKey) =>
    daily.rows.find((r) => r.place === placeLabel && r.date === date)![key] as number | null

  it('has one daily row per successful place and date, dates never dropped', () => {
    expect(daily.rows).toHaveLength(okPlaces.length * model.dates.length)
    for (const place of okPlaces) {
      const dates = daily.rows.filter((r) => r.place === place.label).map((r) => r.date)
      expect(dates).toEqual(model.dates)
    }
  })

  it('names columns readably with the units of the model', () => {
    const labels = Object.fromEntries(daily.columns.map((c) => [c.key, c.label]))
    expect(labels.precipitation).toBe(`Precipitation (${model.variables.precipitation.unit})`)
    expect(labels.wind_speed).toBe(`Wind speed (${model.variables.wind_speed.unit})`)
  })

  it.each(VARIABLES)('chart %s: labels equal the model dates, values equal the table cells', (variable) => {
    const chart = chartOf(byKey(variable === 'precipitation' ? 'chart-rain' : 'chart-wind'))
    expect(chart.data.labels).toEqual(model.dates)
    expect(chart.data.datasets.map((d) => d.label)).toEqual(okPlaces.map((p) => p.label))
    expect(chart.unit).toBe(model.variables[variable].unit)
    for (const dataset of chart.data.datasets) {
      const values = dataset.data as Array<number | null>
      expect(values).toHaveLength(model.dates.length)
      model.dates.forEach((date, i) => {
        const fromTable = cell(dataset.label, date, variable)
        // null <-> null and 0 <-> 0, strictly (toBe uses Object.is).
        expect(values[i]).toBe(fromTable)
        const fromModel = okPlaces.find((p) => p.label === dataset.label)!.series[variable][i]
        expect(values[i]).toBe(fromModel)
      })
    }
  })

  it('draws no zero where a value is missing, and keeps the real zero', () => {
    const rain = chartOf(byKey('chart-rain'))
    const lyon = rain.data.datasets.find((d) => d.label === 'Lyon (fixture)')!.data as Array<number | null>
    const brest = rain.data.datasets.find((d) => d.label === 'Brest (fixture)')!.data as Array<number | null>
    expect(lyon[0]).toBe(0) // the real zero stays 0 ...
    expect(brest[2]).toBeNull() // ... and the missing value stays null.
    expect(cell('Lyon (fixture)', '2026-10-04', 'precipitation')).toBe(0)
    expect(cell('Brest (fixture)', '2026-10-06', 'precipitation')).toBeNull()

    const wind = chartOf(byKey('chart-wind'))
    const lyonWind = wind.data.datasets.find((d) => d.label === 'Lyon (fixture)')!.data
    expect(lyonWind).toEqual([18, null, 31])
    const brestWind = wind.data.datasets.find((d) => d.label === 'Brest (fixture)')!.data
    expect(brestWind).toEqual([null, null, null]) // whole series missing, series kept

    // No zero was manufactured anywhere in the model-derived data.
    for (const place of okPlaces) {
      for (const variable of VARIABLES) {
        place.series[variable].forEach((value, i) => {
          if (value === null) {
            expect(cell(place.label, model.dates[i], variable)).toBeNull()
          }
        })
      }
    }
  })

  it('keeps the failed place out of every chart and table row, but names it in the header', () => {
    for (const { key, layout } of layouts) {
      if (key === 'geography' || key === 'evidence' || key === 'header') continue
      for (const c of ofType(layout, 'chart')) {
        const params = c.params as ChartComponentParams
        expect(JSON.stringify(params)).not.toContain('Grenoble')
      }
      for (const c of ofType(layout, 'table')) {
        const rows = (c.params as TableComponentParams).rows
        expect(JSON.stringify(rows), key).not.toContain('Grenoble')
      }
    }
    const header = textOf(byKey('header'))
    expect(header).toContain('Grenoble (fixture)')
    expect(header).toContain('upstream_failed')
  })

  it('states the header facts: places, covered dates, numerical forecast, provider, unknown model', () => {
    const header = textOf(byKey('header'))
    expect(header).toContain('SYNTHETIC FIXTURE')
    expect(header).toContain('Numerical forecast')
    expect(header).toContain('Lyon (fixture)')
    expect(header).toContain('Brest (fixture)')
    expect(header).toContain('2026-10-04 to 2026-10-06')
    // Brest only has values on two dates: the header says so rather than claiming three.
    expect(header).toMatch(/Brest \(fixture\): 2026-10-04, 2026-10-05 \(2 of 3 dates\)/)
    expect(header).toContain('Provider: Synthetic fixture provider')
    expect(header).toContain(`Model: ${UNAVAILABLE}`)
  })

  describe('comparison never passes a partial figure off as a complete total', () => {
    const rain = byKey('comparison-rain')
    const wind = byKey('comparison-wind')
    const row = (layout: UILayout, place: string) =>
      tableOf(layout).rows.find((r) => r.place === place)!

    it('uses the same period for every place', () => {
      for (const layout of [rain, wind]) {
        const t = tableOf(layout)
        t.rows.forEach((r) => expect(String(r.coverage)).toMatch(new RegExp(` of ${model.dates.length} days$`)))
        expect(textOf(layout)).toContain(`the same ${model.dates.length}-day period for every place`)
        expect(chartOf(layout).data.labels).toEqual(okPlaces.map((p) => p.label))
      }
    })

    it('rain: complete total for Lyon only; Brest is null in the chart, partial + coverage in the table', () => {
      expect(chartOf(rain).data.datasets).toHaveLength(1)
      expect(chartOf(rain).data.datasets[0].data).toEqual([5.8, null])
      expect(row(rain, 'Lyon (fixture)')).toMatchObject({ complete: 5.8, available: 5.8, coverage: '3 of 3 days' })
      expect(row(rain, 'Brest (fixture)')).toMatchObject({ complete: null, available: 8.5, coverage: '2 of 3 days' })
      expect(chartOf(rain).data.datasets[0].data).not.toContain(8.5)
      expect(textOf(rain)).toContain('8.5 mm covers the available days only and is not the period figure')
    })

    it('wind: the maximum is withheld while a day is missing; the available-days figure is explicit', () => {
      expect(chartOf(wind).data.datasets[0].data).toEqual([null, null])
      expect(row(wind, 'Lyon (fixture)')).toMatchObject({ complete: null, available: 31, coverage: '2 of 3 days' })
      expect(row(wind, 'Brest (fixture)')).toMatchObject({ complete: null, available: null, coverage: '0 of 3 days' })
      expect(chartOf(wind).data.datasets[0].data).not.toContain(31)
      expect(textOf(wind)).toContain('no figure available')
      expect(textOf(wind)).toContain('Not compared, no forecast: Grenoble (fixture)')
    })

    it('takes the units from the model metadata', () => {
      expect(chartOf(rain).unit).toBe(model.variables.precipitation.unit)
      expect(chartOf(wind).unit).toBe(model.variables.wind_speed.unit)
      const labels = tableOf(rain).columns.map((c) => c.label).join('|')
      expect(labels).toContain(`(${model.variables.precipitation.unit})`)
    })

    it('uses the recipe layout: chart cols 1-7, table cols 8-12, summary above', () => {
      const [summary, chart, table] = rain.components
      expect(summary.type).toBe('text')
      expect(chart.position).toMatchObject({ colStart: 1, colSpan: 7 })
      expect(table.position).toMatchObject({ colStart: 8, colSpan: 5 })
    })
  })

  it('takes every unit from the model: changing the metadata changes the views', () => {
    const changed: ForecastModel = {
      ...model,
      variables: {
        precipitation: { ...model.variables.precipitation, unit: 'in' },
        wind_speed: { ...model.variables.wind_speed, unit: 'mph' },
      },
    }
    expect(chartOf(buildChartLayout(changed, 'precipitation')).unit).toBe('in')
    expect(chartOf(buildChartLayout(changed, 'wind_speed')).unit).toBe('mph')
    expect(JSON.stringify(buildComparisonLayout(changed, 'wind_speed'))).not.toContain('km/h')
    expect(JSON.stringify(buildAllLayouts(changed))).not.toMatch(/km\/h|\bmm\b/)
  })
})

// ─── c. coordinates ──────────────────────────────────────────────────────────

describe('c. coordinates: [latitude, longitude] on markers, same numbers in the table', () => {
  const geography = byKey('geography')
  const map = only(ofType(geography, 'map')).params as MapComponentParams
  const table = tableOf(geography)

  it('puts real coordinates in marker tuples as [lat, lon]', () => {
    expect(map.markers!.map((m) => m.position)).toEqual([
      [45.764, 4.8357], // Lyon
      [48.3904, -4.4861], // Brest (negative longitude, so a swap cannot hide)
      [45.1885, 5.7245], // Grenoble (queried, failed)
    ])
    for (const m of map.markers!) {
      const [lat, lon] = m.position as [number, number]
      expect(Math.abs(lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(lon)).toBeLessThanOrEqual(180)
    }
  })

  it('shows the same places and numbers in the table, in the same order', () => {
    expect(table.rows.map((r) => [r.latitude, r.longitude])).toEqual(
      map.markers!.map((m) => m.position)
    )
    expect(table.rows.map((r) => r.place)).toEqual(map.markers!.map((m) => m.tooltip))
    expect(table.rows.map((r) => r.place)).toEqual(model.places.map((p) => p.label))
  })

  it('labels markers, fits the bounds, and marks the failed point as failed', () => {
    expect(map.fitBounds).toBe(true)
    map.markers!.forEach((m) => expect(m.tooltip).toMatch(/\(fixture\)$/))
    expect(table.rows[2].status).toBe('Forecast failed (upstream_failed)')
    expect(table.rows[0].status).toBe('Forecast available')
  })

  it('uses the geography recipe: map cols 1-8, table cols 9-12', () => {
    const mapComponent = only(ofType(geography, 'map'))
    const tableComponent = only(ofType(geography, 'table'))
    expect(mapComponent.position).toMatchObject({ colStart: 1, colSpan: 8 })
    expect(tableComponent.position).toMatchObject({ colStart: 9, colSpan: 4 })
  })

  it('has no GeoJSON; if one is ever added, its coordinates must be [lon, lat]', () => {
    const visit = (value: unknown, lonLatRange: (pair: number[]) => void): void => {
      if (Array.isArray(value)) {
        if (value.length >= 2 && value.every((v) => typeof v === 'number')) lonLatRange(value as number[])
        else value.forEach((v) => visit(v, lonLatRange))
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach((v) => visit(v, lonLatRange))
      }
    }
    for (const { layout } of layouts) {
      for (const c of ofType(layout, 'map')) {
        const params = c.params as MapComponentParams & { geojson?: unknown }
        expect(params.layers).toBeUndefined()
        if (params.geojson) {
          const geo = params.geojson as { features: Array<{ geometry: { coordinates: unknown } }> }
          geo.features.forEach((f) =>
            visit(f.geometry.coordinates, ([lon, lat]) => {
              const place = model.places.find((p) => p.latitude === lat && p.longitude === lon)
              expect(place, `GeoJSON pair [${lon}, ${lat}] is not [lon, lat] of a fixture place`).toBeDefined()
            })
          )
        }
      }
    }
  })
})

// ─── d. threshold ────────────────────────────────────────────────────────────

describe('d. inclusive threshold: the host result is shown unchanged', () => {
  const rows = tableOf(byKey('thresholds')).rows
  // The existing row: a value exactly AT its inclusive threshold.
  const row = rows[0]
  // The decimal row: a value just BELOW its inclusive threshold (4.2 against ≥ 4.25).
  const below = rows.find((r) => r.variable === 'Precipitation')!

  it('shows place, date, value, unit, operator, threshold and result', () => {
    expect(row).toMatchObject({
      place: 'Lyon (fixture)',
      date: '2026-10-06',
      value: 31,
      unit: 'km/h',
      operator: '≥',
      threshold: 31,
      result: 'Exceeded',
    })
  })

  it('keeps the value exactly at the threshold and the host verdict untouched', () => {
    const t = model.thresholds[0]
    expect(row.value).toBe(t.value)
    expect(row.threshold).toBe(t.threshold)
    expect(row.value).toBe(row.threshold)
    expect(row.result).toBe(t.exceeded ? 'Exceeded' : 'Not exceeded')
    expect(row.unit).toBe(model.variables.wind_speed.unit)
  })

  it('shows the same value as the daily table and the wind chart', () => {
    const daily = tableOf(byKey('daily')).rows.find(
      (r) => r.place === 'Lyon (fixture)' && r.date === '2026-10-06'
    )!
    expect(daily.wind_speed).toBe(row.value)
    const lyon = chartOf(byKey('chart-wind')).data.datasets.find((d) => d.label === 'Lyon (fixture)')!
    expect(lyon.data[2]).toBe(row.value)
  })

  it('says it creates no monitoring and no email', () => {
    expect(allText(byKey('thresholds'))).toContain('create no monitoring and send no email')
  })

  it('lists one row per host result, the exactly-at row first', () => {
    expect(model.thresholds).toHaveLength(2)
    expect(rows).toHaveLength(model.thresholds.length)
    expect(rows.map((r) => r.variable)).toEqual(['Wind speed', 'Precipitation'])
  })

  it('shows a decimal value below an inclusive threshold unrounded, with the host verdict unchanged', () => {
    const t = model.thresholds[1]
    expect(below).toMatchObject({
      place: 'Lyon (fixture)',
      date: '2026-10-05',
      variable: 'Precipitation',
      value: 4.2,
      unit: 'mm',
      operator: '≥',
      threshold: 4.25,
      result: 'Not exceeded',
    })
    // Neither number went through any rounding or formatting on its way to the table.
    expect(below.value).toBe(t.value)
    expect(below.threshold).toBe(t.threshold)
    expect(below.value).not.toBe(Math.round(t.value))
    expect(below.threshold).not.toBe(Math.round(t.threshold))
    expect(below.result).toBe(t.exceeded ? 'Exceeded' : 'Not exceeded')
    expect(below.unit).toBe(model.variables.precipitation.unit)
  })

  it('shows the same decimal as the daily table and the rain chart', () => {
    const daily = tableOf(byKey('daily')).rows.find(
      (r) => r.place === 'Lyon (fixture)' && r.date === '2026-10-05'
    )!
    expect(daily.precipitation).toBe(below.value)
    const lyon = chartOf(byKey('chart-rain')).data.datasets.find((d) => d.label === 'Lyon (fixture)')!
    expect(lyon.data[1]).toBe(below.value)
  })

  it('uses, for every host result, a value that really exists in the series it comes from', () => {
    for (const t of model.thresholds) {
      const place = okPlaces.find((p) => p.id === t.placeId)!
      const index = model.dates.indexOf(t.date)
      expect(index, `${t.placeId} ${t.date} is a model date`).toBeGreaterThanOrEqual(0)
      expect(place.series[t.variable][index]).toBe(t.value)
    }
  })

  it('takes every verdict from the host: flipping it flips the row, the numbers never decide', () => {
    const flipped: ForecastModel = {
      ...model,
      thresholds: model.thresholds.map((t) => ({ ...t, exceeded: !t.exceeded })),
    }
    const flippedRows = tableOf(buildThresholdsLayout(flipped)).rows
    // 31 ≥ 31 is true and 4.2 ≥ 4.25 is false; the host said the opposite, and the views follow it.
    expect(flippedRows.map((r) => r.result)).toEqual(['Not exceeded', 'Exceeded'])
    expect(flippedRows.map((r) => [r.value, r.threshold])).toEqual([
      [31, 31],
      [4.2, 4.25],
    ])
  })
})

// ─── e. provenance ───────────────────────────────────────────────────────────

describe('e. unknown provenance is stated, never filled in', () => {
  const evidence = byKey('evidence')
  const rows = tableOf(evidence).rows as Array<{ field: string; value: string }>
  const value = (field: string) => rows.find((r) => r.field === field)?.value

  it('writes unknown fields as unavailable', () => {
    expect(value('Model')).toBe(UNAVAILABLE)
    expect(value('Model issue time')).toBe(UNAVAILABLE)
    expect(value('Source URL')).toBe(UNAVAILABLE)
    expect(textOf(byKey('header'))).toContain(`Model issue time: ${UNAVAILABLE}`)
  })

  it('shows the known fields and keeps collection time apart from model issue time', () => {
    expect(value('Provider')).toBe('Synthetic fixture provider')
    expect(value('Collected at (collection time)')).toBe(model.provenance.collectedAt)
    expect(value('Receipt captured at')).toBe(model.provenance.receiptCapturedAt)
    expect(value('Licence')).toBe(model.provenance.licence)
    expect(value('Queried point, Lyon (fixture)')).toBe('45.764, 4.8357 (latitude, longitude)')
    expect(value('Failed place, Grenoble (fixture)')).toBe('No forecast (upstream_failed)')
  })

  it('emits no link component, no URL, no citation or file id', () => {
    for (const { layout } of layouts) {
      expect(layout.components.map((c) => c.type)).not.toContain('link')
    }
    const json = JSON.stringify(layouts)
    expect(json).not.toMatch(/https?:\/\//)
    expect(json).not.toMatch(/citationMap|file_id|"page"|citation/i)
  })

  it('invents no timestamp: only the two timestamps of the model appear', () => {
    const found = new Set(JSON.stringify(layouts).match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g) ?? [])
    expect([...found].sort()).toEqual(
      [model.provenance.collectedAt, model.provenance.receiptCapturedAt].sort()
    )
  })

  it('only makes a link when the model really has a source URL', () => {
    const withUrl: ForecastModel = {
      ...model,
      provenance: { ...model.provenance, sourceUrl: 'https://example.invalid/source' },
    }
    const types = buildAllLayouts(withUrl).flatMap((l) => l.layout.components.map((c) => c.type))
    expect(types.filter((t) => t === 'link')).toHaveLength(1)
  })

  it('states the limits: point forecasts, no normals or hazard levels', () => {
    const text = allText(evidence)
    expect(text).toContain('not a continuous coverage')
    expect(text).toContain('no seasonal normal, probability or hazard level')
    expect(text).toContain('collection time is not the model issue time')
  })
})

// ─── f. rendering ────────────────────────────────────────────────────────────

describe('f. rendering with UIResourceRenderer', () => {
  beforeEach(() => {
    chartHarness.configs.length = 0
    leafletHarness.markerCalls.length = 0
  })
  afterEach(() => cleanup())

  const renderLayout = (layout: UILayout) =>
    render(() => <UIResourceRenderer content={layout} lazyLoad={false} />)

  const settle = async (container: HTMLElement, layout: UILayout) => {
    if (ofType(layout, 'chart').length > 0) {
      await waitFor(() => expect(container.querySelector('canvas')).toBeTruthy())
      await waitFor(() => expect(chartHarness.configs.length).toBeGreaterThan(0))
    }
    if (ofType(layout, 'table').length > 0) {
      await waitFor(() => expect(container.querySelector('table')).toBeTruthy())
    }
  }

  it.each(layouts.map((l) => [l.key, l.layout] as const))('%s renders without a validation error', async (_key, layout) => {
    const { container, queryByText } = renderLayout(layout)
    await settle(container, layout)
    expect(queryByText('Validation Error')).toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('passes the same data to Chart.js: nulls kept, no gap bridged', async () => {
    const layout = byKey('chart-wind')
    const { container } = renderLayout(layout)
    await settle(container, layout)
    const config = chartHarness.configs.at(-1)!
    expect(config.data!.labels).toEqual(model.dates)
    const lyon = config.data!.datasets!.find((d) => d.label === 'Lyon (fixture)')!
    expect(lyon.data).toEqual([18, null, 31])
    // The line must break at the null: spanGaps is explicitly false, not merely "not true".
    expect(lyon.spanGaps).toBe(false)
    const brest = config.data!.datasets!.find((d) => d.label === 'Brest (fixture)')!
    expect(brest.data).toEqual([null, null, null])
    expect(brest.spanGaps).toBe(false)
    expect(JSON.stringify(config.options)).toContain(model.variables.wind_speed.unit)
  })

  it('draws the real zero in the bar chart and keeps the missing bar null', async () => {
    const layout = byKey('chart-rain')
    const { container } = renderLayout(layout)
    await settle(container, layout)
    const config = chartHarness.configs.at(-1)!
    expect(config.type).toBe('bar')
    expect(config.data!.datasets!.find((d) => d.label === 'Lyon (fixture)')!.data![0]).toBe(0)
    expect(config.data!.datasets!.find((d) => d.label === 'Brest (fixture)')!.data).toEqual([6.4, 2.1, null])
  })

  it('creates a Leaflet marker at [lat, lon] for every queried point', async () => {
    const layout = byKey('geography')
    const { container } = renderLayout(layout)
    await waitFor(() => expect(leafletHarness.markerCalls.length).toBe(3))
    expect(leafletHarness.markerCalls).toEqual([
      [45.764, 4.8357],
      [48.3904, -4.4861],
      [45.1885, 5.7245],
    ])
    expect(container.querySelector('table')).toBeTruthy()
  })

  it('renders the real zero as "0" in the daily table', async () => {
    const layout = byKey('daily')
    const { container } = renderLayout(layout)
    await settle(container, layout)
    const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent ?? '')
    const rainIndex = headers.findIndex((h) => h.includes('Precipitation'))
    expect(rainIndex).toBeGreaterThanOrEqual(0)
    const lyonDay1 = [...container.querySelectorAll('tbody tr')].find((tr) => {
      const text = tr.textContent ?? ''
      return text.includes('Lyon (fixture)') && text.includes('2026-10-04')
    })!
    const zeroCell = lyonDay1.querySelectorAll('td')[rainIndex]
    expect(zeroCell.textContent?.trim()).toBe('0')
    expect(zeroCell.querySelector('[data-mcp-missing-value]')).toBeNull()
  })

  // ── table missing-value marks ──
  describe('rendering: table missing-value marks', () => {
    it('daily table: each missing cell carries [data-mcp-missing-value], plus one legend', async () => {
      const layout = byKey('daily')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      const table = container.querySelector('table')!
      const missingInModel = okPlaces.flatMap((p) =>
        VARIABLES.flatMap((k) => p.series[k].filter((v) => v === null))
      ).length
      expect(missingInModel).toBe(5)
      expect(table.querySelectorAll('[data-mcp-missing-value]').length).toBe(missingInModel)
      expect(container.querySelectorAll('[data-mcp-missing-legend]').length).toBe(1)
    })

    it('comparison tables carry the mark and the legend when a figure is withheld', async () => {
      for (const key of ['comparison-rain', 'comparison-wind'] as const) {
        const layout = byKey(key)
        const { container, unmount } = renderLayout(layout)
        await settle(container, layout)
        expect(container.querySelectorAll('table [data-mcp-missing-value]').length).toBeGreaterThan(0)
        expect(container.querySelectorAll('[data-mcp-missing-legend]').length).toBe(1)
        unmount()
      }
    })

    it('tables without a missing cell show neither mark nor legend', async () => {
      for (const key of ['geography', 'thresholds', 'evidence'] as const) {
        const layout = byKey(key)
        const { container, unmount } = renderLayout(layout)
        await settle(container, layout)
        expect(container.querySelectorAll('[data-mcp-missing-value]').length, key).toBe(0)
        expect(container.querySelectorAll('[data-mcp-missing-legend]').length, key).toBe(0)
        unmount()
      }
    })
  })

  // ── chart notes ──
  describe('rendering: chart notes', () => {
    it('wind: gaps note, and a no-data note naming Brest', async () => {
      const layout = byKey('chart-wind')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      const notes = container.querySelector('[data-mcp-chart-notes]')
      expect(notes).toBeTruthy()
      expect(notes!.querySelector('[data-mcp-chart-note="gaps"]')).toBeTruthy()
      const noData = [...notes!.querySelectorAll('[data-mcp-chart-note="no-data"]')]
      expect(noData).toHaveLength(1)
      expect(noData[0].textContent).toContain('Brest (fixture)')
      expect(notes!.textContent).not.toContain('Lyon (fixture)')
    })

    it('rain: bars note, no no-data note', async () => {
      const layout = byKey('chart-rain')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      const notes = container.querySelector('[data-mcp-chart-notes]')
      expect(notes).toBeTruthy()
      expect(notes!.querySelector('[data-mcp-chart-note="bars"]')).toBeTruthy()
      expect(notes!.querySelector('[data-mcp-chart-note="no-data"]')).toBeNull()
    })
  })

  // ── thresholds table: display fidelity ──
  describe('rendering: thresholds table', () => {
    const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim() ?? '')

    it('shows the unrounded value and threshold exactly as given, next to the exactly-at-threshold row', async () => {
      const layout = byKey('thresholds')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      // A sortable header ends with its (unsorted) sort glyph, "↕": not part of the label.
      const headers = [...container.querySelectorAll('thead th')].map((th) =>
        (th.textContent ?? '').replace(/\u2195$/u, '').trim()
      )
      expect(headers).toEqual([
        'Place',
        'Date',
        'Variable',
        'Value',
        'Unit',
        'Operator',
        'Threshold',
        'Result',
      ])
      // Both rows as the host gave them: "4.2" and "4.25" are not rounded to 4 or 4.3,
      // "31" is not shown as 31.0, and each verdict is the host's.
      expect([...container.querySelectorAll('tbody tr')].map(cellsOf)).toEqual([
        ['Lyon (fixture)', '2026-10-06', 'Wind speed', '31', 'km/h', '≥', '31', 'Exceeded'],
        ['Lyon (fixture)', '2026-10-05', 'Precipitation', '4.2', 'mm', '≥', '4.25', 'Not exceeded'],
      ])
    })

    it('marks no cell as missing: a decimal below its threshold is a value, not an absence', async () => {
      const layout = byKey('thresholds')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      expect(container.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(0)
      expect(container.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(0)
    })
  })

  // ── daily table: export parity ──
  // What leaves the table must say what the model says: a real zero stays "0",
  // a missing value is an empty CSV field and a JSON null — never a 0, never
  // the marker, never the accessible "Missing value" wording.
  describe('rendering: daily table export parity', () => {
    // jsdom has no URL.createObjectURL: capture the Blob the table hands to the
    // anchor it clicks, and the file name it gives that anchor.
    let blobs: Blob[]
    let filenames: string[]
    let clickSpy: { mockRestore: () => void }
    const saved = {
      create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
      revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
    }
    const restore = (name: 'createObjectURL' | 'revokeObjectURL', descriptor?: PropertyDescriptor) => {
      if (descriptor) Object.defineProperty(URL, name, descriptor)
      else delete (URL as unknown as Record<string, unknown>)[name]
    }

    beforeEach(() => {
      blobs = []
      filenames = []
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn((blob: Blob) => {
          blobs.push(blob)
          return `blob:fixture-${blobs.length}`
        }),
        configurable: true,
        writable: true,
      })
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        filenames.push(this.download)
      })
    })

    afterEach(() => {
      clickSpy.mockRestore()
      restore('createObjectURL', saved.create)
      restore('revokeObjectURL', saved.revoke)
    })

    const readBlob = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(blob)
      })

    /** Opens the export menu of the rendered daily table and picks `menuLabel`. */
    const exportDaily = async (menuLabel: string) => {
      const layout = byKey('daily')
      const { container } = renderLayout(layout)
      await settle(container, layout)
      fireEvent.click(container.querySelector(`button[aria-label="${DEFAULT_MCPUI_STRINGS.tableExport}"]`)!)
      fireEvent.click(
        await waitFor(() => {
          const item = [...document.body.querySelectorAll('button')].find((b) => b.textContent === menuLabel)
          if (!item) throw new Error('export menu not open')
          return item
        })
      )
      expect(blobs).toHaveLength(1)
      return { text: await readBlob(blobs[0]), mime: blobs[0].type, filename: filenames[0] }
    }

    it('CSV: keeps the real zero as "0" and writes an empty field for each missing value', async () => {
      const { text, mime, filename } = await exportDaily(DEFAULT_MCPUI_STRINGS.tableDownloadCsv)
      expect(filename).toBe('geoai-fixture-daily-forecast.csv')
      expect(mime).toBe('text/csv')

      const [header, ...lines] = text.split('\n')
      expect(header).toBe('Place,Date,Precipitation (mm),Wind speed (km/h)')
      expect(lines).toEqual([
        'Lyon (fixture),2026-10-04,0,18', // the real zero is "0", next to an observed value
        'Lyon (fixture),2026-10-05,4.2,', // wind is missing: an empty field
        'Lyon (fixture),2026-10-06,1.6,31',
        'Brest (fixture),2026-10-04,6.4,',
        'Brest (fixture),2026-10-05,2.1,',
        'Brest (fixture),2026-10-06,,', // both missing: two empty fields
      ])

      // The same lines, derived from the model: nothing was invented or dropped.
      const fromModel = okPlaces.flatMap((place) =>
        model.dates.map((date, i) =>
          [
            place.label,
            date,
            ...VARIABLES.map((k) => (place.series[k][i] === null ? '' : String(place.series[k][i]))),
          ].join(',')
        )
      )
      expect(lines).toEqual(fromModel)
      expect(text).not.toMatch(/null|undefined|NaN|Missing value/i)
    })

    it('JSON: keeps null for each missing value and the real zero as 0', async () => {
      const { text, mime, filename } = await exportDaily(DEFAULT_MCPUI_STRINGS.tableDownloadJson)
      expect(filename).toBe('geoai-fixture-daily-forecast.json')
      expect(mime).toBe('application/json')

      const parsed = JSON.parse(text) as {
        columns: Array<{ key: string; label: string }>
        rows: Array<Record<string, unknown>>
      }
      expect(parsed.columns.map((c) => c.key)).toEqual(['place', 'date', 'precipitation', 'wind_speed'])
      // Strictly the rows of the layout: no key dropped, no null turned into 0 or ''.
      expect(parsed.rows).toStrictEqual(tableOf(byKey('daily')).rows)

      const rowOf = (place: string, date: string) =>
        parsed.rows.find((r) => r.place === place && r.date === date)!
      expect(rowOf('Lyon (fixture)', '2026-10-04').precipitation).toBe(0) // toBe: Object.is, so not null, not ''
      expect(rowOf('Lyon (fixture)', '2026-10-05').wind_speed).toBeNull()
      const bothMissing = rowOf('Brest (fixture)', '2026-10-06')
      expect(Object.keys(bothMissing)).toEqual(['place', 'date', 'precipitation', 'wind_speed']) // present, not omitted
      expect(bothMissing.precipitation).toBeNull()
      expect(bothMissing.wind_speed).toBeNull()

      // As many nulls as the model has missing values, and no zero was added.
      const nulls = parsed.rows.flatMap((r) => VARIABLES.map((k) => r[k])).filter((v) => v === null)
      const missingInModel = okPlaces.flatMap((p) => VARIABLES.flatMap((k) => p.series[k].filter((v) => v === null)))
      expect(nulls).toHaveLength(missingInModel.length)
      expect(parsed.rows.flatMap((r) => VARIABLES.map((k) => r[k])).filter((v) => v === 0)).toHaveLength(1)
    })
  })
})
