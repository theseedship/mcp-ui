/**
 * ChatPrompt — Ephemeral structured interaction above chat input
 * v2.4.0: choice, confirm, form subtypes
 *
 * @experimental — This component may change without major bump until v2.5.0.
 *
 * Renders above the chat input. User responds → consumer calls `onSubmit` →
 * prompt disappears.
 *
 * ## AbortSignal — known limitation (v5.1.0)
 *
 * **`ChatPrompt` itself does NOT listen to any `AbortSignal`.** It is a pure
 * presentation component: render a config, call `onSubmit` on user answer,
 * call `onDismiss` on X/Cancel. Lifecycle (including abort handling) is the
 * consumer's responsibility.
 *
 * `ChatCommands.showChatPrompt(config, signal?)` declares a `signal?` argument
 * in its type, but in v5.0.0/v5.1.0 mcp-ui ships **no default handler** for
 * this command — every consumer wires its own `bus.commands.handle('showChatPrompt', ...)`.
 * Each consumer's handler is responsible for:
 *
 * 1. Storing a `{ resolve, reject }` pair when the command fires.
 * 2. Calling `resolve(response)` from `onSubmit` / `resolve(dismissed)` from `onDismiss`.
 * 3. If a `signal` is provided: `signal.addEventListener('abort', () =>
 *    reject(new DOMException('Prompt aborted', 'AbortError')))` and cleaning
 *    up the listener on resolve/dismiss.
 *
 * The `DOMException('AbortError')` shape is the Web Platform convention
 * (matches `fetch()`, `Response.body.cancel()`, `WritableStream.abort()`).
 * Consumers can branch on `err.name === 'AbortError'` without importing any
 * mcp-ui type.
 *
 * A `createChatPromptController()` primitive centralising this wiring
 * (resolver lifecycle + re-entrance + abort) is planned for v5.2.0 — see
 * `docs/2026/r&d/mcpui-v5.1.0-consensus.md` for the design discussion.
 *
 * ## Re-entrance — known limitation (v5.1.0)
 *
 * Also handled by the consumer. If a new `showChatPrompt` arrives while a
 * previous one is active, the consumer's handler must decide whether to
 * auto-reject the previous Promise, queue, or throw. mcp-ui does not
 * currently enforce any policy. See the same design doc for the v5.2.0
 * direction (auto-reject with `PromptReplacedError`).
 */

import { Component, Show, For, createSignal, createEffect, onCleanup, Switch, Match } from 'solid-js'
import type {
  ChatPromptConfig,
  ChatPromptResponse,
  ChoicePromptConfig,
  ConfirmPromptConfig,
  FormPromptConfig,
} from '../types/chat-bus'
import { FormFieldRenderer } from './FormFieldRenderer'
import type { FormFieldParams } from '../types'

export interface ChatPromptProps {
  /** Prompt configuration */
  config: ChatPromptConfig
  /** Called when user responds */
  onSubmit: (response: ChatPromptResponse) => void
  /** Called when user dismisses (e.g. "send as-is") */
  onDismiss?: () => void
  /** Label for the dismiss button (replaces X icon). Default: shows X icon. */
  dismissLabel?: string
}

/**
 * @experimental
 * Ephemeral interaction component — choice buttons, confirmation dialog, or quick form.
 * Designed to sit between the chat messages and the input area.
 *
 * @example
 * <ChatPrompt
 *   config={{ type: 'choice', title: 'Format?', config: { options: [...] } }}
 *   onSubmit={(r) => bus.events.emit('onChatPromptResponse', { streamKey, response: r })}
 *   onDismiss={() => setActivePrompt(null)}
 * />
 */
