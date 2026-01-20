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
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter'

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
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string | string[]
      borderWidth?: number
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
 * Table component parameters
 * Updated Sprint Ultimate U.3: Added virtualization support
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
   * Custom CSS class (Sprint 7)
   */
  className?: string
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
export interface FormFieldParams {
  name: string
  type: FormFieldType
  label?: string
  placeholder?: string
  helpText?: string
  required?: boolean
  disabled?: boolean
  defaultValue?: any

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
 * Map component parameters (Sprint 6)
 * Updated Sprint Ultimate U.2: Added clustering support
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
   * Auto-fit bounds to show all markers (default: false)
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
   * - true: Enable with default options
   * - false: Disable clustering
   * - MapClusterOptions: Enable with custom options
   */
  clustering?: boolean | MapClusterOptions

  /**
   * Custom CSS class (Sprint 7)
   */
  className?: string
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
