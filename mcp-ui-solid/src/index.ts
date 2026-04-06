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

// Drag-Drop Components
export { DraggableGridItem } from './components/DraggableGridItem'
export { ResizeHandle } from './components/ResizeHandle'
export { EditableUIResourceRenderer } from './components/EditableUIResourceRenderer'
export { ExpandableWrapper } from './components/ExpandableWrapper'
export { ComponentToolbar } from './components/ComponentToolbar'

// Chat Bus (v2.4.0 — @experimental)
export { ChatBusProvider, useChatBus } from './hooks/useChatBus'
export { ChatPrompt } from './components/ChatPrompt'
export { ScratchpadPanel } from './components/ScratchpadPanel'
export { dispatchScratchpad, useScratchpadState } from './stores/scratchpad-store'

// Autocomplete Components
export { GhostText, GhostTextInput } from './components/GhostText'
export { AutocompleteDropdown } from './components/AutocompleteDropdown'
export { AutocompleteFormField } from './components/AutocompleteFormField'

export type {
  UIResourceRendererProps,
  StreamingUIRendererProps,
  GenerativeUIErrorBoundaryProps,
} from './components'

export type { DraggableGridItemProps } from './components/DraggableGridItem'
export type { ResizeHandleProps as ResizeHandleComponentProps } from './components/ResizeHandle'
export type { EditableUIResourceRendererProps } from './components/EditableUIResourceRenderer'
export type { ExpandableWrapperProps } from './components/ExpandableWrapper'
export type { ComponentToolbarProps, ToolbarAction, ToolbarIcon } from './components/ComponentToolbar'
export type { ChatPromptProps } from './components/ChatPrompt'
export type { ScratchpadPanelProps } from './components/ScratchpadPanel'
export type { GhostTextProps, GhostTextInputProps } from './components/GhostText'
export type { AutocompleteDropdownProps } from './components/AutocompleteDropdown'
export type { AutocompleteFormFieldProps, AutocompleteFormFieldParams } from './components/AutocompleteFormField'

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
  // Drag-Drop hooks
  useDragDrop,
  useResize,
  // Autocomplete hooks
  useAutocomplete,
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
  // Drag-Drop types
  UseDragDropOptions,
  UseDragDropReturn,
  DragProps,
  UseResizeOptions,
  UseResizeReturn,
  ResizeEdge,
  // Autocomplete types
  UseAutocompleteOptions,
  UseAutocompleteReturn,
} from './hooks'

// Context (Phase 5.0)
export { MCPActionProvider, MCPActionContext, useMCPAction, useMCPActionSafe } from './context'
// Autocomplete Context
export {
  AutocompleteProvider,
  useAutocompleteContext,
  useAutocompleteContextSafe,
} from './context/AutocompleteContext'

export type {
  MCPActionContextValue,
  MCPActionProviderProps,
  ActionRequest,
  ActionResult,
} from './context'

export type {
  AutocompleteContextValue,
  AutocompleteProviderProps,
} from './context/AutocompleteContext'

// Plugins (Sprint Autocomplete)
// Note: DuckDB plugin is exported separately due to WASM dependencies
export {
  createGroqPlugin,
  createSupabasePlugin,
  createRestPlugin,
} from './plugins'

// DuckDB plugin is available via direct import:
// import { createDuckDBPlugin, preloadDuckDB } from '@seed-ship/mcp-ui-solid/plugins/duckdb'

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
  // Drag-Drop types (Sprint Drag-Drop)
  ResizeConstraints,
  DragDropConfig,
  DragEventData,
  DraggableGridItemProps as DraggableGridItemPropsType,
  // Autocomplete types (Sprint Autocomplete)
  AutocompleteResultType,
  AutocompleteOption,
  AutocompleteResult,
  AutocompleteContext,
  AutocompletePlugin,
  GroqPluginConfig,
  SupabasePluginConfig,
  DuckDBPluginConfig,
  RestPluginConfig,
  FieldAutocompleteConfig,
  AutocompleteProviderConfig,
} from './types'

// Services
export {
  validateComponent,
  validateLayout,
  validateIframeDomain,
  getIframeSandbox,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_IFRAME_DOMAINS,
  TRUSTED_IFRAME_DOMAINS,
  ComponentRegistry,
  createEventEmitter,
  createCommandHandler,
  createChatBus,
  mergeScratchpadSections,
} from './services'

// Chat Bus Types (v2.4.0 — @experimental)
export type {
  ChatEventBase,
  ChatEvents,
  ChatCommands,
  ChatBus,
  ChatEventEmitter,
  ChatCommandHandler,
  EventSubscribeOptions,
  ChatPromptConfig,
  ChatPromptResponse,
  ChoicePromptConfig,
  ConfirmPromptConfig,
  FormPromptConfig,
  SelectPromptConfig,
  SuggestionItem,
  AgentContext,
  BriefingEvent,
  BriefingSection,
  ScratchpadState,
  ScratchpadSection,
  ScratchpadEvent,
  StreamDoneMetadata,
  ChatError,
  Citation,
  ToolCallEvent,
  ClarificationEvent,
} from './types/chat-bus'
