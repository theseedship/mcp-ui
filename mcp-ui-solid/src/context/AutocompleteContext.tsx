/**
 * AutocompleteContext - Context provider for autocomplete functionality
 * Manages plugins and provides unified autocomplete API
 *
 * Sprint Autocomplete Feature
 */

import {
  createContext,
  useContext,
  ParentComponent,
  Accessor,
  createSignal,
  createMemo,
  onCleanup
} from 'solid-js'
import type {
  AutocompletePlugin,
  AutocompleteResult,
  AutocompleteContext as AutocompleteContextData,
  AutocompleteProviderConfig
} from '../types'

/**
 * Cache entry for autocomplete results
 */
interface CacheEntry {
  result: AutocompleteResult
  timestamp: number
}

/**
 * Context value interface
 */
export interface AutocompleteContextValue {
  /**
   * Get suggestions from a plugin
   */
  getSuggestions: (
    input: string,
    pluginId?: string,
    context?: AutocompleteContextData
  ) => Promise<AutocompleteResult>

  /**
   * Get registered plugins
   */
  plugins: Accessor<AutocompletePlugin[]>

  /**
   * Get default plugin ID
   */
  defaultPluginId: Accessor<string | undefined>

  /**
   * Check if a plugin is ready
   */
  isPluginReady: (pluginId: string) => boolean

  /**
   * Get plugin by ID
   */
  getPlugin: (pluginId: string) => AutocompletePlugin | undefined

  /**
   * Register a new plugin
   */
  registerPlugin: (plugin: AutocompletePlugin) => void

  /**
   * Unregister a plugin
   */
  unregisterPlugin: (pluginId: string) => void

  /**
   * Clear cache
   */
  clearCache: () => void

  /**
   * Global config
   */
  config: {
    debounceMs: number
    minChars: number
    cacheTtl: number
    cacheEnabled: boolean
  }
}

// Create context with undefined default
const AutocompleteCtx = createContext<AutocompleteContextValue>()

/**
 * Props for AutocompleteProvider
 */
export interface AutocompleteProviderProps extends AutocompleteProviderConfig {
  children: any
}

/**
 * Generate cache key
 */
function getCacheKey(input: string, pluginId: string, context?: AutocompleteContextData): string {
  const contextKey = context ? JSON.stringify(context) : ''
  return `${pluginId}:${input}:${contextKey}`
}

/**
 * AutocompleteProvider Component
 * Provides autocomplete context to child components
 */
export const AutocompleteProvider: ParentComponent<AutocompleteProviderProps> = (props) => {
  // Plugin registry
  const [plugins, setPlugins] = createSignal<AutocompletePlugin[]>(props.plugins || [])

  // Result cache
  const [cache, setCache] = createSignal<Map<string, CacheEntry>>(new Map())

  // Config with defaults
  const config = createMemo(() => ({
    debounceMs: props.debounceMs ?? 150,
    minChars: props.minChars ?? 1,
    cacheTtl: props.cacheTtl ?? 60000,
    cacheEnabled: props.cacheEnabled ?? true
  }))

  // Default plugin ID
  const defaultPluginId = createMemo(() => {
    if (props.defaultPlugin) return props.defaultPlugin
    const firstPlugin = plugins()[0]
    return firstPlugin?.id
  })

  /**
   * Get plugin by ID
   */
  const getPlugin = (pluginId: string): AutocompletePlugin | undefined => {
    return plugins().find(p => p.id === pluginId)
  }

  /**
   * Check if plugin is ready
   */
  const isPluginReady = (pluginId: string): boolean => {
    const plugin = getPlugin(pluginId)
    if (!plugin) return false
    if (plugin.isReady) return plugin.isReady()
    return true
  }

  /**
   * Check cache for result
   */
  const getFromCache = (key: string): AutocompleteResult | null => {
    if (!config().cacheEnabled) return null

    const entry = cache().get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > config().cacheTtl) {
      // Expired, remove from cache
      setCache(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      return null
    }

    return { ...entry.result, cached: true }
  }

  /**
   * Add result to cache
   */
  const addToCache = (key: string, result: AutocompleteResult): void => {
    if (!config().cacheEnabled) return

    setCache(prev => {
      const next = new Map(prev)
      next.set(key, { result, timestamp: Date.now() })
      return next
    })
  }

  /**
   * Get suggestions from plugin
   */
  const getSuggestions = async (
    input: string,
    pluginId?: string,
    context?: AutocompleteContextData
  ): Promise<AutocompleteResult> => {
    const targetPluginId = pluginId || defaultPluginId()

    if (!targetPluginId) {
      return { type: 'options', options: [], pluginId: undefined }
    }

    const plugin = getPlugin(targetPluginId)
    if (!plugin) {
      console.warn(`[Autocomplete] Plugin not found: ${targetPluginId}`)
      return { type: 'options', options: [], pluginId: targetPluginId }
    }

    // Check cache
    const cacheKey = getCacheKey(input, targetPluginId, context)
    const cached = getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const result = await plugin.getSuggestions(input, context)
      result.pluginId = targetPluginId

      // Cache result
      addToCache(cacheKey, result)

      return result
    } catch (error) {
      console.error(`[Autocomplete] Plugin error (${targetPluginId}):`, error)
      return {
        type: 'options',
        options: [],
        pluginId: targetPluginId
      }
    }
  }

  /**
   * Register a new plugin
   */
  const registerPlugin = (plugin: AutocompletePlugin): void => {
    setPlugins(prev => {
      // Remove existing plugin with same ID
      const filtered = prev.filter(p => p.id !== plugin.id)
      return [...filtered, plugin]
    })
  }

  /**
   * Unregister a plugin
   */
  const unregisterPlugin = (pluginId: string): void => {
    const plugin = getPlugin(pluginId)
    if (plugin?.dispose) {
      plugin.dispose()
    }
    setPlugins(prev => prev.filter(p => p.id !== pluginId))
  }

  /**
   * Clear cache
   */
  const clearCache = (): void => {
    setCache(new Map())
  }

  // Cleanup on unmount
  onCleanup(() => {
    // Dispose all plugins
    plugins().forEach(plugin => {
      if (plugin.dispose) {
        try {
          plugin.dispose()
        } catch (e) {
          console.error(`[Autocomplete] Error disposing plugin ${plugin.id}:`, e)
        }
      }
    })
  })

  // Context value
  const contextValue: AutocompleteContextValue = {
    getSuggestions,
    plugins,
    defaultPluginId,
    isPluginReady,
    getPlugin,
    registerPlugin,
    unregisterPlugin,
    clearCache,
    config: config()
  }

  return (
    <AutocompleteCtx.Provider value={contextValue}>
      {props.children}
    </AutocompleteCtx.Provider>
  )
}

/**
 * Hook to use autocomplete context
 * @throws Error if used outside provider
 */
export function useAutocompleteContext(): AutocompleteContextValue {
  const context = useContext(AutocompleteCtx)
  if (!context) {
    throw new Error(
      'useAutocompleteContext must be used within an AutocompleteProvider'
    )
  }
  return context
}

/**
 * Safe hook that returns undefined if outside provider
 */
export function useAutocompleteContextSafe(): AutocompleteContextValue | undefined {
  return useContext(AutocompleteCtx)
}

export { AutocompleteCtx }
