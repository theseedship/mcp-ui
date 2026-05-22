/**
 * Zod validation schemas for component registry
 */

import { z } from 'zod';

// Grid position schema
export const GridPositionSchema = z.object({
  colStart: z.number().int().min(1).max(12),
  colSpan: z.number().int().min(1).max(12),
  rowStart: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).default(1).optional(),
});

// Component types (synced with mcp-ui-solid v1.2.6)
export const ComponentTypeSchema = z.enum([
  'chart',
  'table',
  'metric',
  'text',
  'composite',
  'grid', // Phase 5.0: Nested grid layouts
  'iframe',
  'image',
  'link',
  'action', // Phase 5.0: Tool call actions
  'footer', // Phase 5.0: Metadata footer
  'carousel',
  'artifact',
  'form', // Sprint 1: Form component
  'modal', // Sprint 3: Modal/dialog component
  'action-group', // Sprint 3: Action grouping component
  'image-gallery', // Sprint 5: Image gallery with lightbox
  'video', // Sprint 5: Video embed (YouTube, Vimeo, direct)
  'code', // Sprint 6: Syntax highlighted code block
  'map', // Sprint 6: Interactive map (Leaflet)
  'graph', // v5.0.4: node-link graph (peer @antv/g6)
]);

// Form field option schema (for select, radio)
export const FormFieldOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  disabled: z.boolean().optional(),
});

// Form field type schema
export const FormFieldTypeSchema = z.enum([
  'text',
  'email',
  'password',
  'number',
  'date',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'autocomplete',
  'range',
  'tags',
  'toggle',
  'fieldset',
]);

// Show when operator schema
export const ShowWhenOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
]);

// Show when condition schema
export const ShowWhenConditionSchema = z.object({
  field: z.string().min(1),
  operator: ShowWhenOperatorSchema,
  value: z.any().optional(),
});

// Prefill source schema (v4.2.0)
export const PrefillSourceSchema = z.enum(['user', 'detected', 'inferred', 'default']);

// Form field schema
//
// NAME REGEX (relaxed in v5.0.2 per audit MCP-UI-AUDIT-2026-04-26.md §L.2)
// — allows `_`, `.`, `-` after the first letter (kebab-case for URL params,
// dot-paths for nested forms). Still requires a leading letter to keep the
// value usable as a CSS selector / JS access key.
export const FormFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][\w.-]*$/),
  type: FormFieldTypeSchema,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  defaultValue: z.any().optional(),
  // Prefill — pre-populated value with source tracking (v4.2.0)
  prefill: z.union([z.string(), z.array(z.string())]).optional(),
  displayHint: z.string().optional(),
  source: PrefillSourceSchema.optional(),
  muted: z.boolean().optional(),
  // Prefill mode for autocomplete fields (v4.3.0)
  prefillMode: z.enum(['exact', 'resolve']).optional(),
  // Value format validation (v4.3.0)
  valueFormat: z.string().optional(),
  valueFormatHint: z.string().optional(),
  // Text/textarea specific
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  pattern: z.string().optional(),
  // Number specific
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  // Date specific
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  // Select/Radio specific
  options: z.array(FormFieldOptionSchema).optional(),
  // Multi-select (v2.6.0)
  multiple: z.boolean().optional(),
  // Autocomplete specific (v2.6.0)
  apiUrl: z.string().url().optional(),
  searchParam: z.string().optional(),
  labelField: z.string().optional(),
  valueField: z.string().optional(),
  extraParams: z.record(z.string()).optional(),
  minChars: z.number().int().min(0).optional(),
  debounceMs: z.number().int().min(0).optional(),
  // Dependent field (v2.7.0)
  dependsOn: z
    .object({
      field: z.string(),
      apiUrl: z.string(),
      labelField: z.string(),
      valueField: z.string(),
      extraParams: z.record(z.string()).optional(),
    })
    .optional(),
  // Field status — API capability indicator (v2.11.0)
  fieldStatus: z.enum(['required', 'optional', 'unsupported', 'unknown']).optional(),
  statusReason: z.string().optional(),
  // Checkbox specific
  checkboxLabel: z.string().optional(),
  // Textarea specific
  rows: z.number().int().min(1).max(20).optional(),
  // Conditional visibility
  showWhen: ShowWhenConditionSchema.optional(),
});

// Form submit action schema
export const FormSubmitActionSchema = z.object({
  toolName: z.string().min(1),
  params: z.record(z.unknown()).optional(),
});

// Form component params schema
export const FormComponentParamsSchema = z.object({
  title: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  submitLabel: z.string().optional(),
  showReset: z.boolean().optional(),
  submitAction: FormSubmitActionSchema.optional(),
  // Persistence options (Sprint 4)
  persistKey: z.string().optional(),
  excludeFromPersistence: z.array(z.string()).optional(),
  persistExpiresIn: z.number().int().positive().optional(),
  layout: z.enum(['vertical', 'horizontal', 'inline']).optional(),
  // Auto-submit countdown in ms when all required fields are prefilled (v4.2.0)
  autoSubmitDelay: z.number().int().min(1000).max(30000).optional(),
});

