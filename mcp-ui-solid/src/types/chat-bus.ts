/**
 * Chat Bus — Type Definitions
 * v2.4.0: Event-driven chat toolkit for agent interactions
 *
 * @experimental — These types may change without major bump until stabilized in v2.5.0.
 * See CHANGELOG for breaking changes on experimental types.
 */

import type { UIComponent, UILayout } from './index'

// ─── Event Base ──────────────────────────────────────────────

/**
 * @experimental
 * Base for all chat events — identifies the source stream (C2).
 * Enables multi-stream support (Deposium supports 3 concurrent streams).
 */
export interface ChatEventBase {
  /** Unique key identifying the active stream */
  streamKey: string
  /** Conversation ID (if available) */
  conversationId?: string
  /** Space/context ID */
  spaceId?: string
  /** Correlation ID linking a sendPrompt command to its resulting stream (C6) */
  correlationId?: string
}

// ─── Chat Events (read — from chat to agents) ───────────────

/**
 * @experimental
 * Events emitted by the chat. The host app connects its SSE stream
 * to these callbacks. Agents consume events to react.
 *
 * `onToken` is a hot path (C3) — subscribe with throttle option.
 * Most agents only need `onStreamEnd`.
 */
export interface ChatEvents {
  // --- Streaming ---
  onToken: (event: ChatEventBase & { token: string }) => void
  onStreamStart: (event: ChatEventBase) => void
  onStreamEnd: (event: ChatEventBase & { metadata: StreamDoneMetadata }) => void
  onError: (event: ChatEventBase & { error: ChatError }) => void

  // --- Structured content ---
  onUILayout: (event: ChatEventBase & { layout: UILayout }) => void
  onCitation: (event: ChatEventBase & { citation: Citation }) => void
  onToolCall: (event: ChatEventBase & { tool: ToolCallEvent }) => void
  onSuggestions: (event: ChatEventBase & { items: string[] }) => void

  // --- Interactions ---
  onChatPromptResponse: (event: ChatEventBase & { response: ChatPromptResponse }) => void
  onClarificationNeeded: (event: ChatEventBase & { clarification: ClarificationEvent }) => void

  // --- Agentic (handled by app, not MCP-UI) ---
  onAgentSwitch: (event: ChatEventBase & { agent: AgentContext }) => void
  onBriefing: (event: ChatEventBase & { briefing: BriefingEvent }) => void
  onCapabilityChange: (event: ChatEventBase & { capabilities: string[] }) => void

  // --- Fallback ---
  onCustomEvent: (type: string, event: ChatEventBase & { data: unknown }) => void
}

/**
 * @experimental
 * Subscription options for event listeners (C3).
 */
export interface EventSubscribeOptions {
  /** Throttle in ms — recommended 100ms for onToken */
  throttle?: number
  /** Filter events by streamKey */
  streamKey?: string
}

// ─── Chat Commands (write — from agents to chat) ────────────

/**
 * @experimental
 * Commands that agents send to the chat. The host app implements
 * these commands on its UI (maps to existing signals).
 */
export interface ChatCommands {
  // --- Prompt injection ---
  /** Fill the input field without sending */
  injectPrompt: (text: string) => void
  /** Fill the input and send immediately. Returns correlationId (C6). */
  sendPrompt: (text: string, metadata?: Record<string, unknown>) => string
  /** Append text to the current input value */
  appendPrompt: (text: string) => void

  // --- Structured interactions ---
  /** Show a ChatPrompt (choice, confirm, form) above the input (C4) */
  showChatPrompt: (config: ChatPromptConfig, signal?: AbortSignal) => Promise<ChatPromptResponse>
  /** Dismiss the active ChatPrompt */
  dismissChatPrompt: () => void
  /** Show suggestion chips */
  showSuggestions: (items: SuggestionItem[]) => void

  // --- Configuration ---
  /** Toggle a connector on/off */
  toggleConnector: (connectorId: string, enabled: boolean) => void
  /** Change the chat mode */
  setMode: (mode: string) => void

  // --- UI ---
  /** Scroll to a specific message */
  scrollToMessage: (messageId: string) => void
  /** Show a notification in the chat context */
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

// ─── Chat Bus ────────────────────────────────────────────────

/**
 * @experimental
 * The combined events + commands bus.
 */
export interface ChatBus {
  events: ChatEventEmitter
  commands: ChatCommandHandler
}

/**
 * @experimental
 * Typed event emitter for ChatEvents.
 */
export interface ChatEventEmitter {
  /** Subscribe to an event */
  on<K extends keyof ChatEvents>(
    event: K,
    handler: ChatEvents[K],
    options?: EventSubscribeOptions
  ): () => void  // returns unsubscribe function

