/**
 * Generative MCP UI - Type Definitions
 * Phase 0-3 Implementation
 *
 * Defines the contract for LLM-generated UI components
 */

/**
 * Component types supported by the renderer
 */
export type ComponentType =
  | 'chart'
  | 'table'
  | 'metric'
  | 'text'
  | 'grid'
  | 'iframe'
  | 'image'
  | 'link'
  | 'action'
  | 'footer'
  | 'carousel'
  | 'artifact'
  | 'form'
  | 'modal'
  | 'action-group'
  | 'image-gallery' // Sprint 5
  | 'video'         // Sprint 5
  | 'code'          // Sprint 6
  | 'map'           // Sprint 6

/**
 * Chart types (powered by Quickchart)
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'bubble' | 'polarArea'

/**
 * Grid layout specification (12-column system)
 */
export interface GridPosition {
  /**
   * Column start (1-12)
   */
  colStart: number

  /**
   * Column span (1-12)
   */
  colSpan: number

  /**
   * Row start (1-based, auto-increment if not specified)
   */
  rowStart?: number

  /**
   * Row span (default: 1)
   */
  rowSpan?: number
}

/**
 * Component resource limits (SECURITY)
 */
export interface ResourceLimits {
  /**
   * Max data points per chart (default: 1000)
   */
  maxDataPoints: number

  /**
   * Max table rows (default: 100, pagination required)
   */
  maxTableRows: number

  /**
   * Max payload size in bytes (default: 50KB)
   */
  maxPayloadSize: number

  /**
   * Iframe render timeout in ms (default: 5000ms)
   */
  renderTimeout: number
}

/**
 * Chart component parameters
 */
export interface ChartComponentParams {
  type: ChartType
  title?: string
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[] | Array<{ x: string | number; y: number }>
      backgroundColor?: string | string[]
      borderColor?: string | string[]
      borderWidth?: number
      /** Fill area under line (useful for time-series) */
      fill?: boolean | string
      /** Line tension (0 = straight, 0.4 = smooth) */
      tension?: number
    }>
  }
  options?: {
    responsive?: boolean
    maintainAspectRatio?: boolean
    tension?: number
    scales?: any
    plugins?: any
  }
  /**
   * Force renderer type (Sprint 4)
   * - 'native': Use Chart.js directly (requires chart.js peer dependency)
   * - 'iframe': Use Quickchart.io iframe (default fallback)
   * - 'auto': Use native if Chart.js is available, otherwise iframe (default)
   */
  renderer?: 'native' | 'iframe' | 'auto'
  /**
   * Enable PNG export button (v2.2.0)
   */
  exportable?: boolean
  /**
   * Time-series axis configuration (v3.1.0).
   * When set, x-axis labels are parsed as dates.
   */
  timeAxis?: {
    /** Date format for parsing labels (Chart.js adapter format, e.g. 'yyyy-MM-dd') */
    parser?: string
    /** Display unit for x-axis ticks */
    unit?: 'day' | 'week' | 'month' | 'quarter' | 'year'
    /** Date format for tooltip display */
    tooltipFormat?: string
    /** Min date (ISO string) */
    min?: string
    /** Max date (ISO string) */
    max?: string
  }
  /**
   * Chart container height as CSS value (v2.2.0, default '250px')
   */
  height?: string
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Table virtualization options (Sprint Ultimate U.3)
 */
export interface TableVirtualizeOptions {
  /**
   * Enable virtualization explicitly (auto-enabled if rows > threshold)
   */
  enabled?: boolean

  /**
   * Row height in pixels (default: 48)
   */
  rowHeight?: number

  /**
   * Number of rows to render outside viewport (default: 5)
   */
  overscan?: number

  /**
   * Auto-enable threshold - virtualize if rows exceed this count (default: 100)
   */
  threshold?: number
}

/**
 * Citation map entry — source of a `[N]` citation marker rendered inline
 * inside table cells (v5.7.0). See
 * `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md`.
 */
export interface CitationEntry {
  page: number | string
  file?: string
  file_id?: number | string
}

/**
 * Table component parameters
 * Updated Sprint Ultimate U.3: Added virtualization support
 * Updated v5.7.0: Optional citationMap + citationRender for chip rendering
 */