// Modal size schema (Sprint 3)
export const ModalSizeSchema = z.enum(['sm', 'md', 'lg', 'xl', 'full']);

// Modal component params schema (Sprint 3)
export const ModalComponentParamsSchema = z.object({
  title: z.string().optional(),
  size: ModalSizeSchema.optional(),
  showClose: z.boolean().optional(),
  closeOnEscape: z.boolean().optional(),
  closeOnBackdrop: z.boolean().optional(),
  maxHeight: z.string().optional(),
  // Note: content and footer are UIComponent references, validated separately
});

// Action group layout schema (Sprint 3)
export const ActionGroupLayoutSchema = z.enum([
  'horizontal',
  'vertical',
  'space-between',
  'end',
  'center',
]);

// Action group gap schema (Sprint 3)
export const ActionGroupGapSchema = z.enum(['none', 'sm', 'md', 'lg']);

// Action component params schema (for action-group)
export const ActionParamsSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['button', 'link']).optional(),
  action: z.enum(['tool-call', 'link', 'submit']).optional(),
  toolName: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  url: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'danger']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  icon: z.string().optional(),
  disabled: z.boolean().optional(),
});

// Action group component params schema (Sprint 3)
export const ActionGroupParamsSchema = z.object({
  actions: z.array(ActionParamsSchema).min(1),
  layout: ActionGroupLayoutSchema.optional(),
  gap: ActionGroupGapSchema.optional(),
  fullWidth: z.boolean().optional(),
  label: z.string().optional(),
});

// Gallery image schema (Sprint 5)
export const GalleryImageSchema = z.object({
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  srcset: z.string().optional(),
  sizes: z.string().optional(),
});

// Image gallery columns schema (Sprint 5)
export const ImageGalleryColumnsSchema = z
  .enum(['2', '3', '4', '5'])
  .transform(Number) as unknown as z.ZodType<2 | 3 | 4 | 5>;

// Image gallery gap schema (Sprint 5)
export const ImageGalleryGapSchema = z.enum(['none', 'sm', 'md', 'lg']);

// Image gallery aspect ratio schema (Sprint 5)
export const ImageGalleryAspectRatioSchema = z.enum(['1:1', '16:9', '4:3', 'auto']);

// Image gallery params schema (Sprint 5)
export const ImageGalleryParamsSchema = z.object({
  title: z.string().optional(),
  images: z.array(GalleryImageSchema).min(1),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  gap: ImageGalleryGapSchema.optional(),
  aspectRatio: ImageGalleryAspectRatioSchema.optional(),
  lightbox: z.boolean().optional(),
  showCaptions: z.boolean().optional(),
});

// Video aspect ratio schema (Sprint 5)
export const VideoAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', '21:9']);

// Video component params schema (Sprint 5)
export const VideoComponentParamsSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  caption: z.string().optional(),
  poster: z.string().url().optional(),
  aspectRatio: VideoAspectRatioSchema.optional(),
  autoplay: z.boolean().optional(),
  controls: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  startTime: z.number().int().min(0).optional(),
});

// Code component params schema (Sprint 6)
export const CodeComponentParamsSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  filename: z.string().optional(),
  showLineNumbers: z.boolean().optional(),
  startLine: z.number().optional(),
  highlightLines: z.array(z.number()).optional(),
  maxHeight: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Lat/Lng point — Leaflet-compatible polymorphic shape (v5.0.2)
//
// Leaflet's own LatLng API accepts either a `[lat, lng]` tuple OR a
// `{ lat, lng }` object literal natively. Mirroring that here lets MCP
// servers emit either shape without forcing normalization (per audit
// MCP-UI-AUDIT-2026-04-26.md §L.1).
export const LatLngObjectSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export const LatLngTupleSchema = z.tuple([z.number(), z.number()]);
export const LatLngPointSchema = z.union([LatLngTupleSchema, LatLngObjectSchema]);

// Map marker schema (Sprint 6, position relaxed to LatLngPoint in v5.0.2)
export const MapMarkerSchema = z.object({
  position: LatLngPointSchema,
  tooltip: z.string().optional(),
  popup: z.string().optional(),
});

// =============================================================================
// GeoJSON contract for the `map` component (v5.2.0)
//
// `@seed-ship/mcp-ui-solid`'s <MapRenderer> has shipped GeoJSON / choropleth /
// popup / multi-layer / PMTiles support since its v3.1.0, but the spec only
// validated `markers` — a host emitting `type:'map'` with `params.geojson`
// had those fields silently stripped by Zod. These schemas close that gap so
// a FeatureCollection is a first-class, validated part of the map contract.
//
// Geometry `coordinates` are typed as a depth-bounded union of number arrays
// rather than per-geometry-type tuples: that accepts every standard geometry
// (Point → MultiPolygon) without rejecting valid edge cases such as 3D
// positions `[lng, lat, elevation]`. The contract stays "typed but
// permissive" — an obviously-wrong payload (bad `type`, non-numeric
// coordinates) is still rejected, but a structurally-valid FeatureCollection
// is never refused. No domain logic (Cadastre / data.gouv / IGN) lives here.
// =============================================================================

