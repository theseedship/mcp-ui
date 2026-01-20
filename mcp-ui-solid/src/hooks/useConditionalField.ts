/**
 * useConditionalField - Evaluates showWhen conditions for form fields
 * Sprint 2: Form Advanced
 */

import { Accessor, createMemo } from 'solid-js'
import type { ShowWhenCondition } from '../types'

export interface UseConditionalFieldOptions {
  condition?: ShowWhenCondition
  formData: Accessor<Record<string, any>>
}

/**
 * Evaluates a showWhen condition against form data
 */
export function evaluateCondition(
  condition: ShowWhenCondition,
  formData: Record<string, any>
): boolean {
  const fieldValue = formData[condition.field]

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value

    case 'notEquals':
      return fieldValue !== condition.value

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)

    case 'notIn':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue)

    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value as string)

    case 'startsWith':
      return typeof fieldValue === 'string' && fieldValue.startsWith(condition.value as string)

    case 'endsWith':
      return typeof fieldValue === 'string' && fieldValue.endsWith(condition.value as string)

    case 'greaterThan':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number)

    case 'lessThan':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number)

    case 'isEmpty':
      return fieldValue === undefined || fieldValue === null || fieldValue === ''

    case 'isNotEmpty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''

    case 'isTrue':
      return fieldValue === true

    case 'isFalse':
      return fieldValue === false

    default:
      return true
  }
}

/**
 * Hook for conditional field visibility
 *
 * @example
 * ```tsx
 * const { isVisible } = useConditionalField({
 *   condition: field.showWhen,
 *   formData: formDataAccessor
 * })
 *
 * return (
 *   <Show when={isVisible()}>
 *     <input ... />
 *   </Show>
 * )
 * ```
 */
export function useConditionalField(options: UseConditionalFieldOptions) {
  const isVisible = createMemo(() => {
    if (!options.condition) return true
    return evaluateCondition(options.condition, options.formData())
  })

  return { isVisible }
}
