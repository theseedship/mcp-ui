/**
 * SSR-safe validation exports
 *
 * This file ONLY exports validation functions and types,
 * WITHOUT loading any UI components that contain client-only APIs.
 *
 * Use this for server-side validation:
 * ```typescript
 * import { validateLayout } from '@seed-ship/mcp-ui-solid/validation'
 * ```
 */

// Re-export validation functions (no component dependencies)
export {
  validateComponent,
  validateLayout,
  validateGridPosition,
  validateChartComponent,
  validateTableComponent,
  validatePayloadSize,
  validateIframeDomain,
  sanitizeString,
  DEFAULT_RESOURCE_LIMITS,
} from './dist/services/validation.js'

// Re-export types only (no runtime code)
export type {
  UIComponent,
  UILayout,
  GridPosition,
  ComponentType,
  ChartComponentParams,
  TableComponentParams,
  MetricComponentParams,
  TextComponentParams,
  ValidationResult,
  ResourceLimits,
} from './dist/types/index.js'
