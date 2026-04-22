/**
 * ElicitationForm — schema-driven renderer for MCP `elicitation/create` requests
 *
 * @experimental
 * @since v5.3.0
 *
 * Thin wrapper over `<ChatPrompt>` + `elicitationToPromptConfig()` that
 * accepts a spec-shaped `ElicitationEvent` (MCP 2025-06-18) and exposes a
 * spec-shaped `onAccept(content)` callback whose payload is ready to send
 * back as the `accept` outcome of an `elicitation/create` reply.
 *
 * The mapping (boolean → confirm, single enum ≤4 → choice, else → form) is
 * delegated to the `elicitationToPromptConfig` helper — same rules, same
 * tests. This component owns the inverse mapping : extracting a spec-shaped
 * `Record<string, unknown>` from the `ChatPromptResponse`.
 *
 * ## Outcome semantics (per MCP spec 2025-06-18)
 *
 * | User action                           | Callback fired     | Payload                          |
 * |---------------------------------------|--------------------|----------------------------------|
 * | Submit form / pick choice / confirm   | `onAccept(content)`| `{ [propName]: value, ... }`     |
 * | X icon / Cancel button                | `onCancel()` *or* `onDecline()` if provided | none                |
 *
 * mcp-ui's `<ChatPrompt>` does not natively distinguish "decline" (explicit
 * refusal) from "cancel" (passive close). To surface a decline action,
 * pass `dismissLabel="Decline"` and route the callback via `onDecline`.
 *
 * @example
 * ```tsx
 * bus.events.on('onElicitation', ({ elicitation }) => {
 *   render(() => (
 *     <ElicitationForm
 *       event={elicitation}
 *       onAccept={(content) => sendElicitationReply({ action: 'accept', content })}
 *       onCancel={() => sendElicitationReply({ action: 'cancel' })}
 *     />
 *   ), mountPoint)
 * })
 * ```
 */

import { Component } from 'solid-js'
import { ChatPrompt } from './ChatPrompt'
import { elicitationToPromptConfig } from '../services/chat-bus'
import type {
  ChatPromptResponse,
  ElicitationEvent,
  ElicitationPropertySchema,
} from '../types/chat-bus'

export interface ElicitationFormProps {
  /** MCP `elicitation/create` request payload to render. */
  event: ElicitationEvent
  /**
   * Called when user submits a valid response. `content` is keyed by the
   * elicitation `requestedSchema.properties` names — ready to send back as
   * the `accept` outcome of an `elicitation/create` reply.
   */
  onAccept: (content: Record<string, unknown>) => void
  /** Called when user dismisses (X icon, confirm-cancel button). */
  onCancel?: () => void
  /**
   * Optional explicit decline action. When provided, takes precedence over
   * `onCancel` on dismiss. Pair with `dismissLabel="Decline"` to surface as
   * a decline action in the UI.
   */
  onDecline?: () => void
  /** Label on the dismiss button (default: X icon). */
  dismissLabel?: string
}

/**
 * @experimental
 * Schema-driven renderer for MCP `elicitation/create` requests.
 */
export const ElicitationForm: Component<ElicitationFormProps> = (props) => {
  const config = () => elicitationToPromptConfig(props.event)

  const handleSubmit = (response: ChatPromptResponse): void => {
    if (response.dismissed) {
      ;(props.onDecline ?? props.onCancel)?.()
      return
    }
    props.onAccept(extractContent(response, props.event))
  }

  return <ChatPrompt config={config()} dismissLabel={props.dismissLabel} onSubmit={handleSubmit} />
}

function extractContent(
  response: ChatPromptResponse,
  event: ElicitationEvent
): Record<string, unknown> {
  // Form: response.value is already a Record keyed by property names.
  if (typeof response.value !== 'string') {
    return response.value
  }

  const propEntries = Object.entries(event.requestedSchema.properties)

  // Single-property cases (boolean confirm or single enum choice).
  if (propEntries.length === 1) {
    const [name, schema] = propEntries[0]
    return { [name]: coerceScalar(response.value, schema) }
  }

  // Multi-property string response — shouldn't happen since the helper
  // routes multi-prop schemas to 'form'. Fall back gracefully.
  console.warn(
    '[MCP-UI] ElicitationForm: received string value for multi-property schema. Falling back to _value.'
  )
  return { _value: response.value }
}

function coerceScalar(value: string, schema: ElicitationPropertySchema): unknown {
  // Confirm always emits the literal 'confirmed' on accept (cancel path is
  // trapped earlier by `dismissed: true`). Map to boolean true.
  if (schema.type === 'boolean') return true

  if (schema.type === 'number' || schema.type === 'integer') {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }

  return value
}
