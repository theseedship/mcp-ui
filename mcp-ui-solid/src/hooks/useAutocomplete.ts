/**
 * useAutocomplete Hook
 * Provides autocomplete functionality for form fields
 *
 * Sprint Autocomplete Feature
 */

import {
  createSignal,
  createEffect,
  on,
  Accessor,
  onCleanup,
  batch,
  createMemo
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { useAutocompleteContextSafe } from '../context/AutocompleteContext'
import type {
  AutocompleteOption,
  AutocompleteContext,
  FieldAutocompleteConfig
} from '../types'

/**
 * Options for the useAutocomplete hook
 */
export interface UseAutocompleteOptions {
  /**
   * Current input value accessor
   */
  inputValue: Accessor<string>

  /**
   * Plugin ID to use (overrides default)
   */
  pluginId?: string

  /**
   * Field configuration
   */
  fieldConfig?: FieldAutocompleteConfig

  /**
   * Context data for suggestions
   */
  context?: Accessor<AutocompleteContext>

  /**
   * Whether autocomplete is enabled
   */
  enabled?: boolean

  /**
   * Callback when input value should change (for accepting suggestions)
   */
  onInputChange?: (value: string) => void

  /**
   * Minimum characters before triggering
   */
  minChars?: number

  /**
   * Debounce delay in ms
   */
  debounceMs?: number
}

/**
 * Return type for the useAutocomplete hook
 */
export interface UseAutocompleteReturn {
  /**
   * Current completion text (for ghost text, LLM mode)
   */
  completion: Accessor<string | null>

  /**
   * Ghost text to show (remaining text after input)
   */
  ghostText: Accessor<string>

  /**
   * Accept the current completion
   */
  acceptCompletion: () => void

  /**
   * Current options (for dropdown, data mode)
   */
  options: Accessor<AutocompleteOption[]>

  /**
   * Currently selected option index
   */
  selectedIndex: Accessor<number>

  /**
   * Select an option by index
   */
  selectOption: (option: AutocompleteOption) => void

  /**
   * Navigate to next option
   */
  nextOption: () => void

  /**
   * Navigate to previous option
   */
  prevOption: () => void

  /**
   * Select current highlighted option
   */
  selectCurrentOption: () => void

  /**
   * Whether suggestions are loading
   */
  isLoading: Accessor<boolean>

  /**
   * Error message if any
   */
  error: Accessor<string | null>

  /**
   * Dismiss suggestions
   */
  dismiss: () => void

  /**
   * Whether suggestions are visible
   */
  isOpen: Accessor<boolean>

  /**
   * Result type ('completion' or 'options')
   */
  resultType: Accessor<'completion' | 'options' | null>

  /**
   * Open/show suggestions
   */
  open: () => void

  /**
   * Handle keyboard events
   */
  handleKeyDown: (e: KeyboardEvent) => boolean
}

/**
 * Debounce helper
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): { call: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return {
    call: (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        fn(...args)
        timeoutId = null
      }, delay)
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }
}

/**
 * Hook for autocomplete functionality
 */
export function useAutocomplete(options: UseAutocompleteOptions): UseAutocompleteReturn {
  const {
    inputValue,
    pluginId,
    fieldConfig,
    context,
    enabled = true,
    onInputChange,
    minChars: minCharsOption,
    debounceMs: debounceOption
  } = options

  // Get context (may be undefined if no provider)
  const autocompleteCtx = useAutocompleteContextSafe()

  // State
  const [completion, setCompletion] = createSignal<string | null>(null)
  const [options_, setOptions] = createSignal<AutocompleteOption[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(-1)
  const [isLoading, setIsLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [isOpen, setIsOpen] = createSignal(false)
  const [resultType, setResultType] = createSignal<'completion' | 'options' | null>(null)

  // Request ID to track stale responses
  let currentRequestId = 0

  // Config with defaults from context/options
  const config = createMemo(() => ({
    minChars: minCharsOption ?? fieldConfig?.minChars ?? autocompleteCtx?.config.minChars ?? 1,
    debounceMs: debounceOption ?? fieldConfig?.debounceMs ?? autocompleteCtx?.config.debounceMs ?? 150
  }))

  // Ghost text (portion after current input)
  const ghostText = createMemo(() => {
    const comp = completion()
    const input = inputValue()

    if (!comp || !input) return ''

    // If completion starts with input, show the remaining part
    if (comp.toLowerCase().startsWith(input.toLowerCase())) {
      return comp.slice(input.length)
    }

    return ''
  })

  // Fetch suggestions
  const fetchSuggestions = async (input: string) => {
    if (!autocompleteCtx) {
      return
    }

    if (input.length < config().minChars) {
      batch(() => {
        setCompletion(null)
        setOptions([])
        setIsOpen(false)
        setResultType(null)
      })
      return
    }

    // Increment request ID to track this specific request
    const requestId = ++currentRequestId

    setIsLoading(true)
    setError(null)

    try {
      const targetPluginId = pluginId ?? fieldConfig?.plugin
      const contextData = context?.()

      const result = await autocompleteCtx.getSuggestions(
        input,
        targetPluginId,
        contextData
      )

      // Ignore stale responses - if a newer request was made, discard this result
      if (requestId !== currentRequestId) {
        return
      }

      batch(() => {
        setResultType(result.type)

        if (result.type === 'completion') {
          setCompletion(result.completion || null)
          setOptions([])
          setIsOpen(!!result.completion)
        } else {
          setCompletion(null)
          setOptions(result.options || [])
          setSelectedIndex(-1)
          setIsOpen((result.options?.length || 0) > 0)
        }

        setIsLoading(false)
      })
    } catch (e) {
      // Ignore errors from stale requests
      if (requestId !== currentRequestId) {
        return
      }

      batch(() => {
        setError(e instanceof Error ? e.message : 'Unknown error')
        setIsLoading(false)
        setIsOpen(false)
      })
    }
  }

  // Debounced fetch
  const debouncedFetch = debounce(fetchSuggestions, config().debounceMs)

  // Watch input value changes
  createEffect(
    on(inputValue, (value) => {
      if (!enabled || !autocompleteCtx || isServer) {
        return
      }

      debouncedFetch.call(value)
    })
  )

  // Cleanup
  onCleanup(() => {
    debouncedFetch.cancel()
  })

  /**
   * Accept the current completion
   */
  const acceptCompletion = () => {
    const comp = completion()
    if (comp && onInputChange) {
      onInputChange(comp)
      batch(() => {
        setCompletion(null)
        setIsOpen(false)
      })
    }
  }

  /**
   * Select an option
   */
  const selectOption = (option: AutocompleteOption) => {
    if (onInputChange) {
      onInputChange(option.value)
    }
    batch(() => {
      setOptions([])
      setSelectedIndex(-1)
      setIsOpen(false)
    })
  }

  /**
   * Navigate to next option
   */
  const nextOption = () => {
    const opts = options_()
    if (opts.length === 0) return

    setSelectedIndex((prev) => {
      const next = prev + 1
      return next >= opts.length ? 0 : next
    })
  }

  /**
   * Navigate to previous option
   */
  const prevOption = () => {
    const opts = options_()
    if (opts.length === 0) return

    setSelectedIndex((prev) => {
      const next = prev - 1
      return next < 0 ? opts.length - 1 : next
    })
  }

  /**
   * Select current highlighted option
   */
  const selectCurrentOption = () => {
    const idx = selectedIndex()
    const opts = options_()
    if (idx >= 0 && idx < opts.length) {
      selectOption(opts[idx])
    }
  }

  /**
   * Dismiss suggestions
   */
  const dismiss = () => {
    debouncedFetch.cancel()
    batch(() => {
      setCompletion(null)
      setOptions([])
      setSelectedIndex(-1)
      setIsOpen(false)
      setError(null)
    })
  }

  /**
   * Open suggestions
   */
  const open = () => {
    const input = inputValue()
    if (input.length >= config().minChars) {
      fetchSuggestions(input)
    }
  }

  /**
   * Handle keyboard events
   * Returns true if the event was handled
   */
  const handleKeyDown = (e: KeyboardEvent): boolean => {
    if (!isOpen()) return false

    const type = resultType()

    // Tab to accept completion
    if (e.key === 'Tab' && type === 'completion' && ghostText()) {
      e.preventDefault()
      acceptCompletion()
      return true
    }

    // Arrow keys for dropdown navigation
    if (type === 'options') {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          nextOption()
          return true

        case 'ArrowUp':
          e.preventDefault()
          prevOption()
          return true

        case 'Enter':
          if (selectedIndex() >= 0) {
            e.preventDefault()
            selectCurrentOption()
            return true
          }
          break

        case 'Tab':
          if (selectedIndex() >= 0) {
            e.preventDefault()
            selectCurrentOption()
            return true
          }
          break
      }
    }

    // Escape to dismiss
    if (e.key === 'Escape') {
      e.preventDefault()
      dismiss()
      return true
    }

    return false
  }

  return {
    completion,
    ghostText,
    acceptCompletion,
    options: options_,
    selectedIndex,
    selectOption,
    nextOption,
    prevOption,
    selectCurrentOption,
    isLoading,
    error,
    dismiss,
    isOpen,
    resultType,
    open,
    handleKeyDown
  }
}
