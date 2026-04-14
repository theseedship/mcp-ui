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

  // --- Scratchpad (HITL shared workspace) ---
  onScratchpad: (event: ChatEventBase & { scratchpad: ScratchpadEvent }) => void
  onScratchpadPreview: (event: ChatEventBase & { id: string; preview: ScratchpadState['preview'] }) => void

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
  /**
   * Show a ChatPrompt (choice, confirm, form) above the input (C4).
   *
   * **Known limitation (v4.3.9):** Not re-entrant. If called while another
   * prompt is already active, the previous prompt's Promise will never resolve
   * (memory leak). Host apps must queue prompts or dismiss the previous one
   * manually before showing a new one. Fix planned for v4.4.0 (auto-reject
   * previous prompt or FIFO queue).
   *
   * **AbortSignal limitation (v4.3.9):** The `signal` argument is currently
   * unused — `ChatPrompt` does not listen to aborts. Host apps must wire
   * abort → Promise rejection themselves. Fix planned for v4.4.0.
   */
  showChatPrompt: (config: ChatPromptConfig, signal?: AbortSignal) => Promise<ChatPromptResponse>
  /** Dismiss the active ChatPrompt */
  dismissChatPrompt: () => void
  /** Show suggestion chips */
  showSuggestions: (items: SuggestionItem[]) => void

  // --- Scratchpad ---
  /** Send scratchpad filter/form changes to the agent */
  updateScratchpad: (id: string, update: { filters?: Record<string, string | string[]>; formData?: Record<string, unknown> }) => void

  // --- Configuration ---
  /** Toggle a connector on/off */
  toggleConnector: (connectorId: string, enabled: boolean) => void
  /** Change the chat mode */
  setMode: (mode: string) => void

  // --- Agents (v4.1.0) ---
  /** Trigger an agent from the chat (replaces /macro command) */
  triggerAgent: (agentId: string, params?: Record<string, unknown>) => void

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
  /**
   * Prompt type:
   * - 'choice' → large visual buttons with icon + description (horizontal/vertical/grid layout)
   * - 'confirm' → yes/no dialog with danger variant
   * - 'form' → full form with 18 field types (text, select, autocomplete, conditional, ...)
   *
   * NOTE: 'select' was declared in v4.0 but never implemented — removed in v4.3.9.
   * Use 'form' with a single `{type: 'select'}` field, or 'choice' for large visual picks.
   */
  type: 'choice' | 'confirm' | 'form'
  /** Title / question displayed */
  title: string
  /** Type-specific configuration */
  config: ChoicePromptConfig | ConfirmPromptConfig | FormPromptConfig
}

