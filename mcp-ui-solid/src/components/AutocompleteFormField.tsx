/**
 * AutocompleteFormField Component
 * Form field with integrated autocomplete support
 *
 * Sprint Autocomplete Feature
 */

import { Component, Show, createSignal, createMemo, Accessor, createEffect, on } from 'solid-js'
import type { FormFieldParams, FieldAutocompleteConfig, AutocompleteContext } from '../types'
import { useConditionalField } from '../hooks/useConditionalField'
import { useAutocomplete } from '../hooks/useAutocomplete'
import { useAutocompleteContextSafe } from '../context/AutocompleteContext'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'
import { GhostText } from './GhostText'
import { AutocompleteDropdown } from './AutocompleteDropdown'

/**
 * Extended FormFieldParams with autocomplete config
 */
export interface AutocompleteFormFieldParams extends FormFieldParams {
  /**
   * Autocomplete configuration for this field
   */
  autocomplete?: FieldAutocompleteConfig
}

/**
 * Props for AutocompleteFormField
 */
export interface AutocompleteFormFieldProps {
  /**
   * Field configuration
   */
  field: AutocompleteFormFieldParams

  /**
   * Current field value
   */
  value: any

  /**
   * Error message
   */
  error?: string

  /**
   * Change handler
   */
  onChange: (value: any) => void

  /**
   * Whether field is disabled
   */
  disabled?: boolean

  /**
   * Form data accessor for conditional visibility and context
   */
  formData?: Accessor<Record<string, any>>
}

/**
 * AutocompleteFormField Component
 */