export interface TableComponentParams {
  title?: string
  columns: Array<{
    key: string
    label: string
    sortable?: boolean
    width?: string
  }>
  rows: Array<Record<string, any>>
  pagination?: {
    currentPage: number
    pageSize: number
    totalRows: number
  }
  /**
   * Enable table virtualization for large datasets (Sprint Ultimate U.3)
   * - true: Enable with default options
   * - false: Disable virtualization
   * - TableVirtualizeOptions: Enable with custom options
   */
  virtualize?: boolean | TableVirtualizeOptions
  /**
   * Enable table export (v2.2.0)
   * - true: Enable all formats (csv, tsv, json)
   * - object: Configure formats and filename
   */
  exportable?: boolean | {
    formats?: ('csv' | 'tsv' | 'json')[]
    filename?: string
  }
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
  /**
   * Opt-in citation chip rendering (v5.7.0). Maps marker id (e.g. `1` from
   * `[1]` or `[📄 CITATION 1]` in cell text) to its source. When set,
   * `<TableRenderer>` replaces markers in cell strings with clickable
   * chips carrying `data-citation-page` / `data-citation-doc` /
   * `data-citation-verified` attributes that a host's delegated click
   * handler can route. JSON-serializable — safe to send from MCP servers.
   */
  citationMap?: Record<string | number, CitationEntry>
  /**
   * Optional override for the chip HTML (v5.7.0). When supplied, wins over
   * the default chip shape. NOT JSON-serializable — must be wired by the
   * consumer at render time, not from a server payload.
   */
  citationRender?: (
    id: number,
    mapping: CitationEntry | undefined
  ) => string
}

/**
 * Metric card component parameters
 */
export interface MetricComponentParams {
  title: string
  value: string | number
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
  }
  subtitle?: string
  icon?: string
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Text component parameters
 */
export interface TextComponentParams {
  content: string
  markdown?: boolean
  className?: string
}

/**
 * Action component parameters
 */
export interface ActionComponentParams {
  label: string
  type: 'button' | 'link'
  action: 'tool-call' | 'link' | 'submit'
  toolName?: string
  params?: Record<string, any>
  url?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  disabled?: boolean
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
  /**
   * Accessible label for screen readers (Sprint 7)
   */
  ariaLabel?: string
}

/**
 * Form field option (for select, radio)
 */
export interface FormFieldOption {
  label: string
  value: string
  disabled?: boolean
}

/**
 * Form field type
 */
export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'autocomplete'
  | 'range'
  | 'tags'
  | 'toggle'
  | 'fieldset'

/**
 * Operators for conditional field display
 */
export type ShowWhenOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse'

/**
 * Condition for conditional field visibility
 */
export interface ShowWhenCondition {
  field: string
  operator: ShowWhenOperator
  value?: any
}

/**
 * Form field parameters
 */
/** How a prefilled value was obtained */
export type PrefillSource = 'user' | 'detected' | 'inferred' | 'default'

export interface FormFieldParams {
  name: string
  type: FormFieldType
  label?: string
  placeholder?: string
  helpText?: string
  required?: boolean
  disabled?: boolean
  defaultValue?: any

  // Prefill — pre-populated value with source tracking (v4.2.0)
  /** Pre-filled value. Field renders with this value instead of empty. */
  prefill?: string | string[]
  /** Human-readable display for prefilled value (e.g. "Rhône — déduit de Lyon") */
  displayHint?: string
  /** How this value was obtained. Drives visual treatment. */
  source?: PrefillSource
  /** If true, field is visually muted (but still editable on click/focus). */
  muted?: boolean
  /** How to handle prefill for autocomplete fields.
   *  - "exact" (default): prefill is the final value (code), use as-is
   *  - "resolve": prefill is a display name, call apiUrl to resolve to valueField */
  prefillMode?: 'exact' | 'resolve'
  /** Regex pattern the submitted value MUST match. Prevents submit if invalid. */
  valueFormat?: string
  /** Human-readable hint shown when valueFormat validation fails. */
  valueFormatHint?: string

  // Text/textarea specific
  minLength?: number
  maxLength?: number
  pattern?: string

  // Number specific
  min?: number
  max?: number
  step?: number

  // Date specific
  minDate?: string
  maxDate?: string

  // Select/Radio specific
  options?: FormFieldOption[]
  /** Enable multi-select (returns array of values) */
  multiple?: boolean

