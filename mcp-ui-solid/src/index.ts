/**
 * @mcp-ui/solid
 *
 * SolidJS components and hooks for rendering MCP-generated UI resources
 *
 * @example
 * ```tsx
 * import { UIResourceRenderer, StreamingUIRenderer } from '@mcp-ui/solid'
 * import { useStreamingUI } from '@mcp-ui/solid/hooks'
 * import type { UIComponent, UILayout } from '@mcp-ui/solid/types'
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
export { useStreamingUI } from './hooks'

export type {
  UseStreamingUIOptions,
  StreamingUIState,
  StreamProgress,
  StreamError,
  CompleteMetadata,
} from './hooks'

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
} from './types'

// Services
export {
  validateComponent,
  validateLayout,
  DEFAULT_RESOURCE_LIMITS,
  ComponentRegistry,
} from './services'
