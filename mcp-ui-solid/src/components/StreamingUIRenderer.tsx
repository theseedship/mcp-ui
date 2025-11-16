/**
 * StreamingUIRenderer Component - Phase 2
 *
 * Renders streaming dashboard components with skeleton states and progress indicators.
 * Uses the useStreamingUI hook for SSE connection and state management.
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

import { Show, For, createSignal } from 'solid-js'
import { useStreamingUI, type UseStreamingUIOptions } from '../hooks/useStreamingUI'
import type { UIComponent, RendererError } from '../types'
import { validateComponent } from '../services/validation'
import { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'

export interface StreamingUIRendererProps extends UseStreamingUIOptions {
  class?: string
  showProgress?: boolean
  showMetadata?: boolean
  onRenderError?: (error: RendererError) => void
}

/**
 * Component Renderer - Inline lightweight version
 * (Full implementation in UIResourceRenderer)
 */
function StreamingComponentRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
}) {
  // Validate component before rendering
  const validation = validateComponent(props.component)
  if (!validation.valid) {
    props.onError?.({
      type: 'validation',
      message: 'Component validation failed',
      componentId: props.component.id,
      details: validation.errors,
    })

    return (
      <div class="w-full bg-error-subtle border border-border-error rounded-lg p-4">
        <p class="text-sm font-medium text-error-primary">Validation Error</p>
        <p class="text-xs text-text-secondary mt-1">
          {validation.errors?.[0]?.message || 'Unknown validation error'}
        </p>
      </div>
    )
  }

  // Simplified renderer - just show component type and title
  // Full rendering logic in UIResourceRenderer
  const params = props.component.params as any

  return (
    <GenerativeUIErrorBoundary
      componentId={props.component.id}
      componentType={props.component.type}
      onError={props.onError}
      allowRetry={false}
    >
      <div class="w-full bg-surface-secondary border border-border-subtle rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-medium text-text-tertiary uppercase">
            {props.component.type}
          </span>
        </div>
        <Show when={params?.title}>
          <h3 class="text-sm font-semibold text-text-primary">{params.title}</h3>
        </Show>
        <Show when={props.component.type === 'metric' && params?.value}>
          <div class="mt-2">
            <p class="text-2xl font-semibold text-text-primary">{params.value}</p>
            <Show when={params.unit}>
              <span class="text-sm text-text-secondary">{params.unit}</span>
            </Show>
          </div>
        </Show>
        <div class="mt-3 text-xs text-text-tertiary">
          Component ID: {props.component.id.slice(0, 8)}...
        </div>
      </div>
    </GenerativeUIErrorBoundary>
  )
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
        {/* Render received components */}
        <For each={components()}>
          {(component) => (
            <div
              ref={() => handleComponentRender(component.id)}
              class={`
                col-span-${component.position.colSpan}
                ${animatingComponents().has(component.id) ? 'animate-fade-in-up' : ''}
              `}
              style={`grid-column-start: ${component.position.colStart}; grid-column-end: ${component.position.colStart + component.position.colSpan}`}
            >
              <StreamingComponentRenderer component={component} onError={props.onRenderError} />
            </div>
          )}
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