  // Autocomplete specific
  /** API URL for autocomplete suggestions */
  apiUrl?: string
  /** Query parameter name (e.g. 'nom', 'q') */
  searchParam?: string
  /** Field in API response to display */
  labelField?: string
  /** Field in API response to use as value */
  valueField?: string
  /** Extra query parameters */
  extraParams?: Record<string, string>
  /** Min characters before triggering (default: 2) */
  minChars?: number
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number

  // Dependent field — update options when parent changes
  /** Field dependency configuration */
  dependsOn?: {
    /** Name of the parent field */
    field: string
    /** API URL template — use {value} for parent value (e.g. '/departements/{value}/communes') */
    apiUrl: string
    /** Field in API response to display */
    labelField: string
    /** Field in API response for value */
    valueField: string
    /** Extra query parameters */
    extraParams?: Record<string, string>
  }

  // Field status — API capability indicator
  /** Whether this field is supported by the target API/dataset */
  fieldStatus?: 'required' | 'optional' | 'unsupported' | 'unknown'
  /** Human-readable explanation of the status */
  statusReason?: string

  // Checkbox specific
  checkboxLabel?: string

  // Textarea specific
  rows?: number

  // Conditional visibility
  showWhen?: ShowWhenCondition
}

/**
 * Form component parameters
 */
export interface FormComponentParams {
  title?: string
  fields: FormFieldParams[]
  submitLabel?: string
  showReset?: boolean
  submitAction?: {
    toolName: string
    params?: Record<string, any>
  }
  /**
   * Unique key for persisting form data to localStorage (Sprint 4)
   */
  persistKey?: string
  /**
   * Fields to exclude from persistence (e.g., passwords) (Sprint 4)
   */
  excludeFromPersistence?: string[]
  /**
   * Expiry time in milliseconds for persisted data (Sprint 4)
   */
  persistExpiresIn?: number
  layout?: 'vertical' | 'horizontal' | 'inline'
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
  /**
   * Auto-submit countdown in ms when all required fields are prefilled (v4.2.0).
   * Shows a countdown with cancel button. Stops if user interacts.
   */
  autoSubmitDelay?: number
}

/**
 * Modal size options
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

/**
 * Modal component parameters (Sprint 3)
 */
export interface ModalComponentParams {
  /**
   * Modal title displayed in header
   */
  title?: string

  /**
   * Modal size (default: 'md')
   */
  size?: ModalSize

  /**
   * Show close button in header (default: true)
   */
  showClose?: boolean

  /**
   * Close on Escape key (default: true)
   */
  closeOnEscape?: boolean

  /**
   * Close on backdrop click (default: true)
   */
  closeOnBackdrop?: boolean

  /**
   * Max height for content area (CSS value)
   */
  maxHeight?: string

  /**
   * Content component to render inside modal
   */
  content?: UIComponent

  /**
   * Footer component (typically action buttons)
   */
  footer?: UIComponent

  /**
   * Trigger component that opens the modal
   */
  trigger?: UIComponent
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Action group layout options
 */
export type ActionGroupLayout = 'horizontal' | 'vertical' | 'space-between' | 'end' | 'center'

/**
 * Action group gap options
 */
export type ActionGroupGap = 'none' | 'sm' | 'md' | 'lg'

/**
 * Action group parameters (Sprint 3)
 */
export interface ActionGroupParams {
  /**
   * Array of action configurations
   */
  actions: ActionComponentParams[]

  /**
   * Layout direction (default: 'horizontal')
   */
  layout?: ActionGroupLayout

  /**
   * Gap between actions (default: 'md')
   */
  gap?: ActionGroupGap

  /**
   * Make actions fill full width
   */
  fullWidth?: boolean

  /**
   * Accessible label for the group
   */
  label?: string
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Single image in gallery (Sprint 5)
 */
export interface GalleryImage {
  /**
   * Full-size image URL
   */
  url: string

  /**
   * Optional thumbnail URL (smaller version for grid)
   */
  thumbnail?: string

  /**
   * Alt text for accessibility
   */
  alt?: string

  /**
   * Image caption
   */
  caption?: string

  /**
   * Responsive srcset
   */
  srcset?: string

  /**
   * Responsive sizes
   */
  sizes?: string
}

/**
 * Image gallery component parameters (Sprint 5)
 */
export interface ImageGalleryParams {
  /**
   * Gallery title
   */
  title?: string

  /**
   * Array of images to display
   */
  images: GalleryImage[]

