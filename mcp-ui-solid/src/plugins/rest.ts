/**
 * REST API Autocomplete Plugin
 * Provides suggestions from any REST API endpoint
 *
 * Sprint Autocomplete Feature
 */

import type {
  AutocompletePlugin,
  AutocompleteResult,
  AutocompleteContext,
  AutocompleteOption,
  RestPluginConfig
} from '../types'

/**
 * Get value at path (e.g., "data.results" -> obj.data.results)
 */
function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Default transform function
 */
function defaultTransform(
  data: any[],
  valueField: string,
  labelField: string
): AutocompleteOption[] {
  return data.map(item => ({
    value: String(item[valueField] ?? item.value ?? item.id ?? ''),
    label: String(item[labelField] ?? item.label ?? item.name ?? item[valueField] ?? ''),
    metadata: item
  }))
}

/**
 * Create a REST API autocomplete plugin
 */
export function createRestPlugin(config: RestPluginConfig): AutocompletePlugin {
  const {
    endpoint,
    method = 'GET',
    headers = {},
    bodyTemplate,
    transform,
    resultPath,
    valueField = 'value',
    labelField = 'label'
  } = config

  return {
    id: 'rest',
    name: 'REST API',

    configure(newConfig: Record<string, any>) {
      Object.assign(config, newConfig)
    },

    isReady() {
      return !!endpoint
    },

    async getSuggestions(
      input: string,
      _context?: AutocompleteContext
    ): Promise<AutocompleteResult> {
      if (!endpoint) {
        console.warn('[REST Plugin] Endpoint not configured')
        return { type: 'options', options: [] }
      }

      if (!input.trim()) {
        return { type: 'options', options: [] }
      }

      try {
        // Build URL with search placeholder
        const url = endpoint.replace(/\{search\}/g, encodeURIComponent(input))

        // Build request options
        const requestOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }

        // Add body for POST requests
        if (method === 'POST' && bodyTemplate) {
          const body = bodyTemplate.replace(/\{search\}/g, input)
          requestOptions.body = body
        } else if (method === 'POST') {
          requestOptions.body = JSON.stringify({ search: input })
        }

        const response = await fetch(url, requestOptions)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[REST Plugin] API error:', response.status, errorText)
          return { type: 'options', options: [] }
        }

        const data = await response.json()

        // Extract results from path if specified
        let results = resultPath ? getByPath(data, resultPath) : data

        // Ensure results is an array
        if (!Array.isArray(results)) {
          if (results && typeof results === 'object') {
            // Try common result structures
            results = results.data || results.results || results.items || [results]
          } else {
            results = []
          }
        }

        // Transform results to options
        let options: AutocompleteOption[]

        if (transform) {
          options = transform(results)
        } else {
          options = defaultTransform(results, valueField, labelField)
        }

        return {
          type: 'options',
          options
        }
      } catch (error) {
        console.error('[REST Plugin] Error:', error)
        return { type: 'options', options: [] }
      }
    },

    dispose() {
      // No cleanup needed
    }
  }
}

export default createRestPlugin
