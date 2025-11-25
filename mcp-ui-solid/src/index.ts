/**
 * @seed-ship/mcp-ui-solid
 *
 * SolidJS components and hooks for rendering MCP-generated UI resources
 *
 * @example
 * ```tsx
 * import { UIResourceRenderer, StreamingUIRenderer } from '@seed-ship/mcp-ui-solid'
 * import { useStreamingUI } from '@seed-ship/mcp-ui-solid/hooks'
 * import type { UIComponent, UILayout } from '@seed-ship/mcp-ui-solid/types'
 *
 * // Static rendering
 * function Dashboard() {
 *   const layout = { components: [...] }
 *   return <UIResourceRenderer content={layout} />
 * }
 *
 * // Streaming rendering
 * function StreamingDashboard() {
 *   return (
 *     <StreamingUIRenderer
 *       query="Show me revenue trends"
 *       spaceIds={['space-1']}
 *       onComplete={(metadata) => console.log('Done!', metadata)}
 *     />
 *   )
 * }
 * ```
 */

// Components
export { UIResourceRenderer, StreamingUIRenderer, GenerativeUIErrorBoundary } from './components'

export type {
  UIResourceRendererProps,
  StreamingUIRendererProps,
  GenerativeUIErrorBoundaryProps,
} from './components'

// Hooks
export { useStreamingUI, useAction, useToolAction } from './hooks'

export type {
  UseStreamingUIOptions,
  StreamingUIState,
  StreamProgress,
  StreamError,
  CompleteMetadata,
  UseActionReturn,
} from './hooks'

// Context (Phase 5.0)
export { MCPActionProvider, MCPActionContext, useMCPAction, useMCPActionSafe } from './context'

export type {
  MCPActionContextValue,
  MCPActionProviderProps,
  ActionRequest,
  ActionResult,
} from './context'

// Types
export type {
  UIComponent,
  UILayout,
  GridPosition,
  ComponentType,
  RendererError,
  ChartComponentParams,
  TableComponentParams,
  MetricComponentParams,
  TextComponentParams,
  ActionComponentParams,
  GridComponentParams,
} from './types'

// Services
export {
  validateComponent,
  validateLayout,
  DEFAULT_RESOURCE_LIMITS,
  ComponentRegistry,
} from './services'