  /**
   * Number of columns (default: 3)
   */
  columns?: 2 | 3 | 4 | 5

  /**
   * Gap between images
   */
  gap?: 'none' | 'sm' | 'md' | 'lg'

  /**
   * Aspect ratio for thumbnails
   */
  aspectRatio?: '1:1' | '16:9' | '4:3' | 'auto'

  /**
   * Enable lightbox on click (default: true)
   */
  lightbox?: boolean

  /**
   * Show captions below thumbnails
   */
  showCaptions?: boolean
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Video component parameters (Sprint 5)
 */
export interface VideoComponentParams {
  /**
   * Video URL (YouTube, Vimeo, or direct video file)
   */
  url: string

  /**
   * Video title
   */
  title?: string

  /**
   * Video caption/description
   */
  caption?: string

  /**
   * Poster image URL (thumbnail before play)
   */
  poster?: string

  /**
   * Aspect ratio (default: '16:9')
   */
  aspectRatio?: '16:9' | '4:3' | '1:1' | '21:9'

  /**
   * Auto-play video (requires muted for most browsers)
   */
  autoplay?: boolean

  /**
   * Show video controls (default: true)
   */
  controls?: boolean

  /**
   * Loop video playback
   */
  loop?: boolean

  /**
   * Mute video (required for autoplay)
   */
  muted?: boolean

  /**
   * Start time in seconds (YouTube only)
   */
  startTime?: number
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Code component parameters (Sprint 6)
 */
export interface CodeComponentParams {
  /**
   * Code content
   */
  code: string

  /**
   * Language (e.g., 'typescript', 'python', 'json')
   */
  language?: string

  /**
   * Filename or title
   */
  filename?: string

  /**
   * Show line numbers (default: true)
   */
  showLineNumbers?: boolean

  /**
   * Starting line number (default: 1)
   */
  startLine?: number

  /**
   * Lines to highlight (1-indexed)
   */
  highlightLines?: number[]

  /**
   * Max height for code block (CSS value)
   */
  maxHeight?: string

  /**
   * Color theme
   */
  theme?: 'light' | 'dark'
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * Map marker definition (Sprint 6)
 */
export interface MapMarker {
  /**
   * Position as [latitude, longitude] tuple
   */
  position: [number, number]

  /**
   * Tooltip text (shown on hover)
   */
  tooltip?: string

  /**
   * Popup content (shown on click)
   */
  popup?: string
}

/**
 * Map clustering options (Sprint Ultimate U.2)
 */
export interface MapClusterOptions {
  /**
   * Maximum cluster radius in pixels (default: 80)
   */
  maxClusterRadius?: number

  /**
   * Spiderfy clusters at max zoom (default: true)
   */
  spiderfyOnMaxZoom?: boolean

  /**
   * Show coverage polygon on hover (default: true)
   */
  showCoverageOnHover?: boolean

  /**
   * Disable clustering at this zoom level
   */
  disableClusteringAtZoom?: number

  /**
   * Animation duration in ms (default: 200)
   */
  animateAddingMarkers?: boolean
}

/**
 * GeoJSON feature popup configuration (v3.1.0)
 */
export interface MapPopupConfig {
  /** Property key used as popup title */
  titleField?: string
  /** Property keys to display in popup body */
  fields?: string[]
  /** Custom HTML template (use {{property}} placeholders) */
  template?: string
}

/**
 * GeoJSON style configuration (v3.1.0)
 * Supports static styles and choropleth (data-driven) coloring.
 */
export interface MapGeoJSONStyle {
  /** Fill color (CSS color or choropleth config) */
  fillColor?: string
  /** Fill opacity (0-1, default: 0.6) */
  fillOpacity?: number
  /** Stroke color (default: '#333') */
  strokeColor?: string
  /** Stroke width (default: 1) */
  strokeWeight?: number
  /** Stroke opacity (0-1, default: 1) */
  strokeOpacity?: number
  /** Choropleth: property key for data-driven coloring */
  choroplethField?: string
  /** Choropleth: color scale stops [value, color][] sorted ascending */
  choroplethScale?: Array<[number, string]>
  /** Choropleth: color for features with missing/null values */
  choroplethFallback?: string
}

/**
 * Named GeoJSON layer for multi-layer maps (v3.1.0)
 */
export interface MapLayer {
  /** Layer name (shown in layer control) */
  name: string
  /** Is this layer visible by default? */
  visible?: boolean
  /** GeoJSON FeatureCollection (inline or from API) */
  geojson: unknown // GeoJSON.FeatureCollection — kept as unknown for zero-dep types
  /** Per-layer style override */
  style?: MapGeoJSONStyle
  /** Per-layer popup config */
  popup?: MapPopupConfig
}

/**
 * Map component parameters (Sprint 6)
 * Updated v3.1.0: GeoJSON, choropleth, popups, layers
 */
export interface MapComponentParams {
  /**
   * Initial center [lat, lng]
   */
  center?: [number, number]

