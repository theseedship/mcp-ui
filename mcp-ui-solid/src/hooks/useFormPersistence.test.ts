/**
 * useFormPersistence Tests
 * Sprint 4: State & Charts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignal, createRoot } from 'solid-js'
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

  it('does not save before initialization', () => {
    createRoot((dispose) => {
      const [formData, setFormData] = createSignal<Record<string, unknown>>({ name: 'test' })

      useFormPersistence({
        persistKey: 'test-form',
        formData,
        setFormData,
        storage: mockStorage,
      })

      // Should not save immediately (before onMount)
      vi.advanceTimersByTime(600)
      expect(mockStorage.setItem).not.toHaveBeenCalled()

      dispose()
    })
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

      clearPersisted()
      expect(mockStorage.removeItem).toHaveBeenCalledWith('mcp-ui-form:test-form')

      dispose()
    })
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

      expect(hasPersisted()).toBe(false)

      dispose()
    })
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

      expect(hasPersisted()).toBe(true)

      dispose()
    })
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

      expect(hasPersisted()).toBe(false)

      dispose()
    })
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

      expect(getPersistedTimestamp()).toBeNull()

      dispose()
    })
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

      expect(getPersistedTimestamp()).toBe(timestamp)

      dispose()
    })
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

      // Should not throw errors
      expect(hasPersisted()).toBe(false)
      expect(getPersistedTimestamp()).toBeNull()
      clearPersisted() // Should not throw

      dispose()
    })
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

      expect(hasPersisted()).toBe(false)

      dispose()
    })
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

      // Should handle gracefully
      expect(hasPersisted()).toBe(false)
      expect(getPersistedTimestamp()).toBeNull()

      dispose()
    })
  })
})