export interface ChoicePromptConfig {
  options: Array<{
    value: string
    label: string
    icon?: string
    description?: string
    /**
     * Free-form metadata (confidence, source, tags, ...).
     * Opaque to default renderer — use a custom ChoiceBody wrapper to display it.
     * Preserved through showChatPrompt → ChatPromptResponse roundtrip.
     * @since v4.3.9
     */
    metadata?: Record<string, unknown>
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
    /** Dependent field — update options when parent field changes */
    dependsOn?: {
      field: string
      apiUrl: string
      labelField: string
      valueField: string
      extraParams?: Record<string, string>
    }
    /** Conditional visibility (show/hide based on another field value) */
    showWhen?: { field: string; operator: 'equals' | 'not_equals' | 'in'; value: any }
  }>
  submitLabel?: string
  /** Live preview configuration — shows stats as user fills the form */
  preview?: {
    /** API endpoint to call for preview */
    endpoint: string
    /** Debounce delay in ms (default: 500) */
    debounceMs?: number
    /** Fields to include in the preview request */
    fields: string[]
    /** Display format */
    format?: 'text' | 'stats'
  }
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
  /**
   * True when user closed the prompt without explicit answer.
   * - X icon click (any type) → dismissed: true
   * - Cancel button in 'confirm' → dismissed: true
   * - Choice button click → dismissed: undefined (explicit answer)
   * - Form submit → dismissed: undefined (explicit answer)
   * - AbortSignal triggered → Promise rejection (NOT a response).
   *   NOTE: Host app is currently responsible for wiring AbortSignal to
   *   Promise.reject. mcp-ui's ChatPrompt component does NOT listen to
   *   the signal yet (v4.3.9 known limitation, fix planned in v4.4.0).
   */
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

// ─── Scratchpad types ────────────────────────────────────────

/**
 * @experimental
 * Scratchpad state — shared workspace between agent and human.
 * The agent fills sections, the human can edit filters and validate.
 */
export interface ScratchpadState {
  id: string
  title: string
  sections: ScratchpadSection[]
  /** Active filters — human can add/remove */
  filters: Record<string, string | string[]>
  /** Live preview (auto-updated when filters change) */
  preview?: { count: number; rows?: Record<string, unknown>[]; summary: string }
  /** Agent messages (explanations, questions) */
  agentMessages: Array<{ text: string; type: 'info' | 'question' | 'warning' }>
  status: 'loading' | 'ready' | 'waiting_human' | 'processing' | 'complete' | 'error'
  /** Error details when status is 'error' */
  error?: { message: string; code?: string; retryable?: boolean }
  /** Endpoint for auto-refresh preview when filters change */
  previewEndpoint?: string
  /** Debounce delay for preview refresh (ms, default 500) */
  previewDebounce?: number
  /** HTTP method for preview (default POST) */
  previewMethod?: 'GET' | 'POST'
  /** Extra headers for preview fetch */
  previewHeaders?: Record<string, string>
  /** Current turn number (multi-tour) */
  turn?: number
  /** Total expected turns */
  totalTurns?: number
  /** History of completed turns */
  turnHistory?: Array<{
    turn: number
    label: string
    summary: string
    status: 'done' | 'active' | 'pending' | 'skipped'
  }>
}

export interface ScratchpadSection {
  id: string
  title: string
  type: 'data' | 'filter' | 'preview' | 'message' | 'action' | 'steps' | 'form' | 'understanding' | 'feedback' | 'prompt' | 'stepper' | 'error' | 'source_card' | 'diff' | 'verified_text' | 'data_preview' | 'map' | 'chart' | 'agent_card' | 'split_stepper' | 'agent_handoff' | 'briefing_diff'
  content: unknown
  /** Can the human edit this section? */
  editable: boolean
  /** Who filled this section */
  source: 'agent' | 'human' | 'api'
}

/**
 * @experimental
 * SSE event for scratchpad create/update/close.
 */
export interface ScratchpadEvent {
  id: string
  action: 'create' | 'update' | 'close'
  title?: string
  sections?: ScratchpadSection[]
  /** How to merge sections on update (default: 'replace') */
  sectionMode?: 'replace' | 'append' | 'upsert'
  /** If true, scratchpad stays visible during stream (no auto-close on complete) */
  pinned?: boolean
  filters?: Record<string, string | string[]>
  preview?: { count: number; rows?: Record<string, unknown>[]; summary: string }
  agentMessages?: Array<{ text: string; type: 'info' | 'question' | 'warning' }>
  status?: ScratchpadState['status']
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
  /** The question to ask the user */
  question: string
  /** Available options (aligns with ChoicePromptConfig.options shape) */
  options: Array<{
    value: string
    label: string
    /**
     * Free-form metadata (confidence, source, tags, ...).
     * Opaque to mcp-ui — host apps pass it through as-is.
     * @since v4.3.9
     */
    metadata?: Record<string, unknown>
  }>
  /** Original user message that triggered the clarification */
  original_message?: string
  /**
   * Free-form type tag for host routing (e.g. 'intent_disambiguate', 'file_select').
   * Opaque to mcp-ui — hosts use it to decide how to render/route the clarification.
   * @since v4.3.9
   */
  type?: string
}

// ─── Data Validation (v3.1.0 — anti-hallucination) ──────────

/**
 * Result of validating LLM text against source data.
 * Pure regex-based — zero LLM cost, <1ms latency.
 */
export interface DataValidation {
  /** Is the text free of hallucinated numbers? */
  valid: boolean
  /** Numbers found in the LLM text */
  llmNumbers: LLMNumber[]
  /** Numbers present in the source data */
  sourceNumbers: Set<number>
  /** Numbers from the LLM NOT found in the source */
  hallucinated: HallucinatedNumber[]
  /** Confidence score 0-1 (1 = all numbers verified) */
  confidence: number
}

export interface LLMNumber {
  value: number
  /** Character index in the text */
  position: number
  /** ~20 chars surrounding context */
  context: string
}

export interface HallucinatedNumber extends LLMNumber {
  /** Closest number in source data */
  closest?: number
  /** Distance as ratio (0.18 = 18% off) */
  distance?: number
}

/** Options for validateAgainstSource */
export interface DataValidationOptions {
  /** Tolerance for rounding (default: 0.01 = 1%) */
  tolerance?: number
  /** Columns to ignore (e.g. 'id', 'code_geo') */
  ignoreColumns?: string[]
  /** Number patterns to ignore (e.g. years, postal codes) */
  ignorePatterns?: RegExp[]
}

/** Content for verified_text scratchpad section */
export interface VerifiedTextContent {
  /** Original LLM text */
  text: string
  /** Validation result from validateAgainstSource */
  validation: DataValidation
  /** Display mode */
  mode?: 'highlight' | 'strip' | 'annotate'
}

/** Column definition for data_preview section */
export interface DataPreviewColumn {
  key: string
  label: string
  type?: 'number' | 'string' | 'date'
  format?: string
  align?: 'left' | 'right' | 'center'
}

/** Content for data_preview scratchpad section */
export interface DataPreviewContent {
  columns: DataPreviewColumn[]
  rows: Record<string, unknown>[]
  /** Total rows (if paginated — e.g. 22306 total, 30 displayed) */
  totalRows?: number
  /** Data source attribution */
  source?: string
  /** Data freshness label */
  freshness?: string
  /** Enable export buttons (CSV/JSON) */
  exportable?: boolean
  /** Rows per page (default: 25). Set 0 to disable pagination. */
  pageSize?: number
  /** Initial page (0-indexed, default: 0) */
  initialPage?: number
  /** Show "Showing X-Y of Z" counter (default: true) */
  showPageInfo?: boolean
  /** Callback when page changes (for server-side pagination) */
  onPageChange?: (page: number) => void
}

/** Content for map scratchpad section (v3.1.0) */
export interface MapSectionContent {
  /** GeoJSON FeatureCollection */
  geojson: unknown
  /** Map center [lat, lng] */
  center?: [number, number]
  /** Zoom level */
  zoom?: number
  /** GeoJSON style (including choropleth) */
  style?: import('./index').MapGeoJSONStyle
  /** Popup config for feature click */
  popup?: import('./index').MapPopupConfig
  /** Named layers */
  layers?: import('./index').MapLayer[]
  /** Map height (CSS, default: '300px') */
  height?: string
}

// ─── Agent section types (v4.1.0 — AITL sprint) ────────────

/** Content for agent_card scratchpad section */
export interface AgentCardContent {
  agentId: string
  name: string
  /** Avatar icon key (e.g. 'scales', 'chart', 'search') or emoji */
  avatar?: string
  status: 'idle' | 'running' | 'waiting' | 'done' | 'error'
  /** Agent capabilities as string badges */
  capabilities?: string[]
  /** LLM model used */
  model?: string
  /** Current step info (shown when running) */
  currentStep?: { id: string; label: string }
}

/** Content for split_stepper scratchpad section (parallel agents) */
export interface SplitStepperContent {
  agents: Array<{
    id: string
    name: string
    steps: Array<{ id: string; label: string; status: 'done' | 'active' | 'pending' | 'skipped' | 'error' }>
    status: 'done' | 'active' | 'pending' | 'error'
  }>
  /** Final synthesis step (activates when all agents are done) */
  synthesis?: {
    status: 'done' | 'active' | 'pending'
    label: string
  }
}

/** Content for agent_handoff scratchpad section */
export interface AgentHandoffContent {
  from: { id: string; name: string; avatar?: string }
  to: { id: string; name: string; avatar?: string }
  /** Data keys transferred */
  dataKeys?: string[]
  /** Summary of what was transferred */
  summary?: string
  /** Count of items transferred */
  itemCount?: number
}

/** Content for briefing_diff scratchpad section */
export interface BriefingDiffContent {
  /** Title of the comparison */
  title?: string
  /** When was the previous version */
  previousDate?: string
  /** When is the current version */
  currentDate?: string
  /** List of changes */
  changes: Array<{
    type: 'added' | 'removed' | 'changed'
    label: string
    /** Previous value (for 'changed' and 'removed') */
    previous?: string
    /** Current value (for 'changed' and 'added') */
    current?: string
  }>
  /** Summary stats */
  stats?: { added: number; removed: number; changed: number }
}