  /** Emit an event to all subscribers */
  emit<K extends keyof ChatEvents>(
    event: K,
    ...args: Parameters<ChatEvents[K]>
  ): void

  /** Remove all listeners (cleanup) */
  clear(): void
}

/**
 * @experimental
 * Typed command handler for ChatCommands.
 */
export interface ChatCommandHandler {
  /** Register a command handler (app-side) */
  handle<K extends keyof ChatCommands>(
    command: K,
    handler: ChatCommands[K]
  ): void

  /** Execute a command (agent-side) */
  exec<K extends keyof ChatCommands>(
    command: K,
    ...args: Parameters<ChatCommands[K]>
  ): ReturnType<ChatCommands[K]>
}

// ─── ChatPrompt ──────────────────────────────────────────────

/**
 * @experimental
 * Configuration for a ChatPrompt interaction.
 */
export interface ChatPromptConfig {
  /** Prompt type */
  type: 'choice' | 'confirm' | 'form' | 'select'
  /** Title / question displayed */
  title: string
  /** Type-specific configuration */
  config: ChoicePromptConfig | ConfirmPromptConfig | FormPromptConfig | SelectPromptConfig
}

export interface ChoicePromptConfig {
  options: Array<{
    value: string
    label: string
    icon?: string
    description?: string
  }>
  layout?: 'horizontal' | 'vertical' | 'grid'
}

export interface ConfirmPromptConfig {
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

export interface FormPromptConfig {
  fields: Array<{
    name: string
    label: string
    type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'email' | 'autocomplete'
    required?: boolean
    placeholder?: string
    options?: Array<{ label: string; value: string }>
    /** Enable multi-select (returns array) */
    multiple?: boolean
    /** Autocomplete: API URL */
    apiUrl?: string
    /** Autocomplete: query param name */
    searchParam?: string
    /** Autocomplete: field in response for display */
    labelField?: string
    /** Autocomplete: field in response for value */
    valueField?: string
    /** Autocomplete: extra query params */
    extraParams?: Record<string, string>
    /** Autocomplete: min chars before trigger (default: 2) */
    minChars?: number
    /** Autocomplete: debounce ms (default: 300) */
    debounceMs?: number
    /** Checkbox label text */
    checkboxLabel?: string
    /** Help text below field */
    helpText?: string
  }>
  submitLabel?: string
}

export interface SelectPromptConfig {
  options: Array<{ value: string; label: string; group?: string }>
  placeholder?: string
  searchable?: boolean
}

/**
 * @experimental
 * Structured response from a ChatPrompt.
 */
export interface ChatPromptResponse {
  type: ChatPromptConfig['type']
  /** The selected value or form data */
  value: string | Record<string, unknown>
  /** Human-readable label (for display in chat as user message) */
  label: string
  /** Whether the user dismissed without answering */
  dismissed?: boolean
}

// ─── Suggestion ──────────────────────────────────────────────

export interface SuggestionItem {
  /** Text to inject when clicked */
  text: string
  /** Display label (defaults to text) */
  label?: string
  /** Icon */
  icon?: string
}

// ─── Agentic types ───────────────────────────────────────────

/**
 * @experimental
 * Agent context — who is the active agent?
 */
export interface AgentContext {
  id: string
  name: string
  persona?: string
  avatar?: string
  capabilities?: string[]
  metadata?: Record<string, unknown>
}

/**
 * @experimental
 * Briefing event — update the briefings tab.
 */
export interface BriefingEvent {
  id: string
  action: 'create' | 'update' | 'complete' | 'archive'
  title: string
  sections?: BriefingSection[]
  status?: 'draft' | 'in_progress' | 'complete'
  agent?: string
  components?: UIComponent[]
  /** true = do not persist (tooltip, preview). false/absent = app decides storage. */
  ephemeral?: boolean
}

export interface BriefingSection {
  title: string
  content: string
  components?: UIComponent[]
}

// ─── SSE / Stream types ──────────────────────────────────────

export interface StreamDoneMetadata {
  message_hash?: string
  intent?: string
  model?: string
  tokens?: { input: number; output: number }
  cost_usd?: number
  suggestions?: string[]
  extracted_charts?: unknown[]
  timing_breakdown?: Record<string, number>
  [key: string]: unknown  // forward-compatible
}

export interface ChatError {
  message: string
  code?: string
  recoverable?: boolean
}

export interface Citation {
  page?: number
  document_id?: string
  document_name?: string
  snippet?: string
  score?: number
}

export interface ToolCallEvent {
  tool: string
  status: 'running' | 'completed' | 'failed'
  params?: Record<string, unknown>
  results?: unknown
  duration_ms?: number
}

export interface ClarificationEvent {
  question: string
  options: Array<{
    value: string
    label: string
    file_id?: number
  }>
  original_message?: string
}
