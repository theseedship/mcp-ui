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
} from '../types'

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
 * Allowed iframe domains (whitelist)
 * Must match CSP frame-src directive
 */
const ALLOWED_IFRAME_DOMAINS = [
  'quickchart.io',
  'www.quickchart.io',
  'deposium.com',
  'deposium.vip',
  'localhost',
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

  // Validate data points count
  const totalDataPoints = params.data.datasets.reduce(
    (sum, dataset) => sum + dataset.data.length,
    0
  )

  if (totalDataPoints > limits.maxDataPoints) {
    errors.push({
      path: 'params.data',
      message: `Chart exceeds max data points: ${totalDataPoints} > ${limits.maxDataPoints}`,
      code: 'RESOURCE_LIMIT_EXCEEDED',
    })
  }

  // Validate labels match dataset length
  const expectedLength = params.data.labels.length
  for (const [index, dataset] of params.data.datasets.entries()) {
    if (dataset.data.length !== expectedLength) {
      errors.push({
        path: `params.data.datasets[${index}]`,
        message: `Dataset length mismatch: expected ${expectedLength}, got ${dataset.data.length}`,
        code: 'DATA_LENGTH_MISMATCH',
      })
    }
  }

  // Validate numeric data
  for (const [index, dataset] of params.data.datasets.entries()) {
    for (const [dataIndex, value] of dataset.data.entries()) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push({
          path: `params.data.datasets[${index}].data[${dataIndex}]`,
          message: `Invalid data value: ${value} (must be finite number)`,
          code: 'INVALID_DATA_TYPE',
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
 */
export function validateIframeDomain(url: string): ValidationResult {
  try {
    const parsedUrl = new URL(url)
    const domain = parsedUrl.hostname

    const isAllowed = ALLOWED_IFRAME_DOMAINS.some(
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
 * Validate entire component
 */
export function validateComponent(
  component: UIComponent,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): ValidationResult {
  const errors: ValidationResult['errors'] = []

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
    case 'chart':
      const chartResult = validateChartComponent(component.params as ChartComponentParams, limits)
      if (!chartResult.valid) {
        errors.push(...(chartResult.errors || []))
      }
      break

    case 'table':
      const tableResult = validateTableComponent(component.params as TableComponentParams, limits)
      if (!tableResult.valid) {
        errors.push(...(tableResult.errors || []))
      }
      break

    case 'metric':
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

    case 'text':
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

    case 'iframe':
      // Basic validation for iframe
      const iframeParams = component.params as any
      if (!iframeParams.url) {
        errors.push({
          path: 'params',
          message: 'Iframe component must have url',
          code: 'INVALID_IFRAME',
        })
      }
      break

    case 'image':
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

    case 'link':
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

    case 'action':
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

    default:
      errors.push({
        path: 'type',
        message: `Unknown component type: ${component.type}`,
        code: 'UNKNOWN_COMPONENT_TYPE',
      })
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate entire layout
 */
export function validateLayout(
  layout: UILayout,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
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
    const result = validateComponent(component, limits)
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
