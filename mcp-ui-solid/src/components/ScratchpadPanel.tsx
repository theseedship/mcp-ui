/**
 * ScratchpadPanel v3 — Full HITL/AITL workspace
 * v2.9.0: Interactive filters, form sections, stepper, preview auto-refresh
 *
 * @experimental
 */

import { Component, Show, For, Switch, Match, createSignal, createEffect, onCleanup } from 'solid-js'
import type { ScratchpadState, ScratchpadSection, VerifiedTextContent, DataPreviewContent, MapSectionContent, AgentCardContent, SplitStepperContent, AgentHandoffContent, BriefingDiffContent } from '../types/chat-bus'
import type { FormFieldParams, ChartComponentParams } from '../types'
import { FormFieldRenderer } from './FormFieldRenderer'
import { VerifiedText } from './VerifiedText'
import { DataPreviewSection } from './DataPreviewSection'
import { MapRenderer } from './MapRenderer'
import { ChartJSRenderer } from './ChartJSRenderer'
import { AgentCard, AgentStatusBadge } from './AgentCard'
import { SplitStepper } from './SplitStepper'
import { AgentHandoff } from './AgentHandoff'
import { BriefingDiff } from './BriefingDiff'

export interface ScratchpadPanelProps {
  state: ScratchpadState
  onFilterChange?: (filters: Record<string, string | string[]>) => void
  onAction?: (action: string, data?: unknown) => void
  onSectionEdit?: (sectionId: string, content: unknown) => void
  /** Dedicated callback for form submissions (cleaner than onAction) */
  onSubmit?: (sectionId: string, values: Record<string, unknown>) => void
  /** Called when user clicks retry on error state */
  onRetry?: () => void
  onClose?: () => void
  /** When true, action buttons show loading spinner and stay open until next server update */
  asyncAction?: boolean
  /** When true (set by server), scratchpad stays visible during stream */
  pinned?: boolean
  /** Log events/actions to console */
  debug?: boolean
  /** Show mini debug overlay */
  debugOverlay?: boolean
  closable?: boolean
  autoCloseDelay?: number
  collapsible?: boolean
  maxHeight?: string
}

