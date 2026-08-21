/**
 * Tests for Chat Bus — createEventEmitter + createCommandHandler + createChatBus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEventEmitter, createCommandHandler, createChatBus, clarificationToPromptConfig, elicitationToPromptConfig } from './chat-bus'
import type { ClarificationEvent, ElicitationEvent } from '../types/chat-bus'

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

describe('clarificationToPromptConfig', () => {
  it('converts a basic ClarificationEvent to a choice prompt', () => {
    const event: ClarificationEvent = {
      question: 'Which file?',
      options: [
        { value: 'a', label: 'File A' },
        { value: 'b', label: 'File B' },
      ],
    }
    const config = clarificationToPromptConfig(event)
    expect(config.type).toBe('choice')
    expect(config.title).toBe('Which file?')
    expect('options' in config.config).toBe(true)
    const opts = (config.config as any).options
    expect(opts).toHaveLength(2)
    expect(opts[0]).toEqual({ value: 'a', label: 'File A' })
    expect((config.config as any).layout).toBe('vertical')
  })

  it('preserves custom metadata transparently', () => {
    const event: ClarificationEvent = {
      question: 'Pick one',
      options: [
        { value: 'x', label: 'X', metadata: { confidence: 0.9, source: 'llm' } },
      ],
    }
    const config = clarificationToPromptConfig(event)
    const opts = (config.config as any).options
    expect(opts[0].metadata).toEqual({ confidence: 0.9, source: 'llm' })
  })

  it('migrates legacy runtime file_id into metadata.file_id', () => {
    // Legacy payloads from older servers may still carry top-level file_id.
    // The helper accepts these at runtime even though the type no longer lists file_id.
    const event = {
      question: 'Which file?',
      options: [
        { value: 'a', label: 'File A', file_id: 42 },
      ],
    } as unknown as ClarificationEvent
    const config = clarificationToPromptConfig(event)
    const opts = (config.config as any).options
    expect(opts[0].metadata).toEqual({ file_id: 42 })
  })

  it('merges legacy file_id alongside existing metadata', () => {
    const event = {
      question: 'Pick one',
      options: [
        { value: 'a', label: 'A', file_id: 7, metadata: { confidence: 0.8 } },
      ],
    } as unknown as ClarificationEvent
    const config = clarificationToPromptConfig(event)
    const opts = (config.config as any).options
    expect(opts[0].metadata).toEqual({ confidence: 0.8, file_id: 7 })
  })

  it('gives precedence to explicit metadata.file_id over legacy field', () => {
    const event = {
      question: 'Pick',
      options: [
        { value: 'a', label: 'A', file_id: 1, metadata: { file_id: 99 } },
      ],
    } as unknown as ClarificationEvent
    const config = clarificationToPromptConfig(event)
    const opts = (config.config as any).options
    expect((opts[0].metadata as any).file_id).toBe(99)
  })

  it('omits metadata entirely when nothing to carry', () => {
    const event: ClarificationEvent = {
      question: 'Pick',
      options: [{ value: 'a', label: 'A' }],
    }
    const config = clarificationToPromptConfig(event)
    const opts = (config.config as any).options
    expect(opts[0]).not.toHaveProperty('metadata')
  })
})

describe('elicitationToPromptConfig — v5.2.0', () => {
  it('single boolean property maps to confirm prompt', () => {
    const event: ElicitationEvent = {
      message: 'Proceed with the deployment?',
      requestedSchema: {
        type: 'object',
        properties: { confirmed: { type: 'boolean', description: 'Ship it?' } },
        required: ['confirmed'],
      },
    }
    const config = elicitationToPromptConfig(event)
    expect(config.type).toBe('confirm')
    expect(config.title).toBe('Proceed with the deployment?')
    expect((config.config as any).message).toBe('Ship it?')
  })

  it('single enum string property (≤4 values) maps to choice prompt', () => {
    const event: ElicitationEvent = {
      message: 'Select severity',
      requestedSchema: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            enumNames: ['Low', 'Medium', 'High'],
          },
        },
      },
    }
    const config = elicitationToPromptConfig(event)
    expect(config.type).toBe('choice')
    const opts = (config.config as any).options
    expect(opts).toEqual([
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ])
  })

  it('enum with >4 values maps to form with select field (not choice)', () => {
    const event: ElicitationEvent = {
      message: 'Pick a country',
      requestedSchema: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            enum: ['FR', 'DE', 'IT', 'ES', 'PT'],
          },
        },
      },
    }
    const config = elicitationToPromptConfig(event)
    expect(config.type).toBe('form')
    const fields = (config.config as any).fields
    expect(fields[0].type).toBe('select')
    expect(fields[0].options).toHaveLength(5)
  })

  it('multi-property object maps to form with one field per property', () => {
    const event: ElicitationEvent = {
      message: 'Fill in contact info',
      requestedSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Full name' },
          age: { type: 'integer' },
          newsletter: { type: 'boolean', description: 'Opt-in' },
        },
        required: ['name'],
      },
    }
    const config = elicitationToPromptConfig(event)
    expect(config.type).toBe('form')
    const fields = (config.config as any).fields
    expect(fields).toHaveLength(3)
    expect(fields.map((f: any) => f.name)).toEqual(['name', 'age', 'newsletter'])
    expect(fields[0]).toMatchObject({ type: 'text', label: 'Full name', required: true })
    expect(fields[1]).toMatchObject({ type: 'number', required: false })
    expect(fields[2]).toMatchObject({ type: 'checkbox', helpText: 'Opt-in' })
  })

  it('string format email maps to email field', () => {
    const event: ElicitationEvent = {
      message: 'Contact',
      requestedSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          reply: { type: 'string' }, // force form (not single-property shortcut)
        },
      },
    }
    const config = elicitationToPromptConfig(event)
    const fields = (config.config as any).fields
    expect(fields[0]).toMatchObject({ name: 'email', type: 'email' })
  })

  it('string format date / date-time maps to date field', () => {
    const event: ElicitationEvent = {
      message: 'Schedule',
      requestedSchema: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date-time' },
        },
      },
    }
    const config = elicitationToPromptConfig(event)
    const fields = (config.config as any).fields
    expect(fields[0].type).toBe('date')
    expect(fields[1].type).toBe('date')
  })

  it('default value maps to placeholder', () => {
    const event: ElicitationEvent = {
      message: 'Settings',
      requestedSchema: {
        type: 'object',
        properties: {
          retries: { type: 'integer', default: 3 },
          timeout: { type: 'integer' }, // second property to force form
        },
      },
    }
    const config = elicitationToPromptConfig(event)
    const fields = (config.config as any).fields
    expect(fields[0]).toMatchObject({ placeholder: '3' })
  })

  it('unknown schema type falls through to text with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = {
      message: 'Edge case',
      requestedSchema: {
        type: 'object',
        properties: {
          weird: { type: 'array' }, // not a primitive
          other: { type: 'string' },
        },
      },
    } as unknown as ElicitationEvent
    const config = elicitationToPromptConfig(event)
    const fields = (config.config as any).fields
    expect(fields[0].type).toBe('text')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
