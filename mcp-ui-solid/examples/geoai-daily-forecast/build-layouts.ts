/**
 * Turns the synthetic presentation model (./fixture.ts) into MCP-UI layouts.
 *
 * SYNTHETIC FIXTURE — NOT REAL WEATHER. LOCAL EXAMPLE: this file is not part
 * of the published package, not an API, and not what Deposium installs.
 *
 * This code plays the HOST's role (deposium_MCPs in production). The brief
 * puts statistics on the host: the totals, maxima, coverage counts, covered
 * dates and the threshold verdicts are all computed HERE, from the model, and
 * MCP-UI only displays them. The three presentation recipes (comparison,
 * geography, evidence) only arrange the components this file supplies; they
 * compute and invent nothing.
 *
 * Rules applied in every view:
 * - Absence is not zero: `null` stays `null` in tables and charts, a failed
 *   place is never given a series, and a date is never dropped from an axis.
 * - A total or a maximum exists only when every day of the period is present.
 *   Otherwise the chart gets `null`, and the table gets an explicit
 *   available-days figure plus its coverage ("2 of 3 days").
 * - Units come from the model (`model.variables[k].unit`), never hardcoded.
 * - Unknown provenance is written as UNAVAILABLE; there is no link without a
 *   URL, and no timestamp, citation or file id is invented.
 */

import {
  createComparisonLayout,
  createEvidenceLayout,
  createGeographyLayout,
  type ChartComponent,
  type LinkComponent,
  type MapComponent,
  type TableComponent,
  type TextComponent,
} from '../../src/adapters/presentation'
import type { UIComponent, UILayout } from '../../src/types'
import {
  FIXTURE_LABEL,
  type ForecastModel,
  type ForecastPlace,
  type VariableKey,
} from './fixture'

/** What the host writes for a provenance field it does not know. */
export const UNAVAILABLE = 'unavailable'

/** One-line statement reused wherever the data could be mistaken for weather. */
export const NOT_REAL_WEATHER = `${FIXTURE_LABEL}.`

const GRID = { columns: 12, gap: '1rem' } as const

export type SuccessfulPlace = ForecastPlace & {
  status: 'ok'
  series: NonNullable<ForecastPlace['series']>
}

export function successfulPlaces(model: ForecastModel): SuccessfulPlace[] {
  return model.places.filter((p): p is SuccessfulPlace => p.status === 'ok' && !!p.series)
}

export function failedPlaces(model: ForecastModel): ForecastPlace[] {
  return model.places.filter((p) => p.status === 'failed')
}

/** `"Precipitation (mm)"`: the unit comes from the model. */
export function labelWithUnit(model: ForecastModel, variable: VariableKey): string {
  const v = model.variables[variable]
  return `${v.label} (${v.unit})`
}

/** Dates on which the place has at least one observed value, in model order. */
export function coveredDates(model: ForecastModel, place: SuccessfulPlace): string[] {
  return model.dates.filter((_, i) =>
    (Object.keys(place.series) as VariableKey[]).some((k) => place.series[k][i] !== null)
  )
}

/** Float noise only (4.2 + 1.6 = 5.800000000000001); never rounds a real figure. */
function clean(value: number): number {
  return Number(value.toFixed(10))
}

export type Aggregation = 'sum' | 'max'

export interface PeriodFigure {
  /** Days of the period that have a value. */
  present: number
  /** Days of the period. */
  total: number
  /** Only set when every day is present: the one figure that may be called a total / maximum. */
  complete: number | null
  /** Figure over the available days only; equals `complete` when nothing is missing. */
  availableDays: number | null
}

export function periodFigure(
  model: ForecastModel,
  place: SuccessfulPlace,
  variable: VariableKey,
  kind: Aggregation
): PeriodFigure {
  const values = place.series[variable]
  const observed = values.filter((v): v is number => v !== null)
  const figure =
    observed.length === 0
      ? null
      : clean(kind === 'sum' ? observed.reduce((a, b) => a + b, 0) : Math.max(...observed))
  return {
    present: observed.length,
    total: model.dates.length,
    complete: observed.length === values.length ? figure : null,
    availableDays: figure,
  }
}

export function coverageText(figure: PeriodFigure): string {
  return `${figure.present} of ${figure.total} days`
}

function dateRange(dates: string[]): string {
  return dates.length === 0
    ? UNAVAILABLE
    : dates.length === 1
      ? dates[0]
      : `${dates[0]} to ${dates[dates.length - 1]}`
}

function component<T extends UIComponent['type']>(
  id: string,
  type: T,
  params: unknown,
  position: UIComponent['position'] = { colStart: 1, colSpan: 12 }
): UIComponent {
  return { id, type, position, params } as UIComponent
}

function layout(id: string, components: UIComponent[]): UILayout {
  return { id, components, grid: { ...GRID } }
}

