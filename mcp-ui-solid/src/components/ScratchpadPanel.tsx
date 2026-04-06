/**
 * ScratchpadPanel v3 — Full HITL/AITL workspace
 * v2.9.0: Interactive filters, form sections, stepper, preview auto-refresh
 *
 * @experimental
 */

import { Component, Show, For, Switch, Match, createSignal, createEffect, onCleanup } from 'solid-js'
import type { ScratchpadState, ScratchpadSection } from '../types/chat-bus'
import type { FormFieldParams } from '../types'
import { FormFieldRenderer } from './FormFieldRenderer'

export interface ScratchpadPanelProps {
  state: ScratchpadState
  onFilterChange?: (filters: Record<string, string | string[]>) => void
  onAction?: (action: string, data?: unknown) => void
  onSectionEdit?: (sectionId: string, content: unknown) => void
  onClose?: () => void
  closable?: boolean
  autoCloseDelay?: number
  collapsible?: boolean
  maxHeight?: string
}

const STATUS_BADGES: Record<ScratchpadState['status'], { label: string; class: string }> = {
  loading: { label: 'Loading...', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ready: { label: 'Ready', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  waiting_human: { label: 'Your turn', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse' },
  processing: { label: 'Processing...', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  complete: { label: 'Complete', class: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
}

export const ScratchpadPanel: Component<ScratchpadPanelProps> = (props) => {
  const [collapsed, setCollapsed] = createSignal(false)
  const [localPreview, setLocalPreview] = createSignal<ScratchpadState['preview']>(undefined)
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  const badge = () => STATUS_BADGES[props.state.status] || STATUS_BADGES.loading
  const isClosable = () => props.closable !== false
  const isCollapsible = () => props.collapsible !== false
  const preview = () => localPreview() || props.state.preview
  const hasFilters = () => Object.keys(props.state.filters || {}).length > 0

  // Auto-close on complete
  createEffect(() => {
    if (props.state.status === 'complete' && props.autoCloseDelay) {
      const timer = setTimeout(() => props.onClose?.(), props.autoCloseDelay)
      onCleanup(() => clearTimeout(timer))
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      }`}
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

          {/* Search button when waiting_human */}
          <Show when={props.state.status === 'waiting_human' && hasFilters()}>
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => props.onAction?.('search', { filters: props.state.filters })}
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
        <Match when={props.section.type === 'data'}><DataSection content={props.section.content} /></Match>
        <Match when={props.section.type === 'filter'}><InteractiveFilterSection content={props.section.content} filters={props.filters} onFilterChange={props.onFilterChange} /></Match>
        <Match when={props.section.type === 'message'}><p class="text-sm text-gray-700 dark:text-gray-300">{String(props.section.content)}</p></Match>
        <Match when={props.section.type === 'action'}><ActionSection content={props.section.content} onAction={props.onAction} /></Match>
        <Match when={props.section.type === 'steps'}><EnrichedStepsSection content={props.section.content} onAction={props.onAction} onFilterChange={props.onFilterChange} /></Match>
        <Match when={props.section.type === 'form'}><EmbeddedFormSection content={props.section.content} sectionId={props.section.id} onAction={props.onAction} /></Match>
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
}> = (props) => {
  const [formData, setFormData] = createSignal<Record<string, any>>({})
  const [dynamicOptions, setDynamicOptions] = createSignal<Record<string, Array<{ label: string; value: string }>>>({})

  const config = () => {
    const c = props.content as any
    return { fields: c?.fields || [], submitLabel: c?.submitLabel || 'Submit' }
  }

  const updateField = (name: string, value: any) => setFormData(prev => ({ ...prev, [name]: value }))

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
    props.onAction?.('submit_form', { sectionId: props.sectionId, values: formData() })
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-3">
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
      <div class="flex justify-end">
        <button type="submit" class="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          {config().submitLabel}
        </button>
      </div>
    </form>
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
          <div class={`rounded-lg ${step.status === 'active' ? 'bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3' : 'px-1'}`}>
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
  const actions = () => Array.isArray(props.content) ? props.content as Array<{ label: string; value?: string; action?: string; variant?: string; icon?: string }> : []
  return (
    <div class="flex flex-wrap gap-2">
      <For each={actions()}>
        {(item) => (
          <button type="button" onClick={() => props.onAction?.(item.value || item.action || item.label, item)}
            class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              item.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700'
              : item.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
            <Show when={item.icon}><span class="mr-1">{item.icon}</span></Show>
            {item.label}
          </button>
        )}
      </For>
    </div>
  )
}
