/**
 * MCP UI Solid - Hooks
 *
 * SolidJS hooks for managing UI resource state and streaming
 */

export { useStreamingUI } from './useStreamingUI'
export type {
  UseStreamingUIOptions,
  StreamingUIState,
  StreamProgress,
  StreamError,
  CompleteMetadata,
} from './useStreamingUI'

// Action hooks (Phase 5.0)
export { useAction, useToolAction } from './useAction'
export type { UseActionReturn, ActionRequest, ActionResult } from './useAction'
