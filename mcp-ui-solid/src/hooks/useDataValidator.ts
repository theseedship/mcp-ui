/**
 * useDataValidator — reactive SolidJS hook for data validation
 * v3.1.0: Wraps validateAgainstSource in a reactive memo
 *
 * @experimental
 */

import { createMemo } from 'solid-js'
import { validateAgainstSource } from '../services/data-validator'
import type { DataValidation, DataValidationOptions } from '../types/chat-bus'

export interface UseDataValidatorOptions extends DataValidationOptions {
  /** Disable validation (returns null) */
  enabled?: boolean
}

export interface UseDataValidatorReturn {
  /** Reactive validation result (null if disabled or no text) */
  validation: () => DataValidation | null
  /** Is the text valid (no hallucinations)? */
  valid: () => boolean
  /** Confidence score 0-1 */
  confidence: () => number
  /** Count of hallucinated numbers */
  hallucinatedCount: () => number
}

/**
 * Reactive hook that validates LLM text against source data rows.
 * Re-validates automatically when text or rows change.
 *
 * @example
 * ```tsx
 * const { validation, valid, confidence } = useDataValidator(
 *   () => llmResponse(),
 *   () => sourceRows(),
 *   { tolerance: 0.02, ignoreColumns: ['code_geo'] }
 * )
 *
 * return (
 *   <Show when={!valid()}>
 *     <span>⚠️ {validation()!.hallucinated.length} unverified numbers</span>
 *   </Show>
 * )
 * ```
 */
export function useDataValidator(
  text: () => string,
  sourceRows: () => Record<string, unknown>[],
  options: UseDataValidatorOptions = {}
): UseDataValidatorReturn {
  const { enabled = true, ...validationOptions } = options

  const validation = createMemo<DataValidation | null>(() => {
    if (!enabled) return null
    const t = text()
    const rows = sourceRows()
    if (!t || !rows || rows.length === 0) return null
    return validateAgainstSource(t, rows, validationOptions)
  })

  return {
    validation,
    valid: () => validation()?.valid ?? true,
    confidence: () => validation()?.confidence ?? 1,
    hallucinatedCount: () => validation()?.hallucinated.length ?? 0,
  }
}
