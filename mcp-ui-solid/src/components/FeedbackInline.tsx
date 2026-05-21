/**
 * FeedbackInline — per-message inline feedback (thumbs up/down)
 *
 * @experimental
 * @since v5.2.0
 *
 * A small, non-blocking per-message feedback primitive. Sits next to an
 * assistant message, captures a rating, calls back to the consumer for
 * persistence. Best-effort by design — no retry UX, no revision UX.
 *
 * ## When to use vs other feedback primitives
 *
 * - **`FeedbackInline`** (this) → per-message thumb-up/down, non-blocking,
 *   many can coexist.
 * - **`ChatPrompt` (type=choice)** → modal, one-at-a-time above the input,
 *   used when the agent needs a blocking answer.
 * - **`ScratchpadPanel` feedback section** → structured feedback bound to a
 *   scratchpad turn, panel-side.
 *
 * ## Persistence is the consumer's job
 *
 * The component flips to "submitted" state *optimistically* on click and
 * calls `onSubmit(rating, context)`. Network failures do not revert the UI —
 * feedback is best-effort. If you need stricter semantics (offline retry,
 * revision, ...) wrap this in your own component.
 *
 * @example
 * ```tsx
 * <FeedbackInline
 *   messageHash={msg.hash}
 *   context={{ intent: msg.intent, confidenceBand: msg.band }}
 *   onSubmit={(rating, ctx) =>
 *     fetch('/api/feedback', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ message_hash: msg.hash, rating, ...ctx }),
 *     })
 *   }
 * />
 * ```
 */

import { Component, Show, createSignal } from 'solid-js'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'

export interface FeedbackInlineContext {
  intent?: string
  confidenceBand?: string
  tags?: string[]
  [key: string]: unknown
}

export interface FeedbackInlineProps {
  /** Stable identifier for the message being rated. */
  messageHash?: string
  /**
   * Called on click. Consumer is responsible for persistence (HTTP, store,
   * localStorage). Return value ignored.
   */
  onSubmit: (rating: 'positive' | 'negative', context?: FeedbackInlineContext) => void | Promise<void>
  /** Extra context forwarded to `onSubmit`. */
  context?: FeedbackInlineContext
  /** Ack text shown after positive rating. Defaults to `MCPUIStrings.feedbackPositiveAck` ('Thanks!' in EN). */
  positiveAck?: string
  /** Ack text shown after negative rating. Defaults to `MCPUIStrings.feedbackNegativeAck`. */
  negativeAck?: string
  /** Extra Tailwind classes on the container. */
  class?: string
}

/**
 * @experimental
 * Per-message inline feedback (thumbs up/down). Non-blocking.
 */
export const FeedbackInline: Component<FeedbackInlineProps> = (props) => {
  const [rating, setRating] = createSignal<'positive' | 'negative' | null>(null)
  const strings = useMCPUIStrings()

  const handle = (value: 'positive' | 'negative') => {
    if (rating() !== null) return // already submitted, final state
    setRating(value)
    try {
      // Fire-and-forget. If the consumer returns a Promise that rejects,
      // swallow it — feedback is best-effort by design.
      const result = props.onSubmit(value, props.context)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch(() => {
          /* non-blocking */
        })
      }
    } catch {
      /* non-blocking */
    }
  }

  return (
    <div class={`flex items-center gap-1 ${props.class ?? ''}`.trim()}>
      <Show
        when={rating() === null}
        fallback={
          <span class="text-[11px] text-deposium-slate-500">
            {rating() === 'positive'
              ? (props.positiveAck ?? strings.feedbackPositiveAck)
              : (props.negativeAck ?? strings.feedbackNegativeAck)}
          </span>
        }
      >
        <button
          type="button"
          onClick={() => handle('positive')}
          class="p-1 rounded hover:bg-green-500/10 text-deposium-slate-500 hover:text-green-500 transition-colors"
          title={strings.feedbackUseful}
          aria-label="Mark response as useful"
          data-feedback-inline-rating="positive"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M3 15v7"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handle('negative')}
          class="p-1 rounded hover:bg-red-500/10 text-deposium-slate-500 hover:text-red-500 transition-colors"
          title={strings.feedbackNotUseful}
          aria-label="Mark response as not useful"
          data-feedback-inline-rating="negative"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M21 4v7"
            />
          </svg>
        </button>
      </Show>
    </div>
  )
}