export const AutocompleteFormField: Component<AutocompleteFormFieldProps> = (props) => {
  const strings = useMCPUIStrings()
  // Check if autocomplete context is available
  const autocompleteCtx = useAutocompleteContextSafe()

  // Conditional visibility
  const { isVisible } = useConditionalField({
    condition: props.field.showWhen,
    formData: props.formData || (() => ({}))
  })

  // Local input value for autocomplete (may differ during suggestion)
  const [localValue, setLocalValue] = createSignal(String(props.value || ''))

  // Sync external value changes
  createEffect(on(() => props.value, (newValue) => {
    setLocalValue(String(newValue || ''))
  }))

  // Build autocomplete context
  const autocompleteContext = createMemo((): AutocompleteContext | undefined => {
    const formData = props.formData?.()
    const config = props.field.autocomplete

    if (!config?.contextFields?.length && !formData) {
      return { fieldName: props.field.name }
    }

    const contextData: Record<string, any> = {}
    if (config?.contextFields && formData) {
      config.contextFields.forEach(field => {
        if (formData[field] !== undefined) {
          contextData[field] = formData[field]
        }
      })
    }

    return {
      fieldName: props.field.name,
      formData: contextData
    }
  })

  // Initialize autocomplete hook
  const autocomplete = useAutocomplete({
    inputValue: localValue,
    pluginId: props.field.autocomplete?.plugin,
    fieldConfig: props.field.autocomplete,
    context: () => autocompleteContext() || { fieldName: props.field.name },
    enabled: !!(props.field.autocomplete?.enabled && autocompleteCtx),
    minChars: props.field.autocomplete?.minChars,
    debounceMs: props.field.autocomplete?.debounceMs,
    onInputChange: (value) => {
      setLocalValue(value)
      props.onChange(value)
    }
  })

  // Handle input change
  const handleInput = (value: string) => {
    setLocalValue(value)
    props.onChange(value)
  }

  // Handle key down
  const handleKeyDown = (e: KeyboardEvent) => {
    if (autocomplete.handleKeyDown(e)) {
      return
    }
  }

  // Base input class
  const baseInputClass = () => `
    w-full px-3 py-2 border rounded-md
    focus:ring-2 focus:ring-[color:var(--mcp-ui-focus,var(--color-blue-500))] focus:border-[color:var(--mcp-ui-focus,var(--color-blue-500))]
    disabled:bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-100,#f3f4f6))] disabled:cursor-not-allowed
    ${props.error
      ? 'border-[color:var(--mcp-ui-danger-border,var(--color-red-500))] focus:ring-[color:var(--mcp-ui-focus,var(--color-red-500))]'
      : 'border-[color:var(--mcp-ui-border-control,var(--color-gray-300,#d1d5db))] dark:border-[color:var(--mcp-ui-border-control,var(--color-gray-600,#4b5563))]'}
    dark:bg-[color:var(--mcp-ui-surface-muted,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-white,#fff))]
  `

  const fieldId = () => `field-${props.field.name}`
  const errorId = () => `${props.field.name}-error`

  // Check if field supports autocomplete (text-based fields only)
  const supportsAutocomplete = createMemo(() =>
    ['text', 'email'].includes(props.field.type)
  )

  // Whether to show autocomplete features
  const showAutocomplete = createMemo(() =>
    supportsAutocomplete() &&
    props.field.autocomplete?.enabled &&
    autocompleteCtx !== undefined
  )

  return (
    <Show when={isVisible()}>
      <div class="space-y-1">
        {/* Label */}
        <Show when={props.field.label}>
          <label
            for={fieldId()}
            class="block text-sm font-medium text-[color:var(--mcp-ui-fg,var(--color-gray-700,#374151))] dark:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))]"
          >
            {props.field.label}
            <Show when={props.field.required}>
              <span class="text-[color:var(--mcp-ui-danger,var(--color-red-500))] ml-1" aria-hidden="true">*</span>
            </Show>
          </label>
        </Show>

        {/* Input with autocomplete */}
        <div class="relative">
          <Show
            when={showAutocomplete()}
            fallback={
              /* Standard input without autocomplete */
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
            }
          >
            {/* Autocomplete-enabled input */}
            <div class="relative">
              {/* Ghost text overlay (for completion type) */}
              <Show when={autocomplete.resultType() === 'completion'}>
                <GhostText
                  inputValue={localValue()}
                  ghostText={autocomplete.ghostText()}
                  visible={autocomplete.isOpen()}
                  hintText={
                    autocomplete.ghostText() ? strings.autocompleteTabToAccept : undefined
                  }
                  isLoading={autocomplete.isLoading()}
                />
              </Show>

              <input
                id={fieldId()}
                type={props.field.type}
                name={props.field.name}
                value={localValue()}
                onInput={(e) => handleInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay dismiss to allow click on dropdown
                  setTimeout(() => autocomplete.dismiss(), 150)
                }}
                onFocus={() => {
                  if (localValue().length >= (props.field.autocomplete?.minChars || 1)) {
                    autocomplete.open()
                  }
                }}
                placeholder={props.field.placeholder}
                disabled={props.disabled}
                required={props.field.required}
                minLength={props.field.minLength}
                maxLength={props.field.maxLength}
                pattern={props.field.pattern}
                aria-invalid={!!props.error}
                aria-describedby={props.error ? errorId() : undefined}
                aria-autocomplete="list"
                aria-expanded={autocomplete.isOpen()}
                aria-haspopup="listbox"
                class={`${baseInputClass()} ${autocomplete.resultType() === 'completion' ? 'bg-transparent' : ''}`}
                style={{
                  position: 'relative',
                  'z-index': '2'
                }}
                autocomplete="off"
              />

              {/* Dropdown (for options type) */}
              <Show when={autocomplete.resultType() === 'options'}>
                <AutocompleteDropdown
                  options={autocomplete.options()}
                  selectedIndex={autocomplete.selectedIndex()}
                  isOpen={autocomplete.isOpen()}
                  isLoading={autocomplete.isLoading()}
                  onSelect={(option) => {
                    handleInput(option.value)
                    autocomplete.dismiss()
                  }}
                  onHover={(_index) => {
                    // Could add hover selection here
                  }}
                  highlightMatch={localValue()}
                  loadingMessage={props.field.autocomplete?.loadingPlaceholder}
                />
              </Show>
            </div>
          </Show>
        </div>

        {/* Help text */}
        <Show when={props.field.helpText && !props.error}>
          <p class="text-xs text-[color:var(--mcp-ui-fg-muted,var(--color-gray-500,#6b7280))] dark:text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))]">
            {props.field.helpText}
          </p>
        </Show>

        {/* Error message */}
        <Show when={props.error}>
          <p id={errorId()} role="alert" class="text-xs text-[color:var(--mcp-ui-danger,var(--color-red-600))] dark:text-[color:var(--mcp-ui-danger,var(--color-red-400))]">
            {props.error}
          </p>
        </Show>
      </div>
    </Show>
  )
}

export default AutocompleteFormField
