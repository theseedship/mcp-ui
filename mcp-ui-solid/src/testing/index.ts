/**
 * Testing utilities for mcp-ui consumers.
 *
 * @experimental
 * @since v4.3.9
 */

import { createChatBus } from '../services/chat-bus'
import type { ChatBus, ChatPromptConfig, ChatPromptResponse } from '../types/chat-bus'

export interface MockChatBusOptions {
  /** Pre-programmed responses for showChatPrompt, consumed in FIFO order */
  promptResponses?: ChatPromptResponse[]
  /** Called when showChatPrompt is invoked (spy hook) */
  onShowChatPrompt?: (config: ChatPromptConfig) => void
}

/**
 * Create a ChatBus pre-wired with test fixtures.
 *
 * Pre-programmed `ChatPromptResponse`s are returned in FIFO order when the
 * agent calls `showChatPrompt`. Useful for testing flows that depend on
 * user choices without rendering any UI.
 *
 * @example
 * const bus = createMockChatBus({
 *   promptResponses: [
 *     { type: 'choice', value: 'yes', label: 'Yes' },
 *   ],
 * })
 * const response = await bus.commands.exec('showChatPrompt', {
 *   type: 'choice',
 *   title: 'Proceed?',
 *   config: { options: [{ value: 'yes', label: 'Yes' }] },
 * })
 * expect(response.value).toBe('yes')
 */
export function createMockChatBus(options: MockChatBusOptions = {}): ChatBus {
  const bus = createChatBus()
  const queue = [...(options.promptResponses ?? [])]
  bus.commands.handle('showChatPrompt', async (config) => {
    options.onShowChatPrompt?.(config)
    const response = queue.shift()
    if (!response) {
      throw new Error('createMockChatBus: no more pre-programmed responses')
    }
    return response
  })
  return bus
}
