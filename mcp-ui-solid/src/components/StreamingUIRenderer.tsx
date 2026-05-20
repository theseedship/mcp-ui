/**
 * StreamingUIRenderer Component
 *
 * Renders streaming dashboard components with skeleton states and progress
 * indicators. Uses the `useStreamingUI` hook for SSE connection and state.
 *
 * ## Rendering parity (v6.6.0 — closes Gap 1 of ROADMAP-opendata-macro-mcpui)
 *
 * Each component received over SSE is delegated to the real
 * `<UIResourceRenderer>`. Streamed `table` / `chart` / `map` / `action-group`
 * therefore render with the SAME fidelity as a static layout — no more
 * simplified "type + title" placeholder. Validation, telemetry, the error
 * boundary and `errorMode` all come from `<UIResourceRenderer>`, so the two
 * paths cannot drift.
 *
 * Delegation is a one-way value import (`UIResourceRenderer` never imports
 * this file — no cycle). The streamed component's `position` is normalized
 * to full-width before delegation : this component owns the 12-column grid,
 * `<UIResourceRenderer>` only owns the component's own rendering.
 *
 * Features:
 * - Skeleton loading states while components stream
 * - Progress bar and status messages
 * - Smooth component animations on arrival
 * - Error handling with retry capability
 * - Responsive 12-column grid layout
 *
 * Usage:
 * ```tsx
 * <StreamingUIRenderer
 *   query="Show me revenue trends"
 *   spaceIds={['uuid1', 'uuid2']}
 *   onComplete={(metadata) => console.log('Done!', metadata)}
 * />
 * ```
 */

import { Show, For, createSignal, onMount } from 'solid-js'
import { useStreamingUI, type UseStreamingUIOptions } from '../hooks/useStreamingUI'
import type { UIComponent, RendererError } from '../types'
import { UIResourceRenderer, type ValidationErrorMode } from './UIResourceRenderer'

export interface StreamingUIRendererProps extends UseStreamingUIOptions {
  class?: string
  showProgress?: boolean
  showMetadata?: boolean
  onRenderError?: (error: RendererError) => void
  /**
   * How to react when a streamed component fails `validateComponent()`
   * (v5.4.0). Defaults to `'block'` (full red error card — pre-v5.4.0
   * behavior). Forwarded to the delegated `<UIResourceRenderer>`.
   */
  errorMode?: ValidationErrorMode
  /**
   * Visibility behavior of the inline expand button on streamed components
   * wrapped in `<ExpandableWrapper>` (v6.6.0 — parity with the static
   * `<UIResourceRenderer toolbarVariant>` prop). Forwarded as-is.
   */
  toolbarVariant?: 'hover' | 'always-visible'
}

/**
 * The 12-column placement of a streamed component is owned by this
 * component's outer grid (the cell `<div>` below). Delegating the component
 * verbatim to `<UIResourceRenderer>` would re-apply that placement inside a
 * fresh nested 12-column grid and visually misplace it. We hand
 * `<UIResourceRenderer>` a full-width copy so it only renders the component,
 * not a competing layout.
 */
function asFullWidth(component: UIComponent): UIComponent {
  return { ...component, position: { colStart: 1, colSpan: 12 } }
}