  /**
   * Initial zoom level (default: 13)
   */
  zoom?: number

  /**
   * Array of markers to display
   */
  markers?: MapMarker[]

  /**
   * Map height (CSS value, default: '400px')
   */
  height?: string

  /**
   * Auto-fit bounds to show all markers/features (default: false)
   */
  fitBounds?: boolean

  /**
   * Show zoom controls (default: true)
   */
  zoomControl?: boolean

  /**
   * Allow scroll wheel zoom (default: true)
   */
  scrollWheelZoom?: boolean

  /**
   * Custom tile layer URL (default: OpenStreetMap)
   */
  tileLayer?: string

  /**
   * Attribution text (set to empty string to hide)
   */
  attribution?: string

  /**
   * Enable marker clustering (Sprint Ultimate U.2)
   */
  clustering?: boolean | MapClusterOptions

  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string

  // ─── GeoJSON (v3.1.0) ────────────────────

  /**
   * GeoJSON FeatureCollection to render on the map.
   * Use this for polygons, lines, points from structured data.
   */
  geojson?: unknown // GeoJSON.FeatureCollection

  /**
   * Style for the GeoJSON layer.
   * Supports static colors and choropleth (data-driven) coloring.
   */
  geojsonStyle?: MapGeoJSONStyle

  /**
   * Popup configuration for GeoJSON features.
   * Shown on feature click.
   */
  popup?: MapPopupConfig

  /**
   * Named layers for multi-layer maps.
   * Each layer has its own GeoJSON, style, and popup config.
   * A Leaflet layer control is added when layers are present.
   */
  layers?: MapLayer[]

  // ─── PMTiles (v3.1.0) ────────────────────

  /**
   * PMTiles vector tile source for large datasets (>5000 features).
   * Requires protomaps-leaflet peer dependency.
   * Pipeline: GeoParquet -> Tippecanoe -> PMTiles (static file on S3/CDN).
   */
  pmtiles?: MapPMTilesConfig
}

/**
 * PMTiles configuration for large vector tile datasets (v3.1.0)
 */
export interface MapPMTilesConfig {
  /** URL to the .pmtiles file (S3, CDN, local) */
  url: string
  /** Attribution text for this tile source */
  attribution?: string
  /** Style rules for vector features */
  paintRules?: Array<{
    /** Layer name in the PMTiles source */
    dataLayer: string
    /** Symbol type */
    symbolizer: 'polygon' | 'line' | 'circle'
    /** Fill/stroke color (CSS color or function name) */
    color?: string
    /** Stroke width */
    width?: number
    /** Fill opacity */
    opacity?: number
  }>
  /** Label rules for text labels */
  labelRules?: Array<{
    dataLayer: string
    /** Property key for label text */
    textField: string
    /** Font size */
    fontSize?: number
  }>
  /** Max zoom level */
  maxZoom?: number
  /** Min zoom level */
  minZoom?: number
}

/**
 * Grid component parameters (Phase 5.0)
 * Enables nested CSS Grid layouts for template builder
 */
export interface GridComponentParams {
  /**
   * Number of columns (default: 12)
   */
  columns?: number

  /**
   * Gap between grid items (default: '1rem')
   */
  gap?: string

  /**
   * Minimum row height (optional)
   */
  minRowHeight?: string

  /**
   * CSS Grid template areas for named regions
   * Example: [['header', 'header'], ['sidebar', 'main'], ['footer', 'footer']]
   */
  areas?: string[][]

  /**
   * Child components to render within the grid
   */
  children: UIComponent[]
  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
}

/**
 * UI Component definition (generated by LLM)
 */
export interface UIComponent {
  /**
   * Unique component ID
   */
  id: string

  /**
   * Component type
   */
  type: ComponentType

