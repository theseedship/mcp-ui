/**
 * Tests for createMockChatBus helper.
 */

import { describe, it, expect, vi } from 'vitest'
import { createMockChatBus } from './index'
import type { ChatPromptResponse } from '../types/chat-bus'

describe('createMockChatBus', () => {
  it('returns pre-programmed responses in FIFO order', async () => {
    const responses: ChatPromptResponse[] = [
      { type: 'choice', value: 'a', label: 'A' },
      { type: 'choice', value: 'b', label: 'B' },
    ]
    const bus = createMockChatBus({ promptResponses: responses })

    const first = await bus.commands.exec('showChatPrompt', {
      type: 'choice',
      title: 'first',
      config: { options: [{ value: 'a', label: 'A' }] },
    })
    const second = await bus.commands.exec('showChatPrompt', {
      type: 'choice',
      title: 'second',
      config: { options: [{ value: 'b', label: 'B' }] },
    })

    expect(first.value).toBe('a')
    expect(second.value).toBe('b')
  })

  it('throws when the queue is exhausted', async () => {
    const bus = createMockChatBus({ promptResponses: [] })
    await expect(
      bus.commands.exec('showChatPrompt', {
        type: 'choice',
        title: 'x',
        config: { options: [{ value: 'a', label: 'A' }] },
      })
    ).rejects.toThrow(/no more pre-programmed responses/)
  })

  it('invokes onShowChatPrompt spy with the config', async () => {
    const spy = vi.fn()
    const bus = createMockChatBus({
      promptResponses: [{ type: 'confirm', value: 'yes', label: 'Yes' }],
      onShowChatPrompt: spy,
    })
    const config = {
      type: 'confirm' as const,
      title: 'Proceed?',
      config: { message: 'sure?' },
    }
    await bus.commands.exec('showChatPrompt', config)
    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(config)
  })

  it('exposes a working underlying event emitter', () => {
    const bus = createMockChatBus()
    const handler = vi.fn()
    bus.events.on('onToken', handler)
    bus.events.emit('onToken', { streamKey: 'test', token: 'hi' })
    expect(handler).toHaveBeenCalledWith({ streamKey: 'test', token: 'hi' })
  })
})