// A GeoJSON position: [lng, lat] or [lng, lat, elevation] (RFC 7946 §3.1.1).
export const GeoJSONPositionSchema = z.array(z.number()).min(2);

// Coordinates nest 0–3 levels deep depending on geometry type:
//   Point                       → Position
//   LineString / MultiPoint     → Position[]
//   Polygon / MultiLineString   → Position[][]
//   MultiPolygon                → Position[][][]
export const GeoJSONCoordinatesSchema = z.union([
  GeoJSONPositionSchema,
  z.array(GeoJSONPositionSchema),
  z.array(z.array(GeoJSONPositionSchema)),
  z.array(z.array(z.array(GeoJSONPositionSchema))),
]);

export const GeoJSONGeometryTypeSchema = z.enum([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

// A geometry without `geometries` — used inside a GeometryCollection. GeoJSON
// (RFC 7946 §3.1.8) recommends against nesting GeometryCollections, so this
// is intentionally one level deep.
const GeoJSONSimpleGeometrySchema = z.object({
  type: GeoJSONGeometryTypeSchema,
  coordinates: GeoJSONCoordinatesSchema.optional(),
  bbox: z.array(z.number()).optional(),
});

// A single geometry. `coordinates` carries every type except
// GeometryCollection, which instead nests `geometries`. Both are optional at
// this level so the union stays permissive; the `type` enum is the real gate.
export const GeoJSONGeometrySchema = z.object({
  type: GeoJSONGeometryTypeSchema,
  coordinates: GeoJSONCoordinatesSchema.optional(),
  geometries: z.array(GeoJSONSimpleGeometrySchema).optional(),
  bbox: z.array(z.number()).optional(),
});

export const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeoJSONGeometrySchema.nullable(),
  properties: z.record(z.unknown()).nullable().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  bbox: z.array(z.number()).optional(),
});

export const GeoJSONFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureSchema),
  bbox: z.array(z.number()).optional(),
});

// What the `geojson` field accepts. Leaflet's `L.geoJSON()` — which
// <MapRenderer> calls directly — takes a FeatureCollection, a bare Feature,
// or a raw Geometry, so the spec mirrors that. FeatureCollection is the
// expected shape for connector / opendata payloads.
export const GeoJSONSchema = z.union([
  GeoJSONFeatureCollectionSchema,
  GeoJSONFeatureSchema,
  GeoJSONGeometrySchema,
]);

// Static + choropleth (data-driven) style for a GeoJSON layer. Mirrors
// `MapGeoJSONStyle` in @seed-ship/mcp-ui-solid.
export const MapGeoJSONStyleSchema = z.object({
  fillColor: z.string().optional(),
  fillOpacity: z.number().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  strokeOpacity: z.number().optional(),
  choroplethField: z.string().optional(),
  choroplethScale: z.array(z.tuple([z.number(), z.string()])).optional(),
  choroplethFallback: z.string().optional(),
});

// Feature popup configuration — auto-generated from `fields`/`titleField`, or
// a custom `template` with `{{property}}` placeholders.
export const MapPopupConfigSchema = z.object({
  titleField: z.string().optional(),
  fields: z.array(z.string()).optional(),
  template: z.string().optional(),
});

// A named GeoJSON overlay; the renderer adds a Leaflet layer control when
// more than one is present.
export const MapLayerSchema = z.object({
  name: z.string().min(1),
  visible: z.boolean().optional(),
  geojson: GeoJSONSchema,
  style: MapGeoJSONStyleSchema.optional(),
  popup: MapPopupConfigSchema.optional(),
});

// Marker clustering options (Leaflet.markercluster).
export const MapClusterOptionsSchema = z.object({
  maxClusterRadius: z.number().optional(),
  spiderfyOnMaxZoom: z.boolean().optional(),
  showCoverageOnHover: z.boolean().optional(),
  disableClusteringAtZoom: z.number().optional(),
  animateAddingMarkers: z.boolean().optional(),
});

// PMTiles vector-tile source for large datasets (protomaps-leaflet peer).
export const MapPMTilesPaintRuleSchema = z.object({
  dataLayer: z.string(),
  symbolizer: z.enum(['polygon', 'line', 'circle']),
  color: z.string().optional(),
  width: z.number().optional(),
  opacity: z.number().optional(),
});

export const MapPMTilesLabelRuleSchema = z.object({
  dataLayer: z.string(),
  textField: z.string(),
  fontSize: z.number().optional(),
});

export const MapPMTilesConfigSchema = z.object({
  url: z.string(),
  attribution: z.string().optional(),
  paintRules: z.array(MapPMTilesPaintRuleSchema).optional(),
  labelRules: z.array(MapPMTilesLabelRuleSchema).optional(),
  maxZoom: z.number().optional(),
  minZoom: z.number().optional(),
});

