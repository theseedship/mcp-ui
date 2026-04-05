/**
 * ChatPrompt — Ephemeral structured interaction above chat input
 * v2.4.0: choice, confirm, form subtypes
 *
 * @experimental — This component may change without major bump until v2.5.0.
 *
 * Renders above the chat input. User responds → Promise resolves → prompt disappears.
 * Supports AbortSignal for cleanup on navigation (C4).
 */

import { Component, Show, For, createSignal, onCleanup, Switch, Match } from 'solid-js'
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
      class="w-full max-w-2xl mx-auto mb-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
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
    switch (props.config.layout) {
      case 'vertical': return 'flex flex-col gap-2'
      case 'grid': return 'grid grid-cols-2 gap-2'
      default: return 'flex flex-wrap gap-2'
    }
  }

  return (
    <div class={layoutClass()}>
      <For each={props.config.options}>
        {(option) => (
          <button
            onClick={() => props.onSelect(option.value, option.label)}
            class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 transition-colors text-left"
          >
            <Show when={option.icon}>
              <span class="mr-2">{option.icon}</span>
            </Show>
            {option.label}
            <Show when={option.description}>
              <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">{option.description}</span>
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

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

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

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-3">
      <For each={props.config.fields}>
        {(field) => (
          <FormFieldRenderer
            field={field as FormFieldParams}
            value={formData()[field.name]}
            onChange={(val) => updateField(field.name, val)}
            formData={formData}
          />
        )}
      </For>
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
