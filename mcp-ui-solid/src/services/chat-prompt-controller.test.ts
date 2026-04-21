/**
 * Tests for createChatPromptController — v5.2.0
 */

import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import {
  createChatPromptController,
  PromptReplacedError,
} from './chat-prompt-controller'
import type { ChatPromptConfig, ChatPromptResponse } from '../types/chat-bus'

const choiceConfig = (title = 'Pick one'): ChatPromptConfig => ({
  type: 'choice',
  title,
  config: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
})

const confirmConfig = (title = 'Confirm?'): ChatPromptConfig => ({
  type: 'confirm',
  title,
  config: { message: 'Sure?' },
})

const choiceResponse = (value: string): ChatPromptResponse => ({
  type: 'choice',
  value,
  label: value,
})

describe('createChatPromptController — v5.2.0', () => {
  it('sequential prompts both resolve', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()

      const p1 = ctrl.handle(choiceConfig('First'))
      expect(ctrl.activePrompt()?.title).toBe('First')
      ctrl.resolveActive(choiceResponse('a'))
      expect(ctrl.activePrompt()).toBeNull()
      const r1 = await p1
      expect(r1.value).toBe('a')

      const p2 = ctrl.handle(choiceConfig('Second'))
      expect(ctrl.activePrompt()?.title).toBe('Second')
      ctrl.resolveActive(choiceResponse('b'))
      const r2 = await p2
      expect(r2.value).toBe('b')

      dispose()
    })
  })

  it('re-entrant call rejects previous Promise with PromptReplacedError', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()

      const p1 = ctrl.handle(choiceConfig('First'))
      // Don't resolve — fire a second one
      const p2 = ctrl.handle(choiceConfig('Second'))

      await expect(p1).rejects.toBeInstanceOf(PromptReplacedError)

      // The second prompt is now active and can still resolve
      expect(ctrl.activePrompt()?.title).toBe('Second')
      ctrl.resolveActive(choiceResponse('b'))
      await expect(p2).resolves.toMatchObject({ value: 'b' })

      dispose()
    })
  })

  it('AbortSignal already aborted on entry rejects with DOMException AbortError', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()
      const ac = new AbortController()
      ac.abort()

      const p = ctrl.handle(choiceConfig('Never shown'), ac.signal)
      expect(ctrl.activePrompt()).toBeNull() // UI never installed

      await expect(p).rejects.toMatchObject({ name: 'AbortError' })
      dispose()
    })
  })

  it('AbortSignal aborted during prompt rejects + clears activePrompt', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()
      const ac = new AbortController()

      const p = ctrl.handle(choiceConfig('Pending'), ac.signal)
      expect(ctrl.activePrompt()?.title).toBe('Pending')

      ac.abort()
      await expect(p).rejects.toMatchObject({ name: 'AbortError' })
      expect(ctrl.activePrompt()).toBeNull()

      dispose()
    })
  })

  it('abort() method rejects pending Promise with AbortError', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()

      const p = ctrl.handle(choiceConfig('Will abort'))
      ctrl.abort('Navigated away')

      await expect(p).rejects.toMatchObject({ name: 'AbortError' })
      expect(ctrl.activePrompt()).toBeNull()

      dispose()
    })
  })

  it('dismissActive resolves with dismissed: true and preserves the prompt type', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()
      const p = ctrl.handle(confirmConfig('Really?'))

      ctrl.dismissActive()
      const r = await p
      expect(r).toMatchObject({ type: 'confirm', dismissed: true })
      expect(ctrl.activePrompt()).toBeNull()

      dispose()
    })
  })

  it('resolve/dismiss after abort is a no-op (double-settle protection)', async () => {
    await createRoot(async (dispose) => {
      const ctrl = createChatPromptController()
      const p = ctrl.handle(choiceConfig('x'))

      ctrl.abort()
      // These should not throw or re-settle
      ctrl.resolveActive(choiceResponse('ignored'))
      ctrl.dismissActive()

      await expect(p).rejects.toMatchObject({ name: 'AbortError' })
      dispose()
    })
  })
})