// Map component params schema (Sprint 6; center relaxed to LatLngPoint in
// v5.0.2; GeoJSON / layers / clustering / PMTiles aligned with <MapRenderer>
// in v5.2.0). All new fields are optional — a markers-only map is unchanged.
export const MapComponentParamsSchema = z.object({
  center: LatLngPointSchema.optional(),
  zoom: z.number().optional(),
  markers: z.array(MapMarkerSchema).optional(),
  height: z.string().optional(),
  fitBounds: z.boolean().optional(),
  zoomControl: z.boolean().optional(),
  scrollWheelZoom: z.boolean().optional(),
  tileLayer: z.string().optional(),
  attribution: z.string().optional(),
  className: z.string().optional(),
  // GeoJSON layer (v5.2.0) — polygons / lines / points from structured data.
  geojson: GeoJSONSchema.optional(),
  geojsonStyle: MapGeoJSONStyleSchema.optional(),
  popup: MapPopupConfigSchema.optional(),
  // Multiple named GeoJSON overlays with a Leaflet layer control (v5.2.0).
  layers: z.array(MapLayerSchema).optional(),
  // Marker clustering — `true` for defaults, or an options object (v5.2.0).
  clustering: z.union([z.boolean(), MapClusterOptionsSchema]).optional(),
  // PMTiles vector-tile source for large datasets (v5.2.0).
  pmtiles: MapPMTilesConfigSchema.optional(),
});

// =============================================================================
// Graph component (v5.0.4) — generic node-link visualization
//
// The shape is intentionally domain-neutral: nodes have an id + optional
// label/weight/style, edges have source+target+optional weight/style. The
// `weight` field on both is a generic ranking signal — domain semantics
// (rerank score / co-retrieval count / criticality / token contribution /
// frequency / etc.) are opaque to the lib and decided by the consumer.
//
// Renderer support lives in `@seed-ship/mcp-ui-solid` and lazy-loads
// `@antv/g6 ^5` as a peer-optional dependency. Apps that don't install
// the peer see an informative fallback instead of a crash.
// =============================================================================

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  type: z.string().optional(), // G6 node type: 'circle' | 'rect' | 'image' | …
  size: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional(),
  /**
   * Generic ranking / importance signal. Drives default node size when
   * `size` is omitted, and acts as the sort key for the `concentric`
   * layout (highest weight at center). Domain semantics opaque to the lib.
   */
  weight: z.number().optional(),
  style: z.record(z.unknown()).optional(), // passthrough G6 NodeStyle
  data: z.record(z.unknown()).optional(), // arbitrary metadata for tooltips / click handlers
});

export const GraphEdgeSchema = z.object({
  source: z.string().min(1), // must match a node.id
  target: z.string().min(1), // must match a node.id
  label: z.string().optional(),
  type: z.string().optional(), // G6 edge type: 'line' | 'arc' | 'cubic' | 'polyline' | …
  /**
   * Generic strength signal. Drives default edge stroke width and acts
   * as attractive force in `force` layouts. Domain semantics opaque.
   */
  weight: z.number().optional(),
  style: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
});

/**
 * Layout names exposed in the spec. Narrow on purpose — `force` covers
 * generic networks, `dagre` covers DAGs, `concentric` covers
 * weight-ordered ring layouts, `mindmap` + `tree` cover hierarchical
 * fan-outs, `circular` + `grid` cover small-N ordered layouts. Power
 * users opt into other G6 layouts via the object form
 * `{ type: 'force', options: { ... } }` — `options` is a passthrough.
 */
export const GraphLayoutNameSchema = z.enum([
  'force',
  'dagre',
  'mindmap',
  'tree',
  'circular',
  'grid',
  'concentric',
]);

export const GraphLayoutSchema = z.union([
  GraphLayoutNameSchema,
  z.object({
    type: GraphLayoutNameSchema,
    options: z.record(z.unknown()).optional(),
  }),
]);

export const GraphComponentParamsSchema = z.object({
  title: z.string().optional(),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema).optional(),
  /**
   * Layout shorthand string OR object form. When omitted, the renderer
   * picks a sensible default: `'force'` if edges are present, `'circular'`
   * otherwise.
   */
  layout: GraphLayoutSchema.optional(),
  height: z.string().optional(), // CSS length, default '400px'
  width: z.string().optional(), // CSS length, default '100%'
  rendererPref: z.enum(['canvas', 'svg']).optional(), // default 'canvas'
  fitView: z.boolean().optional(), // default true
  enableZoom: z.boolean().optional(), // default true
  enableDrag: z.boolean().optional(), // default true (drag nodes)
  enableSelect: z.boolean().optional(), // default true (click-select highlight)
  tooltip: z.boolean().optional(), // default true (label + data summary on hover)
  className: z.string().optional(),
});

// =============================================================================
// Primitive component params schemas (v5.0.1)
//
// These mirror the runtime types declared in `@seed-ship/mcp-ui-solid/types`
// and the imperative checks in `mcp-ui-solid/src/services/validation.ts`.
// They prepare B.1 — `validation.ts` migration to spec-driven Zod parsing
// without losing the existing imperative resource-limits / iframe-domain
// whitelist layers (see MCP-UI-AUDIT-2026-04-26.md §I).
//
// URL-bearing fields use `z.string().min(1)` (not `.url()`) on purpose —
// validation.ts currently just truthy-checks them, and `.url()` would
// reject relative paths and `localhost`-style dev URLs.
// =============================================================================

