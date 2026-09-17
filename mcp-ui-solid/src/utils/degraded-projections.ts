/**
 * Degraded-fallback projections (audit 2026-05-30, P2.5).
 *
 * Pure functions that turn a heavy renderer's params into a flat
 * `{ columns, rows }` table for `<DegradedFallback>` — the middle rung of
 * the fallback ladder shown when the native render (G6 / Leaflet / Chart.js)
 * is unavailable or throws. No peer deps, no side effects, fully testable.
 *
 * These are best-effort views: they surface the underlying data so the user
 * isn't left with a blank space, not faithful reproductions of the chart/
 * map/graph.
 */

import { formatMCPUIString } from './format-string';

/**
 * Column headers and series names of the degraded tables.
 *
 * The projections are pure helpers with no access to `MCPUIStrings`, so the
 * wording is injected: each function takes an optional trailing `labels`
 * partial, and the renderers feed it from `useMCPUIStrings()`. Left out, the
 * English defaults below apply — the pre-v6.20.0 behaviour.
 *
 * @since v6.20.0
 */
export interface DegradedProjectionLabels {
  /** Graph edge table — source column. */
  source: string;
  /** Graph edge table — target column. */
  target: string;
  /** Graph edge / node table — label column. */
  label: string;
  /** Graph node table — node id column. */
  node: string;
  /** Map table — feature type column. */
  type: string;
  /** Map table — latitude column. */
  lat: string;
  /** Map table — longitude column. */
  lng: string;
  /** Map table — property summary column. */
  info: string;
  /** Map table — `Type` cell of a marker row (v6.20.0, 6th pass). */
  marker: string;
  /** Map table — `Type` cell of a GeoJSON feature without a geometry type (v6.20.0). */
  feature: string;
  /** Chart table — fallback dataset name. Template — `{n}`. */
  series: string;
}

/** English defaults for {@link DegradedProjectionLabels}. */
export const DEGRADED_PROJECTION_LABELS: DegradedProjectionLabels = {
  source: 'Source',
  target: 'Target',
  label: 'Label',
  node: 'Node',
  type: 'Type',
  lat: 'Lat',
  lng: 'Lng',
  info: 'Info',
  marker: 'marker',
  feature: 'feature',
  series: 'Series {n}',
};

const withLabels = (labels?: Partial<DegradedProjectionLabels>): DegradedProjectionLabels => ({
  ...DEGRADED_PROJECTION_LABELS,
  ...labels,
});

export interface DegradedTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

const MAX_PROJECTED_ROWS = 200;

/** Compact a value to a single table cell string. */
function cell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ─── Graph ───────────────────────────────────────────────────────────────

/**
 * Graph → edge table when edges exist (Source / Target / Label), else a
 * node list (Node / Label). The graph renderer can therefore degrade to a
 * readable relationship listing instead of a blank canvas.
 */
export function graphToDegradedTable(params: {
  nodes?: Array<{ id: string; label?: string }>;
  edges?: Array<{ source: string; target: string; label?: string; weight?: number }>;
}, labels?: Partial<DegradedProjectionLabels>): DegradedTable {
  const l = withLabels(labels);
  const edges = params.edges ?? [];
  if (edges.length > 0) {
    return {
      columns: [l.source, l.target, l.label],
      rows: edges.slice(0, MAX_PROJECTED_ROWS).map((e) => {
        const label = [e.weight != null ? String(e.weight) : '', e.label ?? '']
          .filter(Boolean)
          .join(' · ');
        return [cell(e.source), cell(e.target), label];
      }),
    };
  }
  const nodes = params.nodes ?? [];
  return {
    columns: [l.node, l.label],
    rows: nodes.slice(0, MAX_PROJECTED_ROWS).map((n) => [cell(n.id), cell(n.label ?? n.id)]),
  };
}

// ─── Map ───────────────────────────────────────────────────────────────────

interface GeoJSONLikeFeature {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

/** Pull a representative `[lng, lat]` pair out of a geometry's coordinates. */
function firstLngLat(coords: unknown): [number, number] | null {
  let c: unknown = coords;
  // Descend nested arrays until we reach a [number, number, ...] position.
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return [c[0], c[1]];
  }
  return null;
}

/**
 * Map → a coordinate table. Markers become Lat/Lng/Label rows; GeoJSON
 * features become Type / Lat / Lng (+ a compact properties summary). So a
 * map that can't paint still lists where its points are.
 */
export function mapToDegradedTable(params: {
  markers?: Array<{
    position: [number, number] | { lat: number; lng: number };
    tooltip?: string;
    popup?: string;
  }>;
  geojson?: unknown;
}, labels?: Partial<DegradedProjectionLabels>): DegradedTable {
  const l = withLabels(labels);
  const rows: Array<Array<string | number>> = [];

  for (const m of params.markers ?? []) {
    const lat = Array.isArray(m.position) ? m.position[0] : m.position?.lat;
    const lng = Array.isArray(m.position) ? m.position[1] : m.position?.lng;
    rows.push([l.marker, cell(lat), cell(lng), cell(m.tooltip ?? m.popup ?? '')]);
  }

  const fc = params.geojson as { features?: GeoJSONLikeFeature[] } | undefined;
  const features = Array.isArray(fc?.features) ? fc!.features : [];
  for (const f of features) {
    const ll = firstLngLat(f.geometry?.coordinates);
    const props = f.properties ?? {};
    const propSummary = Object.keys(props)
      .slice(0, 3)
      .map((k) => `${k}=${cell(props[k])}`)
      .join(', ');
    rows.push([
      cell(f.geometry?.type ?? l.feature),
      ll ? cell(ll[1]) : '',
      ll ? cell(ll[0]) : '',
      propSummary,
    ]);
  }

  return {
    columns: [l.type, l.lat, l.lng, l.info],
    rows: rows.slice(0, MAX_PROJECTED_ROWS),
  };
}

// ─── Chart ───────────────────────────────────────────────────────────────

/**
 * Chart → a series table: one row per label, one column per dataset. So a
 * chart that can't draw still shows its numbers. Point/object data (scatter,
 * bubble, time series) is stringified per cell.
 */
export function chartToDegradedTable(params: {
  data?: {
    labels?: Array<string | number>;
    datasets?: Array<{ label?: string; data?: unknown[] }>;
  };
}, labels?: Partial<DegradedProjectionLabels>): DegradedTable {
  const l = withLabels(labels);
  const datasets = params.data?.datasets ?? [];
  const dataLabels = params.data?.labels ?? [];
  const rowCount = Math.max(dataLabels.length, ...datasets.map((d) => d.data?.length ?? 0), 0);

  const columns = [
    '',
    ...datasets.map((d, i) => d.label ?? formatMCPUIString(l.series, { n: i + 1 })),
  ];
  const rows: Array<Array<string | number>> = [];
  for (let r = 0; r < Math.min(rowCount, MAX_PROJECTED_ROWS); r++) {
    rows.push([cell(dataLabels[r] ?? r + 1), ...datasets.map((d) => cell(d.data?.[r]))]);
  }
  return { columns, rows };
}
