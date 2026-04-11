/**
 * Component Validation Service
 * Phase 0: Resource Limits & Schema Validation
 *
 * Validates LLM-generated components against:
 * - JSON schema
 * - Resource limits (data points, payload size, grid bounds)
 * - Security constraints (domain whitelist, XSS prevention)
 */

import type {
  UIComponent,
  UILayout,
  ValidationResult,
  ResourceLimits,
  ChartComponentParams,
  TableComponentParams,
  FormFieldParams,
  IframePolicy,
  ValidationOptions,
  ComponentType,
} from '../types'

/**
 * All known ComponentType values — used to distinguish known-but-unvalidated
 * types (pass through) from truly unknown strings (reject).
 */
const KNOWN_COMPONENT_TYPES: Set<string> = new Set<ComponentType>([
  'chart', 'table', 'metric', 'text', 'grid', 'iframe', 'image', 'link',
  'action', 'footer', 'carousel', 'artifact', 'form', 'modal',
  'action-group', 'image-gallery', 'video', 'code', 'map',
])

/**
 * Default resource limits (configurable via env)
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxDataPoints: 1000,
  maxTableRows: 100,
  maxPayloadSize: 50 * 1024, // 50KB
  renderTimeout: 5000, // 5 seconds
}

/**
 * Default allowed iframe domains (whitelist)
 * Must match CSP frame-src directive
 * Updated Sprint 7: Added code, design, docs, and map providers
 *
 * This list is exported for transparency and can be extended via ValidationOptions
 */
export const DEFAULT_IFRAME_DOMAINS = [
  // Charts
  'quickchart.io',
  'www.quickchart.io',

  // Deposium
  'deposium.com',
  'deposium.vip',
  'deposium.ai',

  // Development
  'localhost',

  // Video providers (Sprint 5)
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',

  // Code playgrounds (Sprint 7)
  'codepen.io',
  'codesandbox.io',
  'stackblitz.com',
  'jsfiddle.net',

  // Design tools (Sprint 7)
  'figma.com',
  'www.figma.com',
  'miro.com',

  // Google services (Sprint 7)
  'docs.google.com',
  'drive.google.com',
  'sheets.google.com',
  'slides.google.com',
  'maps.google.com',
  'www.google.com',
  'datastudio.google.com',
  'lookerstudio.google.com',

  // Productivity (Sprint 7)
  'airtable.com',
  'notion.so',
  'www.notion.so',

  // Maps (Sprint 7)
  'openstreetmap.org',
  'www.openstreetmap.org',

  // Analytics/Dashboards (Sprint 7)
  'public.tableau.com',
  'app.powerbi.com',
  'observablehq.com',

  // Diagrams & Whiteboards (v2.0.0)
  'mermaid.live',
  'excalidraw.com',
  'lucidchart.com',
  'lucid.app',

  // Video - Business (v2.0.0)
  'loom.com',
  'www.loom.com',
  'cloudflarestream.com',
  'streamable.com',

  // Code repositories (v2.0.0)
  'github.com',
  'gist.github.com',
  'gitlab.com',
  'replit.com',
  'glitch.com',

  // Business tools (v2.0.0)
  'calendly.com',
  'typeform.com',
  'cal.com',

  // Design (v2.0.0)
  'canva.com',

  // Deploy previews (v2.0.0)
  'vercel.app',
  'netlify.app',

  // E-commerce (v2.0.0)
  'amazon.com',
  'amazon.fr',
  'amazon.de',
  'amazon.co.uk',
  'amazon.es',
  'amazon.it',
  'amazon.ca',
  'amazon.co.jp',
  'images-amazon.com',
  'media-amazon.com',
  'ws-na.amazon-adsystem.com',

  // MCP Connectors — embed-capable services (v2.2.7)
  'gamma.app',
  'www.gamma.app',
  'app.hubspot.com',
  'share.hubspot.com',
  'www.data.gouv.fr',
  'data.gouv.fr',
  'clinicaltrials.gov',
  'www.clinicaltrials.gov',
  'linear.app',
  'www.linear.app',

  // Payment platforms (v2.2.12)
  'polar.sh',
  'www.polar.sh',
  'checkout.stripe.com',
  'js.stripe.com',
  'billing.stripe.com',
  'buy.stripe.com',
  'connect.stripe.com',
  'invoice.stripe.com',
]

