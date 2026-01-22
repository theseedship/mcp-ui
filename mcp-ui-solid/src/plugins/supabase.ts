/**
 * Supabase Autocomplete Plugin
 * Provides data-driven suggestions from a Supabase table
 *
 * Sprint Autocomplete Feature
 */

import type {
  AutocompletePlugin,
  AutocompleteResult,
  AutocompleteContext,
  AutocompleteOption,
  SupabasePluginConfig
} from '../types'

/**
 * Create a Supabase autocomplete plugin
 */
export function createSupabasePlugin(config: SupabasePluginConfig): AutocompletePlugin {
  const {
    url,
    anonKey,
    table,
    column,
    searchColumn,
    labelColumn,
    limit = 10,
    filter
  } = config

  const isConfigured = !!(url && anonKey && table && column)
  const effectiveSearchColumn = searchColumn || column
  const effectiveLabelColumn = labelColumn || column

  return {
    id: 'supabase',
    name: 'Supabase',

    configure(newConfig: Record<string, any>) {
      // Allow runtime reconfiguration
      Object.assign(config, newConfig)
    },

    isReady() {
      return isConfigured
    },

    async getSuggestions(
      input: string,
      _context?: AutocompleteContext
    ): Promise<AutocompleteResult> {
      if (!isConfigured) {
        console.warn('[Supabase Plugin] Not properly configured')
        return { type: 'options', options: [] }
      }

      if (!input.trim()) {
        return { type: 'options', options: [] }
      }

      try {
        // Build query URL
        let queryUrl = `${url}/rest/v1/${table}?select=${column}`

        if (column !== effectiveLabelColumn) {
          queryUrl += `,${effectiveLabelColumn}`
        }

        // Add ILIKE filter for search
        queryUrl += `&${effectiveSearchColumn}=ilike.${encodeURIComponent(input)}%`

        // Add limit
        queryUrl += `&limit=${limit}`

        // Add custom filters
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            queryUrl += `&${key}=eq.${encodeURIComponent(String(value))}`
          })
        }

        const response = await fetch(queryUrl, {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Supabase Plugin] API error:', response.status, errorText)
          return { type: 'options', options: [] }
        }

        const data = await response.json()

        const options: AutocompleteOption[] = data.map((row: Record<string, any>) => ({
          value: String(row[column]),
          label: String(row[effectiveLabelColumn]),
          metadata: row
        }))

        return {
          type: 'options',
          options
        }
      } catch (error) {
        console.error('[Supabase Plugin] Error:', error)
        return { type: 'options', options: [] }
      }
    },

    dispose() {
      // No cleanup needed
    }
  }
}

export default createSupabasePlugin