  /**
   * Grid position
   */
  position: GridPosition

  /**
   * Component parameters (type-specific)
   */
  params: ChartComponentParams | TableComponentParams | MetricComponentParams | TextComponentParams | ActionComponentParams | GridComponentParams | FormComponentParams | ModalComponentParams | ActionGroupParams | ImageGalleryParams | VideoComponentParams | CodeComponentParams | MapComponentParams

  /**
   * Metadata for observability
   */
  metadata?: {
    generatedAt: string
    llmModel?: string
    confidence?: number
    toolsUsed?: string[]
  }
}

/**
 * UI Layout (collection of components)
 */
export interface UILayout {
  /**
   * Layout ID
   */
  id: string

  /**
   * Components in the layout
   */
  components: UIComponent[]

  /**
   * Grid configuration
   */
  grid: {
    columns: number // Always 12 for Bootstrap-like grid
    gap: string // CSS grid-gap value
    minRowHeight?: string
  }

  /**
   * Layout metadata
   */
  metadata?: {
    query: string
    generatedAt: string
    llmModel?: string
    totalComponents: number
    /**
     * Execution time in milliseconds (Phase 5.0)
     */
    executionTime?: number
    /**
     * Number of sources used (Phase 5.0)
     */
    sourceCount?: number
    /**
     * Hide auto-injected footer (Phase 5.0)
     */
    hideFooter?: boolean
  }
}

/**
 * Component registry entry
 */
export interface ComponentRegistryEntry {
  /**
   * Component type identifier
   */
  type: ComponentType

  /**
   * Component name
   */
  name: string

  /**
   * Component description (for LLM context)
   */
  description: string

  /**
   * JSON schema for validation
   */
  schema: any

  /**
   * Example usage (for LLM few-shot prompting)
   */
  examples: Array<{
    query: string
    component: UIComponent
  }>

  /**
   * Resource limits
   */
  limits: ResourceLimits
}

/**
 * Component validation result
 */
export interface ValidationResult {
  valid: boolean
  errors?: Array<{
    path: string
    message: string
    code: string
  }>
}

/**
 * Renderer error types
 */
export type RendererErrorType =
  | 'validation'
  | 'render'
  | 'timeout'
  | 'resource_limit'
  | 'network'
  | 'security'

/**
 * Renderer error
 */
export interface RendererError {
  type: RendererErrorType
  message: string
  componentId?: string
  details?: any
}

/**
 * Streaming event types (Phase 2)
 */
export type StreamEventType =
  | 'status'
  | 'component-start'
  | 'component'
  | 'component-complete'
  | 'error'
  | 'complete'

/**
 * Streaming event (Phase 2)
 */
export interface StreamEvent {
  event: StreamEventType
  data: any
  sequenceId?: number
  timestamp: string
}

/**
 * Action request (for lifecycle callbacks)
 */
export interface ActionRequestBase {
  toolName: string
  params?: Record<string, any>
}

/**
 * Action result (for lifecycle callbacks)
 */
export interface ActionResultBase {
  success: boolean
  data?: any
  error?: string
  timestamp: string
  toolName: string
}

/**
 * Lifecycle callbacks for action execution
 */
export interface ActionLifecycleCallbacks {
  /**
   * Called before action executes (can cancel by returning false)
   */
  onBefore?: (request: ActionRequestBase) => boolean | Promise<boolean>

  /**
   * Called after successful action
   */
  onSuccess?: (result: ActionResultBase) => void

  /**
   * Called after failed action
   */
  onError?: (error: string, request: ActionRequestBase) => void

  /**
   * Called after action completes (success or failure)
   */
  onComplete?: (result: ActionResultBase) => void
}

/**
 * Iframe validation policy
 * - 'strict': Only allow domains in the default whitelist
 * - 'extend': Allow default whitelist + custom domains
 * - 'allow-all': Skip domain validation entirely (use with caution)
 */
export type IframePolicy = 'strict' | 'extend' | 'allow-all'

/**
 * Validation options for component validation
 */
export interface ValidationOptions {
  /**
   * Resource limits for component validation
   */
  limits?: ResourceLimits

  /**
   * Iframe domain validation policy (default: 'strict')
   */
  iframePolicy?: IframePolicy

