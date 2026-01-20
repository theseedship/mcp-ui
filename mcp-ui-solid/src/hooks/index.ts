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

// Action hooks (Phase 5.0 + Sprint 2)
export { useAction, useToolAction } from './useAction'
export type {
  UseActionReturn,
  UseActionOptions,
  UseToolActionReturn,
  ActionRequest,
  ActionResult,
} from './useAction'

// Conditional field hooks (Sprint 2)
export { useConditionalField, evaluateCondition } from './useConditionalField'
export type { UseConditionalFieldOptions } from './useConditionalField'

// Modal hooks (Sprint 3)
export { useModal, useConfirmModal } from './useModal'
export type { UseModalReturn, UseConfirmModalReturn } from './useModal'

// Form persistence hooks (Sprint 4)
export { useFormPersistence } from './useFormPersistence'
export type { UseFormPersistenceOptions, UseFormPersistenceReturn } from './useFormPersistence'
