/**
 * Missing values — one definition shared by tables, chart data views,
 * degraded projections, chart validation and the chart renderer.
 *
 * @since v6.24.0
 *
 * A missing value is a value the payload says EXISTS but was not observed:
 * `null` in a chart dataset (or as a point's `y`), `null` / `undefined` in a
 * table cell. It is not a zero, and it is not the absence of a row or of a
 * label: every view keeps its slot and marks it.
 *
 * Runtime-free on purpose (no `solid-js`): the pure projections in
 * `chart-data-table.ts` and `degraded-projections.ts`, and `validation.ts`
 * (published as the `/validation` subpath), import it.
 */

/** The glyph a table cell shows for a missing value — `renderCellValue`'s historical `-`. */
export const MISSING_VALUE_MARKER = '-'

/**
 * Chart types that encode a value as a share of a whole (or, for polar area,
 * as a wedge whose emptiness reads as zero). Chart.js parses a `null` share
 * as `0`, so these types refuse missing values instead of drawing them.
 */
export const PART_TO_WHOLE_CHART_TYPES: ReadonlySet<string> = new Set([
  'pie',
  'doughnut',
  'polarArea',
])

/**
 * Whether a raw TABLE cell value is displayed as {@link MISSING_VALUE_MARKER}.
 *
 * Mirrors the rules `renderCellValue` applies before any formatting — `null`,
 * `undefined`, and a string that is empty or the word `undefined` once the
 * backend's `"X – undefined"` debris is stripped — plus the literal marker
 * itself (whitespace around it aside, which a table cell does not render),
 * since it looks identical on screen and so must read identically.
 *
 * Objects are never missing here: `renderCellValue` renders them (link,
 * name, or escaped JSON).
 */
export function isMissingCellValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'object') return false
  const cleaned = stripUndefinedDebris(String(value)).trim()
  return cleaned === '' || cleaned === MISSING_VALUE_MARKER || cleaned.toLowerCase() === 'undefined'
}

/**
 * Removes the `"Text – undefined"` / `"undefined – Text"` debris some
 * backends concatenate. Shared with `renderCellValue` so both apply the very
 * same cleanup.
 */
export function stripUndefinedDebris(value: string): string {
  return value.replace(/\s*[–-]\s*undefined\s*$/gi, '').replace(/^undefined\s*[–-]\s*/gi, '')
}

/**
 * Whether one CHART data entry is missing: `null` / `undefined`, a non-finite
 * number (Chart.js parses those to `null` too), or a point whose `y` is.
 */
export function isMissingChartValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  if (typeof value === 'object' && !Array.isArray(value)) {
    const y = (value as { y?: unknown }).y
    return y === null || y === undefined || (typeof y === 'number' && !Number.isFinite(y))
  }
  return false
}

/**
 * What a chart's missing values amount to.
 *
 * Only ENTRIES count: an explicit `null` (or non-finite number, or a point
 * whose `y` is one). A dataset with no entry at all (`data: []`) is not
 * "missing" — it is how 6.23.0 and earlier payloads said "nothing yet", e.g.
 * while streaming, and it keeps rendering exactly as it did then.
 */
export interface ChartMissingSummary {
  /** At least one entry of one dataset is missing. */
  hasMissing: boolean
  /** Per dataset, in order: it has entries and every one of them is missing. */
  fullyMissing: boolean[]
  /**
   * Per dataset, in order: at least one observed value AND at least one
   * missing entry — the series a reader actually sees broken.
   */
  partiallyMissing: boolean[]
  /** Something is missing and no dataset has a single observed value: nothing to plot. */
  allMissing: boolean
}

interface ChartDataLike {
  data?: {
    datasets?: Array<{ data?: unknown[] } | null | undefined>
  }
}

/** Summarises the missing values of a chart payload. Never throws on a malformed payload. */
export function summarizeChartMissing(params: ChartDataLike | null | undefined): ChartMissingSummary {
  const datasets = Array.isArray(params?.data?.datasets) ? params.data.datasets : []
  const fullyMissing: boolean[] = []
  const partiallyMissing: boolean[] = []
  let anyMissing = false
  let anyObserved = false
  for (const dataset of datasets) {
    const data = Array.isArray(dataset?.data) ? dataset.data : []
    let observed = 0
    let missing = 0
    for (const value of data) {
      if (isMissingChartValue(value)) missing += 1
      else observed += 1
    }
    fullyMissing.push(missing > 0 && observed === 0)
    partiallyMissing.push(observed > 0 && missing > 0)
    anyMissing ||= missing > 0
    anyObserved ||= observed > 0
  }
  return {
    hasMissing: anyMissing,
    fullyMissing,
    partiallyMissing,
    allMissing: anyMissing && !anyObserved,
  }
}