// Chart component (v5.0.1)
export const ChartTypeSchema = z.enum([
  'bar',
  'line',
  'pie',
  'doughnut',
  'radar',
  'scatter',
  'bubble',
  'polarArea',
]);

export const ChartDatasetSchema = z.object({
  label: z.string(),
  // Either an array of numbers or an array of {x, y} points (Chart.js shapes)
  data: z.union([
    z.array(z.number()),
    z.array(
      z.object({
        x: z.union([z.string(), z.number()]),
        y: z.number(),
      })
    ),
  ]),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
  fill: z.union([z.boolean(), z.string()]).optional(),
  tension: z.number().optional(),
});

export const ChartTimeAxisSchema = z.object({
  parser: z.string().optional(),
  unit: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  tooltipFormat: z.string().optional(),
  min: z.string().optional(),
  max: z.string().optional(),
});

export const ChartComponentParamsSchema = z.object({
  type: ChartTypeSchema,
  title: z.string().optional(),
  data: z.object({
    labels: z.array(z.string()),
    datasets: z.array(ChartDatasetSchema),
  }),
  options: z
    .object({
      responsive: z.boolean().optional(),
      maintainAspectRatio: z.boolean().optional(),
      tension: z.number().optional(),
      // `scales` and `plugins` are Chart.js opaque config objects — kept loose
      scales: z.unknown().optional(),
      plugins: z.unknown().optional(),
    })
    .optional(),
  renderer: z.enum(['native', 'iframe', 'auto']).optional(),
  exportable: z.boolean().optional(),
  timeAxis: ChartTimeAxisSchema.optional(),
  height: z.string().optional(),
  className: z.string().optional(),
});

// Table component (v5.0.1)
export const TableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  sortable: z.boolean().optional(),
  width: z.string().optional(),
});

export const TablePaginationSchema = z.object({
  currentPage: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalRows: z.number().int().min(0),
});

export const TableVirtualizeOptionsSchema = z.object({
  enabled: z.boolean().optional(),
  rowHeight: z.number().int().min(1).optional(),
  overscan: z.number().int().min(0).optional(),
  threshold: z.number().int().min(1).optional(),
});

export const TableExportableSchema = z.union([
  z.boolean(),
  z.object({
    formats: z.array(z.enum(['csv', 'tsv', 'json'])).optional(),
    filename: z.string().optional(),
  }),
]);

// Citation entry — source of a `[N]` marker rendered inside table cells (v5.0.3)
// Used by `<TableRenderer>` when `params.citationMap` is set, to turn LLM
// `[📄 CITATION N]` markers into clickable chips. See
// `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md` for context.
export const CitationEntrySchema = z.object({
  page: z.union([z.number(), z.string()]),
  file: z.string().optional(),
  file_id: z.union([z.number(), z.string()]).optional(),
});

export const TableComponentParamsSchema = z.object({
  title: z.string().optional(),
  columns: z.array(TableColumnSchema).min(1),
  rows: z.array(z.record(z.unknown())),
  pagination: TablePaginationSchema.optional(),
  virtualize: z.union([z.boolean(), TableVirtualizeOptionsSchema]).optional(),
  exportable: TableExportableSchema.optional(),
  className: z.string().optional(),
  // v5.0.3 — opt-in citation chip rendering inside cells
  citationMap: z.record(z.string(), CitationEntrySchema).optional(),
  // v5.0.5 — opt-out of the inline-mode max-height cap. The library defaults
  // a `max-height: 400px` (or 500px when virtualizing) on tables with > 8
  // rows so they don't blow out a chat-stream layout. Pass `'auto'` to
  // disable the cap (when the consumer's wrapping container handles
  // overflow), a number (interpreted as `${n}px`), or any CSS length string
  // to override the value.
  maxHeight: z.union([z.literal('auto'), z.number(), z.string()]).optional(),
});

// Metric component (v5.0.1)
export const MetricTrendSchema = z.object({
  value: z.number(),
  direction: z.enum(['up', 'down', 'neutral']),
});

export const MetricComponentParamsSchema = z.object({
  title: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: MetricTrendSchema.optional(),
  subtitle: z.string().optional(),
  icon: z.string().optional(),
  className: z.string().optional(),
});

// Text component (v5.0.1)
export const TextComponentParamsSchema = z.object({
  content: z.string().min(1),
  markdown: z.boolean().optional(),
  className: z.string().optional(),
});

// Iframe component (v5.0.1) — domain whitelist stays in mcp-ui-solid (security)
export const IframeComponentParamsSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
  height: z.string().optional(),
  className: z.string().optional(),
});

// Image component (v5.0.1)
export const ImageComponentParamsSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
  className: z.string().optional(),
});

// Link component (v5.0.1)
export const LinkComponentParamsSchema = z.object({
  url: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  className: z.string().optional(),
});

// Carousel component (v5.0.1)
// `items` are UIComponent values that are validated recursively by the
// renderer — kept opaque here to avoid a circular schema reference.
export const CarouselComponentParamsSchema = z.object({
  items: z.array(z.unknown()).min(1),
  height: z.string().optional(),
  className: z.string().optional(),
});

