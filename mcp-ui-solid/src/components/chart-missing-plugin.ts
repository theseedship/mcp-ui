/**
 * Missing values in a Chart.js chart (v6.24.0) — everything the renderer adds
 * to its Chart.js config when a payload says a value is MISSING (`null`).
 *
 * The rule: absence is never zero. Chart.js already keeps the slot of a `null`
 * (no label dropped) and draws nothing for it; what it does not do is make the
 * absence READABLE. A null bar is a zero-height bar that is skipped when
 * drawn, a null line point is a hole the line may bridge (`spanGaps`), and the
 * legend, tooltip and axis know nothing of either. This module supplies:
 *
 * - {@link createMissingValuesPlugin} — a PER-CHART plugin (never
 *   `Chart.register`ed, so it can leak into no other chart) that outlines a
 *   dashed stub where a bar should have been (not on stacked or overlaid
 *   bars, whose baseline belongs to another series), and says "no data" on a
 *   chart with nothing to draw;
 * - {@link createMissingLegendGenerator} — marks a fully-missing series in the
 *   legend;
 * - {@link createTooltipLabel} — names a missing value, and appends the unit;
 * - {@link withDatasetsNoGapSpan} — the shallow-cloned data with
 *   `spanGaps: false`;
 * - {@link applyUnitAxisTitle} — the unit as the value axis title.
 *
 * Runtime-free on purpose (no `solid-js`, no `chart.js` import): the renderer
 * hands in the Chart.js pieces it loaded and the chrome strings (lazily, as
 * getters, so a late locale change is honoured at draw time). Every function
 * is defensive — a drawing hook that throws would blank the whole chart.
 *
 * Chart.js 4.5.1 facts this relies on (verified in `dist/chart.js`):
 * - a bar whose parsed value is `null` gets `base = head = vScale.getBasePixel()`
 *   and no `skip` flag (BarController.updateElements), and `BarController.draw`
 *   skips it (`getParsed(i)[vScale.axis] !== null`) — so nothing is painted;
 * - the bar element still carries its true index-axis thickness (`width` for a
 *   vertical bar, `height` for a horizontal one).
 */

import type { MCPUIStrings } from '../context/MCPUIStringsContext';
import { formatMCPUIString } from '../utils/format-string';
import { isMissingChartValue } from '../utils/missing-value';

type Strings = Required<MCPUIStrings>;

/** Length, in px along the value axis, of the dashed stub of a missing bar. */
export const MISSING_BAR_STUB_LENGTH = 12;
/** Stroke of the stub when the dataset names no border colour. */
export const MISSING_BAR_FALLBACK_COLOR = '#9ca3af';
/** Colour of the centred "no data" text. */
export const NO_DATA_TEXT_COLOR = '#6b7280';
const STUB_DASH = [4, 3];

/** Chart types whose value axis is `y` and whose points are `{x, y}`. */
const POINT_CHART_TYPES = new Set(['scatter', 'bubble']);

/**
 * The category of convention line a chart shows under its canvas:
 * `'gaps'` (a line breaks), `'bars'` (a dashed outline stands in for the
 * bar) or `'omitted'` (nothing is drawn: scatter, bubble, stacked bars).
 */
export type MissingNoteKind = 'gaps' | 'bars' | 'omitted';

/**
 * Whether a bar chart's bars are stacked or overlaid (`stacked` on either
 * axis). A missing bar there has no slot of its own at the baseline — the
 * baseline belongs to the series below — so no dashed outline is drawn.
 */
export function isStackedChart(options: any): boolean {
  return Boolean(options?.scales?.x?.stacked || options?.scales?.y?.stacked);
}

/** Which convention note a chart gets: how ITS missing values are drawn. */
export function missingNoteKind(chartType: string | undefined, options?: any): MissingNoteKind {
  if (chartType === 'bar') return isStackedChart(options) ? 'omitted' : 'bars';
  if (chartType === 'scatter' || chartType === 'bubble') return 'omitted';
  return 'gaps';
}

// ─── Data ──────────────────────────────────────────────────────────────────

/**
 * Chart.js data with every dataset shallow-cloned and `spanGaps: false`, so a
 * line breaks at a missing value instead of joining its neighbours. Never
 * mutates its input; `labels` and every other key are carried by reference.
 */
export function withDatasetsNoGapSpan<D extends { datasets?: unknown }>(data: D): D {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : null;
  if (!datasets) return data;
  return {
    ...data,
    datasets: datasets.map((dataset: unknown) =>
      dataset !== null && typeof dataset === 'object'
        ? { ...(dataset as object), spanGaps: false }
        : dataset
    ),
  };
}

// ─── Legend ────────────────────────────────────────────────────────────────

type LegendGenerator = (chart: any) => any[];

