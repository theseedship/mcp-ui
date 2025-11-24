/**
 * Generative UI Error Boundary with Telemetry
 * Phase 0: Error isolation + structured logging
 *
 * Features:
 * - Component-level error isolation
 * - Structured logging with context
 * - Performance timing
 * - Retry mechanism
 * - User-friendly fallback UI
 */

import { Component, ErrorBoundary, createSignal, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { createLogger } from '../utils/logger'
import type { RendererError } from '../types'

const logger = createLogger('generative-ui')

/**
 * Props for GenerativeUIErrorBoundary
 */
export interface GenerativeUIErrorBoundaryProps {
  /**
   * Component identifier for telemetry
   */
  componentId: string

  /**
   * Component type for context
   */
  componentType: string

  /**
   * Error callback
   */
  onError?: (error: RendererError) => void

  /**
   * Allow retry on error
   */
  allowRetry?: boolean

  /**
   * Child components to wrap
   */
  children: any

  /**
   * Custom fallback UI (optional)
   */
  fallback?: (error: Error, retry?: () => void) => any
}

/**
 * Default fallback UI for errors
 */
function DefaultErrorFallback(props: {
  error: Error
  componentId: string
  componentType: string
  allowRetry?: boolean
  onRetry?: () => void
}) {
  return (
    <div class="w-full h-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <svg
            class="w-5 h-5 text-yellow-600 dark:text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            Component Failed to Render
          </p>
          <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Type: {props.componentType || 'unknown'} | ID: {props.componentId?.slice(0, 8) || 'unknown'}...
          </p>
          <Show when={import.meta.env.DEV}>
            <p class="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-mono">
              {props.error.message}
            </p>
          </Show>
          <Show when={props.allowRetry}>
            <button
              onClick={props.onRetry}
              class="mt-3 text-xs font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
            >
              Retry Rendering
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}

/**
 * Generative UI Error Boundary Component
 */
export const GenerativeUIErrorBoundary: Component<GenerativeUIErrorBoundaryProps> = (props) => {
  const [retryKey, setRetryKey] = createSignal(0)
  // SSR-safe: Initialize performance timing
  let initialRenderTime = 0
  if (!isServer && typeof performance !== 'undefined') {
    initialRenderTime = performance.now()
  }
  const [renderStartTime] = createSignal(initialRenderTime)

  // Handle error with telemetry
  const handleError = (error: Error) => {
    // SSR-safe: Calculate render duration
    let renderEndTime = 0
    if (!isServer && typeof performance !== 'undefined') {
      renderEndTime = performance.now()
    }
    const renderDuration = renderEndTime - renderStartTime()

    // SSR-safe: Get client-only context
    let userAgent = 'server'
    let viewport = { width: 0, height: 0 }

    if (!isServer && typeof window !== 'undefined') {
      userAgent = navigator.userAgent
      viewport = { width: window.innerWidth, height: window.innerHeight }
    }

    // Structure error context
    const errorContext = {
      componentId: props.componentId,
      componentType: props.componentType,
      errorMessage: error.message,
      errorStack: error.stack,
      renderDuration,
      retryCount: retryKey(),
      timestamp: new Date().toISOString(),
      userAgent,
      viewport,
    }

    // Log to structured logger
    logger.error(`Component render failed: ${props.componentType}`, errorContext)

    // Call error callback
    props.onError?.({
      type: 'render',
      message: error.message,
      componentId: props.componentId,
      details: errorContext,
    })

    // In production, send to monitoring service
    if (import.meta.env.PROD) {
      // Future: Send to Sentry or other APM
      // Sentry.captureException(error, { contexts: { component: errorContext } })
    }
  }

  // Retry mechanism
  const handleRetry = () => {
    const newRetryCount = retryKey() + 1
    logger.info(`Retrying component render: ${props.componentType}`, {
      componentId: props.componentId,
      retryCount: newRetryCount,
    })
    setRetryKey(newRetryCount)
  }

  return (
    <ErrorBoundary
      fallback={(error) => {
        handleError(error)

        // Use custom fallback if provided
        if (props.fallback) {
          return props.fallback(error, props.allowRetry ? handleRetry : undefined)
        }

        // Default fallback
        return (
          <DefaultErrorFallback
            error={error}
            componentId={props.componentId}
            componentType={props.componentType}
            allowRetry={props.allowRetry}
            onRetry={handleRetry}
          />
        )
      }}
    >
      {/* Key prop for forcing remount on retry */}
      {(() => {
        const _ = retryKey() // Access signal to track changes
        return <>{props.children}</>
      })()}
    </ErrorBoundary>
  )
}

/**
 * Performance monitoring wrapper
 * Logs render times for performance analysis
 */
export function withPerformanceMonitoring<P extends { componentId: string; componentType: string }>(
  WrappedComponent: Component<P>
) {
  return (props: P) => {
    // SSR-safe: Performance timing
    let renderStart = 0
    if (!isServer && typeof performance !== 'undefined') {
      renderStart = performance.now()
    }

    // Log render start
    logger.debug(`Component render start: ${props.componentType}`, {
      componentId: props.componentId,
      timestamp: new Date().toISOString(),
    })

    // Measure on mount completion (client-side only)
    if (!isServer && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const renderEnd = performance.now()
        const duration = renderEnd - renderStart

        logger.info(`Component rendered: ${props.componentType}`, {
          componentId: props.componentId,
          renderDuration: duration,
          timestamp: new Date().toISOString(),
        })

        // Warn if render is slow (>50ms target)
        if (duration > 50) {
          logger.warn(`Slow component render: ${props.componentType}`, {
            componentId: props.componentId,
            renderDuration: duration,
            threshold: 50,
          })
        }
      })
    }

    return <WrappedComponent {...props} />
  }
}

/**
 * Hook to track component lifecycle events
 */
export function useComponentTelemetry(componentId: string, componentType: string) {
  // SSR-safe: Performance timing
  let mountTime = 0
  if (!isServer && typeof performance !== 'undefined') {
    mountTime = performance.now()
  }

  // Log mount
  logger.debug(`Component mounted: ${componentType}`, {
    componentId,
    timestamp: new Date().toISOString(),
  })

  // Return cleanup function for unmount
  return () => {
    let lifetime = 0
    if (!isServer && typeof performance !== 'undefined') {
      lifetime = performance.now() - mountTime
    }
    logger.debug(`Component unmounted: ${componentType}`, {
      componentId,
      lifetime,
      timestamp: new Date().toISOString(),
    })
  }
}
