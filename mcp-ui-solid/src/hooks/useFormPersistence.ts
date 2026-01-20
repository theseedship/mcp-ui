/**
 * useFormPersistence - Save/restore form data to localStorage
 * Sprint 4: State & Charts
 */

import { Accessor, createEffect, onMount, onCleanup } from 'solid-js'

const STORAGE_PREFIX = 'mcp-ui-form:'
const DEFAULT_DEBOUNCE = 500

/**
 * Options for form persistence
 */
export interface UseFormPersistenceOptions {
  /**
   * Unique key for storage
   */
  persistKey: string

  /**
   * Form data accessor
   */
  formData: Accessor<Record<string, unknown>>

  /**
   * Setter for form data
   */
  setFormData: (data: Record<string, unknown>) => void

  /**
   * Debounce delay in ms (default: 500)
   */
  debounce?: number

  /**
   * Fields to exclude from persistence (e.g., passwords)
   */
  excludeFields?: string[]

  /**
   * Expiry time in ms (default: none)
   */
  expiresIn?: number

  /**
   * Storage provider (default: localStorage)
   * Useful for SSR or testing
   */
  storage?: Storage | null
}

/**
 * Stored data structure with timestamp for expiry
 */
interface StoredData {
  data: Record<string, unknown>
  timestamp: number
  version: number
}

const STORAGE_VERSION = 1

/**
 * Return type for useFormPersistence hook
 */
export interface UseFormPersistenceReturn {
  /**
   * Clear persisted data from storage
   */
  clearPersisted: () => void

  /**
   * Check if there is persisted data
   */
  hasPersisted: () => boolean

  /**
   * Get the timestamp of persisted data
   */
  getPersistedTimestamp: () => number | null
}

/**
 * Hook for persisting form data to localStorage
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const [formData, setFormData] = createSignal({})
 *
 *   const { clearPersisted } = useFormPersistence({
 *     persistKey: 'my-form-draft',
 *     formData,
 *     setFormData,
 *     excludeFields: ['password'],
 *     expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   })
 *
 *   const handleSubmit = () => {
 *     // Submit form
 *     clearPersisted() // Clear draft after successful submit
 *   }
 * }
 * ```
 */
export function useFormPersistence(options: UseFormPersistenceOptions): UseFormPersistenceReturn {
  const storageKey = `${STORAGE_PREFIX}${options.persistKey}`
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let isInitialized = false

  // Get storage (default to localStorage, with SSR safety)
  const getStorage = (): Storage | null => {
    if (options.storage !== undefined) {
      return options.storage
    }
    // SSR-safe check for localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    return null
  }

  // Restore on mount
  onMount(() => {
    const storage = getStorage()
    if (!storage) return

    try {
      const stored = storage.getItem(storageKey)
      if (stored) {
        const parsed: StoredData = JSON.parse(stored)

        // Check version
        if (parsed.version !== STORAGE_VERSION) {
          storage.removeItem(storageKey)
          return
        }

        // Check expiry
        if (options.expiresIn) {
          const elapsed = Date.now() - parsed.timestamp
          if (elapsed > options.expiresIn) {
            storage.removeItem(storageKey)
            return
          }
        }

        // Merge with existing form data (don't overwrite)
        const currentData = options.formData()
        const mergedData = { ...currentData, ...parsed.data }
        options.setFormData(mergedData)
      }
    } catch (e) {
      console.warn('[useFormPersistence] Failed to restore form data:', e)
    }

    isInitialized = true
  })

  // Save on change (debounced)
  createEffect(() => {
    const data = options.formData()

    // Don't save before initialization (would save initial/empty state)
    if (!isInitialized) return

    const storage = getStorage()
    if (!storage) return

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      try {
        // Filter excluded fields
        const toStore = { ...data }
        for (const field of options.excludeFields || []) {
          delete toStore[field]
        }

        // Don't store empty data
        if (Object.keys(toStore).length === 0) {
          storage.removeItem(storageKey)
          return
        }

        const stored: StoredData = {
          data: toStore,
          timestamp: Date.now(),
          version: STORAGE_VERSION,
        }

        storage.setItem(storageKey, JSON.stringify(stored))
      } catch (e) {
        console.warn('[useFormPersistence] Failed to persist form data:', e)
      }
    }, options.debounce ?? DEFAULT_DEBOUNCE)
  })

  // Cleanup timer on unmount
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  // Clear persisted data
  const clearPersisted = () => {
    const storage = getStorage()
    if (storage) {
      storage.removeItem(storageKey)
    }
  }

  // Check if there is persisted data
  const hasPersisted = (): boolean => {
    const storage = getStorage()
    if (!storage) return false

    try {
      const stored = storage.getItem(storageKey)
      if (!stored) return false

      const parsed: StoredData = JSON.parse(stored)

      // Check version
      if (parsed.version !== STORAGE_VERSION) return false

      // Check expiry
      if (options.expiresIn) {
        const elapsed = Date.now() - parsed.timestamp
        if (elapsed > options.expiresIn) return false
      }

      return true
    } catch {
      return false
    }
  }

  // Get timestamp of persisted data
  const getPersistedTimestamp = (): number | null => {
    const storage = getStorage()
    if (!storage) return null

    try {
      const stored = storage.getItem(storageKey)
      if (!stored) return null

      const parsed: StoredData = JSON.parse(stored)
      return parsed.timestamp
    } catch {
      return null
    }
  }

  return {
    clearPersisted,
    hasPersisted,
    getPersistedTimestamp,
  }
}
