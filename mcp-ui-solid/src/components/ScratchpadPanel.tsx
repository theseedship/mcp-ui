/**
 * ScratchpadPanel v2 — HITL/AITL shared workspace
 * v2.8.2: Close button, collapsible, auto-close, empty state, animations
 *
 * @experimental
 */

import { Component, Show, For, Switch, Match, createSignal, createEffect, onCleanup } from 'solid-js'
import type { ScratchpadState, ScratchpadSection } from '../types/chat-bus'

export interface ScratchpadPanelProps {
  state: ScratchpadState
  /** Called when human modifies filters */
  onFilterChange?: (filters: Record<string, string | string[]>) => void
  /** Called when human clicks an action button */
  onAction?: (action: string, data?: unknown) => void
  /** Called when human edits a section */
  onSectionEdit?: (sectionId: string, content: unknown) => void
  /** Called when user closes the panel */
  onClose?: () => void
  /** Show close button (default: true) */
  closable?: boolean
  /** Auto-close delay in ms after status=complete (default: undefined = no auto-close) */
  autoCloseDelay?: number
  /** Allow collapsing body by clicking header (default: true) */
  collapsible?: boolean
  /** CSS max-height for scrollable body (default: "400px") */
  maxHeight?: string
}

const STATUS_BADGES: Record<ScratchpadState['status'], { label: string; class: string }> = {
  loading: { label: 'Loading...', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ready: { label: 'Ready', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  waiting_human: { label: 'Your turn', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' },
  processing: { label: 'Processing...', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  complete: { label: 'Complete', class: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
}

/**
 * @experimental
 */
export const ScratchpadPanel: Component<ScratchpadPanelProps> = (props) => {
  const [collapsed, setCollapsed] = createSignal(false)
  const badge = () => STATUS_BADGES[props.state.status] || STATUS_BADGES.loading
  const isClosable = () => props.closable !== false
  const isCollapsible = () => props.collapsible !== false

  // Auto-close on complete
  createEffect(() => {
    if (props.state.status === 'complete' && props.autoCloseDelay) {
      const timer = setTimeout(() => props.onClose?.(), props.autoCloseDelay)
      onCleanup(() => clearTimeout(timer))
    }
  })

  const handleHeaderClick = () => {
    if (isCollapsible()) setCollapsed(!collapsed())
  }

  return (
    <div
      class="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-visible"
      style={{ animation: 'scratchpad-slide-down 0.2s ease-out' }}
    >
      {/* Header */}
      <div
        class={`flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${isCollapsible() ? 'cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-750' : ''}`}
        onClick={handleHeaderClick}
      >
        <div class="flex items-center gap-2">
          <span class="text-base">&#128221;</span>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{props.state.title}</h3>
          <Show when={isCollapsible()}>
            <svg class={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsed() ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${badge().class}`}>
            {badge().label}
          </span>
          <Show when={isClosable() && props.onClose}>
            <button
              onClick={(e) => { e.stopPropagation(); props.onClose?.() }}
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close scratchpad"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Body — collapsible */}
      <Show when={!collapsed()}>
        <div style={{ "max-height": props.maxHeight || "400px", "overflow-y": "auto" }}>
          {/* Sections */}
          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            <For each={props.state.sections}>
              {(section) => (
                <SectionRenderer
                  section={section}
                  filters={props.state.filters}
                  onFilterChange={props.onFilterChange}
                  onAction={props.onAction}
                  onSectionEdit={props.onSectionEdit}
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
                    <span class="flex-shrink-0 mt-0.5">
                      {msg.type === 'warning' ? '⚠️' : msg.type === 'question' ? '❓' : 'ℹ️'}
                    </span>
                    <p>{msg.text}</p>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Preview */}
          <Show when={props.state.preview}>
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <Show when={props.state.preview!.count === 0} fallback={
                <>
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Preview</span>
                    <span class="px-1.5 py-0.5 text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {props.state.preview!.count.toLocaleString()}
                    </span>
                  </div>
                  <p class="text-sm text-gray-700 dark:text-gray-300">{props.state.preview!.summary}</p>
                  <Show when={props.state.preview!.rows && props.state.preview!.rows!.length > 0}>
                    <div class="mt-2 overflow-x-auto">
                      <table class="min-w-full text-xs">
                        <thead>
                          <tr>
                            <For each={Object.keys(props.state.preview!.rows![0])}>
                              {(key) => <th class="px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400">{key}</th>}
                            </For>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={props.state.preview!.rows!.slice(0, 5)}>
                            {(row) => (
                              <tr class="border-t border-gray-100 dark:border-gray-700">
                                <For each={Object.values(row)}>
                                  {(val) => <td class="px-2 py-1 text-gray-700 dark:text-gray-300">{String(val)}</td>}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </>
              }>
                {/* Empty state */}
                <div class="flex flex-col items-center gap-2 py-4 text-center">
                  <span class="text-2xl">&#128269;</span>
                  <p class="text-sm text-gray-500 dark:text-gray-400">No results for these filters</p>
                  <Show when={props.onFilterChange}>
                    <button
                      type="button"
                      onClick={() => props.onAction?.('refine_filters')}
                      class="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      Modify filters
                    </button>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <style>{`
        @keyframes scratchpad-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Section Renderer ────────────────────────────────────────

const SectionRenderer: Component<{
  section: ScratchpadSection
  filters: Record<string, string | string[]>
  onFilterChange?: (filters: Record<string, string | string[]>) => void
  onAction?: (action: string, data?: unknown) => void
  onSectionEdit?: (sectionId: string, content: unknown) => void
}> = (props) => {
  return (
    <div class="px-4 py-3">
      <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{props.section.title}</h4>

      <Switch>
        <Match when={props.section.type === 'data'}>
          <DataSection content={props.section.content} />
        </Match>
        <Match when={props.section.type === 'filter'}>
          <FilterSection filters={props.filters} onFilterChange={props.onFilterChange} />
        </Match>
        <Match when={props.section.type === 'message'}>
          <p class="text-sm text-gray-700 dark:text-gray-300">{String(props.section.content)}</p>
        </Match>
        <Match when={props.section.type === 'action'}>
          <ActionSection content={props.section.content} onAction={props.onAction} />
        </Match>
        <Match when={props.section.type === 'steps'}>
          <StepsSection content={props.section.content} />
        </Match>
        <Match when={true}>
          <pre class="text-xs text-gray-500 dark:text-gray-400 overflow-auto">
            {JSON.stringify(props.section.content, null, 2)}
          </pre>
        </Match>
      </Switch>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

const DataSection: Component<{ content: unknown }> = (props) => {
  const entries = () => {
    if (typeof props.content !== 'object' || !props.content) return []
    return Object.entries(props.content as Record<string, unknown>)
  }

  return (
    <div class="space-y-1">
      <For each={entries()}>
        {([key, value]) => (
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-gray-400 font-mono text-xs min-w-[120px]">{key}:</span>
            <span class="text-gray-900 dark:text-white text-xs">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </span>
          </div>
        )}
      </For>
    </div>
  )
}

const FilterSection: Component<{
  filters: Record<string, string | string[]>
  onFilterChange?: (filters: Record<string, string | string[]>) => void
}> = (props) => {
  const removeFilter = (key: string) => {
    const next = { ...props.filters }
    delete next[key]
    props.onFilterChange?.(next)
  }

  const entries = () => Object.entries(props.filters)

  return (
    <div class="flex flex-wrap gap-1.5">
      <For each={entries()}>
        {([key, value]) => (
          <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
            <span class="text-blue-500 dark:text-blue-400">{key}:</span>
            {Array.isArray(value) ? value.join(', ') : String(value)}
            <Show when={props.onFilterChange}>
              <button
                type="button"
                onClick={() => removeFilter(key)}
                class="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                aria-label={`Remove filter ${key}`}
              >
                &times;
              </button>
            </Show>
          </span>
        )}
      </For>
      <Show when={entries().length === 0}>
        <p class="text-xs text-gray-400 italic">No filters applied</p>
      </Show>
    </div>
  )
}

const ActionSection: Component<{
  content: unknown
  onAction?: (action: string, data?: unknown) => void
}> = (props) => {
  const actions = () => {
    if (Array.isArray(props.content)) return props.content as Array<{ label: string; value?: string; action?: string; variant?: string; icon?: string }>
    return []
  }

  return (
    <div class="flex flex-wrap gap-2">
      <For each={actions()}>
        {(item) => (
          <button
            type="button"
            onClick={() => props.onAction?.(item.value || item.action || item.label, item)}
            class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              item.variant === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : item.variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Show when={item.icon}><span class="mr-1">{item.icon}</span></Show>
            {item.label}
          </button>
        )}
      </For>
    </div>
  )
}

const StepsSection: Component<{ content: unknown }> = (props) => {
  const steps = () => {
    if (Array.isArray(props.content)) return props.content as Array<{ label: string; status: 'done' | 'active' | 'pending' }>
    return []
  }

  return (
    <div class="flex items-center gap-1">
      <For each={steps()}>
        {(step, i) => (
          <>
            <Show when={i() > 0}>
              <div class={`w-6 h-px ${step.status === 'pending' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-400'}`} />
            </Show>
            <div class={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              step.status === 'done' ? 'text-green-600 dark:text-green-400'
              : step.status === 'active' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'text-gray-400'
            }`}>
              {step.status === 'done' ? '✓' : step.status === 'active' ? '●' : '○'}
              {step.label}
            </div>
          </>
        )}
      </For>
    </div>
  )
}
