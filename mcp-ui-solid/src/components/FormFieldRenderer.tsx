/**
 * FormFieldRenderer - Individual form field component
 * Sprint 1: Form Foundation
 * Sprint 2: Conditional field visibility (showWhen)
 */

import { Component, Show, For, Switch, Match, Accessor, createSignal, createEffect, onCleanup } from 'solid-js'
import type { FormFieldParams } from '../types'
import { useConditionalField } from '../hooks/useConditionalField'

export interface FormFieldRendererProps {
  field: FormFieldParams
  value: any
  error?: string
  onChange: (value: any) => void
  disabled?: boolean
  /**
   * Form data accessor for conditional field visibility
   */
  formData?: Accessor<Record<string, any>>
}

export const FormFieldRenderer: Component<FormFieldRendererProps> = (props) => {
  // Conditional visibility based on showWhen
  const { isVisible } = useConditionalField({
    condition: props.field.showWhen,
    formData: props.formData || (() => ({})),
  })

  const status = () => props.field.fieldStatus || 'optional'
  const isUnsupported = () => status() === 'unsupported'
  const isFieldDisabled = () => props.disabled || isUnsupported()

  const baseInputClass = () => `
    w-full px-3 py-2 border rounded-md
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${props.error
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600'}
    dark:bg-gray-700 dark:text-white
    ${isUnsupported() ? 'opacity-50' : ''}
  `

  const fieldId = () => `field-${props.field.name}`
  const errorId = () => `${props.field.name}-error`

  return (
    <Show when={isVisible()}>
    <div class="space-y-1">
      <Show when={props.field.label && props.field.type !== 'checkbox'}>
        <label
          for={fieldId()}
          class={`block text-sm font-medium ${isUnsupported() ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}
        >
          {props.field.label}
          <Show when={props.field.required || status() === 'required'}>
            <span class="text-red-500 ml-1" aria-hidden="true">*</span>
          </Show>
          <Show when={isUnsupported()}>
            <span class="ml-2 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">Not supported</span>
          </Show>
          <Show when={status() === 'unknown'}>
            <span class="ml-2 text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded">?</span>
          </Show>
        </label>
      </Show>

      <Switch>
        {/* Text Input */}
        <Match when={props.field.type === 'text' || props.field.type === 'email' || props.field.type === 'password'}>
          <input
            id={fieldId()}
            type={props.field.type}
            name={props.field.name}
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            minLength={props.field.minLength}
            maxLength={props.field.maxLength}
            pattern={props.field.pattern}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
            class={baseInputClass()}
          />
        </Match>

        {/* Number Input */}
        <Match when={props.field.type === 'number'}>
          <input
            id={fieldId()}
            type="number"
            name={props.field.name}
            value={props.value ?? ''}
            onInput={(e) => props.onChange(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            min={props.field.min}
            max={props.field.max}
            step={props.field.step}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
            class={baseInputClass()}
          />
        </Match>

        {/* Date Input */}
        <Match when={props.field.type === 'date'}>
          <input
            id={fieldId()}
            type="date"
            name={props.field.name}
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            disabled={props.disabled}
            required={props.field.required}
            min={props.field.minDate}
            max={props.field.maxDate}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
            class={baseInputClass()}
          />
        </Match>

        {/* Textarea */}
        <Match when={props.field.type === 'textarea'}>
          <textarea
            id={fieldId()}
            name={props.field.name}
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder={props.field.placeholder}
            disabled={props.disabled}
            required={props.field.required}
            rows={props.field.rows || 4}
            minLength={props.field.minLength}
            maxLength={props.field.maxLength}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
            class={baseInputClass()}
          />
        </Match>

        {/* Select (single) */}
        <Match when={props.field.type === 'select' && !props.field.multiple}>
          <select
            id={fieldId()}
            name={props.field.name}
            value={props.value || ''}
            onChange={(e) => props.onChange(e.currentTarget.value)}
            disabled={props.disabled}
            required={props.field.required}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
            class={baseInputClass()}
          >
            <Show when={props.field.placeholder}>
              <option value="" disabled>{props.field.placeholder}</option>
            </Show>
            <For each={props.field.options}>
              {(option) => (
                <option value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              )}
            </For>
          </select>
        </Match>

        {/* Checkbox */}
        <Match when={props.field.type === 'checkbox'}>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              id={fieldId()}
              type="checkbox"
              name={props.field.name}
              checked={props.value || false}
              onChange={(e) => props.onChange(e.currentTarget.checked)}
              disabled={props.disabled}
              aria-invalid={!!props.error}
              aria-describedby={props.error ? errorId() : undefined}
              class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {props.field.checkboxLabel || props.field.label}
              <Show when={props.field.required}>
                <span class="text-red-500 ml-1" aria-hidden="true">*</span>
              </Show>
            </span>
          </label>
        </Match>

        {/* Multi-Select with chips */}
        <Match when={props.field.type === 'select' && props.field.multiple}>
          <MultiSelectField
            field={props.field}
            value={props.value || []}
            onChange={props.onChange}
            disabled={props.disabled}
            baseClass={baseInputClass()}
          />
        </Match>

        {/* Autocomplete with API fetch */}
        <Match when={props.field.type === 'autocomplete'}>
          <AutocompleteField
            field={props.field}
            value={props.value || ''}
            onChange={props.onChange}
            disabled={props.disabled}
            baseClass={baseInputClass()}
          />
        </Match>

        {/* Radio Group */}
        <Match when={props.field.type === 'radio'}>
          <div
            class="space-y-2"
            role="radiogroup"
            aria-labelledby={props.field.label ? `${fieldId()}-label` : undefined}
            aria-invalid={!!props.error}
            aria-describedby={props.error ? errorId() : undefined}
          >
            <For each={props.field.options}>
              {(option, index) => (
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={props.field.name}
                    id={`${fieldId()}-${index()}`}
                    value={option.value}
                    checked={props.value === option.value}
                    onChange={() => props.onChange(option.value)}
                    disabled={props.disabled || option.disabled}
                    class="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>
                </label>
              )}
            </For>
          </div>
        </Match>

        {/* Range/Slider */}
        <Match when={props.field.type === 'range'}>
          <div class="flex items-center gap-3">
            <input
              id={fieldId()}
              type="range"
              name={props.field.name}
              value={props.value ?? props.field.min ?? 0}
              onInput={(e) => props.onChange(Number(e.currentTarget.value))}
              min={props.field.min}
              max={props.field.max}
              step={props.field.step || 1}
              disabled={isFieldDisabled()}
              class="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span class="text-sm font-mono text-gray-700 dark:text-gray-300 min-w-[3rem] text-right">{props.value ?? props.field.min ?? 0}</span>
          </div>
        </Match>

        {/* Tags/Chips Input */}
        <Match when={props.field.type === 'tags'}>
          <TagsField value={props.value || []} onChange={props.onChange} placeholder={props.field.placeholder} disabled={isFieldDisabled()} baseClass={baseInputClass()} />
        </Match>

        {/* Toggle */}
        <Match when={props.field.type === 'toggle'}>
          <label class="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={!!props.value}
              onClick={() => props.onChange(!props.value)}
              disabled={isFieldDisabled()}
              class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${props.value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} ${isFieldDisabled() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span class={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${props.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span class="text-sm text-gray-700 dark:text-gray-300">{props.field.checkboxLabel || props.field.label}</span>
          </label>
        </Match>

        {/* Fieldset/Group */}
        <Match when={props.field.type === 'fieldset'}>
          <fieldset class="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <legend class="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">{props.field.label}</legend>
            <p class="text-xs text-gray-400">{props.field.helpText || 'Group container'}</p>
          </fieldset>
        </Match>

        {/* Fallback for unknown field types — renders as text input with warning */}
        <Match when={true}>
          <input
            id={fieldId()}
            type="text"
            name={props.field.name}
            value={props.value || ''}
            onInput={(e) => props.onChange(e.currentTarget.value)}
            placeholder={props.field.placeholder || `(${props.field.type})`}
            disabled={props.disabled}
            class={baseInputClass()}
          />
          <p class="text-xs text-amber-500 mt-0.5">Unknown field type: {props.field.type}</p>
        </Match>
      </Switch>

      <Show when={props.field.statusReason}>
        <p class={`text-xs ${
          isUnsupported() ? 'text-orange-500 dark:text-orange-400'
          : status() === 'unknown' ? 'text-yellow-500 dark:text-yellow-400'
          : status() === 'required' ? 'text-blue-500 dark:text-blue-400'
          : 'text-gray-500 dark:text-gray-400'
        }`}>
          {props.field.statusReason}
        </p>
      </Show>

      <Show when={props.field.helpText && !props.error && !props.field.statusReason}>
        <p class="text-xs text-gray-500 dark:text-gray-400">{props.field.helpText}</p>
      </Show>

      <Show when={props.error}>
        <p id={errorId()} role="alert" class="text-xs text-red-600 dark:text-red-400">
          {props.error}
        </p>
      </Show>
    </div>
    </Show>
  )
}

// ─── Multi-Select with Chips ─────────────────────────────────

const MultiSelectField: Component<{
  field: FormFieldParams
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  baseClass: string
}> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [filter, setFilter] = createSignal('')

  const toggle = (val: string) => {
    const current = props.value || []
    if (current.includes(val)) {
      props.onChange(current.filter((v) => v !== val))
    } else {
      props.onChange([...current, val])
    }
  }

  const removeChip = (val: string) => {
    props.onChange((props.value || []).filter((v) => v !== val))
  }

  const getLabel = (val: string) =>
    props.field.options?.find((o) => o.value === val)?.label || val

  const filteredOptions = () => {
    const q = filter().toLowerCase()
    if (!q) return props.field.options || []
    return (props.field.options || []).filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    )
  }

  return (
    <div class="relative">
      {/* Selected chips */}
      <Show when={props.value.length > 0}>
        <div class="flex flex-wrap gap-1 mb-1">
          <For each={props.value}>
            {(val) => (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {getLabel(val)}
                <button
                  type="button"
                  onClick={() => removeChip(val)}
                  class="hover:text-blue-900 dark:hover:text-blue-100"
                  aria-label={`Remove ${getLabel(val)}`}
                >
                  &times;
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(!open()); if (!open()) setFilter('') }}
        disabled={props.disabled}
        class={`${props.baseClass} text-left flex items-center justify-between`}
      >
        <span class={props.value.length ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
          {props.value.length
            ? `${props.value.length} selected`
            : props.field.placeholder || 'Select...'}
        </span>
        <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown with filter */}
      <Show when={open()}>
        <div
          class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
          style={{ "max-height": "320px", display: "flex", "flex-direction": "column" }}
        >
          {/* Search filter */}
          <Show when={(props.field.options?.length || 0) > 10}>
            <div class="p-2 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
              <input
                type="text"
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
                placeholder="Filter..."
                class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-400 outline-none"
                autofocus
              />
            </div>
          </Show>
          {/* Options list — scrollable */}
          <div style={{ "overflow-y": "auto", "flex": "1", "-webkit-overflow-scrolling": "touch" }}>
            <For each={filteredOptions()}>
              {(option) => (
                <label class="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={(props.value || []).includes(option.value)}
                    onChange={() => toggle(option.value)}
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  />
                  <span class="text-gray-900 dark:text-white">{option.label}</span>
                </label>
              )}
            </For>
            <Show when={filteredOptions().length === 0}>
              <p class="px-3 py-2 text-sm text-gray-400">No matches</p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

// ─── Autocomplete with API fetch ─────────────────────────────

const AutocompleteField: Component<{
  field: FormFieldParams
  value: string | string[]
  onChange: (value: string | string[]) => void
  disabled?: boolean
  baseClass: string
}> = (props) => {
  const [query, setQuery] = createSignal('')
  const [suggestions, setSuggestions] = createSignal<Array<{ label: string; value: string }>>([])
  const [isOpen, setIsOpen] = createSignal(false)
  const [selectedLabels, setSelectedLabels] = createSignal<Map<string, string>>(new Map())
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const isMultiple = () => props.field.multiple === true
  const selectedValues = () => isMultiple() ? (Array.isArray(props.value) ? props.value : []) : []
  const minChars = () => props.field.minChars ?? 2
  const debounceMs = () => props.field.debounceMs ?? 300

  const fetchSuggestions = async (q: string) => {
    if (!props.field.apiUrl || !props.field.searchParam) return

    try {
      const params = new URLSearchParams({ [props.field.searchParam]: q })
      if (props.field.extraParams) {
        for (const [k, v] of Object.entries(props.field.extraParams)) {
          params.set(k, v)
        }
      }
      const res = await fetch(`${props.field.apiUrl}?${params}`)
      if (!res.ok) return

      const data = await res.json()
      const items = Array.isArray(data) ? data : data.results || data.features || []
      const labelField = props.field.labelField || 'label'
      const valueField = props.field.valueField || 'value'

      setSuggestions(items.slice(0, 10).map((item: any) => ({
        label: item[labelField] || String(item),
        value: String(item[valueField] || item[labelField] || item),
      })))
      setIsOpen(true)
    } catch {
      setSuggestions([])
    }
  }

  const handleInput = (value: string) => {
    setQuery(value)
    if (!isMultiple()) {
      props.onChange('')
    }

    if (debounceTimer) clearTimeout(debounceTimer)
    if (value.length < minChars()) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    debounceTimer = setTimeout(() => fetchSuggestions(value), debounceMs())
  }

  const selectSuggestion = (item: { label: string; value: string }) => {
    if (isMultiple()) {
      const current = selectedValues()
      if (!current.includes(item.value)) {
        props.onChange([...current, item.value])
        setSelectedLabels((prev) => new Map(prev).set(item.value, item.label))
      }
      setQuery('')
      setSuggestions([])
      setIsOpen(false)
    } else {
      props.onChange(item.value)
      setSelectedLabels((prev) => new Map(prev).set(item.value, item.label))
      setQuery(item.label)
      setIsOpen(false)
      setSuggestions([])
    }
  }

  const removeChip = (val: string) => {
    props.onChange(selectedValues().filter((v) => v !== val))
    setSelectedLabels((prev) => { const m = new Map(prev); m.delete(val); return m })
  }

  const getLabel = (val: string) => selectedLabels().get(val) || val

  onCleanup(() => { if (debounceTimer) clearTimeout(debounceTimer) })

  return (
    <div class="relative">
      {/* Multi chips */}
      <Show when={isMultiple() && selectedValues().length > 0}>
        <div class="flex flex-wrap gap-1 mb-1">
          <For each={selectedValues()}>
            {(val) => (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {getLabel(val)}
                <button
                  type="button"
                  onClick={() => removeChip(val)}
                  class="hover:text-blue-900 dark:hover:text-blue-100"
                  aria-label={`Remove ${getLabel(val)}`}
                >
                  &times;
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <input
        type="text"
        value={query()}
        onInput={(e) => handleInput(e.currentTarget.value)}
        onFocus={() => { if (suggestions().length) setIsOpen(true) }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={isMultiple() && selectedValues().length
          ? 'Add more...'
          : props.field.placeholder}
        disabled={props.disabled}
        class={props.baseClass}
        autocomplete="off"
      />

      <Show when={isOpen() && suggestions().length > 0}>
        <div class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-72 overflow-y-auto">
          <For each={suggestions()}>
            {(item) => {
              const isSelected = () => isMultiple() && selectedValues().includes(item.value)
              return (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(item)}
                  class={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                    isSelected() ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-900 dark:text-white'
                  }`}
                  disabled={isSelected()}
                >
                  {item.label}
                  <Show when={isSelected()}>
                    <span class="ml-2 text-xs">&#10003;</span>
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}

// ─── Tags/Chips Input ────────────────────────────────────────

const TagsField: Component<{
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  baseClass: string
}> = (props) => {
  const [input, setInput] = createSignal('')

  const addTag = () => {
    const val = input().trim()
    if (val && !(props.value || []).includes(val)) {
      props.onChange([...(props.value || []), val])
    }
    setInput('')
  }

  const removeTag = (tag: string) => {
    props.onChange((props.value || []).filter(t => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !input() && (props.value || []).length > 0) {
      removeTag(props.value[props.value.length - 1])
    }
  }

  return (
    <div>
      <Show when={(props.value || []).length > 0}>
        <div class="flex flex-wrap gap-1 mb-1">
          <For each={props.value || []}>
            {(tag) => (
              <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} class="hover:text-blue-900 dark:hover:text-blue-100" aria-label={`Remove ${tag}`}>&times;</button>
              </span>
            )}
          </For>
        </div>
      </Show>
      <input
        type="text"
        value={input()}
        onInput={(e) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={props.placeholder || 'Type and press Enter...'}
        disabled={props.disabled}
        class={props.baseClass}
      />
    </div>
  )
}