const STATUS_BADGES: Record<ScratchpadState['status'], { label: string; class: string }> = {
  loading: { label: 'Loading...', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ready: { label: 'Action available', class: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  waiting_human: { label: 'Your turn', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' },
  processing: { label: 'Processing...', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  complete: { label: 'Complete', class: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  error: { label: 'Error', class: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

export const ScratchpadPanel: Component<ScratchpadPanelProps> = (props) => {
  const [collapsed, setCollapsed] = createSignal(false)
  const [localPreview, setLocalPreview] = createSignal<ScratchpadState['preview']>(undefined)
  const [loadingAction, setLoadingAction] = createSignal<string | null>(null)
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  const badge = () => STATUS_BADGES[props.state.status] || STATUS_BADGES.loading
  const isClosable = () => props.closable !== false
  const isCollapsible = () => props.collapsible !== false
  const preview = () => localPreview() || props.state.preview
  const hasFilters = () => Object.keys(props.state.filters || {}).length > 0
  const [eventCount, setEventCount] = createSignal(0)
  const [lastEvent, setLastEvent] = createSignal('')

  const debugLog = (event: string, data?: any) => {
    if (!props.debug) return
    setEventCount(c => c + 1)
    setLastEvent(event)
    console.log(`[ScratchpadPanel:${props.state.id}] ${event}`, data || '')
  }

  // ─── DX1: Proactive console messages (always, not just debug) ───

  const VALID_TRANSITIONS: Record<string, string[]> = {
    loading: ['processing', 'waiting_human', 'error'],
    waiting_human: ['processing', 'ready', 'complete', 'error'],
    processing: ['ready', 'complete', 'error', 'waiting_human'],
    ready: ['processing', 'complete', 'error', 'waiting_human'],
    complete: [],
    error: ['processing', 'ready', 'waiting_human'],
  }
  let prevStatus = props.state.status

  // Etape 1: create log
  console.info(
    `%c[MCP-UI] Scratchpad created%c id=${props.state.id} sections=${props.state.sections?.length || 0} status=${props.state.status}${props.pinned ? ' pinned=true' : ''}`,
    'color: #10b981; font-weight: bold', 'color: inherit'
  )

  // Etape 3: status transitions + Etape 4: auto-close info
  createEffect(() => {
    const newStatus = props.state.status
    if (newStatus !== prevStatus) {
      console.info(`%c[MCP-UI] Scratchpad status%c ${props.state.id}: ${prevStatus} → ${newStatus}`, 'color: #3b82f6; font-weight: bold', 'color: inherit')
      if (!VALID_TRANSITIONS[prevStatus]?.includes(newStatus)) {
        console.warn(`[MCP-UI] Scratchpad ${props.state.id}: unusual transition ${prevStatus} → ${newStatus}. Expected: ${VALID_TRANSITIONS[prevStatus]?.join(', ') || 'none (terminal)'}`)
      }
      prevStatus = newStatus
    }
    // Etape 4
    if (props.autoCloseDelay && newStatus !== 'complete') {
      console.info(`[MCP-UI] Scratchpad ${props.state.id}: autoCloseDelay=${props.autoCloseDelay}ms but status='${newStatus}' — auto-close will NOT trigger.`)
    }
  })

  // Action aliases that auto-close the scratchpad
  const CLOSE_ALIASES = new Set(['done', 'close', 'dismiss', 'validate', 'cancel', 'sufficient'])

  const handleAction = (action: string, data?: unknown) => {
    // DX1 Etape 5: action dispatch
    console.info(`%c[MCP-UI] Action dispatched%c value='${action}' asyncAction=${!!props.asyncAction}`, 'color: #f59e0b; font-weight: bold', 'color: inherit')
    if (!props.asyncAction && /^(try_alt:|retry|fetch|load)/.test(action)) {
      console.warn(`[MCP-UI] ScratchpadPanel: action '${action}' looks async but asyncAction prop is not set. The button will NOT show a loading state.`)
    }
    debugLog('onAction', { action, asyncAction: props.asyncAction, data })
    if (props.asyncAction && !CLOSE_ALIASES.has(action)) {
      setLoadingAction(action)
    }
    props.onAction?.(action, data)
    if (CLOSE_ALIASES.has(action) && props.onClose) {
      props.onClose()
    }
  }

  // Debug: log state changes
  createEffect(() => {
    debugLog('state', { status: props.state.status, sections: props.state.sections?.length, filters: Object.keys(props.state.filters || {}), turn: props.state.turn })
  })

  // Auto-close on complete (unless pinned)
  createEffect(() => {
    if (props.state.status === 'complete' && props.autoCloseDelay && !props.pinned) {
      const timer = setTimeout(() => props.onClose?.(), props.autoCloseDelay)
      onCleanup(() => clearTimeout(timer))
    }
    // Clear loading action when server responds
    if (props.state.status !== 'processing' && loadingAction()) {
      setLoadingAction(null)
    }
  })

  // Preview auto-refresh when filters change
  createEffect(() => {
    const endpoint = props.state.previewEndpoint
    if (!endpoint) return
    const filters = props.state.filters
    if (!filters || Object.keys(filters).length === 0) return

    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(async () => {
      try {
        const res = await fetch(endpoint, {
          method: props.state.previewMethod || 'POST',
          headers: { 'Content-Type': 'application/json', ...props.state.previewHeaders },
          credentials: 'include',
          body: JSON.stringify({ filters }),
        })
        if (res.ok) setLocalPreview(await res.json())
      } catch { /* ignore */ }
    }, props.state.previewDebounce || 500)
  })

  onCleanup(() => { if (previewTimer) clearTimeout(previewTimer) })

  return (
    <div
      class={`w-full bg-white dark:bg-gray-800 rounded-xl border shadow-lg overflow-visible ${
        props.state.status === 'waiting_human'
          ? 'border-blue-300 dark:border-blue-600'
          : 'border-gray-200 dark:border-gray-700'
      } ${props.pinned ? 'sticky top-0 z-40' : ''}`}
      style={{ animation: 'scratchpad-slide-down 0.2s ease-out' }}
    >
      {/* Header */}
      <div
        class={`flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${isCollapsible() ? 'cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-750' : ''}`}
        onClick={() => isCollapsible() && setCollapsed(!collapsed())}
      >
        <div class="flex items-center gap-2">
          <span class="text-base">&#128221;</span>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{props.state.title}</h3>
          {/* AgentStatusBadge — auto-detected from agent_card sections (v4.1.0) */}
          {(() => {
            const agentSection = props.state.sections.find(s => s.type === 'agent_card')
            if (!agentSection) return null
            const ac = parseContent(agentSection.content) as AgentCardContent | null
            if (!ac?.name) return null
            return <AgentStatusBadge agentName={ac.name} status={ac.status || 'idle'} />
          })()}
          <Show when={isCollapsible()}>
            <svg class={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed() ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${badge().class}`}>{badge().label}</span>
          <Show when={isClosable() && props.onClose}>
            <button onClick={(e) => { e.stopPropagation(); props.onClose?.() }} class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Close">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Body */}
      <Show when={!collapsed()}>
        <div style={{ "max-height": props.maxHeight || "500px", "overflow-y": "auto" }}>
          {/* Turn history header */}
          <Show when={props.state.turnHistory && props.state.turnHistory.length > 0}>
            <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1.5">
              <For each={props.state.turnHistory}>
                {(turn, i) => (
                  <>
                    <Show when={i() > 0}>
                      <svg class="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </Show>
                    <span class={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      turn.status === 'done' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : turn.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : turn.status === 'skipped' ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {turn.status === 'done' ? '✅' : turn.status === 'active' ? '●' : '○'} {turn.label}
                      <Show when={turn.summary}><span class="ml-1 font-normal opacity-75">— {turn.summary}</span></Show>
                    </span>
                  </>
                )}
              </For>
            </div>
          </Show>

          {/* Sections */}
          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            <For each={props.state.sections}>
              {(section) => (
                <SectionRenderer
                  section={section}
                  filters={props.state.filters}
                  onFilterChange={props.onFilterChange}
                  onAction={handleAction}
                  onSectionEdit={props.onSectionEdit}
                  onSubmit={props.onSubmit}
                />
              )}
            </For>
          </div>

          {/* Agent messages */}
          <Show when={props.state.agentMessages.length > 0}>
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <For each={props.state.agentMessages}>
                {(msg) => (
                  <div class={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                    msg.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
                    : msg.type === 'question' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                  }`}>
                    <span class="flex-shrink-0 mt-0.5">{msg.type === 'warning' ? '⚠️' : msg.type === 'question' ? '❓' : 'ℹ️'}</span>
                    <p>{msg.text}</p>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Preview */}
          <Show when={preview()}>
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <Show when={preview()!.count === 0} fallback={
                <>
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Preview</span>
                    <span class="px-1.5 py-0.5 text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{preview()!.count.toLocaleString()}</span>
                  </div>
                  <p class="text-sm text-gray-700 dark:text-gray-300">{preview()!.summary}</p>
                  <Show when={preview()!.rows && preview()!.rows!.length > 0}>
                    <div class="mt-2 overflow-x-auto">
                      <table class="min-w-full text-xs">
                        <thead><tr><For each={Object.keys(preview()!.rows![0])}>{(k) => <th class="px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400">{k}</th>}</For></tr></thead>
                        <tbody><For each={preview()!.rows!.slice(0, 5)}>{(row) => <tr class="border-t border-gray-100 dark:border-gray-700"><For each={Object.values(row)}>{(v) => <td class="px-2 py-1 text-gray-700 dark:text-gray-300">{String(v)}</td>}</For></tr>}</For></tbody>
                      </table>
                    </div>
                  </Show>
                </>
              }>
                <div class="flex flex-col items-center gap-2 py-4 text-center">
                  <span class="text-2xl">&#128269;</span>
                  <p class="text-sm text-gray-500 dark:text-gray-400">No results for these filters</p>
                  <button type="button" onClick={() => props.onAction?.('refine_filters')} class="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">Modify filters</button>
                </div>
              </Show>
            </div>
          </Show>

          {/* Error state with retry */}
          <Show when={props.state.status === 'error' && props.state.error}>
            <div class="px-4 py-3 border-t border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
              <div class="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                <span class="flex-shrink-0 mt-0.5">⚠️</span>
                <div class="flex-1">
                  <p class="font-medium">{props.state.error!.message}</p>
                  <Show when={props.state.error!.code}>
                    <p class="text-xs text-red-500 dark:text-red-500 mt-0.5">Code: {props.state.error!.code}</p>
                  </Show>
                </div>
              </div>
              <div class="flex gap-2 mt-2">
                <Show when={props.state.error!.retryable !== false}>
                  <button type="button" onClick={() => props.onRetry?.()}
                    class="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1">
                    &#128260; Retry
                  </button>
                </Show>
                <Show when={props.onClose}>
                  <button type="button" onClick={() => props.onClose?.()}
                    class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    Close
                  </button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Search button when waiting_human */}
          <Show when={props.state.status === 'waiting_human' && hasFilters()}>
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleAction('search', { filters: props.state.filters })}
                class="w-full px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Search
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <style>{`
        @keyframes scratchpad-slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Debug overlay */}
      <Show when={props.debugOverlay}>
        <div class="absolute bottom-1 right-1 px-2 py-1 text-[9px] font-mono bg-black/80 text-green-400 rounded z-50 pointer-events-none">
          {props.state.id} | ev:{eventCount()} | sec:{props.state.sections?.length || 0} | {props.state.status} | last:{lastEvent()}
        </div>
      </Show>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────

/** Parse content that may arrive as a JSON string from SSE transport */
function parseContent(content: unknown): unknown {
  if (typeof content === 'string') {
    try { return JSON.parse(content) } catch { return content }
  }
  return content
}

// ─── Section Renderer ────────────────────────────────────────

const SectionRenderer: Component<{
  section: ScratchpadSection
  filters: Record<string, string | string[]>
  onFilterChange?: (filters: Record<string, string | string[]>) => void
  onAction?: (action: string, data?: unknown) => void
  onSectionEdit?: (sectionId: string, content: unknown) => void
  onSubmit?: (sectionId: string, values: Record<string, unknown>) => void
}> = (props) => {
  return (
    <div class="px-4 py-3 animate-[slideDown_0.2s_ease-out]">
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{props.section.title}</h4>
      <Switch>
        <Match when={props.section.type === 'data'}><DataSection content={parseContent(props.section.content)} /></Match>
        <Match when={props.section.type === 'filter'}><InteractiveFilterSection content={parseContent(props.section.content)} filters={props.filters} onFilterChange={props.onFilterChange} /></Match>
        <Match when={props.section.type === 'message'}><p class="text-sm text-gray-700 dark:text-gray-300">{String(props.section.content)}</p></Match>
        <Match when={props.section.type === 'action'}><ActionSection content={parseContent(props.section.content)} onAction={props.onAction} /></Match>
        <Match when={props.section.type === 'steps'}><EnrichedStepsSection content={parseContent(props.section.content)} onAction={props.onAction} onFilterChange={props.onFilterChange} /></Match>
        <Match when={props.section.type === 'form'}><EmbeddedFormSection content={parseContent(props.section.content)} sectionId={props.section.id} onAction={props.onAction} onSubmit={props.onSubmit} /></Match>
        <Match when={props.section.type === 'understanding'}><UnderstandingSection content={parseContent(props.section.content)} /></Match>
        <Match when={props.section.type === 'feedback'}><FeedbackSection content={parseContent(props.section.content)} onAction={props.onAction} /></Match>
        <Match when={props.section.type === 'prompt'}><PromptSection content={parseContent(props.section.content)} onAction={props.onAction} /></Match>
        <Match when={props.section.type === 'stepper'}><StepperProgressSection content={parseContent(props.section.content)} /></Match>
        <Match when={props.section.type === 'error'}><ErrorSectionRenderer content={parseContent(props.section.content)} onAction={props.onAction} /></Match>
        <Match when={props.section.type === 'source_card'}><SourceCardSection content={parseContent(props.section.content)} /></Match>
        <Match when={props.section.type === 'diff'}><DiffSection content={parseContent(props.section.content)} /></Match>
        <Match when={props.section.type === 'verified_text'}><VerifiedText {...(parseContent(props.section.content) as VerifiedTextContent)} onHallucinationClick={(h) => props.onAction?.('hallucination_click', h)} /></Match>
        <Match when={props.section.type === 'data_preview'}><DataPreviewSection content={parseContent(props.section.content) as DataPreviewContent} /></Match>
        <Match when={props.section.type === 'map'}>{(() => { const c = parseContent(props.section.content) as MapSectionContent; return <MapRenderer params={{ geojson: c.geojson, center: c.center, zoom: c.zoom, geojsonStyle: c.style, popup: c.popup, layers: c.layers, height: c.height || '300px', fitBounds: true }} /> })()}</Match>
        <Match when={props.section.type === 'chart'}>{(() => { const c = parseContent(props.section.content) as ChartComponentParams; return <ChartJSRenderer component={{ id: props.section.id, type: 'chart', position: { colStart: 1, colSpan: 12 }, params: { ...c, renderer: 'native', height: (c as any)?.height || '250px' } }} /> })()}</Match>
        <Match when={props.section.type === 'agent_card'}><AgentCard content={parseContent(props.section.content) as AgentCardContent} /></Match>
        <Match when={props.section.type === 'split_stepper'}><SplitStepper content={parseContent(props.section.content) as SplitStepperContent} /></Match>
        <Match when={props.section.type === 'agent_handoff'}><AgentHandoff content={parseContent(props.section.content) as AgentHandoffContent} /></Match>
        <Match when={props.section.type === 'briefing_diff'}><BriefingDiff content={parseContent(props.section.content) as BriefingDiffContent} /></Match>
        <Match when={true}><pre class="text-xs text-gray-500 overflow-auto">{JSON.stringify(props.section.content, null, 2)}</pre></Match>
      </Switch>
    </div>
  )
}

// ─── Data Section ────────────────────────────────────────────

const DataSection: Component<{ content: unknown }> = (props) => {
  const entries = () => typeof props.content === 'object' && props.content ? Object.entries(props.content as Record<string, unknown>) : []
  return (
    <div class="space-y-1">
      <For each={entries()}>{([k, v]) => <div class="flex gap-2 text-xs"><span class="text-gray-500 dark:text-gray-400 font-mono min-w-[120px]">{k}:</span><span class="text-gray-900 dark:text-white">{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>}</For>
    </div>
  )
}

// ─── Interactive Filter Section (#4, #5) ─────────────────────

const InteractiveFilterSection: Component<{
  content: unknown
  filters: Record<string, string | string[]>
  onFilterChange?: (filters: Record<string, string | string[]>) => void
}> = (props) => {
  const [editingKey, setEditingKey] = createSignal<string | null>(null)
  const [editValue, setEditValue] = createSignal('')

  // Content can be a filter definition or just use props.filters
  const filterDefs = () => {
    if (typeof props.content === 'object' && props.content) return props.content as Record<string, any>
    return {}
  }

  const allKeys = () => {
    const fromContent = Object.keys(filterDefs())
    const fromFilters = Object.keys(props.filters || {})
    return [...new Set([...fromContent, ...fromFilters])]
  }

  const removeFilter = (key: string) => {
    const next = { ...props.filters }
    delete next[key]
    props.onFilterChange?.(next)
  }

  const setFilter = (key: string, value: string) => {
    props.onFilterChange?.({ ...props.filters, [key]: value })
    setEditingKey(null)
    setEditValue('')
  }

  const getDef = (key: string) => filterDefs()[key] || {}

  return (
    <div class="flex flex-wrap gap-1.5">
      <For each={allKeys()}>
        {(key) => {
          const def = () => getDef(key)
          const value = () => props.filters[key]
          const hasValue = () => value() !== undefined && value() !== ''

          return (
            <div class="relative">
              <Show when={hasValue()} fallback={
                <button type="button" onClick={() => { setEditingKey(key); setEditValue('') }}
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full hover:border-blue-400 hover:text-blue-500 transition-colors">
                  + {def()?.label || key}
                </button>
              }>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  <button type="button" onClick={() => { setEditingKey(key); setEditValue(String(value() || '')) }} class="hover:underline">
                    <span class="text-blue-500 dark:text-blue-400">{def()?.label || key}:</span> {Array.isArray(value()) ? (value() as string[]).join(', ') : String(value())}
                  </button>
                  <Show when={props.onFilterChange}>
                    <button type="button" onClick={() => removeFilter(key)} class="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100" aria-label={`Remove ${key}`}>&times;</button>
                  </Show>
                </span>
              </Show>

              {/* Inline editor */}
              <Show when={editingKey() === key}>
                <div class="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 min-w-[200px]">
                  <Show when={def()?.options} fallback={
                    <form onSubmit={(e) => { e.preventDefault(); setFilter(key, editValue()) }} class="flex gap-1">
                      <input type="text" value={editValue()} onInput={(e) => setEditValue(e.currentTarget.value)} placeholder={def()?.placeholder || key} autofocus
                        class="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 outline-none" />
                      <button type="submit" class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
                      <button type="button" onClick={() => setEditingKey(null)} class="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </form>
                  }>
                    <div class="max-h-48 overflow-y-auto">
                      <For each={def().options as Array<{ value: string; label: string }>}>
                        {(opt) => (
                          <button type="button" onClick={() => setFilter(key, opt.value)}
                            class={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                              String(value()) === opt.value ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-900 dark:text-white'
                            }`}>
                            {opt.label}
                            <Show when={String(value()) === opt.value}><span class="ml-1">✓</span></Show>
                          </button>
                        )}
                      </For>
                    </div>
                    <button type="button" onClick={() => setEditingKey(null)} class="mt-1 w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-700 text-center">Cancel</button>
                  </Show>
                </div>
              </Show>
            </div>
          )
        }}
      </For>
      <Show when={allKeys().length === 0}>
        <p class="text-xs text-gray-400 italic">No filters</p>
      </Show>
    </div>
  )
}