  /**
   * Custom domains to allow when iframePolicy is 'extend'
   */
  customIframeDomains?: string[]
}

// =============================================================================
// DRAG-DROP TYPES (Sprint Drag-Drop)
// =============================================================================

/**
 * Resize constraints for grid items
 */
export interface ResizeConstraints {
  /**
   * Minimum column span (default: 1)
   */
  minColSpan?: number

  /**
   * Maximum column span (default: 12)
   */
  maxColSpan?: number

  /**
   * Minimum row span (default: 1)
   */
  minRowSpan?: number

  /**
   * Maximum row span
   */
  maxRowSpan?: number

  /**
   * Lock horizontal resizing
   */
  lockHorizontal?: boolean

  /**
   * Lock vertical resizing
   */
  lockVertical?: boolean
}

/**
 * Drag-Drop configuration for UIResourceRenderer
 */
export interface DragDropConfig {
  /**
   * Enable drag-drop functionality (default: false)
   */
  enabled?: boolean

  /**
   * Enable reordering via drag (default: true when enabled)
   */
  reorder?: boolean

  /**
   * Enable resize handles (default: true when enabled)
   */
  resize?: boolean

  /**
   * Resize constraints
   */
  constraints?: ResizeConstraints

  /**
   * Callback when components are reordered
   */
  onReorder?: (components: UIComponent[]) => void

  /**
   * Callback when a component is resized
   */
  onResize?: (componentId: string, newPosition: GridPosition) => void

  /**
   * Callback when layout changes (reorder or resize)
   */
  onChange?: (layout: UILayout) => void

  /**
   * Show grid lines during drag (default: true)
   */
  showGridLines?: boolean

  /**
   * Animation duration in ms (default: 200)
   */
  animationDuration?: number
}

/**
 * Drag event data for internal use
 */
export interface DragEventData {
  /**
   * Component being dragged
   */
  componentId: string

  /**
   * Original position
   */
  originalPosition: GridPosition

  /**
   * Current drag position (in grid coordinates)
   */
  currentPosition?: GridPosition

  /**
   * Drag type
   */
  type: 'reorder' | 'resize'

  /**
   * For resize: which edge is being dragged
   */
  resizeEdge?: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

/**
 * Props for draggable grid items
 */
export interface DraggableGridItemProps {
  /**
   * Component ID
   */
  id: string

  /**
   * Grid position
   */
  position: GridPosition

  /**
   * Enable dragging
   */
  draggable?: boolean

  /**
   * Enable resize handles
   */
  resizable?: boolean

  /**
   * Resize constraints
   */
  constraints?: ResizeConstraints

  /**
   * Is this item currently being dragged
   */
  isDragging?: boolean

  /**
   * Is this item a drop target
   */
  isDropTarget?: boolean

  /**
   * Children to render
   */
  children?: any

  /**
   * Custom class
   */
  class?: string
}

// =============================================================================
// AUTOCOMPLETE TYPES (Sprint Autocomplete)
// =============================================================================

/**
 * Autocomplete result type
 */
export type AutocompleteResultType = 'completion' | 'options'

/**
 * Single autocomplete option (for dropdown)
 */
export interface AutocompleteOption {
  /**
   * Option value
   */
  value: string

  /**
   * Display label (defaults to value)
   */
  label?: string

  /**
   * Optional description
   */
  description?: string

  /**
   * Optional icon
   */
  icon?: string

  /**
   * Additional metadata from the source
   */
  metadata?: Record<string, any>

  /**
   * Whether this option is disabled
   */
  disabled?: boolean
}

/**
 * Result from autocomplete plugin
 */
export interface AutocompleteResult {
  /**
   * Result type:
   * - 'completion': Ghost text (LLM-style)
   * - 'options': Dropdown options (data source)
   */
  type: AutocompleteResultType

  /**
   * For type: 'completion' - the suggested text to complete
   */
  completion?: string

  /**
   * For type: 'options' - list of suggestions
   */
  options?: AutocompleteOption[]

  /**
   * Plugin ID that generated this result
   */
  pluginId?: string

  /**
   * Whether result is from cache
   */
  cached?: boolean
}

/**
 * Context passed to autocomplete plugins
 */
export interface AutocompleteContext {
  /**
   * Field name/identifier
   */
  fieldName: string

  /**
   * Current form data (other fields)
   */
  formData?: Record<string, any>

  /**
   * Cursor position in input
   */
  cursorPosition?: number

  /**
   * Previous user inputs (for context)
   */
  history?: string[]

