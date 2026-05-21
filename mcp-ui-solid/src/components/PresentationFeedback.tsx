/**
 * PresentationFeedback — feedback on how a connector result was *presented*.
 *
 * @experimental
 * @since v6.6.0 (R3 / D9 of ROADMAP-opendata-macro-mcpui)
 *
 * ## A separate axis from `FeedbackInline`
 *
 * MCP-UI has two distinct feedback widgets, kept separate on purpose
 * (cf. R3) :
 *
 * - **`FeedbackInline`** — was the *answer* good? (response quality)
 * - **`PresentationFeedback`** (this) — was the answer *shown well*?
 *   (layout / readability)
 *
 * They are separate components, separate exports, separate payloads — so
 * the two axes never collapse into one in the UX or in the logs.
 *
 * ## Stateless — host owns persistence and re-render
 *
 * On submit the component calls `onSubmit(feedback)` with a
 * `ConnectorRenderFeedback` payload and flips to its acknowledgement state.
 * It does NOT persist anything and does NOT re-render the result itself
 * (cf. D1 : adapter pure + host-owned state). The host persists the
 * feedback and, if it wants to "close the loop", re-runs its adapter with
 * the corrected `preferredLayout`.
 *
 * Submission is best-effort : a rejected `onSubmit` promise is swallowed,
 * the UI still flips.
 *
 * ## Localization
 *
 * All labels ship in English and are overridable via the `labels` prop
 * (partial). This component carries its own label bag rather than routing
 * through `MCPUIStringsProvider` — its label set is large and specific to
 * this one widget.
 *
 * @example
 * ```tsx
 * <PresentationFeedback
 *   connectorId="datagouv"
 *   toolName="datagouv.search"
 *   queryHash={result.queryHash}
 *   layoutType="table"
 *   preferredLayoutOptions={['table', 'bar', 'map']}
 *   onSubmit={(fb) => fetch('/api/render-feedback', {
 *     method: 'POST', body: JSON.stringify(fb),
 *   })}
 * />
 * ```
 */

import { Component, Show, For, createSignal } from 'solid-js'
import type {
  ConnectorRenderFeedback,
  ConnectorRenderProblem,
  ConnectorPreferredLayout,
} from '@seed-ship/mcp-ui-spec'

/** The full set of problem tags, in display order. */
const PROBLEM_ORDER: ConnectorRenderProblem[] = [
  'too_raw',
  'wrong_columns',
  'wrong_chart',
  'missing_context',
  'wrong_unit',
  'bad_grouping',
  'missing_dataset_context',
]

export interface PresentationFeedbackLabels {
  /** Resting-state question. */
  prompt: string
  /** Positive verdict button. */
  readable: string
  /** Negative verdict button — opens the detail step. */
  notReadable: string
  /** Heading of the detail step. */
  problemsPrompt: string
  /** Per-problem chip labels. */
  problemTooRaw: string
  problemWrongColumns: string
  problemWrongChart: string
  problemMissingContext: string
  problemWrongUnit: string
  problemBadGrouping: string
  problemMissingDatasetContext: string
  /** Heading of the optional layout picker. */
  preferLayoutPrompt: string
  /** Free-text comment placeholder. */
  commentPlaceholder: string
  /** Submit button of the detail step. */
  submit: string
  /** Acknowledgement shown after submission. */
  ack: string
}

/** English defaults. Override via the `labels` prop for other locales. */
export const DEFAULT_PRESENTATION_FEEDBACK_LABELS: PresentationFeedbackLabels = {
  prompt: 'Is this shown clearly?',
  readable: 'Clear',
  notReadable: 'Not clear',
  problemsPrompt: "What's off?",
  problemTooRaw: 'Too raw',
  problemWrongColumns: 'Wrong columns',
  problemWrongChart: 'Wrong chart',
  problemMissingContext: 'Missing context',
  problemWrongUnit: 'Wrong unit',
  problemBadGrouping: 'Bad grouping',
  problemMissingDatasetContext: 'Missing dataset context',
  preferLayoutPrompt: 'Better shown as',
  commentPlaceholder: 'Anything else? (optional)',
  submit: 'Send feedback',
  ack: 'Thanks — noted.',
}

const PROBLEM_LABEL_KEY: Record<ConnectorRenderProblem, keyof PresentationFeedbackLabels> = {
  too_raw: 'problemTooRaw',
  wrong_columns: 'problemWrongColumns',
  wrong_chart: 'problemWrongChart',
  missing_context: 'problemMissingContext',
  wrong_unit: 'problemWrongUnit',
  bad_grouping: 'problemBadGrouping',
  missing_dataset_context: 'problemMissingDatasetContext',
}

export interface PresentationFeedbackProps {
  /** Connector whose result is being rated. */
  connectorId: string
  /** Tool that produced the result. */
  toolName: string
  /** Stable key tying feedback to a `ConnectorDynamicResultV1.queryHash`. */
  queryHash?: string
  /** What is being rated (e.g. `'primary'`). Passed through to the payload. */
  renderKind?: string
  /** The layout type currently shown (e.g. `'table'`). Passed through. */
  layoutType?: string
  /**
   * Called once on submit with the assembled `ConnectorRenderFeedback`.
   * Persistence + any re-render are the host's responsibility.
   */
  onSubmit: (feedback: ConnectorRenderFeedback) => void | Promise<void>
  /**
   * Layout alternatives offered in the detail step. Omit (or pass an empty
   * array) to hide the layout picker entirely.
   */
  preferredLayoutOptions?: ConnectorPreferredLayout[]
  /** Partial label override (English defaults otherwise). */
  labels?: Partial<PresentationFeedbackLabels>
  /** Extra Tailwind classes on the container. */
  class?: string
}

