/**
 * SYNTHETIC FIXTURE — NOT REAL WEATHER.
 *
 * Local example for the GeoAI daily-forecast pilot (brief 2026-10-03, section
 * 7). Every number, place label and timestamp below is invented to exercise
 * the presentation rules; none of it was observed or forecast by anyone.
 * Place labels carry "(fixture)" on purpose so a view can never be mistaken
 * for a real answer.
 *
 * This is a HOST-PREPARED PRESENTATION MODEL, not the private GeoAI receipt:
 * MCP-UI never sees signatures, scopes or the signed `chat-artifact/v1`
 * structure. The host (MCPs) verifies and authorizes the receipt, then hands
 * the renderer a model of this shape. Units come from the model's metadata
 * (`metadata.provider_map[variable].unit` in the real receipt) and the views
 * never hardcode them.
 *
 * Absence is never zero: `null` means "missing", a failed place has no
 * series at all, and `0` is a real observed zero.
 */

export const IS_SYNTHETIC_FIXTURE = true as const

export const FIXTURE_LABEL = 'SYNTHETIC FIXTURE — not real weather' as const

/** The two variables of the pilot batch, keyed like the GeoAI variables. */
export type VariableKey = 'precipitation' | 'wind_speed'

export interface ForecastVariable {
  key: VariableKey
  /** Human-readable name, without unit. */
  label: string
  /** Unit from the model metadata. Never hardcoded in a view. */
  unit: string
  /** Provider of this variable (providers can differ per variable). */
  provider: string
}

export interface ForecastError {
  code: string
}

export interface ForecastPlace {
  id: string
  /** Display label, always carrying "(fixture)". */
  label: string
  /** The point actually queried (metadata.lat / lon), in degrees. NOT a city centre. */
  latitude: number
  longitude: number
  status: 'ok' | 'failed'
  /** Set when status is 'failed'. A failed place has no `series` at all. */
  error?: ForecastError
  /**
   * Per variable, one entry per model date, aligned with `ForecastModel.dates`.
   * `null` is a missing value. `0` is a real zero.
   */
  series?: Record<VariableKey, Array<number | null>>
}

export interface ThresholdResult {
  placeId: string
  date: string
  variable: VariableKey
  /** The value the host compared, unrounded. */
  value: number
  /** Inclusive operators: a value exactly at the threshold satisfies them. */
  operator: '≥' | '>' | '≤' | '<'
  threshold: number
  /** The host's verdict, displayed unchanged and never recomputed by a view. */
  exceeded: boolean
}

export interface ForecastProvenance {
  provider: string
  /** `null`: the model is not known. */
  model: string | null
  /**
   * `null`: the model run (issue) time is not known. `collectedAt` is the
   * GeoAI COLLECTION time, not a model issue time.
   */
  modelIssuedAt: string | null
  collectedAt: string
  receiptCapturedAt: string
  licence: string
  /** `null`: the source has no URL, so the views must not make a link. */
  sourceUrl: string | null
}

export interface ForecastModel {
  fixture: typeof IS_SYNTHETIC_FIXTURE
  /** ISO dates of the requested period, shared by every place. */
  dates: string[]
  variables: Record<VariableKey, ForecastVariable>
  places: ForecastPlace[]
  thresholds: ThresholdResult[]
  provenance: ForecastProvenance
}

export const FORECAST_FIXTURE: ForecastModel = {
  fixture: IS_SYNTHETIC_FIXTURE,
  dates: ['2026-10-04', '2026-10-05', '2026-10-06'],
  variables: {
    precipitation: {
      key: 'precipitation',
      label: 'Precipitation',
      unit: 'mm',
      provider: 'Synthetic fixture provider',
    },
    wind_speed: {
      key: 'wind_speed',
      label: 'Wind speed',
      unit: 'km/h',
      provider: 'Synthetic fixture provider',
    },
  },
  places: [
    {
      id: 'lyon',
      label: 'Lyon (fixture)',
      latitude: 45.764,
      longitude: 4.8357,
      status: 'ok',
      series: {
        // A real zero on day 1: it must stay 0, distinct from a missing value.
        // Day 2 (4.2) is a decimal that sits just below the second test threshold.
        precipitation: [0, 4.2, 1.6],
        // One missing cell (day 2); day 3 sits exactly on the test threshold.
        wind_speed: [18, null, 31],
      },
    },
    {
      id: 'brest',
      label: 'Brest (fixture)',
      latitude: 48.3904,
      longitude: -4.4861,
      status: 'ok',
      series: {
        // Covers days 1-2 only: day 3 is null, and the date stays on every axis.
        precipitation: [6.4, 2.1, null],
        // An entirely missing series.
        wind_speed: [null, null, null],
      },
    },
    {
      id: 'grenoble',
      label: 'Grenoble (fixture)',
      latitude: 45.1885,
      longitude: 5.7245,
      status: 'failed',
      error: { code: 'upstream_failed' },
    },
  ],
  thresholds: [
    // Exactly AT an inclusive threshold: 31 ≥ 31, so the host says exceeded.
    {
      placeId: 'lyon',
      date: '2026-10-06',
      variable: 'wind_speed',
      value: 31,
      operator: '≥',
      threshold: 31,
      exceeded: true,
    },
    // A decimal value just BELOW an inclusive threshold: 4.2 ≥ 4.25 is false, so
    // the host says not exceeded. The value is the real Lyon precipitation of
    // 2026-10-05, and neither number may be rounded on display: both rounded to
    // an integer read "4", a value AT an inclusive threshold that is nevertheless
    // "not exceeded".
    {
      placeId: 'lyon',
      date: '2026-10-05',
      variable: 'precipitation',
      value: 4.2,
      operator: '≥',
      threshold: 4.25,
      exceeded: false,
    },
  ],
  provenance: {
    provider: 'Synthetic fixture provider',
    model: null,
    modelIssuedAt: null,
    collectedAt: '2026-10-03T08:00:00Z',
    receiptCapturedAt: '2026-10-03T08:00:05Z',
    licence: 'CC0-1.0 (synthetic fixture data)',
    sourceUrl: null,
  },
}