  /**
   * Custom context data
   */
  custom?: Record<string, any>
}

/**
 * Plugin interface for autocomplete sources
 */
export interface AutocompletePlugin {
  /**
   * Unique plugin identifier
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Configure the plugin
   */
  configure?: (config: Record<string, any>) => void

  /**
   * Get suggestions for input
   */
  getSuggestions: (
    input: string,
    context?: AutocompleteContext
  ) => Promise<AutocompleteResult>

  /**
   * Cleanup resources
   */
  dispose?: () => void

  /**
   * Whether plugin is ready
   */
  isReady?: () => boolean
}

/**
 * Groq LLM plugin configuration
 */
export interface GroqPluginConfig {
  /**
   * Groq API key (VITE_GROQ_API_KEY)
   */
  apiKey: string

  /**
   * Model to use (default: 'mixtral-8x7b-32768')
   */
  model?: string

  /**
   * System prompt for completion
   */
  systemPrompt?: string

  /**
   * Max tokens to generate (default: 50)
   */
  maxTokens?: number

  /**
   * Temperature (default: 0.3)
   */
  temperature?: number
}

/**
 * Supabase plugin configuration
 */
export interface SupabasePluginConfig {
  /**
   * Supabase project URL
   */
  url: string

  /**
   * Supabase anonymous key
   */
  anonKey: string

  /**
   * Table to search
   */
  table: string

  /**
   * Column to return as value
   */
  column: string

  /**
   * Column to search (defaults to column)
   */
  searchColumn?: string

  /**
   * Label column (defaults to column)
   */
  labelColumn?: string

  /**
   * Max results (default: 10)
   */
  limit?: number

  /**
   * Filter expression
   */
  filter?: Record<string, any>
}

/**
 * DuckDB WASM plugin configuration
 */
export interface DuckDBPluginConfig {
  /**
   * SQL query with :search placeholder
   * Example: "SELECT name FROM cities WHERE name ILIKE :search || '%' LIMIT 10"
   */
  query: string

  /**
   * Optional data to load into DuckDB
   */
  data?: {
    tableName: string
    source: string | ArrayBuffer | File // URL, raw data, or file
    format?: 'csv' | 'json' | 'parquet'
  }
}

/**
 * Generic REST API plugin configuration
 */
export interface RestPluginConfig {
  /**
   * API endpoint with {search} placeholder
   * Example: '/api/search?q={search}'
   */
  endpoint: string

  /**
   * HTTP method (default: 'GET')
   */
  method?: 'GET' | 'POST'

  /**
   * Request headers
   */
  headers?: Record<string, string>

  /**
   * For POST: body template with {search} placeholder
   */
  bodyTemplate?: string

  /**
   * Transform response to options
   */
  transform?: (response: any) => AutocompleteOption[]

  /**
   * Path to results array in response (e.g., 'data.results')
   */
  resultPath?: string

  /**
   * Field name for value (default: 'value' or 'id')
   */
  valueField?: string

  /**
   * Field name for label (default: 'label' or 'name')
   */
  labelField?: string
}

/**
 * Field-level autocomplete configuration
 */
export interface FieldAutocompleteConfig {
  /**
   * Enable autocomplete for this field
   */
  enabled: boolean

  /**
   * Plugin ID to use (defaults to provider default)
   */
  plugin?: string

  /**
   * Plugin-specific configuration
   */
  config?: Record<string, any>

  /**
   * Other form fields to include as context
   */
  contextFields?: string[]

  /**
   * Minimum characters before triggering (default: 1)
   */
  minChars?: number

  /**
   * Debounce delay in ms (default: 150)
   */
  debounceMs?: number

  /**
   * Custom placeholder when loading
   */
  loadingPlaceholder?: string
}

/**
 * Autocomplete provider configuration
 */
export interface AutocompleteProviderConfig {
  /**
   * Registered plugins
   */
  plugins: AutocompletePlugin[]

  /**
   * Default plugin ID
   */
  defaultPlugin?: string

  /**
   * Global debounce delay (default: 150ms)
   */
  debounceMs?: number

  /**
   * Global minimum characters (default: 1)
   */
  minChars?: number

  /**
   * Cache TTL in ms (default: 60000)
   */
  cacheTtl?: number

  /**
   * Enable caching (default: true)
   */
  cacheEnabled?: boolean
}
