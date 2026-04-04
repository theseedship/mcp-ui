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

export interface ChatPromptProps {
  /** Prompt configuration */
  config: ChatPromptConfig
  /** Called when user responds */
  onSubmit: (response: ChatPromptResponse) => void
  /** Called when user dismisses */
  onDismiss?: () => void
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
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Dismiss"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
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

// ─── Form ────────────────────────────────────────────────────

const FormBody: Component<{
  config: FormPromptConfig
  onSubmit: (data: Record<string, unknown>, label: string) => void
}> = (props) => {
  const [formData, setFormData] = createSignal<Record<string, string>>({})

  const updateField = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const data = formData()
    // Build a human-readable label from the form values
    const label = Object.entries(data)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    props.onSubmit(data, label || 'Form submitted')
  }

  const isValid = () => {
    const data = formData()
    return (props.config.fields || [])
      .filter((f) => f.required)
      .every((f) => data[f.name]?.trim())
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-3">
      <For each={props.config.fields}>
        {(field) => (
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {field.label}
              <Show when={field.required}>
                <span class="text-red-500 ml-0.5">*</span>
              </Show>
            </label>
            <Switch>
              <Match when={field.type === 'textarea'}>
                <textarea
                  value={formData()[field.name] || ''}
                  onInput={(e) => updateField(field.name, e.currentTarget.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors"
                />
              </Match>
              <Match when={field.type === 'select'}>
                <select
                  value={formData()[field.name] || ''}
                  onChange={(e) => updateField(field.name, e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors"
                >
                  <option value="">{field.placeholder || 'Select...'}</option>
                  <For each={field.options}>
                    {(opt) => <option value={opt.value}>{opt.label}</option>}
                  </For>
                </select>
              </Match>
              <Match when={true}>
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={formData()[field.name] || ''}
                  onInput={(e) => updateField(field.name, e.currentTarget.value)}
                  placeholder={field.placeholder}
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors"
                />
              </Match>
            </Switch>
          </div>
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
