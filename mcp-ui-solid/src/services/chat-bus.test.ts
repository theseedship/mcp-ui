/**
 * Tests for Chat Bus — createEventEmitter + createCommandHandler + createChatBus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEventEmitter, createCommandHandler, createChatBus } from './chat-bus'
import type { ChatEvents, ChatCommands } from '../types/chat-bus'

describe('createEventEmitter', () => {
  it('emits events to subscribed listeners', () => {
    const emitter = createEventEmitter()
    const handler = vi.fn()

    emitter.on('onToken', handler)
    emitter.emit('onToken', { streamKey: 'abc', token: 'hello' })

    expect(handler).toHaveBeenCalledWith({ streamKey: 'abc', token: 'hello' })
  })

  it('supports multiple listeners for the same event', () => {
    const emitter = createEventEmitter()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    emitter.on('onStreamStart', handler1)
    emitter.on('onStreamStart', handler2)
    emitter.emit('onStreamStart', { streamKey: 'abc' })

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('returns unsubscribe function', () => {
    const emitter = createEventEmitter()
    const handler = vi.fn()

    const unsub = emitter.on('onToken', handler)
    emitter.emit('onToken', { streamKey: 'abc', token: 'a' })
    expect(handler).toHaveBeenCalledOnce()

    unsub()
    emitter.emit('onToken', { streamKey: 'abc', token: 'b' })
    expect(handler).toHaveBeenCalledOnce() // still 1, not 2
  })

  it('clear() removes all listeners', () => {
    const emitter = createEventEmitter()
    const handler = vi.fn()

    emitter.on('onToken', handler)
    emitter.on('onStreamEnd', handler)
    emitter.clear()

    emitter.emit('onToken', { streamKey: 'abc', token: 'a' })
    emitter.emit('onStreamEnd', { streamKey: 'abc', metadata: {} as any })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting with no listeners', () => {
    const emitter = createEventEmitter()
    expect(() => emitter.emit('onToken', { streamKey: 'abc', token: 'a' })).not.toThrow()
  })

  it('catches errors in handlers without breaking other listeners', () => {
    const emitter = createEventEmitter()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const badHandler = vi.fn(() => { throw new Error('boom') })
    const goodHandler = vi.fn()

    emitter.on('onToken', badHandler)
    emitter.on('onToken', goodHandler)
    emitter.emit('onToken', { streamKey: 'abc', token: 'a' })

    expect(badHandler).toHaveBeenCalled()
    expect(goodHandler).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  describe('streamKey filtering', () => {
    it('filters events by streamKey when option is set', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      emitter.on('onToken', handler, { streamKey: 'stream-1' })

      emitter.emit('onToken', { streamKey: 'stream-1', token: 'a' })
      emitter.emit('onToken', { streamKey: 'stream-2', token: 'b' })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ streamKey: 'stream-1', token: 'a' })
    })

    it('does not filter when no streamKey option', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      emitter.on('onToken', handler)

      emitter.emit('onToken', { streamKey: 'stream-1', token: 'a' })
      emitter.emit('onToken', { streamKey: 'stream-2', token: 'b' })

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('filters onCustomEvent by streamKey in second arg', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      emitter.on('onCustomEvent', handler, { streamKey: 'stream-1' })

      // onCustomEvent signature: (type: string, event: ChatEventBase & { data })
      emitter.emit('onCustomEvent', 'my_event', { streamKey: 'stream-1', data: 'yes' })
      emitter.emit('onCustomEvent', 'my_event', { streamKey: 'stream-2', data: 'no' })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('my_event', { streamKey: 'stream-1', data: 'yes' })
    })
  })

  describe('throttle', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('throttles handler calls', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      emitter.on('onToken', handler, { throttle: 100 })

      // Rapid fire
      emitter.emit('onToken', { streamKey: 'abc', token: 'a' })
      emitter.emit('onToken', { streamKey: 'abc', token: 'b' })
      emitter.emit('onToken', { streamKey: 'abc', token: 'c' })

      // First call goes through immediately
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ streamKey: 'abc', token: 'a' })

      // After throttle period, last call fires
      vi.advanceTimersByTime(100)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenLastCalledWith({ streamKey: 'abc', token: 'c' })
    })

    it('cancels pending throttle timer on unsubscribe', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      const unsub = emitter.on('onToken', handler, { throttle: 100 })

      emitter.emit('onToken', { streamKey: 'abc', token: 'a' })
      expect(handler).toHaveBeenCalledOnce() // immediate

      emitter.emit('onToken', { streamKey: 'abc', token: 'b' }) // queued
      unsub() // should cancel the queued call

      vi.advanceTimersByTime(200)
      expect(handler).toHaveBeenCalledOnce() // still 1, queued was cancelled
    })

    it('catches errors in throttled deferred calls', () => {
      const emitter = createEventEmitter()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const badHandler = vi.fn(() => { throw new Error('throttle boom') })

      emitter.on('onToken', badHandler, { throttle: 50 })

      emitter.emit('onToken', { streamKey: 'abc', token: 'a' }) // immediate — caught by emit
      emitter.emit('onToken', { streamKey: 'abc', token: 'b' }) // deferred

      vi.advanceTimersByTime(50) // fires deferred — should catch
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('non-throttled listeners fire immediately', () => {
      const emitter = createEventEmitter()
      const handler = vi.fn()

      emitter.on('onToken', handler) // no throttle

      emitter.emit('onToken', { streamKey: 'abc', token: 'a' })
      emitter.emit('onToken', { streamKey: 'abc', token: 'b' })
      emitter.emit('onToken', { streamKey: 'abc', token: 'c' })

      expect(handler).toHaveBeenCalledTimes(3)
    })
  })
})

describe('createCommandHandler', () => {
  it('executes registered command handlers', () => {
    const commands = createCommandHandler()
    const handler = vi.fn()

    commands.handle('injectPrompt', handler)
    commands.exec('injectPrompt', 'Hello')

    expect(handler).toHaveBeenCalledWith('Hello')
  })

  it('returns handler result', () => {
    const commands = createCommandHandler()

    commands.handle('sendPrompt', (text: string) => `corr-${text}`)
    const result = commands.exec('sendPrompt', 'test')

    expect(result).toBe('corr-test')
  })

  it('warns when executing unregistered command', () => {
    const commands = createCommandHandler()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    commands.exec('injectPrompt', 'test')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('injectPrompt'))
    warnSpy.mockRestore()
  })

  it('replaces handler when handle() is called again', () => {
    const commands = createCommandHandler()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    commands.handle('injectPrompt', handler1)
    commands.handle('injectPrompt', handler2)
    commands.exec('injectPrompt', 'test')

    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).toHaveBeenCalledWith('test')
  })
})

describe('createChatBus', () => {
  it('creates a bus with events and commands', () => {
    const bus = createChatBus()

    expect(bus.events).toBeDefined()
    expect(bus.events.on).toBeTypeOf('function')
    expect(bus.events.emit).toBeTypeOf('function')
    expect(bus.events.clear).toBeTypeOf('function')

    expect(bus.commands).toBeDefined()
    expect(bus.commands.handle).toBeTypeOf('function')
    expect(bus.commands.exec).toBeTypeOf('function')
  })

  it('events and commands work together', () => {
    const bus = createChatBus()
    const responses: string[] = []

    // Agent subscribes to stream end
    bus.events.on('onStreamEnd', (event) => {
      if ((event.metadata as any).needs_period) {
        // Agent sends a command back
        bus.commands.exec('injectPrompt', 'DVF 93 2024')
      }
    })

    // App handles the command
    bus.commands.handle('injectPrompt', (text) => {
      responses.push(text)
    })

    // Simulate stream end
    bus.events.emit('onStreamEnd', {
      streamKey: 'abc',
      metadata: { needs_period: true } as any,
    })

    expect(responses).toEqual(['DVF 93 2024'])
  })

  it('correlationId flows through events→commands→events cycle', () => {
    const bus = createChatBus()
    const receivedCorrelations: (string | undefined)[] = []

    // App handles sendPrompt — returns correlationId
    bus.commands.handle('sendPrompt', (_text: string) => {
      return 'corr-123'
    })

    // Agent listens for stream end with correlation
    bus.events.on('onStreamEnd', (event) => {
      receivedCorrelations.push(event.correlationId)
    })

    // Agent sends prompt
    const corrId = bus.commands.exec('sendPrompt', 'test query')
    expect(corrId).toBe('corr-123')

    // App bridges stream end with correlation
    bus.events.emit('onStreamEnd', {
      streamKey: 'stream-1',
      correlationId: corrId,
      metadata: {} as any,
    })

    expect(receivedCorrelations).toEqual(['corr-123'])
  })
})
