/**
 * Groq LLM Autocomplete Plugin
 * Provides LLM-powered text completion suggestions using Groq API
 *
 * Sprint Autocomplete Feature
 */

import type {
  AutocompletePlugin,
  AutocompleteResult,
  AutocompleteContext,
  GroqPluginConfig
} from '../types'

/**
 * Default system prompt for completion
 */
const DEFAULT_SYSTEM_PROMPT = `You are an autocomplete assistant. Given the user's partial input, provide a natural completion.
Rules:
- Complete the text naturally and concisely
- Return ONLY the completed text (including the original input)
- Do not add quotes, explanations, or additional text
- If unsure, return the original input unchanged`

/**
 * Create a Groq LLM autocomplete plugin
 */
export function createGroqPlugin(config: GroqPluginConfig): AutocompletePlugin {
  const {
    apiKey,
    model = 'mixtral-8x7b-32768',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxTokens = 50,
    temperature = 0.3
  } = config

  let isConfigured = !!apiKey

  return {
    id: 'groq',
    name: 'Groq LLM',

    configure(newConfig: Record<string, any>) {
      if (newConfig.apiKey) {
        isConfigured = true
      }
    },

    isReady() {
      return isConfigured
    },

    async getSuggestions(
      input: string,
      context?: AutocompleteContext
    ): Promise<AutocompleteResult> {
      if (!isConfigured) {
        console.warn('[Groq Plugin] API key not configured')
        return { type: 'completion', completion: input }
      }

      if (!input.trim()) {
        return { type: 'completion', completion: '' }
      }

      try {
        // Build context-aware prompt
        let userPrompt = `Complete this text: "${input}"`

        if (context?.fieldName) {
          userPrompt = `Field: ${context.fieldName}\nComplete this text: "${input}"`
        }

        if (context?.formData && Object.keys(context.formData).length > 0) {
          const formContext = Object.entries(context.formData)
            .filter(([key, value]) => value && key !== context.fieldName)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')

          if (formContext) {
            userPrompt = `Form context: ${formContext}\n${userPrompt}`
          }
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens,
            temperature,
            stream: false
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[Groq Plugin] API error:', response.status, errorText)
          return { type: 'completion', completion: input }
        }

        const data = await response.json()
        const completion = data.choices?.[0]?.message?.content?.trim() || input

        // Clean up the completion (remove quotes if present)
        let cleanCompletion = completion
        if (cleanCompletion.startsWith('"') && cleanCompletion.endsWith('"')) {
          cleanCompletion = cleanCompletion.slice(1, -1)
        }
        if (cleanCompletion.startsWith("'") && cleanCompletion.endsWith("'")) {
          cleanCompletion = cleanCompletion.slice(1, -1)
        }

        return {
          type: 'completion',
          completion: cleanCompletion
        }
      } catch (error) {
        console.error('[Groq Plugin] Error:', error)
        return { type: 'completion', completion: input }
      }
    },

    dispose() {
      // No cleanup needed
    }
  }
}

export default createGroqPlugin