// Artifact component (v5.0.1)
export const ArtifactComponentParamsSchema = z.object({
  url: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

// Sandbox flags
export const SandboxFlagSchema = z.enum([
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-modals',
]);

// Security constraints
export const SecurityConstraintsSchema = z.object({
  requiresAuth: z.boolean().default(false).optional(),
  allowedDomains: z.array(z.string()).optional(),
  maxIframeDepth: z.number().int().min(0).max(3).default(1).optional(),
  sandboxFlags: z.array(SandboxFlagSchema).optional(),
});

// Performance constraints
export const PerformanceConstraintsSchema = z.object({
  maxRenderTime: z.number().int().min(100).default(5000).optional(),
  maxDataSize: z.number().int().min(1024).default(102400).optional(),
});

// Component schema (JSON Schema definition)
export const ComponentSchemaSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.unknown()),
  additionalProperties: z.boolean().optional(),
});

// Component example
export const ComponentExampleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  params: z.record(z.unknown()),
  position: GridPositionSchema.optional(),
});

// Component definition
export const ComponentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: ComponentTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  schema: ComponentSchemaSchema,
  examples: z.array(ComponentExampleSchema).min(1),
  security: SecurityConstraintsSchema.optional(),
  performance: PerformanceConstraintsSchema.optional(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  deprecated: z.boolean().default(false).optional(),
  deprecationMessage: z.string().optional(),
});

// Registry metadata
export const RegistryMetadataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
});

// Component registry
export const ComponentRegistrySchema = z.object({
  version: z.literal('1.0.0'),
  metadata: RegistryMetadataSchema.optional(),
  components: z.array(ComponentSchema).min(1),
});

// Export types inferred from schemas
export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type ComponentExample = z.infer<typeof ComponentExampleSchema>;
export type GridPosition = z.infer<typeof GridPositionSchema>;
export type SecurityConstraints = z.infer<typeof SecurityConstraintsSchema>;
export type PerformanceConstraints = z.infer<typeof PerformanceConstraintsSchema>;
export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type SandboxFlag = z.infer<typeof SandboxFlagSchema>;

// Form types (Sprint 1)
export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type FormSubmitAction = z.infer<typeof FormSubmitActionSchema>;
export type FormComponentParams = z.infer<typeof FormComponentParamsSchema>;
export type PrefillSource = z.infer<typeof PrefillSourceSchema>;

// Conditional field types (Sprint 2)
export type ShowWhenOperator = z.infer<typeof ShowWhenOperatorSchema>;
export type ShowWhenCondition = z.infer<typeof ShowWhenConditionSchema>;

// Modal types (Sprint 3)
export type ModalSize = z.infer<typeof ModalSizeSchema>;
export type ModalComponentParams = z.infer<typeof ModalComponentParamsSchema>;

// Action group types (Sprint 3)
export type ActionGroupLayout = z.infer<typeof ActionGroupLayoutSchema>;
export type ActionGroupGap = z.infer<typeof ActionGroupGapSchema>;
export type ActionParams = z.infer<typeof ActionParamsSchema>;
export type ActionGroupParams = z.infer<typeof ActionGroupParamsSchema>;

// Image gallery types (Sprint 5)
export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export type ImageGalleryGap = z.infer<typeof ImageGalleryGapSchema>;
export type ImageGalleryAspectRatio = z.infer<typeof ImageGalleryAspectRatioSchema>;
export type ImageGalleryParams = z.infer<typeof ImageGalleryParamsSchema>;

// Video types (Sprint 5)
export type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;
export type VideoComponentParams = z.infer<typeof VideoComponentParamsSchema>;

// Code types (Sprint 6)
export type CodeComponentParams = z.infer<typeof CodeComponentParamsSchema>;

// Map types (Sprint 6 + v5.0.2 LatLngPoint relaxation)
export type LatLngObject = z.infer<typeof LatLngObjectSchema>;
export type LatLngTuple = z.infer<typeof LatLngTupleSchema>;
export type LatLngPoint = z.infer<typeof LatLngPointSchema>;
export type MapMarker = z.infer<typeof MapMarkerSchema>;
export type MapComponentParams = z.infer<typeof MapComponentParamsSchema>;

// GeoJSON + map layer types (v5.2.0 — <MapRenderer> contract alignment)
export type GeoJSONPosition = z.infer<typeof GeoJSONPositionSchema>;
export type GeoJSONGeometryType = z.infer<typeof GeoJSONGeometryTypeSchema>;
export type GeoJSONGeometry = z.infer<typeof GeoJSONGeometrySchema>;
export type GeoJSONFeature = z.infer<typeof GeoJSONFeatureSchema>;
export type GeoJSONFeatureCollection = z.infer<typeof GeoJSONFeatureCollectionSchema>;
export type GeoJSON = z.infer<typeof GeoJSONSchema>;
export type MapGeoJSONStyle = z.infer<typeof MapGeoJSONStyleSchema>;
export type MapPopupConfig = z.infer<typeof MapPopupConfigSchema>;
export type MapLayer = z.infer<typeof MapLayerSchema>;
export type MapClusterOptions = z.infer<typeof MapClusterOptionsSchema>;
export type MapPMTilesConfig = z.infer<typeof MapPMTilesConfigSchema>;