/**
 * @experimental
 * Presentation-quality feedback widget (readable / not-readable + detail).
 */
export const PresentationFeedback: Component<PresentationFeedbackProps> = (props) => {
  const [step, setStep] = createSignal<'idle' | 'detail' | 'done'>('idle')
  const [problems, setProblems] = createSignal<Set<ConnectorRenderProblem>>(new Set())
  const [preferred, setPreferred] = createSignal<ConnectorPreferredLayout | undefined>(undefined)
  const [comment, setComment] = createSignal('')

  const label = (key: keyof PresentationFeedbackLabels): string =>
    props.labels?.[key] ?? DEFAULT_PRESENTATION_FEEDBACK_LABELS[key]

  const emit = (feedback: ConnectorRenderFeedback) => {
    try {
      // Fire-and-forget — feedback is best-effort, a rejection must not
      // break the UI (mirrors FeedbackInline).
      const result = props.onSubmit(feedback)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch(() => {
          /* non-blocking */
        })
      }
    } catch {
      /* non-blocking */
    }
    setStep('done')
  }

  const base = (): Pick<
    ConnectorRenderFeedback,
    'connectorId' | 'toolName' | 'queryHash' | 'renderKind' | 'layoutType'
  > => ({
    connectorId: props.connectorId,
    toolName: props.toolName,
    ...(props.queryHash ? { queryHash: props.queryHash } : {}),
    ...(props.renderKind ? { renderKind: props.renderKind } : {}),
    ...(props.layoutType ? { layoutType: props.layoutType } : {}),
  })

  const submitReadable = () => emit({ ...base(), verdict: 'readable' })

  const submitNotReadable = () => {
    const picked = [...problems()]
    const text = comment().trim()
    emit({
      ...base(),
      verdict: 'not_readable',
      ...(picked.length > 0 ? { problems: picked } : {}),
      ...(preferred() ? { preferredLayout: preferred() } : {}),
      ...(text ? { comment: text } : {}),
    })
  }

  const toggleProblem = (p: ConnectorRenderProblem) => {
    setProblems((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  return (
    <div
      class={`text-xs ${props.class ?? ''}`.trim()}
      data-presentation-feedback-step={step()}
    >
      {/* ── Step 1 : verdict ─────────────────────────────── */}
      <Show when={step() === 'idle'}>
        <div class="flex items-center gap-2">
          <span class="text-deposium-slate-500">{label('prompt')}</span>
          <button
            type="button"
            onClick={submitReadable}
            class="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-deposium-slate-600 dark:text-gray-300 hover:border-green-500 hover:text-green-600 transition-colors"
            data-presentation-feedback-verdict="readable"
          >
            {label('readable')}
          </button>
          <button
            type="button"
            onClick={() => setStep('detail')}
            class="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-deposium-slate-600 dark:text-gray-300 hover:border-amber-500 hover:text-amber-600 transition-colors"
            data-presentation-feedback-verdict="not_readable"
          >
            {label('notReadable')}
          </button>
        </div>
      </Show>

      {/* ── Step 2 : detail ──────────────────────────────── */}
      <Show when={step() === 'detail'}>
        <div class="flex flex-col gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
          <span class="font-medium text-deposium-slate-600 dark:text-gray-300">
            {label('problemsPrompt')}
          </span>

          {/* Problem chips */}
          <div class="flex flex-wrap gap-1">
            <For each={PROBLEM_ORDER}>
              {(p) => (
                <button
                  type="button"
                  onClick={() => toggleProblem(p)}
                  aria-pressed={problems().has(p)}
                  data-presentation-feedback-problem={p}
                  class={`px-2 py-0.5 rounded-full border transition-colors ${
                    problems().has(p)
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200'
                      : 'border-gray-200 dark:border-gray-600 text-deposium-slate-500 hover:border-amber-400'
                  }`}
                >
                  {label(PROBLEM_LABEL_KEY[p])}
                </button>
              )}
            </For>
          </div>

          {/* Optional layout picker */}
          <Show when={(props.preferredLayoutOptions?.length ?? 0) > 0}>
            <div class="flex flex-wrap items-center gap-1">
              <span class="text-deposium-slate-500">{label('preferLayoutPrompt')}</span>
              <For each={props.preferredLayoutOptions}>
                {(opt) => (
                  <button
                    type="button"
                    onClick={() => setPreferred((cur) => (cur === opt ? undefined : opt))}
                    aria-pressed={preferred() === opt}
                    data-presentation-feedback-layout={opt}
                    class={`px-2 py-0.5 rounded border transition-colors ${
                      preferred() === opt
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                        : 'border-gray-200 dark:border-gray-600 text-deposium-slate-500 hover:border-blue-400'
                    }`}
                  >
                    {opt}
                  </button>
                )}
              </For>
            </div>
          </Show>

          {/* Free-text comment */}
          <textarea
            value={comment()}
            onInput={(e) => setComment(e.currentTarget.value)}
            placeholder={label('commentPlaceholder')}
            rows={2}
            class="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-xs resize-y"
            data-presentation-feedback-comment
          />

          <button
            type="button"
            onClick={submitNotReadable}
            class="self-end px-3 py-1 rounded bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
            data-presentation-feedback-submit
          >
            {label('submit')}
          </button>
        </div>
      </Show>

      {/* ── Step 3 : acknowledgement ─────────────────────── */}
      <Show when={step() === 'done'}>
        <span class="text-deposium-slate-500" data-presentation-feedback-ack>
          {label('ack')}
        </span>
      </Show>
    </div>
  )
}
