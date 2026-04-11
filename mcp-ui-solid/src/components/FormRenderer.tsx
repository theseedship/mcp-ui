/**
 * FormRenderer - Main form component
 * Sprint 1: Form Foundation
 * Sprint 2: Conditional field visibility (showWhen)
 * Sprint 4: Form state persistence
 */

import { Component, createSignal, For, Show, onMount, createEffect, onCleanup } from 'solid-js'
import { FormFieldRenderer } from './FormFieldRenderer'
import type { UIComponent, FormComponentParams, FormFieldParams } from '../types'
import { useAction } from '../hooks/useAction'
import { validateFormData } from '../services/validation'
import { evaluateCondition } from '../hooks/useConditionalField'
import { useFormPersistence } from '../hooks/useFormPersistence'

export interface FormRendererProps {
  component: UIComponent
  onSubmit?: (data: Record<string, any>) => void
  onError?: (errors: Record<string, string>) => void
}

/**
 * Get default value for a field type
 */
function getFieldDefault(type: FormFieldParams['type']): any {
  switch (type) {
    case 'checkbox':
      return false
    case 'number':
      return undefined
    case 'select':
    case 'radio':
      return ''
    default:
      return ''
  }
}

export const FormRenderer: Component<FormRendererProps> = (props) => {
  const params = () => props.component.params as FormComponentParams
  const [formData, setFormData] = createSignal<Record<string, any>>({})
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const { execute } = useAction()

  // Form persistence (Sprint 4)
  let clearPersisted: (() => void) | undefined

  /**
   * Get fields that are currently visible based on showWhen conditions
   */
  const getVisibleFields = (): FormFieldParams[] => {
    return params().fields.filter((field) => {
      if (!field.showWhen) return true
      return evaluateCondition(field.showWhen, formData())
    })
  }

  // Auto-submit countdown state (v4.2.0)
  const [countdown, setCountdown] = createSignal<number | null>(null)
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  const [userInteracted, setUserInteracted] = createSignal(false)

  const cancelCountdown = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    setCountdown(null)
  }

  const handleUserInteraction = () => {
    if (!userInteracted()) {
      setUserInteracted(true)
      cancelCountdown()
    }
  }

  onCleanup(() => cancelCountdown())

  /**
   * Check if all required fields have prefill values
   */
  const allRequiredPrefilled = (): boolean => {
    return params().fields
      .filter((f) => f.required)
      .every((f) => f.prefill != null)
  }

  // Initialize form data with default values, applying prefill (v4.2.0)
  const initializeForm = (clearStorage = false) => {
    const initial: Record<string, any> = {}
    for (const field of params().fields) {
      // prefill takes priority over defaultValue
      initial[field.name] = field.prefill ?? field.defaultValue ?? getFieldDefault(field.type)
    }
    setFormData(initial)
    setErrors({})

    // Clear persisted data if requested
    if (clearStorage && clearPersisted) {
      clearPersisted()
    }
  }

  // Initialize on mount
  onMount(() => {
    initializeForm()
  })

  // Setup persistence if persistKey is provided (Sprint 4)
  createEffect(() => {
    const persistKey = params().persistKey
    if (persistKey) {
      const persistence = useFormPersistence({
        persistKey,
        formData,
        setFormData,
        excludeFields: params().excludeFromPersistence,
        expiresIn: params().persistExpiresIn,
      })
      clearPersisted = persistence.clearPersisted
    }
  })

  // Auto-submit countdown (v4.2.0)
  createEffect(() => {
    const delay = params().autoSubmitDelay
    if (!delay || !allRequiredPrefilled() || userInteracted()) return

    let remaining = Math.ceil(delay / 1000)
    setCountdown(remaining)

    countdownTimer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        cancelCountdown()
        // Trigger submit programmatically
        const form = document.querySelector(`#form-${props.component.id}`) as HTMLFormElement | null
        if (form) form.requestSubmit()
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  })

  const handleFieldChange = (name: string, value: any) => {
    handleUserInteraction()
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error on change
    if (errors()[name]) {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [name]: _removed, ...rest } = prev
        return rest
      })
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    // Get only visible fields for validation and submission
    const visibleFields = getVisibleFields()
    const visibleFieldNames = new Set(visibleFields.map((f) => f.name))

    // Filter form data to only include visible fields
    const visibleFormData: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData())) {
      if (visibleFieldNames.has(key)) {
        visibleFormData[key] = value
      }
    }

    // Validate only visible fields
    const validationResult = validateFormData(visibleFormData, visibleFields)
    if (!validationResult.valid) {
      setErrors(validationResult.errors)
      setIsSubmitting(false)
      props.onError?.(validationResult.errors)
      return
    }

    // Submit via tool call if specified
    if (params().submitAction?.toolName) {
      try {
        const result = await execute(params().submitAction!.toolName, {
          ...params().submitAction!.params,
          formData: visibleFormData,
        })
        if (!result.success) {
          setErrors({ _form: result.error || 'Submission failed' })
          setIsSubmitting(false)
          props.onError?.({ _form: result.error || 'Submission failed' })
          return
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Submission failed'
        setErrors({ _form: errorMessage })
        setIsSubmitting(false)
        props.onError?.({ _form: errorMessage })
        return
      }
    }

    // Clear persisted data on successful submit
    if (clearPersisted) {
      clearPersisted()
    }

    props.onSubmit?.(visibleFormData)
    setIsSubmitting(false)
  }

  const layoutClass = () => {
    switch (params().layout) {
      case 'horizontal':
        return 'grid grid-cols-2 gap-4'
      case 'inline':
        return 'flex flex-wrap gap-4 items-end'
      default:
        return 'space-y-4'
    }
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <Show when={params().title}>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {params().title}
        </h3>
      </Show>

      <form id={`form-${props.component.id}`} onSubmit={handleSubmit} noValidate>
        <div class={layoutClass()}>
          <For each={params().fields}>
            {(field) => (
              <FormFieldRenderer
                field={field}
                value={formData()[field.name]}
                error={errors()[field.name]}
                onChange={(value) => handleFieldChange(field.name, value)}
                disabled={isSubmitting() || field.disabled}
                formData={formData}
              />
            )}
          </For>
        </div>

        <Show when={errors()._form}>
          <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p class="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors()._form}
            </p>
          </div>
        </Show>

        {/* Auto-submit countdown (v4.2.0) */}
        <Show when={countdown() != null}>
          <div class="mt-4 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <span class="text-sm text-blue-700 dark:text-blue-300">
              {params().submitLabel || 'Submit'} in {countdown()}s...
            </span>
            <button
              type="button"
              onClick={() => { cancelCountdown(); setUserInteracted(true) }}
              class="text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
            >
              Cancel
            </button>
          </div>
        </Show>

        <div class="flex gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSubmitting()}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting() ? (
              <span class="flex items-center gap-2">
                <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </span>
            ) : (
              params().submitLabel || 'Submit'
            )}
          </button>
          <Show when={params().showReset}>
            <button
              type="button"
              onClick={() => initializeForm(true)}
              disabled={isSubmitting()}
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
          </Show>
        </div>
      </form>
    </div>
  )
}
