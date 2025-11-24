/**
 * Types-Only Export
 *
 * This file re-exports ALL type definitions WITHOUT any runtime code.
 * Use this for SSR-safe type imports that won't load components.
 *
 * Usage:
 * ```typescript
 * import type { UILayout, RendererError } from '@seed-ship/mcp-ui-solid/types'
 * ```
 */

export type {
  ComponentType,
  ChartType,
  GridPosition,
  ResourceLimits,
  ChartComponentParams,
  TableComponentParams,
  MetricComponentParams,
  TextComponentParams,
  ActionComponentParams,
  UIComponent,
  UILayout,
  ComponentRegistryEntry,
  ValidationResult,
  RendererErrorType,
  RendererError,
  StreamEventType,
  StreamEvent,
} from './types/index'