const text = (id: string, content: string): TextComponent => ({
  id,
  type: 'text',
  params: { content, markdown: true },
})

// ─── Header ──────────────────────────────────────────────────────────────────

/** Places, dates actually covered, "Numerical forecast", provider/model, failed place. */
export function buildHeaderLayout(model: ForecastModel): UILayout {
  const ok = successfulPlaces(model)
  const failed = failedPlaces(model)
  const prov = model.provenance
  const lines = [
    `**${NOT_REAL_WEATHER}**`,
    `**Numerical forecast** for ${ok.map((p) => p.label).join(', ')}.`,
    `Requested period: ${dateRange(model.dates)} (${model.dates.length} days).`,
    `Dates actually covered:\n${ok
      .map((p) => {
        const covered = coveredDates(model, p)
        return `- ${p.label}: ${covered.length ? covered.join(', ') : UNAVAILABLE} (${covered.length} of ${model.dates.length} dates)`
      })
      .join('\n')}`,
    `Provider: ${prov.provider}. Model: ${prov.model ?? UNAVAILABLE}. Model issue time: ${prov.modelIssuedAt ?? UNAVAILABLE}.`,
  ]
  if (failed.length > 0) {
    lines.push(
      `No forecast for: ${failed.map((p) => `${p.label} (${p.error?.code ?? UNAVAILABLE})`).join(', ')}.`
    )
  }
  return layout('geoai-fixture-header', [
    component('geoai-fixture-header-text', 'text', { content: lines.join('\n\n'), markdown: true }),
  ])
}

// ─── Daily table ─────────────────────────────────────────────────────────────

const VARIABLE_KEYS: VariableKey[] = ['precipitation', 'wind_speed']

/** One row per successful place and date; `null` stays `null`. */
export function buildDailyTable(model: ForecastModel): TableComponent {
  const rows = successfulPlaces(model).flatMap((place) =>
    model.dates.map((date, i) => ({
      place: place.label,
      date,
      ...Object.fromEntries(VARIABLE_KEYS.map((k) => [k, place.series[k][i]])),
    }))
  )
  return {
    id: 'geoai-fixture-daily-table',
    type: 'table',
    params: {
      title: 'Daily forecast (synthetic fixture)',
      columns: [
        { key: 'place', label: 'Place' },
        { key: 'date', label: 'Date' },
        ...VARIABLE_KEYS.map((k) => ({ key: k, label: labelWithUnit(model, k) })),
      ],
      rows,
      exportable: { formats: ['csv', 'json'], filename: 'geoai-fixture-daily-forecast' },
    },
  }
}

export function buildDailyTableLayout(model: ForecastModel): UILayout {
  return layout('geoai-fixture-daily', [
    { ...buildDailyTable(model), position: { colStart: 1, colSpan: 12 } } as UIComponent,
  ])
}

// ─── Charts (one variable, one unit, one dataset per successful place) ──────

/** ISO dates as plain category labels: no timeAxis, no iframe renderer. */
export function buildChart(model: ForecastModel, variable: VariableKey): ChartComponent {
  const v = model.variables[variable]
  return {
    id: `geoai-fixture-chart-${variable.replace(/_/g, '-')}`,
    type: 'chart',
    params: {
      type: variable === 'precipitation' ? 'bar' : 'line',
      title: `${v.label} per day (synthetic fixture)`,
      unit: v.unit,
      renderer: 'native',
      exportable: false,
      data: {
        labels: [...model.dates],
        datasets: successfulPlaces(model).map((p) => ({
          label: p.label,
          data: [...p.series[variable]],
        })),
      },
    },
  }
}

export function buildChartLayout(model: ForecastModel, variable: VariableKey): UILayout {
  const chart = buildChart(model, variable)
  return layout(`geoai-fixture-${variable.replace(/_/g, '-')}-curve`, [
    { ...chart, position: { colStart: 1, colSpan: 12 } } as UIComponent,
  ])
}

// ─── Comparison (same period for every place) ────────────────────────────────

const COMPARISON: Record<VariableKey, { kind: Aggregation; name: string }> = {
  precipitation: { kind: 'sum', name: 'Cumulative precipitation' },
  wind_speed: { kind: 'max', name: 'Maximum wind speed' },
}

export function comparisonKind(variable: VariableKey): Aggregation {
  return COMPARISON[variable].kind
}

/**
 * A figure is plotted only when its whole period is present (otherwise `null`).
 * The table adds the available-days figure and the coverage so nothing partial
 * can pass for the expected total.
 */