// ─── Embedded Form Section (#7, #8) ──────────────────────────

const EmbeddedFormSection: Component<{
  content: unknown
  sectionId: string
  onAction?: (action: string, data?: unknown) => void
  onSubmit?: (sectionId: string, values: Record<string, unknown>) => void
}> = (props) => {
  const [dynamicOptions, setDynamicOptions] = createSignal<Record<string, Array<{ label: string; value: string }>>>({})

  const config = () => {
    const c = props.content as any
    return {
      fields: c?.fields || [],
      submitLabel: c?.submitLabel || 'Submit',
      autoSubmitDelay: c?.autoSubmitDelay as number | undefined,
    }
  }

  // Initialize form data with prefill values (v4.2.0)
  const buildInitial = () => {
    const initial: Record<string, any> = {}
    for (const field of config().fields) {
      initial[field.name] = field.prefill ?? field.defaultValue ?? ''
    }
    return initial
  }

  const [formData, setFormData] = createSignal<Record<string, any>>(buildInitial())

  // Re-init when content changes (streaming updates)
  createEffect(() => {
    const fields = config().fields
    if (fields.length > 0) {
      setFormData((prev) => {
        const next = { ...prev }
        for (const field of fields) {
          // Only apply prefill if the user hasn't changed the field yet
          if (field.prefill != null && (next[field.name] === undefined || next[field.name] === '')) {
            next[field.name] = field.prefill
          }
        }
        return next
      })
    }
  })

  // Auto-submit countdown (v4.2.0)
  const [countdown, setCountdown] = createSignal<number | null>(null)
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  const [userInteracted, setUserInteracted] = createSignal(false)

  const cancelCountdown = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
    setCountdown(null)
  }

  onCleanup(() => cancelCountdown())

  createEffect(() => {
    const delay = config().autoSubmitDelay
    if (!delay || userInteracted()) return
    const allRequiredPrefilled = config().fields
      .filter((f: any) => f.required)
      .every((f: any) => f.prefill != null)
    if (!allRequiredPrefilled) return

    let remaining = Math.ceil(delay / 1000)
    setCountdown(remaining)
    countdownTimer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        cancelCountdown()
        const form = document.querySelector(`#scratchpad-form-${props.sectionId}`) as HTMLFormElement | null
        if (form) form.requestSubmit()
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  })

  const updateField = (name: string, value: any) => {
    if (!userInteracted()) { setUserInteracted(true); cancelCountdown() }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // depends_on reactive (#9)
  createEffect(() => {
    const data = formData()
    for (const field of config().fields) {
      const dep = field.depends_on || field.dependsOn
      if (!dep) continue
      const parentValue = data[dep.field]
      if (!parentValue) continue
      const url = (dep.options_endpoint || dep.apiUrl || '').replace('{value}', encodeURIComponent(parentValue))
      if (!url) continue
      const params = new URLSearchParams(dep.extraParams || dep.extra_params || {})
      fetch(`${url}${url.includes('?') ? '&' : '?'}${params}`)
        .then(r => r.json())
        .then(items => {
          const arr = Array.isArray(items) ? items : items.results || items.features || []
          const lf = dep.label_field || dep.labelField || 'label'
          const vf = dep.value_field || dep.valueField || 'value'
          setDynamicOptions(prev => ({ ...prev, [field.name]: arr.map((i: any) => ({ label: i[lf] || String(i), value: String(i[vf] || i[lf] || i) })) }))
        })
        .catch(() => {})
    }
  })

  const getField = (field: any): FormFieldParams => {
    const dynOpts = dynamicOptions()[field.name]
    return dynOpts ? { ...field, options: dynOpts } as FormFieldParams : field as FormFieldParams
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()

    // Filter out unsupported fields, keep only values with content
    const values = Object.fromEntries(
      Object.entries(formData())
        .filter(([key]) => {
          const field = config().fields.find((f: any) => f.name === key)
          return field?.fieldStatus !== 'unsupported'
        })
        .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    )

    // DX1 Etape 7: form submit log
    console.info(`%c[MCP-UI] Form submitted%c section=${props.sectionId} fields=${Object.keys(values).join(',')}`, 'color: #8b5cf6; font-weight: bold', 'color: inherit')

    if (props.onSubmit) {
      props.onSubmit(props.sectionId, values)
    } else {
      props.onAction?.('submit_form', { sectionId: props.sectionId, values })
    }
  }

  // Proposal 3: prefill confidence summary
  const prefillSummary = () => {
    const fields = config().fields
    const total = fields.length
    const prefilled = fields.filter((f: any) => f.prefill != null).length
    return { total, prefilled }
  }

  // Proposal 4: auto-submit toast mode — compact view when ALL fields prefilled
  const [expanded, setExpanded] = createSignal(false)
  const allFieldsPrefilled = () => {
    const fields = config().fields
    return fields.length > 0 && fields.every((f: any) => f.prefill != null)
  }
  const showToast = () => allFieldsPrefilled() && !userInteracted() && !expanded() && countdown() != null

  return (
    <Show when={!showToast()} fallback={
      <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
        <span class="flex-1 text-blue-800 dark:text-blue-200 font-medium">
          {config().fields.map((f: any) => f.displayHint || f.prefill).join(', ')}
        </span>
        <span class="text-blue-600 dark:text-blue-300">{countdown()}s...</span>
        <button type="button" onClick={() => { setExpanded(true); cancelCountdown(); setUserInteracted(true) }}
          class="text-blue-600 dark:text-blue-400 underline text-xs">Modifier</button>
        <button type="button" onClick={() => { cancelCountdown(); setUserInteracted(true) }}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
      </div>
    }>
    <form id={`scratchpad-form-${props.sectionId}`} onSubmit={handleSubmit} class="flex flex-col gap-3">
      {/* Proposal 3: prefill summary */}
      <Show when={prefillSummary().prefilled > 0}>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {prefillSummary().prefilled} champ{prefillSummary().prefilled > 1 ? 's' : ''} pré-rempli{prefillSummary().prefilled > 1 ? 's' : ''} sur {prefillSummary().total}
        </p>
      </Show>
      <For each={config().fields}>
        {(field) => (
          <FormFieldRenderer
            field={getField(field)}
            value={formData()[field.name]}
            onChange={(val) => updateField(field.name, val)}
            formData={formData}
          />
        )}
      </For>
      <Show when={countdown() != null}>
        <div class="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
          <span class="text-blue-700 dark:text-blue-300">
            {config().submitLabel} in {countdown()}s...
          </span>
          <button
            type="button"
            onClick={() => { cancelCountdown(); setUserInteracted(true) }}
            class="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
          >
            Cancel
          </button>
        </div>
      </Show>
      <div class="flex justify-end">
        <button type="submit" class="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          {config().submitLabel}
        </button>
      </div>
    </form>
    </Show>
  )
}