export function StreamingUIRenderer(props: StreamingUIRendererProps) {
  const { components, isLoading, isStreaming, error, progress, metadata, startStreaming } =
    useStreamingUI({
      query: props.query,
      spaceIds: props.spaceIds,
      sessionId: props.sessionId,
      options: props.options,
      onComplete: props.onComplete,
      onError: props.onError,
      onComponentReceived: props.onComponentReceived,
    })

  const [animatingComponents, setAnimatingComponents] = createSignal<Set<string>>(new Set())

  // Track new components for animation
  const handleComponentRender = (componentId: string) => {
    setAnimatingComponents((prev) => new Set([...prev, componentId]))

    // Remove from animating set after animation completes
    setTimeout(() => {
      setAnimatingComponents((prev) => {
        const next = new Set(prev)
        next.delete(componentId)
        return next
      })
    }, 500)
  }

  return (
    <div class={`streaming-ui-renderer ${props.class || ''}`}>
      {/* Progress Bar */}
      <Show when={props.showProgress !== false && (isLoading() || isStreaming())}>
        <div class="mb-4 rounded-lg border border-border-subtle bg-surface-secondary p-4">
          {/* Status Message */}
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-text-primary">{progress().message}</span>
            <Show when={progress().totalCount !== null}>
              <span class="text-sm text-text-secondary">
                {progress().receivedCount} / {progress().totalCount}
              </span>
            </Show>
          </div>

          {/* Progress Bar */}
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
            <div
              class="h-full bg-brand-primary transition-all duration-300 ease-out"
              style={
                progress().totalCount !== null
                  ? `width: ${(progress().receivedCount / progress().totalCount!) * 100}%`
                  : 'width: 0%'
              }
            />
          </div>

          {/* Indeterminate Progress (when totalCount unknown) */}
          <Show when={progress().totalCount === null && isStreaming()}>
            <div class="mt-2">
              <div class="h-1 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div class="animate-progress-indeterminate h-full w-1/3 bg-brand-primary" />
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Error State */}
      <Show when={error()}>
        <div class="mb-4 rounded-lg border border-border-error bg-error-subtle p-4">
          <div class="mb-2 flex items-center gap-2">
            <svg
              class="h-5 w-5 text-error-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="font-medium text-error-primary">{error()?.error}</span>
          </div>
          <p class="text-sm text-text-secondary">{error()?.message}</p>

          {/* Retry Button (if recoverable) */}
          <Show when={error()?.recoverable}>
            <button
              type="button"
              class="mt-3 rounded-md bg-error-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-error-hover"
              onClick={() => startStreaming()}
            >
              Retry
            </button>
          </Show>
        </div>
      </Show>

      {/* Components Grid */}
      <div class="grid grid-cols-12 gap-4">
        {/* Render received components — delegated to the real UIResourceRenderer */}
        <For each={components()}>
          {(component) => {
            // Trigger animation on mount (SSR-safe, no 'use' directive needed)
            onMount(() => handleComponentRender(component.id))

            return (
              <div
                class={`
                  col-span-${component.position.colSpan}
                  ${animatingComponents().has(component.id) ? 'animate-fade-in-up' : ''}
                `}
                style={`grid-column-start: ${component.position.colStart}; grid-column-end: ${component.position.colStart + component.position.colSpan}`}
              >
                <UIResourceRenderer
                  content={asFullWidth(component)}
                  errorMode={props.errorMode}
                  onError={props.onRenderError}
                  toolbarVariant={props.toolbarVariant}
                />
              </div>
            )
          }}
        </For>

        {/* Skeleton placeholders (if streaming and expecting more) */}
        <Show when={isStreaming() && progress().totalCount !== null}>
          <For
            each={Array.from({
              length: progress().totalCount! - progress().receivedCount,
            })}
          >
            {() => <SkeletonComponent />}
          </For>
        </Show>
      </div>

      {/* Metadata Display */}
      <Show when={props.showMetadata !== false && metadata()}>
        <div class="mt-6 rounded-lg border border-border-subtle bg-surface-secondary p-4 text-sm text-text-secondary">
          <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div class="font-medium text-text-primary">Provider</div>
              <div>{metadata()?.provider}</div>
            </div>
            <div>
              <div class="font-medium text-text-primary">Model</div>
              <div>{metadata()?.model}</div>
            </div>
            <div>
              <div class="font-medium text-text-primary">Execution Time</div>
              <div>{metadata()?.executionTimeMs}ms</div>
            </div>
            <Show when={metadata()?.costUSD !== undefined}>
              <div>
                <div class="font-medium text-text-primary">Cost</div>
                <div>${metadata()?.costUSD?.toFixed(4)}</div>
              </div>
            </Show>
            <div>
              <div class="font-medium text-text-primary">TTFB</div>
              <div>{metadata()?.firstTokenMs}ms</div>
            </div>
            <Show when={metadata()?.cached}>
              <div>
                <div class="font-medium text-text-primary">Cached</div>
                <div class="text-success-primary">Yes</div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}

/**
 * Skeleton Component - Placeholder while components load
 */
function SkeletonComponent() {
  return (
    <div class="col-span-12 md:col-span-6 lg:col-span-4">
      <div class="animate-pulse rounded-lg border border-border-subtle bg-surface-secondary p-4">
        {/* Header skeleton */}
        <div class="mb-4 h-6 w-1/2 rounded bg-surface-tertiary" />

        {/* Content skeleton */}
        <div class="space-y-3">
          <div class="h-4 rounded bg-surface-tertiary" />
          <div class="h-4 w-5/6 rounded bg-surface-tertiary" />
          <div class="h-4 w-4/6 rounded bg-surface-tertiary" />
        </div>

        {/* Chart/visual skeleton */}
        <div class="mt-4 h-32 rounded bg-surface-tertiary" />
      </div>
    </div>
  )
}

// CSS Animations (add to global styles or Tailwind config)
/*
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.5s ease-out;
}

.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s infinite ease-in-out;
}
*/
