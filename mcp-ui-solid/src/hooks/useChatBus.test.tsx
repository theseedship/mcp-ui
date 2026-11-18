import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createChatBus } from '../services/chat-bus'
import { ChatBusProvider, useChatBus } from './useChatBus'
import type { ChatBus } from '../types/chat-bus'

describe('ChatBusProvider Solid 2 lifecycle', () => {
  afterEach(cleanup)

  it('isolates two explicit buses and tears down only the disposed provider', () => {
    const first = createChatBus()
    const second = createChatBus()
    const onFirst = vi.fn()
    const onSecond = vi.fn()
    let seenFirst: ChatBus | undefined
    let seenSecond: ChatBus | undefined
    const FirstProbe = () => {
      seenFirst = useChatBus()
      return null
    }
    const SecondProbe = () => {
      seenSecond = useChatBus()
      return null
    }
    const firstRoot = render(() => (
      <ChatBusProvider bus={first}>
        <FirstProbe />
      </ChatBusProvider>
    ))
    const secondRoot = render(() => (
      <ChatBusProvider bus={second}>
        <SecondProbe />
      </ChatBusProvider>
    ))
    expect(seenFirst).toBe(first)
    expect(seenSecond).toBe(second)
    first.events.on('onToken', onFirst)
    second.events.on('onToken', onSecond)
    first.events.emit('onToken', { streamKey: 'first', token: 'a' })
    expect(onFirst).toHaveBeenCalledTimes(1)
    expect(onSecond).not.toHaveBeenCalled()
    firstRoot.unmount()
    first.events.emit('onToken', { streamKey: 'first', token: 'late' })
    second.events.emit('onToken', { streamKey: 'second', token: 'b' })
    expect(onFirst).toHaveBeenCalledTimes(1)
    expect(onSecond).toHaveBeenCalledTimes(1)
    secondRoot.unmount()
  })

  it('retains the explicit missing-provider error', () => {
    const MissingProvider = () => {
      useChatBus()
      return null
    }
    expect(() => render(() => <MissingProvider />)).toThrow(
      'useChatBus must be used within a <ChatBusProvider>'
    )
  })
})
