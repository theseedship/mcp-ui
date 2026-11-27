/**
 * useFormPersistence Tests
 * Sprint 4: State & Charts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot, flush } from 'solid-js'
import { useFormPersistence } from './useFormPersistence'

// Mock localStorage
const createMockStorage = (): Storage => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key])
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('useFormPersistence', () => {
  let mockStorage: Storage

  beforeEach(() => {
    mockStorage = createMockStorage()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('restores a reactive key over committed defaults and cancels pending writes on disposal', () => {
    mockStorage.setItem(
      'mcp-ui-form:first',
      JSON.stringify({ data: { name: 'saved first' }, timestamp: Date.now(), version: 1 })
    )
    mockStorage.setItem(
      'mcp-ui-form:second',
      JSON.stringify({ data: { name: 'saved second' }, timestamp: Date.now(), version: 1 })
    )
    let dispose!: () => void
    const { formData, setFormData, setKey } = createRoot((cleanup) => {
      dispose = cleanup
      const [key, setKey] = createSignal('first')
      const [formData, setFormData] = createSignal<Record<string, unknown>>({
        name: 'default',
        retained: true,
      })
      useFormPersistence({
        get persistKey() {
          return key()
        },
        formData,
        setFormData,
        storage: mockStorage,
        debounce: 10,
      })
      return { formData, setFormData, setKey }
    })
    flush()
    expect(formData()).toEqual({ name: 'saved first', retained: true })
    setKey('second')
    flush()
    expect(formData()).toEqual({ name: 'saved second', retained: true })
    setFormData({ name: 'not persisted after disposal' })
    flush()
    dispose()
    vi.advanceTimersByTime(20)
    expect(JSON.parse(mockStorage.getItem('mcp-ui-form:second')!).data.name).toBe('saved second')
  })

  it('does not save before initialization', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({ name: 'test' })

      useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        // Should not save immediately (before onMount)
        vi.advanceTimersByTime(600)
        flush()
        expect(mockStorage.setItem).not.toHaveBeenCalled()

        dispose()
      }
    })()
  })

  it('clears persisted data with clearPersisted', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      // Pre-populate storage
      const stored = JSON.stringify({
        data: { name: 'stored' },
        timestamp: Date.now(),
        version: 1,
      })
      ;(mockStorage.getItem as any).mockReturnValue(stored)

      const { clearPersisted } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        clearPersisted()
        flush()
        expect(mockStorage.removeItem).toHaveBeenCalledWith('mcp-ui-form:test-form')

        dispose()
      }
    })()
  })

  it('returns false for hasPersisted when no data exists', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      const { hasPersisted } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(hasPersisted()).toBe(false)

        dispose()
      }
    })()
  })

  it('returns true for hasPersisted when valid data exists', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      // Pre-populate storage
      const stored = JSON.stringify({
        data: { name: 'stored' },
        timestamp: Date.now(),
        version: 1,
      })
      ;(mockStorage.getItem as any).mockReturnValue(stored)

      const { hasPersisted } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(hasPersisted()).toBe(true)

        dispose()
      }
    })()
  })

  it('returns false for hasPersisted when data is expired', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      // Pre-populate storage with old timestamp
      const stored = JSON.stringify({
        data: { name: 'stored' },
        timestamp: Date.now() - 10000, // 10 seconds ago
        version: 1,
      })
      ;(mockStorage.getItem as any).mockReturnValue(stored)

      const { hasPersisted } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
        expiresIn: 5000, // 5 seconds
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(hasPersisted()).toBe(false)

        dispose()
      }
    })()
  })

  it('returns null for getPersistedTimestamp when no data exists', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      const { getPersistedTimestamp } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(getPersistedTimestamp()).toBeNull()

        dispose()
      }
    })()
  })

  it('returns timestamp for getPersistedTimestamp when data exists', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      const timestamp = Date.now()
      const stored = JSON.stringify({
        data: { name: 'stored' },
        timestamp,
        version: 1,
      })
      ;(mockStorage.getItem as any).mockReturnValue(stored)

      const { getPersistedTimestamp } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(getPersistedTimestamp()).toBe(timestamp)

        dispose()
      }
    })()
  })

  it('handles null storage gracefully (SSR)', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({ name: 'test' })

      const { clearPersisted, hasPersisted, getPersistedTimestamp } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: null,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        // Should not throw errors
        expect(hasPersisted()).toBe(false)
        expect(getPersistedTimestamp()).toBeNull()
        clearPersisted()
        flush() // Should not throw

        dispose()
      }
    })()
  })

  it('ignores data with wrong version', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      // Pre-populate storage with wrong version
      const stored = JSON.stringify({
        data: { name: 'stored' },
        timestamp: Date.now(),
        version: 999, // Wrong version
      })
      ;(mockStorage.getItem as any).mockReturnValue(stored)

      const { hasPersisted } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        expect(hasPersisted()).toBe(false)

        dispose()
      }
    })()
  })

  it('handles JSON parse errors gracefully', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({})

      // Pre-populate storage with invalid JSON
      ;(mockStorage.getItem as any).mockReturnValue('invalid json{')

      const { hasPersisted, getPersistedTimestamp } = useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Exercise imperative events outside the pure root-construction scope.
      return () => {
        // Should handle gracefully
        expect(hasPersisted()).toBe(false)
        expect(getPersistedTimestamp()).toBeNull()

        dispose()
      }
    })()
  })
})
