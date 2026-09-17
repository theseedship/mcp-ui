import { formatMCPUIString } from '../utils/format-string';

/**
 * Column headers and series names of the accessible chart data table.
 *
 * `chartToDataTable` is a pure helper with no access to `MCPUIStrings`, so
 * the wording is injected: it takes an optional trailing `labels` partial,
 * which `ChartJSRenderer` feeds from `useMCPUIStrings()`. Left out, the
 * English defaults below apply — the pre-v6.20.0 behaviour.
 *
 * `x` / `y` / `r` stay untranslated on purpose: they are the Chart.js point
 * property NAMES the cells mirror, not prose.
 *
 * @since v6.20.0
 */
export interface ChartDataTableLabels {
  /** Series column of the per-point table. */
  series: string;
  /** Point-index column of the per-point table. */
  point: string;
  /** Label column (categorical table, and per-point table when labelled). */
  label: string;
  /** Fallback dataset name. Template — `{n}`. */
  seriesName: string;
  /** Chart.js point property names — machine tokens, rarely overridden. */
  x: string;
  y: string;
  r: string;
}

/** English defaults for {@link ChartDataTableLabels}. */
export const CHART_DATA_TABLE_LABELS: ChartDataTableLabels = {
  series: 'Series',
  point: 'Point',
  label: 'Label',
  seriesName: 'Series {n}',
  x: 'x',
  y: 'y',
  r: 'r',
};

export interface ChartDataTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ChartDatasetLike {
  label?: string;
  data?: unknown[];
}

export interface ChartDataLike {
  type?: string;
  data?: {
    labels?: Array<string | number>;
    datasets?: ChartDatasetLike[];
  };
}

function tableCell(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isPoint(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('x' in value || 'y' in value || 'r' in value)
  );
}

/**
 * Project Chart.js data into an accessible table without flattening point
 * coordinates. Categorical charts use a compact wide table; scatter, bubble,
 * and object-valued line charts use one row per point so x/y/r remain distinct.
 */
export function chartToDataTable(
  params: ChartDataLike,
  labels?: Partial<ChartDataTableLabels>
): ChartDataTable {
  const l: ChartDataTableLabels = { ...CHART_DATA_TABLE_LABELS, ...labels };
  const datasets = params.data?.datasets ?? [];
  const dataLabels = params.data?.labels ?? [];
  const pointData =
    params.type === 'scatter' ||
    params.type === 'bubble' ||
    datasets.some((dataset) => dataset.data?.some(isPoint));

  if (pointData) {
    const hasLabels = dataLabels.length > 0;
    const hasRadius =
      params.type === 'bubble' ||
      datasets.some((dataset) => dataset.data?.some((value) => isPoint(value) && 'r' in value));
    const columns = [
      l.series,
      l.point,
      ...(hasLabels ? [l.label] : []),
      l.x,
      l.y,
      ...(hasRadius ? [l.r] : []),
    ];
    const rows: Array<Array<string | number>> = [];

    datasets.forEach((dataset, datasetIndex) => {
      const series = dataset.label || formatMCPUIString(l.seriesName, { n: datasetIndex + 1 });
      (dataset.data ?? []).forEach((value, pointIndex) => {
        const point = isPoint(value) ? value : { y: value };
        rows.push([
          series,
          pointIndex + 1,
          ...(hasLabels ? [tableCell(dataLabels[pointIndex])] : []),
          tableCell(point.x),
          tableCell(point.y),
          ...(hasRadius ? [tableCell(point.r)] : []),
        ]);
      });
    });

    return { columns, rows };
  }

  const rowCount = Math.max(
    dataLabels.length,
    ...datasets.map((dataset) => dataset.data?.length ?? 0),
    0
  );
  const columns = [
    l.label,
    ...datasets.map(
      (dataset, index) => dataset.label || formatMCPUIString(l.seriesName, { n: index + 1 })
    ),
  ];
  const rows: Array<Array<string | number>> = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    rows.push([
      tableCell(dataLabels[rowIndex] ?? rowIndex + 1),
      ...datasets.map((dataset) => tableCell(dataset.data?.[rowIndex])),
    ]);
  }

  return { columns, rows };
}