/**
 * Wraps a Chart.js legend label generator so a fully-missing dataset reads
 * `"{series} (no data)"` (`strings.chartLegendNoData`). Every other item is
 * passed through untouched.
 */
export function createMissingLegendGenerator(
  base: LegendGenerator,
  fullyMissing: readonly boolean[],
  getStrings: () => Strings
): LegendGenerator {
  return function generateLabels(this: unknown, chart: any) {
    const items = base.call(this, chart);
    if (!Array.isArray(items)) return items;
    return items.map((item) => {
      const index = item?.datasetIndex;
      if (typeof index !== 'number' || !fullyMissing[index]) return item;
      const text = typeof item.text === 'string' ? item.text : String(item.text ?? '');
      return {
        ...item,
        text: formatMCPUIString(getStrings().chartLegendNoData, { series: text }),
      };
    });
  };
}

// ─── Tooltip ───────────────────────────────────────────────────────────────

/** Whether a Chart.js tooltip item stands for a missing value. */
export function isMissingTooltipItem(item: any): boolean {
  if (item === null || item === undefined) return false;
  if (item.raw === null || item.raw === undefined || isMissingChartValue(item.raw)) return true;
  const parsed = item.parsed;
  if (parsed !== null && typeof parsed === 'object') {
    const chartType = item.chart?.config?.type;
    const valueKey =
      chartType === 'radar' ? 'r' : item.chart?.options?.indexAxis === 'y' ? 'x' : 'y';
    if (valueKey in parsed && parsed[valueKey] === null) return true;
  }
  return false;
}

/**
 * Tooltip `label` callback: names a missing value (`"{series}: Missing
 * value"`) and, with a `unit`, appends it to a present one. Otherwise it is
 * Chart.js's default composition (dataset label, `": "`, formatted value) —
 * including its `mode: 'dataset'` branch, which prefixes the CATEGORY label
 * instead, since every item of that tooltip belongs to the same dataset.
 * Hence a regular function: Chart.js calls it with the tooltip as `this`.
 *
 * `unit` is left off scatter and bubble tooltips: their formatted value is the
 * pair `(x, y)`, to which one unit does not belong.
 */
export function createTooltipLabel(
  getStrings: () => Strings,
  unit: string | undefined,
  chartType: string | undefined
): (this: any, item: any) => string {
  const applyUnit = unit !== undefined && !POINT_CHART_TYPES.has(chartType ?? '');
  return function label(this: any, item: any) {
    const strings = getStrings();
    const prefixLabel = this?.options?.mode === 'dataset' ? item?.label : item?.dataset?.label;
    const prefix = typeof prefixLabel === 'string' && prefixLabel !== '' ? `${prefixLabel}: ` : '';

    if (isMissingTooltipItem(item)) return `${prefix}${strings.missingValue}`;

    const formatted = item?.formattedValue;
    if (formatted === null || formatted === undefined) return prefix;
    const value = applyUnit
      ? formatMCPUIString(strings.chartValueWithUnit, { value: formatted, unit: unit as string })
      : String(formatted);
    return `${prefix}${value}`;
  };
}

// ─── Axis ──────────────────────────────────────────────────────────────────

/**
 * Sets the chart's `unit` as the title of its value axis, in place on the
 * `options` object the renderer just built (never on the payload's).
 *
 * Only bar, line, scatter and bubble have a value axis to title. The value
 * axis is `y`, or `x` when the index axis is `y` (a horizontal bar or line).
 * An existing `scales[axis].title` is the payload's own word and is kept; the
 * rest of the scale config (a `timeAxis` block sets `scales.x`) is kept too.
 */
export function applyUnitAxisTitle(
  options: any,
  chartType: string | undefined,
  unit: string | undefined
): void {
  if (unit === undefined) return;
  if (chartType !== 'bar' && chartType !== 'line' && !POINT_CHART_TYPES.has(chartType ?? '')) {
    return;
  }
  const horizontal = (chartType === 'bar' || chartType === 'line') && options?.indexAxis === 'y';
  const axis = horizontal ? 'x' : 'y';
  if (options.scales?.[axis]?.title !== undefined) return;
  options.scales = {
    ...options.scales,
    [axis]: { ...options.scales?.[axis], title: { display: true, text: unit } },
  };
}

// ─── Plugin ────────────────────────────────────────────────────────────────

export interface MissingValuesPluginOptions {
  /** At least one dataset and every one of them has no observed value. */
  allMissing: boolean;
  /** Lazy: read at draw time. */
  getNoDataText: () => string;
  /** Lazy: `Chart.defaults.font.family`, when the build exposes it. */
  getFontFamily?: () => string | undefined;
}