// ─── Enriched Steps Section (#6) ─────────────────────────────

const EnrichedStepsSection: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
  onFilterChange?: (filters: Record<string, string | string[]>) => void
}> = (props) => {
  const stepsData = () => {
    const c = props.content as any
    return { steps: c?.steps || [], currentStep: c?.currentStep ?? 0 }
  }

  return (
    <div class="space-y-3">
      <For each={stepsData().steps}>
        {(step: any) => (
          <div class={`rounded-lg ${step.status === 'active' ? 'bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 animate-pulse' : 'px-1'}`}>
            <div class={`flex items-center gap-2 text-sm font-medium ${
              step.status === 'done' ? 'text-green-600 dark:text-green-400'
              : step.status === 'active' ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400'
            }`}>
              <span>{step.status === 'done' ? '✅' : step.status === 'active' ? '●' : '○'}</span>
              {step.label}
              <Show when={step.description && step.status === 'active'}>
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400">— {step.description}</span>
              </Show>
            </div>

            {/* Embedded content for active step */}
            <Show when={step.status === 'active' && step.content}>
              <div class="mt-2 ml-6">
                <SectionRenderer
                  section={step.content}
                  filters={{}}
                  onFilterChange={props.onFilterChange}
                  onAction={props.onAction}
                />
              </div>
            </Show>
          </div>
        )}
      </For>

      {/* Next button */}
      <Show when={stepsData().steps.some((s: any) => s.status === 'active')}>
        <div class="flex justify-end">
          <button type="button" onClick={() => props.onAction?.('next_step', { step: stepsData().currentStep })}
            class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-1">
            Next <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </Show>
    </div>
  )
}