// Graph types (v5.0.4)
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphLayoutName = z.infer<typeof GraphLayoutNameSchema>;
export type GraphLayout = z.infer<typeof GraphLayoutSchema>;
export type GraphComponentParams = z.infer<typeof GraphComponentParamsSchema>;

// Primitive component params types (v5.0.1)
export type ChartType = z.infer<typeof ChartTypeSchema>;
export type ChartDataset = z.infer<typeof ChartDatasetSchema>;
export type ChartTimeAxis = z.infer<typeof ChartTimeAxisSchema>;
export type ChartComponentParams = z.infer<typeof ChartComponentParamsSchema>;
export type TableColumn = z.infer<typeof TableColumnSchema>;
export type TablePagination = z.infer<typeof TablePaginationSchema>;
export type TableVirtualizeOptions = z.infer<typeof TableVirtualizeOptionsSchema>;
export type TableExportable = z.infer<typeof TableExportableSchema>;
export type CitationEntry = z.infer<typeof CitationEntrySchema>;
export type TableComponentParams = z.infer<typeof TableComponentParamsSchema>;
export type MetricTrend = z.infer<typeof MetricTrendSchema>;
export type MetricComponentParams = z.infer<typeof MetricComponentParamsSchema>;
export type TextComponentParams = z.infer<typeof TextComponentParamsSchema>;
export type IframeComponentParams = z.infer<typeof IframeComponentParamsSchema>;
export type ImageComponentParams = z.infer<typeof ImageComponentParamsSchema>;
export type LinkComponentParams = z.infer<typeof LinkComponentParamsSchema>;
export type CarouselComponentParams = z.infer<typeof CarouselComponentParamsSchema>;
export type ArtifactComponentParams = z.infer<typeof ArtifactComponentParamsSchema>;

// =============================================================================
// Connector dynamic result contract (v6.6.0 — R1 of ROADMAP-opendata-macro-mcpui)
//
// `ConnectorDynamicResultV1` is the JSON contract a connector / MCP server
// emits to describe a rich, ready-to-render result. It crosses repo
// boundaries (MCPs emitter -> mcp-ui-solid consumer) deployed independently,
// so it carries an explicit, namespaced `schemaVersion` discriminant — an
// old emitter + a new consumer must fail loudly, not silently.
//
// HOME : this contract lives in `mcp-ui-spec` (not `mcp-ui-solid` core) on
// purpose — it is a cross-repo JSON contract, not a Solid renderer type.
//
// `primary` / `supplemental` carry `UIComponent` / `UILayout` payloads.
// They are kept as passthrough objects here : the spec validates the
// ENVELOPE, the renderer (`mcp-ui-solid`) owns runtime component validation
// (`validateComponent`). Adapters in `mcp-ui-solid/adapters` narrow them to
// the real `UIComponent | UILayout` types at the consumption boundary.
// =============================================================================

/**
 * A follow-up suggestion a connector attaches to a result — a next query
 * the user might want to run (refine, compare, expand, clarify).
 */
export const ConnectorFollowupSchema = z.object({
  /** Display text of the suggestion. */
  label: z.string().min(1),
  /** The follow-up query to run when the suggestion is picked. */
  query: z.string().optional(),
  /** Normalized intent of the follow-up query. */
  intent: z.string().optional(),
  /** What kind of follow-up this is — drives grouping / iconography. */
  kind: z.enum(['refine', 'compare', 'expand', 'clarify']).optional(),
});

/**
 * A connector action reuses the exact `action-group` action shape
 * (`ActionParamsSchema`) — `tool-call` / `link` / `submit` with a label,
 * params, variant, etc. No parallel type.
 */
export const ConnectorActionSchema = ActionParamsSchema;

/**
 * Non-binding hints from the connector about how the result is best shown.
 * Heuristic only — the renderer/adapter may override (cf. D1 priority chain:
 * adapter default < renderHints < persisted user feedback).
 */
/**
 * Top-level layout shapes a connector hint / user feedback can ask for.
 * Shared by `ConnectorRenderHintsSchema` (connector's hint) and
 * `ConnectorRenderFeedbackSchema` (user's correction).
 */
export const ConnectorPreferredLayoutSchema = z.enum([
  'table',
  'cards',
  'bar',
  'line',
  'doughnut',
  'map',
  'metric',
]);

