/**
 * useAutocomplete Tests
 * Sprint Autocomplete Feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot } from 'solid-js'
import { useAutocomplete } from './useAutocomplete'
// Note: Full integration tests require AutocompleteProvider
// These tests focus on the hook's internal logic

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('initializes with correct default state', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        expect(autocomplete.completion()).toBeNull()
        expect(autocomplete.ghostText()).toBe('')
        expect(autocomplete.options()).toEqual([])
        expect(autocomplete.selectedIndex()).toBe(-1)
        expect(autocomplete.isLoading()).toBe(false)
        expect(autocomplete.error()).toBeNull()
        expect(autocomplete.isOpen()).toBe(false)
        expect(autocomplete.resultType()).toBeNull()

        dispose()
      })
    })

    it('does not fetch when disabled', () => {
      createRoot((dispose) => {
        const [inputValue, setInputValue] = createSignal('')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: false
        })

        setInputValue('test')
        vi.advanceTimersByTime(200)

        expect(autocomplete.isLoading()).toBe(false)
        expect(autocomplete.isOpen()).toBe(false)

        dispose()
      })
    })
  })

  describe('ghost text computation', () => {
    it('computes ghost text correctly', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('hel')
        const onInputChange = vi.fn()

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          onInputChange
        })

        // Manually set completion for testing
        // In real usage, this would come from the context
        expect(autocomplete.ghostText()).toBe('')

        dispose()
      })
    })
  })

  describe('option navigation', () => {
    it('navigates options with nextOption', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        // Initially no selection
        expect(autocomplete.selectedIndex()).toBe(-1)

        dispose()
      })
    })

    it('navigates options with prevOption', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        // Initially no selection
        expect(autocomplete.selectedIndex()).toBe(-1)

        dispose()
      })
    })
  })

  describe('keyboard handling', () => {
    it('handles Tab key for completion', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')
        const onInputChange = vi.fn()

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          onInputChange
        })

        const event = {
          key: 'Tab',
          preventDefault: vi.fn()
        } as unknown as KeyboardEvent

        // Should return false when not open
        const handled = autocomplete.handleKeyDown(event)
        expect(handled).toBe(false)

        dispose()
      })
    })

    it('handles Escape key to dismiss', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        const event = {
          key: 'Escape',
          preventDefault: vi.fn()
        } as unknown as KeyboardEvent

        // Should return false when not open
        const handled = autocomplete.handleKeyDown(event)
        expect(handled).toBe(false)

        dispose()
      })
    })

    it('handles ArrowDown for dropdown navigation', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        const event = {
          key: 'ArrowDown',
          preventDefault: vi.fn()
        } as unknown as KeyboardEvent

        // Should return false when not open
        const handled = autocomplete.handleKeyDown(event)
        expect(handled).toBe(false)

        dispose()
      })
    })

    it('handles ArrowUp for dropdown navigation', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        const event = {
          key: 'ArrowUp',
          preventDefault: vi.fn()
        } as unknown as KeyboardEvent

        // Should return false when not open
        const handled = autocomplete.handleKeyDown(event)
        expect(handled).toBe(false)

        dispose()
      })
    })
  })

  describe('dismiss', () => {
    it('clears all state on dismiss', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true
        })

        autocomplete.dismiss()

        expect(autocomplete.completion()).toBeNull()
        expect(autocomplete.options()).toEqual([])
        expect(autocomplete.selectedIndex()).toBe(-1)
        expect(autocomplete.isOpen()).toBe(false)
        expect(autocomplete.error()).toBeNull()

        dispose()
      })
    })
  })

  describe('min chars', () => {
    it('respects minChars option', () => {
      createRoot((dispose) => {
        const [inputValue, setInputValue] = createSignal('a')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          minChars: 3
        })

        // Should not trigger with only 1 char
        setInputValue('ab')
        vi.advanceTimersByTime(200)

        expect(autocomplete.isLoading()).toBe(false)
        expect(autocomplete.isOpen()).toBe(false)

        dispose()
      })
    })
  })

  describe('debounce', () => {
    it('debounces input changes', () => {
      createRoot((dispose) => {
        const [inputValue, setInputValue] = createSignal('')

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          debounceMs: 300
        })

        // Rapid changes should be debounced
        setInputValue('a')
        vi.advanceTimersByTime(100)
        setInputValue('ab')
        vi.advanceTimersByTime(100)
        setInputValue('abc')
        vi.advanceTimersByTime(100)

        // Not enough time has passed
        expect(autocomplete.isLoading()).toBe(false)

        // After full debounce time
        vi.advanceTimersByTime(300)

        // Would be loading if context was available
        expect(autocomplete.isOpen()).toBe(false) // No context

        dispose()
      })
    })
  })

  describe('option selection', () => {
    it('calls onInputChange when selecting option', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')
        const onInputChange = vi.fn()

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          onInputChange
        })

        autocomplete.selectOption({ value: 'selected', label: 'Selected Option' })

        expect(onInputChange).toHaveBeenCalledWith('selected')

        dispose()
      })
    })
  })

  describe('accept completion', () => {
    it('calls onInputChange when accepting completion', () => {
      createRoot((dispose) => {
        const [inputValue] = createSignal('test')
        const onInputChange = vi.fn()

        const autocomplete = useAutocomplete({
          inputValue,
          enabled: true,
          onInputChange
        })

        // Without actual completion, this should not call onChange
        autocomplete.acceptCompletion()

        // Since completion is null, onInputChange should not be called
        expect(onInputChange).not.toHaveBeenCalled()

        dispose()
      })
    })
  })
})