// ─── Action Section ──────────────────────────────────────────

const ActionSection: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
}> = (props) => {
  const data = () => {
    const c = props.content as any
    if (Array.isArray(c)) return { actions: c, title: undefined, preview: undefined, validation: undefined }
    if (c && Array.isArray(c.actions)) return { actions: c.actions, title: c.title, preview: c.preview, validation: c.validation }
    return { actions: [], title: undefined, preview: undefined, validation: undefined }
  }

  return (
    <div>
      {/* Confirm checkpoint: title + preview (v4.1.0) */}
      <Show when={data().title}>
        <p class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{data().title}</p>
      </Show>
      <Show when={data().preview}>
        {(preview) => (
          <div class="mb-2 p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
            <Show when={preview().count != null}>
              <span class="font-medium text-gray-800 dark:text-gray-200">{preview().count}</span> items
            </Show>
            <Show when={preview().summary}>
              <span class="ml-1">&mdash; {preview().summary}</span>
            </Show>
          </div>
        )}
      </Show>
      <Show when={data().validation && data().validation.confidence != null}>
        <div class="mb-2 flex items-center gap-2 text-xs">
          <span classList={{
            'text-green-600 dark:text-green-400': data().validation.confidence >= 0.8,
            'text-amber-600 dark:text-amber-400': data().validation.confidence >= 0.5 && data().validation.confidence < 0.8,
            'text-red-600 dark:text-red-400': data().validation.confidence < 0.5,
          }}>
            {Math.round(data().validation.confidence * 100)}% verified
          </span>
          <Show when={data().validation.hallucinated?.length > 0}>
            <span class="text-amber-600">({data().validation.hallucinated.length} unverified)</span>
          </Show>
        </div>
      </Show>

      {/* Action buttons */}
      <div class="flex flex-wrap gap-2">
        <For each={data().actions as Array<{ label: string; value?: string; action?: string; variant?: string; icon?: string }>}>
          {(item) => (
            <button type="button" on:click={() => props.onAction?.(item.value || item.action || item.label, item)}
              class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                item.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700'
                : item.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700'
                : item.variant === 'secondary' ? 'border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <Show when={item.icon}><span class="mr-1">{item.icon}</span></Show>
              {item.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

// ─── Understanding Section — agent comprehension ─────────────

const UnderstandingSection: Component<{ content: unknown }> = (props) => {
  const data = () => {
    const c = props.content as any
    return { detections: c?.detections || [], warnings: c?.warnings || [] }
  }

  const confidenceClass = (conf?: string) => {
    switch (conf) {
      case 'high': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
      case 'low': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div class="space-y-2">
      <div class="space-y-1.5">
        <For each={data().detections}>
          {(det: any) => (
            <div class="flex items-center gap-2 text-sm">
              <span class={`px-1.5 py-0.5 text-xs font-medium rounded ${confidenceClass(det.confidence)}`}>
                {det.label}
              </span>
              <span class="text-gray-900 dark:text-white">{det.value}</span>
            </div>
          )}
        </For>
      </div>
      <Show when={data().warnings.length > 0}>
        <div class="space-y-1">
          <For each={data().warnings}>
            {(w: string) => (
              <div class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <span class="flex-shrink-0">⚠️</span>
                <span>{w}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

// ─── Feedback Section — thumbs up/down ───────────────────────

const FeedbackSection: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
}> = (props) => {
  const [comment, setComment] = createSignal('')
  const [showComment, setShowComment] = createSignal(false)
  const [submitted, setSubmitted] = createSignal<string | null>(null)
  const data = () => {
    const c = props.content as any
    const options = c?.options || [
      { value: c?.approve?.value || 'approve', label: c?.approve?.label || 'Yes', icon: '\uD83D\uDC4D', variant: 'primary' },
      { value: c?.reject?.value || 'reject', label: c?.reject?.label || 'No', icon: '\uD83D\uDC4E' },
    ]
    return {
      question: c?.question || '',
      options: options as Array<{ value: string; label: string; icon?: string; variant?: string; needsComment?: boolean }>,
      allowFreeText: c?.allowFreeText ?? c?.allowComment ?? false,
      placeholder: c?.placeholder || c?.commentPlaceholder || 'Add a comment...',
      // v4.1.0: per-step feedback
      agentId: c?.agentId as string | undefined,
      stepId: c?.stepId as string | undefined,
    }
  }

  const handleOption = (option: any) => {
    if (option.needsComment) {
      setShowComment(true)
      return
    }
    setSubmitted(option.value)
    const payload = {
      option: option.value,
      comment: comment(),
      ...(data().agentId ? { agentId: data().agentId } : {}),
      ...(data().stepId ? { stepId: data().stepId } : {}),
    }
    console.info('[MCP-UI:HITL] user responded', {
      agentId: data().agentId, stepId: data().stepId, action: option.value,
    })
    props.onAction?.('feedback', payload)
  }

  return (
    <div class="space-y-3">
      <p class="text-sm text-gray-700 dark:text-gray-300">{data().question}</p>

      {/* Already submitted — show micro-badge */}
      <Show when={submitted()}>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span classList={{
            'text-green-600': submitted() === 'approve',
            'text-red-600': submitted() === 'reject',
            'text-blue-600': submitted() !== 'approve' && submitted() !== 'reject',
          }}>
            {submitted() === 'approve' ? '\u2705' : submitted() === 'reject' ? '\u274C' : '\uD83D\uDCAC'} {submitted()}
          </span>
          <Show when={comment()}>
            <span class="italic">&mdash; {comment()}</span>
          </Show>
        </div>
      </Show>

      {/* Buttons — hidden after submit */}
      <Show when={!submitted()}>
        <div class="flex flex-wrap gap-2">
          <For each={data().options}>
            {(option) => (
              <button type="button" on:click={() => handleOption(option)}
                class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                  option.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : option.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                <Show when={option.icon}><span>{option.icon}</span></Show>
                {option.label}
              </button>
            )}
          </For>
        </div>
        <Show when={data().allowFreeText || showComment()}>
          <div class="flex gap-1">
            <input type="text" value={comment()} onInput={(e) => setComment(e.currentTarget.value)}
              placeholder={data().placeholder} autofocus={showComment()}
              class="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 outline-none" />
            <button type="button" on:click={() => { setSubmitted('comment'); props.onAction?.('feedback', { option: 'comment', comment: comment(), agentId: data().agentId, stepId: data().stepId }) }}
              class="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send</button>
          </div>
        </Show>
      </Show>
    </div>
  )
}

// ─── Prompt Section — agent interpretation ───────────────────

const PromptSection: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
}> = (props) => {
  const data = () => {
    const c = props.content as any
    return {
      originalQuery: c?.originalQuery || '',
      interpretation: c?.interpretation || '',
      extracted: c?.extracted || {},
      plan: c?.plan || '',
      editable: c?.editable ?? false,
    }
  }

  return (
    <div class="space-y-2">
      <Show when={data().originalQuery}>
        <p class="text-xs text-gray-500 dark:text-gray-400 italic">"{data().originalQuery}"</p>
      </Show>
      <div class="space-y-1">
        <For each={Object.entries(data().extracted)}>
          {([key, value]) => (
            <div class="flex gap-2 text-sm">
              <span class="text-gray-500 dark:text-gray-400 font-medium min-w-[80px]">{key}:</span>
              <span class="text-gray-900 dark:text-white">{String(value)}</span>
            </div>
          )}
        </For>
      </div>
      <Show when={data().plan}>
        <div class="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <span class="font-medium">Plan:</span> {data().plan}
        </div>
      </Show>
      <Show when={data().editable}>
        <button type="button" onClick={() => props.onAction?.('edit_prompt', data())}
          class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
          &#9998; Modify
        </button>
      </Show>
    </div>
  )
}

// ─── Stepper Progress Section (multi-source) ─────────────────

const StepperProgressSection: Component<{ content: unknown }> = (props) => {
  const data = () => {
    const c = props.content as any
    return {
      steps: (c?.steps || []) as Array<{ id: string; label: string; status: string; summary?: string; duration_ms?: number }>,
      orientation: c?.orientation || 'horizontal',
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'done': return '✅'
      case 'active': return '🔄'
      case 'error': return '❌'
      default: return '⏳'
    }
  }

  const isHorizontal = () => data().orientation === 'horizontal'

  return (
    <Show when={isHorizontal()} fallback={
      <div class="space-y-2">
        <For each={data().steps}>
          {(step) => (
            <div class={`flex items-start gap-2 text-sm ${step.status === 'active' ? 'font-medium' : ''} ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
              <span class="flex-shrink-0">{statusIcon(step.status)}</span>
              <div>
                <span>{step.label}</span>
                <Show when={step.summary}>
                  <span class="ml-1 text-xs text-gray-500 dark:text-gray-400">— {step.summary}</span>
                </Show>
                <Show when={step.duration_ms}>
                  <span class="ml-1 text-xs text-gray-400">({step.duration_ms}ms)</span>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    }>
      <div class="flex items-center gap-1 flex-wrap">
        <For each={data().steps}>
          {(step, i) => (
            <>
              <Show when={i() > 0}>
                <svg class="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </Show>
              <div class={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                step.status === 'done' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : step.status === 'active' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium animate-pulse'
                : step.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'text-gray-400'
              }`}>
                <span>{statusIcon(step.status)}</span>
                <span>{step.label}</span>
                <Show when={step.summary}>
                  <span class="text-[10px] opacity-75">{step.summary}</span>
                </Show>
              </div>
            </>
          )}
        </For>
      </div>
    </Show>
  )
}

// ─── Error Section (F6) ──────────────────────────────────────

const ErrorSectionRenderer: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
}> = (props) => {
  const [showDetails, setShowDetails] = createSignal(false)
  const data = () => {
    const c = props.content as any
    const d = { message: c?.message || 'Error', severity: c?.severity || 'error', retryAction: c?.retryAction, retryLabel: c?.retryLabel || 'Retry', details: c?.details, timestamp: c?.timestamp }
    // DX1 Etape 8
    console.info(`%c[MCP-UI] Error section rendered%c severity=${d.severity} retry=${!!d.retryAction}`, 'color: #ef4444; font-weight: bold', 'color: inherit')
    return d
  }
  const isWarning = () => data().severity === 'warning'

  return (
    <div class={`rounded-lg px-3 py-2 text-sm ${isWarning() ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
      <div class="flex items-start gap-2">
        <span class="flex-shrink-0">{isWarning() ? '⚠️' : '❌'}</span>
        <div class="flex-1">
          <p>{data().message}</p>
          <div class="flex gap-2 mt-2">
            <Show when={data().retryAction}>
              <button type="button" onClick={() => props.onAction?.(data().retryAction!)} class={`px-2 py-1 text-xs font-medium rounded ${isWarning() ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-red-600 text-white hover:bg-red-700'} transition-colors`}>&#128260; {data().retryLabel}</button>
            </Show>
            <Show when={data().details}>
              <button type="button" onClick={() => setShowDetails(!showDetails())} class="px-2 py-1 text-xs opacity-70 hover:opacity-100">&#9654; Details</button>
            </Show>
          </div>
          <Show when={showDetails() && data().details}>
            <pre class="mt-2 text-xs opacity-70 overflow-x-auto">{data().details}</pre>
          </Show>
        </div>
      </div>
    </div>
  )
}

// ─── Source Card Section (F9) ────────────────────────────────

const SourceCardSection: Component<{ content: unknown }> = (props) => {
  const data = () => {
    const c = props.content as any
    return { name: c?.name || 'Source', status: c?.status || 'available', capabilities: c?.capabilities || [], latency_ms: c?.latency_ms, freshness: c?.freshness, row_count: c?.row_count }
  }
  const statusIcon = () => ({ queried: '✅', available: '📦', error: '❌' } as Record<string, string>)[data().status] || '📦'

  return (
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-sm font-medium text-gray-900 dark:text-white">{statusIcon()} {data().name}</span>
        <Show when={data().row_count !== undefined}>
          <span class="text-xs font-bold text-blue-600 dark:text-blue-400">{data().row_count?.toLocaleString()} results</span>
        </Show>
      </div>
      <div class="flex flex-wrap gap-1.5 mb-1">
        <For each={data().capabilities}>
          {(cap: any) => (
            <span class={`text-[10px] px-1.5 py-0.5 rounded ${cap.supported ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
              {cap.supported ? '✅' : '❌'} {cap.label}
            </span>
          )}
        </For>
      </div>
      <Show when={data().freshness || data().latency_ms}>
        <p class="text-[10px] text-gray-400">{[data().freshness, data().latency_ms ? `${data().latency_ms}ms` : ''].filter(Boolean).join(' · ')}</p>
      </Show>
    </div>
  )
}

// ─── Diff Section (F10) ──────────────────────────────────────

const DiffSection: Component<{ content: unknown }> = (props) => {
  const data = () => {
    const c = props.content as any
    return { left: c?.left || { label: 'A', rows: [] }, right: c?.right || { label: 'B', rows: [] }, highlight: c?.highlight_columns || [] }
  }
  const allKeys = () => {
    const l = data().left.rows[0] || {}
    const r = data().right.rows[0] || {}
    return [...new Set([...Object.keys(l), ...Object.keys(r)])]
  }

  return (
    <div class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead>
          <tr>
            <th class="px-2 py-1 text-left text-gray-500 dark:text-gray-400"></th>
            <th class="px-2 py-1 text-left font-medium text-blue-600 dark:text-blue-400">{data().left.label}</th>
            <th class="px-2 py-1 text-left font-medium text-purple-600 dark:text-purple-400">{data().right.label}</th>
          </tr>
        </thead>
        <tbody>
          <For each={allKeys()}>
            {(key) => {
              const lVal = () => data().left.rows[0]?.[key]
              const rVal = () => data().right.rows[0]?.[key]
              const isDiff = () => String(lVal()) !== String(rVal()) && data().highlight.includes(key)
              return (
                <tr class={`border-t border-gray-100 dark:border-gray-700 ${isDiff() ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                  <td class="px-2 py-1 font-mono text-gray-500 dark:text-gray-400">{key}</td>
                  <td class="px-2 py-1 text-gray-900 dark:text-white">{lVal() !== undefined ? String(lVal()) : '—'}</td>
                  <td class="px-2 py-1 text-gray-900 dark:text-white">{rVal() !== undefined ? String(rVal()) : '—'}</td>
                </tr>
              )
            }}
          </For>
        </tbody>
      </table>
    </div>
  )
}