/** A dataset colour for entry `index`, as a string, or `undefined`. */
function colorAt(color: unknown, index: number): string | undefined {
  if (typeof color === 'string' && color !== '') return color;
  if (Array.isArray(color) && color.length > 0) {
    const picked = color[index % color.length];
    return typeof picked === 'string' && picked !== '' ? picked : undefined;
  }
  return undefined;
}

/**
 * Draws a dashed outline stub for every missing bar of every visible,
 * non-stacked bar dataset, so a missing value is a visible mark, not a bar
 * that "is" zero.
 *
 * The stub sits on the value-axis base, as thick as the bar would have been,
 * and runs {@link MISSING_BAR_STUB_LENGTH}px toward the middle of the chart
 * area (up from a bottom baseline, down from a top one, right from a left
 * one). Clipped to the chart area.
 */
export function drawMissingBarStubs(chart: any): void {
  const ctx = chart?.ctx;
  const area = chart?.chartArea;
  const datasets = chart?.data?.datasets;
  if (!ctx || !area || !Array.isArray(datasets)) return;

  const left = area.left;
  const top = area.top;
  const right = area.right ?? left + (area.width ?? 0);
  const bottom = area.bottom ?? top + (area.height ?? 0);

  let saved = false;
  datasets.forEach((dataset: any, datasetIndex: number) => {
    const meta = chart.getDatasetMeta?.(datasetIndex);
    if (!meta) return;
    const isBar = meta.type === 'bar' || meta.controller?.constructor?.id === 'bar';
    if (!isBar) return;
    // Stacked or overlaid bars: the baseline under a missing segment is the
    // series below, so an outline there would point at the wrong series.
    if (meta.vScale?.options?.stacked || meta.iScale?.options?.stacked) return;
    if (typeof chart.isDatasetVisible === 'function' && !chart.isDatasetVisible(datasetIndex)) {
      return;
    }
    const values: unknown[] = Array.isArray(dataset?.data) ? dataset.data : [];
    const elements: any[] = Array.isArray(meta.data) ? meta.data : [];

    values.forEach((value, index) => {
      if (!isMissingChartValue(value)) return;
      const element = elements[index];
      if (!element) return;
      const props = element.getProps?.(['x', 'y', 'base', 'width', 'height'], true) ?? element;
      const { x, y, base, width, height } = props;
      if (![x, y, base].every((n) => Number.isFinite(n))) return;
      const horizontal = element.horizontal === true;
      const thickness = horizontal ? height : width;
      if (!Number.isFinite(thickness) || thickness <= 0) return;

      let rect: [number, number, number, number];
      if (horizontal) {
        const dir = base < (left + right) / 2 ? 1 : -1;
        rect = [Math.min(base, base + dir * MISSING_BAR_STUB_LENGTH), y - thickness / 2, MISSING_BAR_STUB_LENGTH, thickness];
      } else {
        const dir = base > (top + bottom) / 2 ? -1 : 1;
        rect = [x - thickness / 2, Math.min(base, base + dir * MISSING_BAR_STUB_LENGTH), thickness, MISSING_BAR_STUB_LENGTH];
      }

      if (!saved) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, right - left, bottom - top);
        ctx.clip();
        saved = true;
      }
      ctx.strokeStyle = colorAt(dataset?.borderColor, index) ?? MISSING_BAR_FALLBACK_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash(STUB_DASH);
      ctx.strokeRect(...rect);
    });
  });
  if (saved) {
    ctx.setLineDash?.([]);
    ctx.restore();
  }
}

/** Draws `text` centred in the chart area (a chart with nothing to plot). */
export function drawNoDataText(chart: any, text: string, fontFamily?: string): void {
  const ctx = chart?.ctx;
  const area = chart?.chartArea;
  if (!ctx || !area || !text) return;
  const cx = (area.left + (area.right ?? area.left + (area.width ?? 0))) / 2;
  const cy = (area.top + (area.bottom ?? area.top + (area.height ?? 0))) / 2;
  ctx.save();
  ctx.font = `12px ${fontFamily || 'sans-serif'}`;
  ctx.fillStyle = NO_DATA_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/**
 * The per-chart plugin object. Passed as `config.plugins = [plugin]`: Chart.js
 * scopes it to that one chart. Both hooks swallow their own errors — a
 * decoration must never take the chart down.
 */
export function createMissingValuesPlugin(options: MissingValuesPluginOptions) {
  return {
    id: 'mcpuiMissingValues',
    afterDatasetsDraw(chart: any) {
      try {
        drawMissingBarStubs(chart);
        if (options.allMissing) {
          drawNoDataText(chart, options.getNoDataText(), options.getFontFamily?.());
        }
      } catch {
        // Cosmetic layer: never break the chart.
      }
    },
  };
}