/**
 * Trusted iframe domains that require allow-same-origin to function.
 * These domains need access to their own cookies/storage for auth.
 * All other whitelisted domains get a restrictive sandbox without allow-same-origin.
 */
export const TRUSTED_IFRAME_DOMAINS = [
  // Deposium (own domains)
  'deposium.com',
  'deposium.vip',
  'deposium.ai',
  'localhost',

  // Google services (need auth cookies)
  'docs.google.com',
  'drive.google.com',
  'sheets.google.com',
  'slides.google.com',
  'maps.google.com',
  'datastudio.google.com',
  'lookerstudio.google.com',

  // Productivity (need auth)
  'notion.so',
  'www.notion.so',
  'airtable.com',
  'figma.com',
  'www.figma.com',
  'miro.com',

  // Payment (need auth + cookies for checkout)
  'polar.sh',
  'www.polar.sh',
  'checkout.stripe.com',
  'js.stripe.com',
  'billing.stripe.com',
  'buy.stripe.com',
  'connect.stripe.com',
  'invoice.stripe.com',

  // Business tools (need auth)
  'app.hubspot.com',
  'share.hubspot.com',
  'app.powerbi.com',
  'linear.app',
  'www.linear.app',
  'calendly.com',
  'typeform.com',
  'cal.com',
  'canva.com',
]

/**
 * Validate grid position bounds (1-12 columns)
 */
