/**
 * createChatPromptController — centralised lifecycle for `showChatPrompt`
 *
 * @experimental
 * @since v5.2.0
 *
 * The controller owns the resolver closure, AbortSignal wiring, and
 * re-entrance policy in one primitive. Consumers go from ~20 LOC of manual
 * wiring per app to :
 *
 * ```ts
 * const ctrl = createChatPromptController()
 * bus.commands.handle('showChatPrompt', ctrl.handle)
 * // ...
 * <Show when={ctrl.activePrompt()}>
 *   {(cfg) => (
 *     <ChatPrompt
 *       config={cfg()}
 *       onSubmit={ctrl.resolveActive}
 *       onDismiss={ctrl.dismissActive}
 *     />
 *   )}
 * </Show>
 * ```
 *
 * ## Re-entrance policy
 *
 * If a new `showChatPrompt` arrives while a previous Promise is still
 * pending, the previous Promise rejects **synchronously** with a
 * `PromptReplacedError` before the new prompt is installed. Callers that
 * care can branch on `err instanceof PromptReplacedError` or `err.name ===
 * 'PromptReplacedError'`.
 *
 * ## Abort semantics
 *
 * `handle(config, signal?)` honours `AbortSignal` :
 *
 * - If `signal.aborted === true` on entry → returns a rejected Promise with
 *   `new DOMException('Prompt aborted', 'AbortError')`, does NOT set
 *   `activePrompt`.
 * - Otherwise registers a once-only listener that rejects with the same
 *   `DOMException` on abort, clearing the active state.
 *
 * `AbortError` is the Web Platform convention (matches `fetch()`,
 * `Response.body.cancel()`, etc.) — callers can branch on `err.name ===
 * 'AbortError'` without importing any mcp-ui type.
 */

import { createSignal, type Accessor } from 'solid-js'
import type { ChatPromptConfig, ChatPromptResponse } from '../types/chat-bus'

// ─── Error class ─────────────────────────────────────────────

/**
 * Thrown when an active `showChatPrompt` Promise is rejected because a new
 * prompt arrived before the previous one resolved. Consumers can use
 * `instanceof PromptReplacedError` or `err.name === 'PromptReplacedError'` to
 * branch (retry, bail, log).
 *
 * @experimental
 * @since v5.2.0
 */
export class PromptReplacedError extends Error {
  readonly name = 'PromptReplacedError' as const
  constructor(message = 'Prompt replaced by a newer one') {
    super(message)
  }
}

// ─── Controller shape ────────────────────────────────────────

export interface ChatPromptController {
  /**
   * Register as the bus handler :
   * `bus.commands.handle('showChatPrompt', ctrl.handle)`
   */
  handle: (config: ChatPromptConfig, signal?: AbortSignal) => Promise<ChatPromptResponse>

  /**
   * Reactive accessor for the currently active prompt config (null when no
   * prompt is pending). Use in JSX to drive `<ChatPrompt>` rendering.
   */
  activePrompt: Accessor<ChatPromptConfig | null>

  /** Call this from `<ChatPrompt>`'s `onSubmit` prop. */
  resolveActive: (response: ChatPromptResponse) => void

  /** Call this from `<ChatPrompt>`'s `onDismiss` prop. */
  dismissActive: () => void

  /**
   * Cancel the active prompt programmatically (e.g. on route change). Rejects
   * the pending Promise with the supplied reason or an `AbortError`.
   */
  abort: (reason?: string) => void
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a stateful controller that owns the active prompt Promise, the
 * AbortSignal listener, and the re-entrance policy. See module JSDoc for
 * full usage.
 *
 * @experimental
 * @since v5.2.0
 */
export function createChatPromptController(): ChatPromptController {
  const [activePrompt, setActivePrompt] = createSignal<ChatPromptConfig | null>(null)

  interface PendingEntry {
    type: ChatPromptConfig['type']
    resolve: (r: ChatPromptResponse) => void
    reject: (err: unknown) => void
    signal?: AbortSignal
    onAbort?: () => void
  }

  let pending: PendingEntry | null = null

  function cleanupAbort(entry: PendingEntry): void {
    if (entry.signal && entry.onAbort) {
      entry.signal.removeEventListener('abort', entry.onAbort)
    }
  }

  function clearPending(): void {
    if (pending) {
      cleanupAbort(pending)
      pending = null
    }
    setActivePrompt(null)
  }

  function handle(
    config: ChatPromptConfig,
    signal?: AbortSignal
  ): Promise<ChatPromptResponse> {
    // Re-entrance : synchronously reject the previous Promise before
    // installing the new prompt. The caller's .catch sees the rejection
    // on the microtask boundary regardless.
    if (pending) {
      const previous = pending
      pending = null
      cleanupAbort(previous)
      previous.reject(new PromptReplacedError())
    }

    // Abort already tripped on entry : return a rejected Promise without
    // ever showing the UI.
    if (signal?.aborted) {
      setActivePrompt(null)
      return Promise.reject(new DOMException('Prompt aborted', 'AbortError'))
    }

    return new Promise<ChatPromptResponse>((resolve, reject) => {
      const entry: PendingEntry = { type: config.type, resolve, reject, signal }

      if (signal) {
        entry.onAbort = () => {
          // If this entry is still active, reject + clear. If a newer prompt
          // has since replaced it, the cleanup already ran — no-op.
          if (pending === entry) {
            pending = null
            cleanupAbort(entry)
            setActivePrompt(null)
            reject(new DOMException('Prompt aborted', 'AbortError'))
          }
        }
        signal.addEventListener('abort', entry.onAbort, { once: true })
      }

      pending = entry
      setActivePrompt(config)
    })
  }

  function resolveActive(response: ChatPromptResponse): void {
    if (!pending) return
    const entry = pending
    pending = null
    cleanupAbort(entry)
    setActivePrompt(null)
    entry.resolve(response)
  }

  function dismissActive(): void {
    if (!pending) return
    const entry = pending
    pending = null
    cleanupAbort(entry)
    setActivePrompt(null)
    // Surface as a resolved Promise with dismissed: true — matches existing
    // ChatPrompt onDismiss contract from v4.x.
    entry.resolve({ type: entry.type, value: '', label: '', dismissed: true })
  }

  function abort(reason = 'Prompt aborted'): void {
    if (!pending) return
    const entry = pending
    pending = null
    cleanupAbort(entry)
    setActivePrompt(null)
    entry.reject(new DOMException(reason, 'AbortError'))
  }

  return {
    handle,
    activePrompt,
    resolveActive,
    dismissActive,
    abort,
  }
}
