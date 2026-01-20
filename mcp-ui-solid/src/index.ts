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
export {
  useStreamingUI,
  useAction,
  useToolAction,
  useConditionalField,
  evaluateCondition,
  useModal,
  useConfirmModal,
  useFormPersistence,
} from './hooks'

export type {
  UseStreamingUIOptions,
  StreamingUIState,
  StreamProgress,
  StreamError,
  CompleteMetadata,
  UseActionReturn,
  UseActionOptions,
  UseToolActionReturn,
  UseConditionalFieldOptions,
  UseModalReturn,
  UseConfirmModalReturn,
  UseFormPersistenceOptions,
  UseFormPersistenceReturn,
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
  // Form types (Sprint 1)
  FormFieldOption,
  FormFieldType,
  FormFieldParams,
  FormComponentParams,
  // Conditional field types (Sprint 2)
  ShowWhenOperator,
  ShowWhenCondition,
  // Action lifecycle types (Sprint 2)
  ActionRequestBase,
  ActionResultBase,
  ActionLifecycleCallbacks,
  // Modal types (Sprint 3)
  ModalSize,
  ModalComponentParams,
  // Action group types (Sprint 3)
  ActionGroupLayout,
  ActionGroupGap,
  ActionGroupParams,
  // Media types (Sprint 5)
  GalleryImage,
  ImageGalleryParams,
  VideoComponentParams,
  // Code & Maps types (Sprint 6)
  CodeComponentParams,
  MapMarker,
  MapComponentParams,
  // Validation options (v2.0.0)
  IframePolicy,
  ValidationOptions,
} from './types'

// Services
export {
  validateComponent,
  validateLayout,
  validateIframeDomain,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_IFRAME_DOMAINS,
  ComponentRegistry,
} from './services'
