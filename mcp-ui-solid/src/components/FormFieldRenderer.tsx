/**
 * FormFieldRenderer - Individual form field component
 * Sprint 1: Form Foundation
 * Sprint 2: Conditional field visibility (showWhen)
 */

import { Component, Show, For, Switch, Match, Accessor } from 'solid-js'
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

  const baseInputClass = () => `
    w-full px-3 py-2 border rounded-md
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${props.error
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600'}
    dark:bg-gray-700 dark:text-white
  `

  const fieldId = () => `field-${props.field.name}`
  const errorId = () => `${props.field.name}-error`

  return (
    <Show when={isVisible()}>
    <div class="space-y-1">
      <Show when={props.field.label && props.field.type !== 'checkbox'}>
        <label
          for={fieldId()}
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {props.field.label}
          <Show when={props.field.required}>
            <span class="text-red-500 ml-1" aria-hidden="true">*</span>
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

        {/* Select */}
        <Match when={props.field.type === 'select'}>
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
      </Switch>

      <Show when={props.field.helpText && !props.error}>
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