export const ConnectorRenderHintsSchema = z.object({
  /** Preferred top-level layout for `primary`. */
  preferredLayout: ConnectorPreferredLayoutSchema.optional(),
  /** Data domain — drives presets/examples, NOT the same axis as `intent`. */
  domain: z
    .enum(['real_estate', 'dpe', 'pollution', 'employment', 'education', 'health', 'generic'])
    .optional(),
  /** Connector's confidence in the result, 0..1. */
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Schema version discriminant. Namespaced string (not a bare integer) so
 * it is self-describing in logs and on the wire. Bump the suffix on any
 * breaking change ; a consumer that does not recognize the value must
 * degrade gracefully (cf. R2 — never throw on the runtime render path).
 */
export const CONNECTOR_DYNAMIC_RESULT_V1 = 'connector-dynamic-result/v1' as const;

/**
 * Canonical v1 contract for a connector's dynamic result.
 */
export const ConnectorDynamicResultV1Schema = z.object({
  /** Version discriminant — REQUIRED. */
  schemaVersion: z.literal(CONNECTOR_DYNAMIC_RESULT_V1),
  /** Stable id of the connector that produced this result. */
  connectorId: z.string().min(1),
  /** MCP tool that was invoked. */
  toolName: z.string().min(1),
  /** The raw user query. */
  query: z.string(),
  /**
   * Stable key for storing / retrieving persisted presentation feedback.
   * Optional in the payload, but REQUIRED once a feedback entry is
   * persisted against this result. Recommended derivation :
   * `hash(connectorId + toolName + normalizedIntent)` — NOT the raw query,
   * so two close phrasings of the same ask share the key.
   */
  queryHash: z.string().optional(),
  /** Normalized user intent (e.g. `real_estate_city`, `dpe_city`). */
  intent: z.string().optional(),
  /** Primary result — a `UIComponent` or `UILayout` (passthrough, see header). */
  primary: z.record(z.unknown()),
  /** Supplemental components — related datasets, source cards, etc. */
  supplemental: z.array(z.record(z.unknown())).optional(),
  /** Follow-up actions (tool calls / links) the user can trigger. */
  actions: z.array(ConnectorActionSchema).optional(),
  /** Suggested follow-up queries. */
  followups: z.array(ConnectorFollowupSchema).optional(),
  /** Non-binding rendering hints. */
  renderHints: ConnectorRenderHintsSchema.optional(),
});

export type ConnectorFollowup = z.infer<typeof ConnectorFollowupSchema>;
export type ConnectorAction = z.infer<typeof ConnectorActionSchema>;
export type ConnectorPreferredLayout = z.infer<typeof ConnectorPreferredLayoutSchema>;
export type ConnectorRenderHints = z.infer<typeof ConnectorRenderHintsSchema>;
export type ConnectorDynamicResultV1 = z.infer<typeof ConnectorDynamicResultV1Schema>;

// =============================================================================
// Presentation feedback contract (v6.6.0 — R3 / D9 of ROADMAP-opendata-macro-mcpui)
//
// `ConnectorRenderFeedback` is the payload the `<PresentationFeedback>`
// component (in `mcp-ui-solid`) emits when a user rates how a connector
// result was *presented* — a separate axis from response-quality feedback
// (`FeedbackInline`). The host persists it and may re-run its adapter with
// the corrected `preferredLayout` (cf. D1 : adapter pure + host-owned state).
//
// It lives in the spec because, like `ConnectorDynamicResultV1`, it is a
// cross-boundary contract : component -> host persistence -> (aggregated)
// connector prompt tuning.
// =============================================================================

/**
 * A precise presentation problem. Distinct from the `verdict` (the overall
 * readable / not-readable judgement) — a payload carries one verdict and
 * zero-or-more problems.
 */
export const ConnectorRenderProblemSchema = z.enum([
  'too_raw',
  'wrong_columns',
  'wrong_chart',
  'missing_context',
  'wrong_unit',
  'bad_grouping',
  'missing_dataset_context',
]);

/**
 * Payload emitted by `<PresentationFeedback>`. `verdict` is the overall
 * judgement ; `problems` (and the precise `wrongUnit` / `selectedColumns` /
 * … fields) refine it when the verdict is `not_readable`.
 */
export const ConnectorRenderFeedbackSchema = z.object({
  /** Connector whose result is being rated. */
  connectorId: z.string().min(1),
  /** Tool that produced the result. */
  toolName: z.string().min(1),
  /** Stable key tying this feedback to a `ConnectorDynamicResultV1.queryHash`. */
  queryHash: z.string().optional(),
  /** What was rated (e.g. `'primary'`, `'supplemental'`). */
  renderKind: z.string().optional(),
  /** The layout type that was shown (e.g. `'table'`, `'bar'`). */
  layoutType: z.string().optional(),
  /** Overall judgement — REQUIRED. */
  verdict: z.enum(['readable', 'not_readable']),
  /** Zero or more precise problems (refines a `not_readable` verdict). */
  problems: z.array(ConnectorRenderProblemSchema).optional(),
  /** Layout the user would prefer instead. */
  preferredLayout: ConnectorPreferredLayoutSchema.optional(),
  /** Fields the user says are missing from the render. */
  missingFields: z.array(z.string()).optional(),
  /** Columns the user wishes were shown. */
  selectedColumns: z.array(z.string()).optional(),
  /** A unit the user flags as wrong. */
  wrongUnit: z.string().optional(),
  /** A grouping the user flags as wrong. */
  wrongGrouping: z.string().optional(),
  /** Free-text comment. */
  comment: z.string().optional(),
});

export type ConnectorRenderProblem = z.infer<typeof ConnectorRenderProblemSchema>;
export type ConnectorRenderFeedback = z.infer<typeof ConnectorRenderFeedbackSchema>;