export function buildComparisonLayout(model: ForecastModel, variable: VariableKey): UILayout {
  const { kind, name } = COMPARISON[variable]
  const unit = model.variables[variable].unit
  const ok = successfulPlaces(model)
  const failed = failedPlaces(model)
  const figures = ok.map((p) => ({ place: p, figure: periodFigure(model, p, variable, kind) }))
  const slug = variable.replace(/_/g, '-')
  const period = dateRange(model.dates)

  const chart: ChartComponent = {
    id: `geoai-fixture-comparison-${slug}-chart`,
    type: 'chart',
    params: {
      type: 'bar',
      title: `${name} over ${period} (synthetic fixture)`,
      unit,
      renderer: 'native',
      exportable: false,
      data: {
        labels: ok.map((p) => p.label),
        datasets: [
          { label: `${name}, complete period only`, data: figures.map((f) => f.figure.complete) },
        ],
      },
    },
  }

  const table: TableComponent = {
    id: `geoai-fixture-comparison-${slug}-table`,
    type: 'table',
    params: {
      title: `${name}, ${period}`,
      searchable: false,
      columns: [
        { key: 'place', label: 'Place' },
        { key: 'complete', label: `${name}, complete period (${unit})` },
        { key: 'available', label: `${name}, available days only (${unit})` },
        { key: 'coverage', label: 'Coverage' },
      ],
      rows: figures.map(({ place, figure }) => ({
        place: place.label,
        complete: figure.complete,
        available: figure.availableDays,
        coverage: coverageText(figure),
      })),
    },
  }

  const incomplete = figures.filter((f) => f.figure.complete === null)
  const lines = [
    `${NOT_REAL_WEATHER} ${name} over ${period}: the same ${model.dates.length}-day period for every place.`,
    `A total or a maximum is shown only when all ${model.dates.length} days are present.`,
  ]
  for (const { place, figure } of incomplete) {
    lines.push(
      figure.availableDays === null
        ? `- ${place.label}: ${coverageText(figure)}, no figure available.`
        : `- ${place.label}: ${coverageText(figure)}. ${figure.availableDays} ${unit} covers the available days only and is not the period figure.`
    )
  }
  if (failed.length > 0) {
    lines.push(
      `Not compared, no forecast: ${failed.map((p) => `${p.label} (${p.error?.code ?? UNAVAILABLE})`).join(', ')}.`
    )
  }

  return createComparisonLayout({
    id: `geoai-fixture-comparison-${slug}`,
    chart,
    table,
    summary: text(`geoai-fixture-comparison-${slug}-summary`, lines.join('\n\n')),
  })
}

// ─── Geography ───────────────────────────────────────────────────────────────

function pointStatus(place: ForecastPlace): string {
  return place.status === 'ok'
    ? 'Forecast available'
    : `Forecast failed (${place.error?.code ?? UNAVAILABLE})`
}

/**
 * Markers use [latitude, longitude]. The table repeats the same numbers in
 * the same places. No GeoJSON is emitted (it would be [longitude, latitude]).
 */