export function validateGridPosition(position: UIComponent['position']): ValidationResult {
  const errors: ValidationResult['errors'] = []

  // ✅ PHASE 3 FIX: Defensive check for undefined position
  if (!position) {
    return {
      valid: false,
      errors: [
        {
          path: 'position',
          message: 'Position is required',
          code: 'MISSING_POSITION',
        },
      ],
    }
  }

  if (position.colStart < 1 || position.colStart > 12) {
    errors.push({
      path: 'position.colStart',
      message: 'Column start must be between 1 and 12',
      code: 'INVALID_GRID_COL_START',
    })
  }

  if (position.colSpan < 1 || position.colSpan > 12) {
    errors.push({
      path: 'position.colSpan',
      message: 'Column span must be between 1 and 12',
      code: 'INVALID_GRID_COL_SPAN',
    })
  }

  if (position.colStart + position.colSpan - 1 > 12) {
    errors.push({
      path: 'position',
      message: 'Column start + span exceeds grid width (12)',
      code: 'GRID_OVERFLOW',
    })
  }

  if (position.rowStart !== undefined && position.rowStart < 1) {
    errors.push({
      path: 'position.rowStart',
      message: 'Row start must be >= 1',
      code: 'INVALID_GRID_ROW_START',
    })
  }

  if (position.rowSpan !== undefined && position.rowSpan < 1) {
    errors.push({
      path: 'position.rowSpan',
      message: 'Row span must be >= 1',
      code: 'INVALID_GRID_ROW_SPAN',
    })
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate chart component against resource limits
 */
export function validateChartComponent(
  params: ChartComponentParams,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): ValidationResult {
  const errors: ValidationResult['errors'] = []

  // Guard: params.data must exist with labels + datasets
  if (!params?.data) {
    return { valid: false, errors: [{ path: 'params.data', message: 'Missing chart data object', code: 'MISSING_DATA' }] }
  }
  if (!Array.isArray(params.data.datasets)) {
    return { valid: false, errors: [{ path: 'params.data.datasets', message: 'Missing or invalid datasets array', code: 'MISSING_DATASETS' }] }
  }
  // Detect point-based charts (scatter/bubble) or object data (time-series line)
  const chartType = params.type || 'bar'
  const firstDataPoint = params.data.datasets[0]?.data?.[0]
  const hasObjectData = typeof firstDataPoint === 'object' && firstDataPoint !== null && 'x' in firstDataPoint
  const isPointChart = chartType === 'scatter' || chartType === 'bubble' || hasObjectData

  // Labels required only for categorical charts (not scatter/bubble/time-series)
  if (!isPointChart) {
    if (!Array.isArray(params.data.labels)) {
      return { valid: false, errors: [{ path: 'params.data.labels', message: 'Missing or invalid labels array', code: 'MISSING_LABELS' }] }
    }
  }

  // Validate data points count
  const totalDataPoints = params.data.datasets.reduce(
    (sum, dataset) => sum + (Array.isArray(dataset.data) ? dataset.data.length : 0),
    0
  )

  if (totalDataPoints > limits.maxDataPoints) {
    errors.push({
      path: 'params.data',
      message: `Chart exceeds max data points: ${totalDataPoints} > ${limits.maxDataPoints}`,
      code: 'RESOURCE_LIMIT_EXCEEDED',
    })
  }

  // Length mismatch check — only for categorical charts, skip empty datasets
  if (!isPointChart && Array.isArray(params.data.labels)) {
    const expectedLength = params.data.labels.length
    for (const [index, dataset] of params.data.datasets.entries()) {
      if (Array.isArray(dataset.data) && dataset.data.length > 0 && dataset.data.length !== expectedLength) {
        errors.push({
          path: `params.data.datasets[${index}]`,
          message: `Dataset length mismatch: expected ${expectedLength}, got ${dataset.data.length}`,
          code: 'DATA_LENGTH_MISMATCH',
        })
      }
    }
  }

  // Data type validation — numbers for categorical, {x,y} objects for point charts
  for (const [index, dataset] of params.data.datasets.entries()) {
    if (!Array.isArray(dataset.data)) continue
    for (const [dataIndex, value] of dataset.data.entries()) {
      if (isPointChart) {
        const vObj = value as any
        if (typeof value !== 'object' || value === null || vObj.x == null || typeof vObj.y !== 'number') {
          errors.push({
            path: `params.data.datasets[${index}].data[${dataIndex}]`,
            message: `Invalid point data: expected {x, y} object`,
            code: 'INVALID_POINT_DATA',
          })
        }
      } else {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push({
            path: `params.data.datasets[${index}].data[${dataIndex}]`,
            message: `Invalid data value: ${value} (must be finite number)`,
            code: 'INVALID_DATA_TYPE',
          })
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate table component against resource limits
 */
export function validateTableComponent(
  params: TableComponentParams,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): ValidationResult {
  const errors: ValidationResult['errors'] = []

  // Validate row count
  if (params.rows.length > limits.maxTableRows) {
    errors.push({
      path: 'params.rows',
      message: `Table exceeds max rows: ${params.rows.length} > ${limits.maxTableRows}`,
      code: 'RESOURCE_LIMIT_EXCEEDED',
    })
  }

  // Validate columns
  if (params.columns.length === 0) {
    errors.push({
      path: 'params.columns',
      message: 'Table must have at least one column',
      code: 'EMPTY_COLUMNS',
    })
  }

  // Validate column keys are unique
  const columnKeys = new Set<string>()
  for (const [index, column] of params.columns.entries()) {
    if (columnKeys.has(column.key)) {
      errors.push({
        path: `params.columns[${index}]`,
        message: `Duplicate column key: ${column.key}`,
        code: 'DUPLICATE_COLUMN_KEY',
      })
    }
    columnKeys.add(column.key)
  }

  // Validate rows have valid data for defined columns
  for (const [rowIndex, row] of params.rows.entries()) {
    for (const column of params.columns) {
      if (!(column.key in row)) {
        errors.push({
          path: `params.rows[${rowIndex}]`,
          message: `Missing column key: ${column.key}`,
          code: 'MISSING_COLUMN_DATA',
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate payload size
 */
export function validatePayloadSize(
  component: UIComponent,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): ValidationResult {
  const payloadSize = JSON.stringify(component).length

  if (payloadSize > limits.maxPayloadSize) {
    return {
      valid: false,
      errors: [
        {
          path: 'component',
          message: `Payload size exceeds limit: ${payloadSize} > ${limits.maxPayloadSize} bytes`,
          code: 'PAYLOAD_TOO_LARGE',
        },
      ],
    }
  }

  return { valid: true }
}

/**
 * Sanitize string to prevent XSS
 * Basic implementation - DOMPurify used at render time
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
}

/**
 * Validate iframe domain against whitelist
 *
 * @param url - The URL to validate
 * @param options - Optional validation options
 * @param options.policy - 'strict' (default), 'extend', or 'allow-all'
 * @param options.customDomains - Additional domains when policy is 'extend'
 */
export function validateIframeDomain(
  url: string,
  options?: { policy?: IframePolicy; customDomains?: string[] }
): ValidationResult {
  // If allow-all, skip validation
  if (options?.policy === 'allow-all') {
    return { valid: true }
  }

  try {
    const parsedUrl = new URL(url)
    const domain = parsedUrl.hostname

    // Build effective whitelist
    let effectiveWhitelist = DEFAULT_IFRAME_DOMAINS
    if (options?.policy === 'extend' && options.customDomains) {
      effectiveWhitelist = [...DEFAULT_IFRAME_DOMAINS, ...options.customDomains]
    }

    const isAllowed = effectiveWhitelist.some(
      (allowed) => domain === allowed || domain.endsWith(`.${allowed}`) || allowed === 'localhost'
    )

    if (!isAllowed) {
      return {
        valid: false,
        errors: [
          {
            path: 'url',
            message: `Domain not whitelisted: ${domain}`,
            code: 'DOMAIN_NOT_WHITELISTED',
          },
        ],
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: 'url',
          message: 'Invalid URL format',
          code: 'INVALID_URL',
        },
      ],
    }
  }
}

/**
 * Get the appropriate sandbox attribute for an iframe URL.
 *
 * Trusted domains (Google, Deposium, payment, auth-requiring services) get
 * `allow-same-origin` so they can access their own cookies/storage.
 * All other whitelisted domains get a restrictive sandbox without it,
 * preventing access to the parent page's localStorage/cookies.
 *
 * @param url - The iframe URL
 * @param options - Optional custom trusted domains
 * @returns sandbox attribute string
 */
export function getIframeSandbox(
  url: string,
  options?: { customTrustedDomains?: string[] }
): string {
  const baseSandbox = 'allow-scripts allow-popups'

  try {
    const domain = new URL(url).hostname
    let trustedList = TRUSTED_IFRAME_DOMAINS
    if (options?.customTrustedDomains) {
      trustedList = [...TRUSTED_IFRAME_DOMAINS, ...options.customTrustedDomains]
    }

    const isTrusted = trustedList.some(
      (trusted) => domain === trusted || domain.endsWith(`.${trusted}`)
    )

    if (isTrusted) {
      return `${baseSandbox} allow-same-origin allow-forms`
    }
  } catch {
    // Invalid URL — use restrictive sandbox
  }

  return baseSandbox
}

/**
 * Validate entire component
 *
 * @param component - The component to validate
 * @param options - Optional validation options (limits, iframePolicy, customIframeDomains)
 */
export function validateComponent(
  component: UIComponent,
  options?: ValidationOptions
): ValidationResult {
  const limits = options?.limits ?? DEFAULT_RESOURCE_LIMITS
  const errors: ValidationResult['errors'] = []

  // Guard: params must exist
  if (!component.params) {
    return { valid: false, errors: [{ path: 'params', message: 'Missing component params', code: 'MISSING_PARAMS' }] }
  }

  // Validate grid position
  const gridResult = validateGridPosition(component.position)
  if (!gridResult.valid) {
    errors.push(...(gridResult.errors || []))
  }

  // Validate payload size
  const sizeResult = validatePayloadSize(component, limits)
  if (!sizeResult.valid) {
    errors.push(...(sizeResult.errors || []))
  }

  // Type-specific validation
  switch (component.type) {
    case 'chart': {
      const chartResult = validateChartComponent(component.params as ChartComponentParams, limits)
      if (!chartResult.valid) {
        errors.push(...(chartResult.errors || []))
      }
      break
    }

    case 'table': {
      const tableResult = validateTableComponent(component.params as TableComponentParams, limits)
      if (!tableResult.valid) {
        errors.push(...(tableResult.errors || []))
      }
      break
    }

    case 'metric': {
      // Basic validation for metrics
      const metricParams = component.params as any
      if (!metricParams.title || !metricParams.value) {
        errors.push({
          path: 'params',
          message: 'Metric must have title and value',
          code: 'INVALID_METRIC',
        })
      }
      break
    }

    case 'text': {
      // Basic validation for text
      const textParams = component.params as any
      if (!textParams.content) {
        errors.push({
          path: 'params',
          message: 'Text component must have content',
          code: 'INVALID_TEXT',
        })
      }
      break
    }

    case 'iframe': {
      // Basic validation for iframe
      const iframeParams = component.params as any
      if (!iframeParams.url) {
        errors.push({
          path: 'params',
          message: 'Iframe component must have url',
          code: 'INVALID_IFRAME',
        })
      } else {
        // Validate iframe domain against whitelist
        const iframeResult = validateIframeDomain(iframeParams.url, {
          policy: options?.iframePolicy,
          customDomains: options?.customIframeDomains,
        })
        if (!iframeResult.valid) {
          errors.push(...(iframeResult.errors || []))
        }
      }
      break
    }

    case 'image': {
      // Basic validation for image
      const imageParams = component.params as any
      if (!imageParams.url) {
        errors.push({
          path: 'params',
          message: 'Image component must have url',
          code: 'INVALID_IMAGE',
        })
      }
      break
    }

    case 'link': {
      // Basic validation for link
      const linkParams = component.params as any
      if (!linkParams.url) {
        errors.push({
          path: 'params',
          message: 'Link component must have url',
          code: 'INVALID_LINK',
        })
      }
      break
    }

    case 'action': {
      // Basic validation for action
      const actionParams = component.params as any
      if (!actionParams.label) {
        errors.push({
          path: 'params',
          message: 'Action component must have label',
          code: 'INVALID_ACTION',
        })
      }
      break
    }

    case 'video': {
      const videoParams = component.params as any
      if (!videoParams.url) {
        errors.push({ path: 'params', message: 'Video component must have url', code: 'INVALID_VIDEO' })
      } else {
        // Reuse iframe domain validation for video URLs
        const videoResult = validateIframeDomain(videoParams.url, {
          policy: options?.iframePolicy,
          customDomains: options?.customIframeDomains,
        })
        if (!videoResult.valid) {
          errors.push(...(videoResult.errors || []))
        }
      }
      break
    }

    case 'carousel': {
      const carouselParams = component.params as any
      if (!Array.isArray(carouselParams.items) || carouselParams.items.length === 0) {
        errors.push({ path: 'params.items', message: 'Carousel must have non-empty items array', code: 'EMPTY_CAROUSEL' })
      }
      break
    }

    case 'image-gallery': {
      const galleryParams = component.params as any
      if (!Array.isArray(galleryParams.images) || galleryParams.images.length === 0) {
        errors.push({ path: 'params.images', message: 'Gallery must have non-empty images array', code: 'EMPTY_GALLERY' })
      }
      break
    }

    case 'form': {
      const formParams = component.params as any
      if (!Array.isArray(formParams.fields) || formParams.fields.length === 0) {
        errors.push({ path: 'params.fields', message: 'Form must have non-empty fields array', code: 'EMPTY_FORM' })
      }
      break
    }

    case 'action-group': {
      const agParams = component.params as any
      if (!Array.isArray(agParams.actions) || agParams.actions.length === 0) {
        errors.push({ path: 'params.actions', message: 'Action group must have non-empty actions array', code: 'EMPTY_ACTION_GROUP' })
      }
      break
    }

    case 'code': {
      const codeParams = component.params as any
      if (!codeParams.code) {
        errors.push({ path: 'params.code', message: 'Code component must have code content', code: 'INVALID_CODE' })
      }
      break
    }

    case 'map': {
      // Map can auto-detect center from markers, so center is not strictly required
      const mapParams = component.params as any
      if (!mapParams.center && (!Array.isArray(mapParams.markers) || mapParams.markers.length === 0)) {
        errors.push({ path: 'params', message: 'Map must have center or markers', code: 'INVALID_MAP' })
      }
      break
    }

    case 'modal': {
      // Modal is valid with minimal params (title optional, content can be children)
      break
    }

    case 'artifact': {
      const artifactParams = component.params as any
      if (!artifactParams.content) {
        errors.push({ path: 'params.content', message: 'Artifact must have content', code: 'INVALID_ARTIFACT' })
      }
      break
    }

    default:
      // Known types without specific validation pass through — renderer handles errors
      // Truly unknown types (e.g. typos in streamed JSON) are rejected
      if (!KNOWN_COMPONENT_TYPES.has(component.type)) {
        errors.push({
          path: 'type',
          message: `Unknown component type: ${component.type}`,
          code: 'UNKNOWN_COMPONENT_TYPE',
        })
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate entire layout
 *
 * @param layout - The layout to validate
 * @param options - Optional validation options (limits, iframePolicy, customIframeDomains)
 */
export function validateLayout(
  layout: UILayout,
  options?: ValidationOptions
): ValidationResult {
  const errors: ValidationResult['errors'] = []

  // Validate component count
  if (layout.components.length === 0) {
    errors.push({
      path: 'components',
      message: 'Layout must have at least one component',
      code: 'EMPTY_LAYOUT',
    })
  }

  if (layout.components.length > 12) {
    errors.push({
      path: 'components',
      message: `Layout exceeds max components: ${layout.components.length} > 12`,
      code: 'TOO_MANY_COMPONENTS',
    })
  }

  // Validate each component
  for (const [index, component] of layout.components.entries()) {
    const result = validateComponent(component, options)
    if (!result.valid) {
      errors.push(
        ...(result.errors?.map((error) => ({
          ...error,
          path: `components[${index}].${error.path}`,
        })) || [])
      )
    }
  }

  // Validate grid configuration
  if (layout.grid.columns !== 12) {
    errors.push({
      path: 'grid.columns',
      message: 'Grid must have 12 columns (Bootstrap-like)',
      code: 'INVALID_GRID_COLUMNS',
    })
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate a single form field value against field rules
 */
export function validateFieldValue(
  value: any,
  field: FormFieldParams
): { valid: boolean; error?: string } {
  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `${field.label || field.name} is required` }
    }
    if (field.type === 'checkbox' && value !== true) {
      return { valid: false, error: `${field.label || field.name} must be checked` }
    }
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === '') {
    return { valid: true }
  }

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'password':
      if (field.minLength && String(value).length < field.minLength) {
        return { valid: false, error: `Minimum ${field.minLength} characters required` }
      }
      if (field.maxLength && String(value).length > field.maxLength) {
        return { valid: false, error: `Maximum ${field.maxLength} characters allowed` }
      }
      if (field.pattern && !new RegExp(field.pattern).test(String(value))) {
        return { valid: false, error: 'Invalid format' }
      }
      break

    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        return { valid: false, error: 'Invalid email address' }
      }
      break

    case 'number': {
      const numValue = Number(value)
      if (isNaN(numValue)) {
        return { valid: false, error: 'Must be a valid number' }
      }
      if (field.min !== undefined && numValue < field.min) {
        return { valid: false, error: `Minimum value is ${field.min}` }
      }
      if (field.max !== undefined && numValue > field.max) {
        return { valid: false, error: `Maximum value is ${field.max}` }
      }
      break
    }

    case 'date':
      if (field.minDate && value < field.minDate) {
        return { valid: false, error: `Date must be after ${field.minDate}` }
      }
      if (field.maxDate && value > field.maxDate) {
        return { valid: false, error: `Date must be before ${field.maxDate}` }
      }
      break

    case 'select':
    case 'radio':
      // Validate that value is one of the options
      if (field.options && field.options.length > 0) {
        const validValues = field.options.map((opt) => opt.value)
        if (!validValues.includes(String(value))) {
          return { valid: false, error: 'Please select a valid option' }
        }
      }
      break
  }

  // valueFormat validation (v4.3.0) — runs after type-specific checks
  if (field.valueFormat && value !== undefined && value !== null && value !== '') {
    const vals = Array.isArray(value) ? value : [String(value)]
    for (const v of vals) {
      if (!new RegExp(field.valueFormat).test(v)) {
        return { valid: false, error: field.valueFormatHint || `Invalid format (expected: ${field.valueFormat})` }
      }
    }
  }

  return { valid: true }
}

/**
 * Validate entire form data against field definitions
 */
export function validateFormData(
  data: Record<string, any>,
  fields: FormFieldParams[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const result = validateFieldValue(data[field.name], field)
    if (!result.valid && result.error) {
      errors[field.name] = result.error
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
