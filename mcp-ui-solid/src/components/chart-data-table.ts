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
export function chartToDataTable(params: ChartDataLike): ChartDataTable {
  const datasets = params.data?.datasets ?? [];
  const labels = params.data?.labels ?? [];
  const pointData =
    params.type === 'scatter' ||
    params.type === 'bubble' ||
    datasets.some((dataset) => dataset.data?.some(isPoint));

  if (pointData) {
    const hasLabels = labels.length > 0;
    const hasRadius =
      params.type === 'bubble' ||
      datasets.some((dataset) => dataset.data?.some((value) => isPoint(value) && 'r' in value));
    const columns = [
      'Series',
      'Point',
      ...(hasLabels ? ['Label'] : []),
      'x',
      'y',
      ...(hasRadius ? ['r'] : []),
    ];
    const rows: Array<Array<string | number>> = [];

    datasets.forEach((dataset, datasetIndex) => {
      const series = dataset.label || `Series ${datasetIndex + 1}`;
      (dataset.data ?? []).forEach((value, pointIndex) => {
        const point = isPoint(value) ? value : { y: value };
        rows.push([
          series,
          pointIndex + 1,
          ...(hasLabels ? [tableCell(labels[pointIndex])] : []),
          tableCell(point.x),
          tableCell(point.y),
          ...(hasRadius ? [tableCell(point.r)] : []),
        ]);
      });
    });

    return { columns, rows };
  }

  const rowCount = Math.max(labels.length, ...datasets.map((dataset) => dataset.data?.length ?? 0), 0);
  const columns = ['Label', ...datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`)];
  const rows: Array<Array<string | number>> = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    rows.push([
      tableCell(labels[rowIndex] ?? rowIndex + 1),
      ...datasets.map((dataset) => tableCell(dataset.data?.[rowIndex])),
    ]);
  }

  return { columns, rows };
}