export function buildGeographyLayout(model: ForecastModel): UILayout {
  const map: MapComponent = {
    id: 'geoai-fixture-map',
    type: 'map',
    params: {
      fitBounds: true,
      markers: model.places.map((p) => ({
        position: [p.latitude, p.longitude] as [number, number],
        tooltip: p.label,
        popup: `${p.label}: queried point ${p.latitude}, ${p.longitude} (latitude, longitude). ${pointStatus(p)}.`,
      })),
    },
  }
  const table: TableComponent = {
    id: 'geoai-fixture-map-table',
    type: 'table',
    params: {
      title: 'Queried points',
      searchable: false,
      columns: [
        { key: 'place', label: 'Place' },
        { key: 'latitude', label: 'Latitude (°)' },
        { key: 'longitude', label: 'Longitude (°)' },
        { key: 'status', label: 'Status' },
      ],
      rows: model.places.map((p) => ({
        place: p.label,
        latitude: p.latitude,
        longitude: p.longitude,
        status: pointStatus(p),
      })),
    },
  }
  return createGeographyLayout({
    id: 'geoai-fixture-geography',
    map,
    table,
    summary: text(
      'geoai-fixture-geography-summary',
      `${NOT_REAL_WEATHER} Points actually queried, not a continuous weather coverage and not city centres.`
    ),
  })
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Rows exactly as the host computed them: value, operator, threshold and verdict untouched. */
export function buildThresholdsLayout(model: ForecastModel): UILayout {
  const label = (id: string) => model.places.find((p) => p.id === id)?.label ?? UNAVAILABLE
  const table: TableComponent = {
    id: 'geoai-fixture-thresholds-table',
    type: 'table',
    params: {
      title: 'Test thresholds (computed by the host)',
      searchable: false,
      columns: [
        { key: 'place', label: 'Place' },
        { key: 'date', label: 'Date' },
        { key: 'variable', label: 'Variable' },
        { key: 'value', label: 'Value' },
        { key: 'unit', label: 'Unit' },
        { key: 'operator', label: 'Operator' },
        { key: 'threshold', label: 'Threshold' },
        { key: 'result', label: 'Result' },
      ],
      rows: model.thresholds.map((t) => ({
        place: label(t.placeId),
        date: t.date,
        variable: model.variables[t.variable].label,
        value: t.value,
        unit: model.variables[t.variable].unit,
        operator: t.operator,
        threshold: t.threshold,
        result: t.exceeded ? 'Exceeded' : 'Not exceeded',
      })),
    },
  }
  return layout('geoai-fixture-thresholds', [
    component(
      'geoai-fixture-thresholds-note',
      'text',
      {
        content: `${NOT_REAL_WEATHER} Test thresholds only: the host computed each result. They create no monitoring and send no email.`,
        markdown: true,
      },
      { colStart: 1, colSpan: 12, rowStart: 1 }
    ),
    { ...table, position: { colStart: 1, colSpan: 12, rowStart: 2 } } as UIComponent,
  ])
}

// ─── Sources and limits ──────────────────────────────────────────────────────

export function buildEvidenceLayout(model: ForecastModel): UILayout {
  const prov = model.provenance
  const providers = VARIABLE_KEYS.map((k) => `${model.variables[k].label}: ${model.variables[k].provider}`)
  const failed = failedPlaces(model)
  const rows: Array<{ field: string; value: string }> = [
    { field: 'Kind of data', value: `Numerical forecast (${FIXTURE_LABEL})` },
    { field: 'Provider', value: prov.provider },
    { field: 'Provider per variable', value: providers.join('; ') },
    { field: 'Model', value: prov.model ?? UNAVAILABLE },
    { field: 'Model issue time', value: prov.modelIssuedAt ?? UNAVAILABLE },
    { field: 'Collected at (collection time)', value: prov.collectedAt },
    { field: 'Receipt captured at', value: prov.receiptCapturedAt },
    { field: 'Licence', value: prov.licence },
    { field: 'Source URL', value: prov.sourceUrl ?? UNAVAILABLE },
    ...model.places.map((p) => ({
      field: `Queried point, ${p.label}`,
      value: `${p.latitude}, ${p.longitude} (latitude, longitude)`,
    })),
    ...failed.map((p) => ({
      field: `Failed place, ${p.label}`,
      value: `No forecast (${p.error?.code ?? UNAVAILABLE})`,
    })),
  ]
  const table: TableComponent = {
    id: 'geoai-fixture-sources-table',
    type: 'table',
    params: {
      title: 'Sources and limits',
      searchable: false,
      columns: [
        { key: 'field', label: 'Field' },
        { key: 'value', label: 'Value' },
      ],
      rows,
    },
  }
  // A link only exists when the source really has a URL. This fixture has none.
  const sources: LinkComponent[] = prov.sourceUrl
    ? [
        {
          id: 'geoai-fixture-source-link',
          type: 'link',
          params: { url: prov.sourceUrl, label: prov.provider },
        },
      ]
    : []
  return createEvidenceLayout({
    id: 'geoai-fixture-evidence',
    summary: text(
      'geoai-fixture-evidence-summary',
      [
        `${NOT_REAL_WEATHER} Sources and limits.`,
        'Point forecasts at the queried coordinates: not a continuous coverage, no seasonal normal, probability or hazard level is derived.',
        `Fields marked ${UNAVAILABLE} are not provided. The collection time is not the model issue time.`,
      ].join('\n\n')
    ),
    table,
    ...(sources.length > 0 ? { sources } : {}),
  })
}

// ─── All views ───────────────────────────────────────────────────────────────

export interface NamedLayout {
  /** Short key for tests and docs. */
  key:
    | 'header'
    | 'daily'
    | 'chart-rain'
    | 'chart-wind'
    | 'comparison-rain'
    | 'comparison-wind'
    | 'geography'
    | 'thresholds'
    | 'evidence'
  layout: UILayout
}

export function buildAllLayouts(model: ForecastModel): NamedLayout[] {
  return [
    { key: 'header', layout: buildHeaderLayout(model) },
    { key: 'daily', layout: buildDailyTableLayout(model) },
    { key: 'chart-rain', layout: buildChartLayout(model, 'precipitation') },
    { key: 'chart-wind', layout: buildChartLayout(model, 'wind_speed') },
    { key: 'comparison-rain', layout: buildComparisonLayout(model, 'precipitation') },
    { key: 'comparison-wind', layout: buildComparisonLayout(model, 'wind_speed') },
    { key: 'geography', layout: buildGeographyLayout(model) },
    { key: 'thresholds', layout: buildThresholdsLayout(model) },
    { key: 'evidence', layout: buildEvidenceLayout(model) },
  ]
}