export const ChatPrompt: Component<ChatPromptProps> = (props) => {
  // F1: Guard against null/undefined config (e.g. after dismiss clears state)
  if (!props.config) return null

  return (
    <div
      class="w-full max-w-2xl mx-auto mb-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-visible"
      style={{ animation: 'chat-prompt-slide-up 0.2s ease-out' }}
      role="dialog"
      aria-label={props.config.title}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{props.config.title}</p>
        <button
          onClick={() => {
            props.onDismiss?.()
            props.onSubmit({ type: props.config.type, value: '', label: '', dismissed: true })
          }}
          class={props.dismissLabel
            ? 'px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors'
            : 'p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
          }
          aria-label={props.dismissLabel || 'Dismiss'}
        >
          <Show when={props.dismissLabel} fallback={
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          }>
            {props.dismissLabel}
          </Show>
        </button>
      </div>

      {/* Body — type-specific */}
      <div class="px-4 py-3">
        <Switch>
          <Match when={props.config.type === 'choice'}>
            <ChoiceBody
              config={props.config.config as ChoicePromptConfig}
              onSelect={(value, label) => props.onSubmit({ type: 'choice', value, label })}
            />
          </Match>
          <Match when={props.config.type === 'confirm'}>
            <ConfirmBody
              config={props.config.config as ConfirmPromptConfig}
              onConfirm={() => props.onSubmit({ type: 'confirm', value: 'confirmed', label: (props.config.config as ConfirmPromptConfig).confirmLabel || 'Confirmed' })}
              onCancel={() => {
                props.onDismiss?.()
                props.onSubmit({ type: 'confirm', value: 'cancelled', label: (props.config.config as ConfirmPromptConfig).cancelLabel || 'Cancelled', dismissed: true })
              }}
            />
          </Match>
          <Match when={props.config.type === 'form'}>
            <FormBody
              config={props.config.config as FormPromptConfig}
              onSubmit={(data, label) => props.onSubmit({ type: 'form', value: data, label })}
            />
          </Match>
        </Switch>
      </div>

      <style>{`
        @keyframes chat-prompt-slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Choice ──────────────────────────────────────────────────

const ChoiceBody: Component<{
  config: ChoicePromptConfig
  onSelect: (value: string, label: string) => void
}> = (props) => {
  const layoutClass = () => {
    const base = (() => {
      switch (props.config.layout) {
        case 'vertical': return 'flex flex-col gap-2'
        case 'grid': return 'grid grid-cols-2 gap-2'
        default: return 'flex flex-wrap gap-2'
      }
    })()
    const extra = props.config.containerClass
    return extra ? `${base} ${extra}` : base
  }

  const buttonClass = () => {
    const base = 'px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 transition-colors text-left'
    const extra = props.config.buttonClass
    return extra ? `${base} ${extra}` : base
  }

  return (
    <div class={layoutClass()}>
      <For each={props.config.options}>
        {(option, i) => (
          <button
            type="button"
            onClick={() => props.onSelect(option.value, option.label)}
            class={buttonClass()}
          >
            <Show
              when={props.config.optionRenderer}
              fallback={
                <>
                  <Show when={option.icon}>
                    <span class="mr-2">{option.icon}</span>
                  </Show>
                  {option.label}
                  <Show when={option.description}>
                    <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">{option.description}</span>
                  </Show>
                </>
              }
            >
              {props.config.optionRenderer!(option, i())}
            </Show>
          </button>
        )}
      </For>
    </div>
  )
}

// ─── Confirm ─────────────────────────────────────────────────

const ConfirmBody: Component<{
  config: ConfirmPromptConfig
  onConfirm: () => void
  onCancel: () => void
}> = (props) => {
  const isDanger = () => props.config.variant === 'danger'

  return (
    <div>
      <Show when={props.config.message}>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{props.config.message}</p>
      </Show>
      <div class="flex gap-2 justify-end">
        <button
          onClick={props.onCancel}
          class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {props.config.cancelLabel || 'Cancel'}
        </button>
        <button
          onClick={props.onConfirm}
          class={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
            isDanger()
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {props.config.confirmLabel || 'Confirm'}
        </button>
      </div>
    </div>
  )
}

// ─── Form (delegates to FormFieldRenderer for all field types) ───

const FormBody: Component<{
  config: FormPromptConfig
  onSubmit: (data: Record<string, unknown>, label: string) => void
}> = (props) => {
  const [formData, setFormData] = createSignal<Record<string, any>>({})
  const [dynamicOptions, setDynamicOptions] = createSignal<Record<string, Array<{ label: string; value: string }>>>({})
  const [previewText, setPreviewText] = createSignal<string>('')
  const [previewLoading, setPreviewLoading] = createSignal(false)
  let previewTimer: ReturnType<typeof setTimeout> | null = null

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // --- depends_on: fetch child options when parent changes ---
  createEffect(() => {
    const data = formData()
    for (const field of props.config.fields || []) {
      const dep = field.dependsOn || (field as any).depends_on
      if (!dep) continue
      const parentValue = data[dep.field]
      if (!parentValue) continue

      const apiUrl = (dep.apiUrl || dep.api_url || '').replace('{value}', encodeURIComponent(parentValue))
      if (!apiUrl) continue

      const params = new URLSearchParams(dep.extraParams || dep.extra_params || {})
      fetch(`${apiUrl}?${params}`)
        .then((r) => r.json())
        .then((items) => {
          const arr = Array.isArray(items) ? items : items.results || items.features || []
          const labelKey = dep.labelField || dep.label_field || 'label'
          const valueKey = dep.valueField || dep.value_field || 'value'
          setDynamicOptions((prev) => ({
            ...prev,
            [field.name]: arr.map((item: any) => ({
              label: item[labelKey] || String(item),
              value: String(item[valueKey] || item[labelKey] || item),
            })),
          }))
        })
        .catch(() => {})
    }
  })

  // --- preview: debounced live preview ---
  createEffect(() => {
    const preview = props.config.preview
    if (!preview) return

    const data = formData()
    // Check if any preview field has a value
    const hasValues = preview.fields.some((f) => {
      const v = data[f]
      return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
    })
    if (!hasValues) { setPreviewText(''); return }

    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const body: Record<string, any> = {}
        for (const f of preview.fields) {
          if (data[f] !== undefined) body[f] = data[f]
        }
        const res = await fetch(preview.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (res.ok) {
          const result = await res.json()
          setPreviewText(result.summary_fr || result.summary || result.message || JSON.stringify(result))
        }
      } catch {
        setPreviewText('')
      }
      setPreviewLoading(false)
    }, preview.debounceMs || 500)
  })

  onCleanup(() => { if (previewTimer) clearTimeout(previewTimer) })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const data = formData()
    const label = Object.entries(data)
      .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(', ')
    props.onSubmit(data, label || 'Form submitted')
  }

  const isValid = () => {
    const data = formData()
    return (props.config.fields || [])
      .filter((f) => f.required)
      .every((f) => {
        const val = data[f.name]
        if (Array.isArray(val)) return val.length > 0
        if (typeof val === 'boolean') return true
        return val !== undefined && val !== ''
      })
  }

  // Build field with dynamic options override
  const getField = (field: any): FormFieldParams => {
    const dynOpts = dynamicOptions()[field.name]
    if (dynOpts) {
      return { ...field, options: dynOpts } as FormFieldParams
    }
    return field as FormFieldParams
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-3">
      <For each={props.config.fields}>
        {(field) => (
          <FormFieldRenderer
            field={getField(field)}
            value={formData()[field.name]}
            onChange={(val) => updateField(field.name, val)}
            formData={formData}
          />
        )}
      </For>

      {/* Live preview */}
      <Show when={previewText() || previewLoading()}>
        <div class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
          <Show when={previewLoading()} fallback={
            <p class="text-blue-700 dark:text-blue-300">{previewText()}</p>
          }>
            <p class="text-blue-400 animate-pulse">Loading preview...</p>
          </Show>
        </div>
      </Show>

      <div class="flex justify-end">
        <button
          type="submit"
          disabled={!isValid()}
          class="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {props.config.submitLabel || 'Submit'}
        </button>
      </div>
    </form>
  )
}
