/**
 * Chat Bus — Event Emitter + Command Handler
 * v2.4.0: Core primitives for the chat event/command bus
 *
 * @experimental — This API may change without major bump until v2.5.0.
 */

import type {
  ChatEvents,
  ChatCommands,
  ChatEventEmitter,
  ChatCommandHandler,
  ChatBus,
  EventSubscribeOptions,
  ScratchpadSection,
  ClarificationEvent,
  ChatPromptConfig,
} from '../types/chat-bus'

// ─── Event Emitter ───────────────────────────────────────────

interface Listener<F extends (...args: any[]) => any> {
  handler: F
  options?: EventSubscribeOptions
  throttledHandler?: F
}

/**
 * Create a typed event emitter with throttle and streamKey filtering support.
 *
 * @experimental
 *
 * @example
 * const emitter = createEventEmitter<ChatEvents>()
 * const unsub = emitter.on('onToken', (event) => console.log(event.token), { throttle: 100 })
 * emitter.emit('onToken', { streamKey: 'abc', token: 'hello' })
 * unsub()
 */
export function createEventEmitter(): ChatEventEmitter {
  const listeners = new Map<string, Set<Listener<any>>>()

  interface ThrottledFn<F> {
    fn: F
    cancel: () => void
  }

  function createThrottled<F extends (...args: any[]) => void>(fn: F, ms: number): ThrottledFn<F> {
    let lastCall = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastArgs: any[] | null = null
    let cancelled = false

    const throttled = ((...args: any[]) => {
      if (cancelled) return
      lastArgs = args
      const now = Date.now()
      const remaining = ms - (now - lastCall)

      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null }
        lastCall = now
        fn(...args)
      } else if (!timer) {
        timer = setTimeout(() => {
          lastCall = Date.now()
          timer = null
          if (lastArgs && !cancelled) {
            try { fn(...lastArgs) } catch (err) { console.error('[ChatBus] Error in throttled handler:', err) }
          }
        }, remaining)
      }
    }) as F

    return {
      fn: throttled,
      cancel: () => { cancelled = true; if (timer) { clearTimeout(timer); timer = null } },
    }
  }

  return {
    on(event, handler, options) {
      if (!listeners.has(event as string)) {
        listeners.set(event as string, new Set())
      }

      const listener: Listener<typeof handler> = { handler, options }

      // Apply throttle if requested
      let throttleHandle: ThrottledFn<typeof handler> | null = null
      if (options?.throttle && options.throttle > 0) {
        throttleHandle = createThrottled(handler, options.throttle)
        listener.throttledHandler = throttleHandle.fn
      }

      listeners.get(event as string)!.add(listener)

      // Return unsubscribe function — cancels pending throttle timers
      return () => {
        throttleHandle?.cancel()
        listeners.get(event as string)?.delete(listener)
      }
    },

    emit(event, ...args) {
      const set = listeners.get(event as string)
      if (!set) return

      for (const listener of set) {
        // StreamKey filtering: skip if listener wants a specific streamKey
        // For most events args[0] has streamKey; for onCustomEvent args[1] has it
        if (listener.options?.streamKey) {
          let streamKeyArg: unknown
          for (const arg of args) {
            if (arg && typeof arg === 'object' && 'streamKey' in (arg as any)) {
              streamKeyArg = (arg as any).streamKey
              break
            }
          }
          if (streamKeyArg !== undefined && streamKeyArg !== listener.options.streamKey) continue
        }

        const fn = listener.throttledHandler || listener.handler
        try {
          fn(...args)
        } catch (err) {
          console.error(`[ChatBus] Error in ${event as string} handler:`, err)
        }
      }
    },

    clear() {
      listeners.clear()
    },
  } as ChatEventEmitter
}

// ─── Command Handler ─────────────────────────────────────────

/**
 * Create a typed command handler. The host app registers handlers,
 * agents execute commands.
 *
 * @experimental
 *
 * @example
 * const commands = createCommandHandler<ChatCommands>()
 * commands.handle('injectPrompt', (text) => setInputValue(text))
 * commands.exec('injectPrompt', 'Hello world')
 */
export function createCommandHandler(): ChatCommandHandler {
  const handlers = new Map<string, (...args: any[]) => any>()

  return {
    handle(command, handler) {
      handlers.set(command as string, handler)
    },

    exec(command, ...args) {
      const handler = handlers.get(command as string)
      if (!handler) {
        console.warn(`[ChatBus] No handler registered for command: ${command as string}`)
        return undefined as any
      }
      return handler(...args)
    },
  } as ChatCommandHandler
}

// ─── Chat Bus Factory ────────────────────────────────────────

/**
 * Create a complete ChatBus with events + commands.
 *
 * @experimental
 *
 * @example
 * const bus = createChatBus()
 * bus.events.on('onStreamEnd', (event) => { ... })
 * bus.commands.handle('sendPrompt', (text) => { ... })
 */
export function createChatBus(): ChatBus {
  return {
    events: createEventEmitter(),
    commands: createCommandHandler(),
  }
}

// ─── Scratchpad Section Merge Helper ─────────────────────────

/**
 * Merge sections from a ScratchpadEvent into existing state sections.
 * Handles replace/append/upsert modes.
 *
 * @example
 * const newSections = mergeScratchpadSections(
 *   currentState.sections,
 *   event.sections,
 *   event.sectionMode
 * )
 */
export function mergeScratchpadSections(
  existing: ScratchpadSection[],
  incoming: ScratchpadSection[] | undefined,
  mode: 'replace' | 'append' | 'upsert' = 'replace'
): ScratchpadSection[] {
  if (!incoming) return existing

  switch (mode) {
    case 'append':
      return [...existing, ...incoming]

    case 'upsert': {
      const result = [...existing]
      for (const section of incoming) {
        const idx = result.findIndex((s) => s.id === section.id)
        if (idx >= 0) {
          result[idx] = section
        } else {
          result.push(section)
        }
      }
      return result
    }

    case 'replace':
    default:
      return incoming
  }
}

// ─── Clarification → Prompt Helper (v4.3.9) ──────────────────

/**
 * Convert a ClarificationEvent into a ChatPromptConfig.
 * Universal bridge for apps receiving clarification events via SSE.
 *
 * Legacy runtime `file_id` (removed from the type in v5.0.0) is still
 * transparently migrated into `metadata.file_id` when present, so payloads
 * from older servers continue to work without upgrade pressure.
 *
 * @experimental
 * @since v4.3.9
 * @example
 * bus.events.on('onClarificationNeeded', ({ clarification }) => {
 *   bus.commands.exec('showChatPrompt', clarificationToPromptConfig(clarification))
 * })
 */
export function clarificationToPromptConfig(
  event: ClarificationEvent
): ChatPromptConfig {
  return {
    type: 'choice',
    title: event.question,
    config: {
      options: event.options.map((opt) => {
        const merged: Record<string, unknown> = { ...(opt.metadata ?? {}) }
        // Runtime fallback for legacy payloads that still carry file_id at the top level.
        const legacyFileId = (opt as { file_id?: number }).file_id
        if (legacyFileId !== undefined && merged.file_id === undefined) {
          merged.file_id = legacyFileId
        }
        return {
          value: opt.value,
          label: opt.label,
          // Only include metadata if non-empty (keeps payloads clean)
          ...(Object.keys(merged).length > 0 ? { metadata: merged } : {}),
        }
      }),
      layout: 'vertical',
    },
  }
}
