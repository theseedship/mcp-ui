/**
 * useStreamingUI Hook - Phase 2
 *
 * Client-side hook for consuming the streaming generative UI endpoint.
 * Handles SSE connection, component buffering, reordering, and error handling.
 *
 * Features:
 * - SSE connection with automatic reconnection
 * - Component buffering and reordering by sequenceId
 * - Progress tracking and loading states
 * - Error handling with recovery attempts
 * - Cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const { components, isLoading, error, progress } = useStreamingUI({
 *   query: 'Show me revenue trends',
 *   spaceIds: ['uuid1', 'uuid2'],
 *   onComplete: (metadata) => console.log('Done!', metadata),
 * })
 * ```
 */

import { createSignal, onCleanup } from 'solid-js'
import type { UIComponent } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('useStreamingUI')

// SSR detection without importing solid-js/web (which might cause bundler issues)
const isServer = typeof window === 'undefined'

// ============================================================================
// Types
// ============================================================================

export interface UseStreamingUIOptions {
  query: string
  spaceIds?: string[]
  sessionId?: string
  options?: {
    useCache?: boolean
    useLLM?: boolean
    maxComponents?: number
    preferredComponents?: Array<'chart' | 'table' | 'metric' | 'text'>
  }
  onComplete?: (metadata: CompleteMetadata) => void
  onError?: (error: StreamError) => void
  onComponentReceived?: (component: UIComponent) => void
}

export interface StreamingUIState {
  components: UIComponent[]
  isLoading: boolean
  isStreaming: boolean
  error: StreamError | null
  progress: StreamProgress
  metadata: CompleteMetadata | null
}

export interface StreamProgress {
  receivedCount: number
  totalCount: number | null
  message: string
  timestamp: string
}

export interface CompleteMetadata {
  layoutId: string
  componentsCount: number
  executionTimeMs: number
  firstTokenMs: number
  provider: 'groq' | 'mock'
  model: string
  tokensUsed?: number
  costUSD?: number
  cached: boolean
}

export interface StreamError {
  error: string
  message: string
  componentId?: string
  recoverable: boolean
}

interface ComponentBuffer {
  [sequenceId: number]: {
    component: UIComponent
    position: { colStart: number; colSpan: number; rowStart?: number; rowSpan?: number }
  }
}

// ============================================================================
// SSE Event Types (must match server)
// ============================================================================

type SSEEventType = 'status' | 'component-start' | 'component' | 'complete' | 'error'

interface StatusEvent {
  message: string
  timestamp: string
  totalComponents?: number
}

interface ComponentStartEvent {
  componentId: string
  type: 'chart' | 'table' | 'metric' | 'text'
  sequenceId: number
  position: { colStart: number; colSpan: number }
}

interface ComponentEvent {
  componentId: string
  sequenceId: number
  component: UIComponent
  position: { colStart: number; colSpan: number; rowStart?: number; rowSpan?: number }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStreamingUI(options: UseStreamingUIOptions) {
  // State
  const [components, setComponents] = createSignal<UIComponent[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [error, setError] = createSignal<StreamError | null>(null)
  const [progress, setProgress] = createSignal<StreamProgress>({
    receivedCount: 0,
    totalCount: null,
    message: 'Initializing...',
    timestamp: new Date().toISOString(),
  })
  const [metadata, setMetadata] = createSignal<CompleteMetadata | null>(null)

  // Component buffer for reordering
  let componentBuffer: ComponentBuffer = {}
  let nextSequenceId = 0
  let eventSource: EventSource | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 3

  /**
   * Flush components from buffer in sequence order
   */
  const flushBuffer = () => {
    const flushed: UIComponent[] = []

    while (componentBuffer[nextSequenceId]) {
      const { component } = componentBuffer[nextSequenceId]
      flushed.push(component)
      delete componentBuffer[nextSequenceId]
      nextSequenceId++
    }

    if (flushed.length > 0) {
      setComponents((prev) => [...prev, ...flushed])

      setProgress((prev) => ({
        ...prev,
        receivedCount: prev.receivedCount + flushed.length,
      }))

      logger.debug('Flushed components from buffer', {
        count: flushed.length,
        nextSequenceId,
      })
    }
  }

  /**
   * Handle SSE status event
   */
  const handleStatusEvent = (data: StatusEvent) => {
    logger.debug('Status event received', data as unknown as Record<string, unknown>)

    setProgress({
      receivedCount: progress().receivedCount,
      totalCount: data.totalComponents ?? progress().totalCount,
      message: data.message,
      timestamp: data.timestamp,
    })
  }

  /**
   * Handle SSE component-start event
   */
  const handleComponentStartEvent = (data: ComponentStartEvent) => {
    logger.debug('Component-start event received', data as unknown as Record<string, unknown>)

    setProgress((prev) => ({
      ...prev,
      message: `Loading ${data.type} component...`,
      timestamp: new Date().toISOString(),
    }))
  }

  /**
   * Handle SSE component event
   */
  const handleComponentEvent = (data: ComponentEvent) => {
    logger.debug('Component event received', {
      componentId: data.componentId,
      sequenceId: data.sequenceId,
    })

    // Add to buffer
    componentBuffer[data.sequenceId] = {
      component: data.component,
      position: data.position,
    }

    // Flush buffer in sequence
    flushBuffer()

    // Notify callback
    if (options.onComponentReceived) {
      options.onComponentReceived(data.component)
    }
  }

  /**
   * Handle SSE complete event
   */
  const handleCompleteEvent = (data: CompleteMetadata) => {
    logger.info('Stream completed', data as unknown as Record<string, unknown>)

    setIsStreaming(false)
    setIsLoading(false)
    setMetadata(data)

    // Flush any remaining buffered components
    flushBuffer()

    setProgress((prev) => ({
      ...prev,
      message: 'Dashboard loaded',
      timestamp: new Date().toISOString(),
    }))

    // Notify callback
    if (options.onComplete) {
      options.onComplete(data)
    }
  }

  /**
   * Handle SSE error event
   */
  const handleErrorEvent = (data: StreamError) => {
    logger.error('Stream error received', data as unknown as Record<string, unknown>)

    setError(data)
    setIsStreaming(false)
    setIsLoading(false)

    setProgress((prev) => ({
      ...prev,
      message: `Error: ${data.message}`,
      timestamp: new Date().toISOString(),
    }))

    // Notify callback
    if (options.onError) {
      options.onError(data)
    }

    // Try to reconnect if recoverable
    if (data.recoverable && reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      logger.warn('Attempting to reconnect', { attempt: reconnectAttempts })
      setTimeout(() => startStreaming(), 1000 * reconnectAttempts)
    }
  }

  /**
   * Parse SSE event
   */
  const parseSSEEvent = (event: MessageEvent, eventType: SSEEventType) => {
    try {
      const data = JSON.parse(event.data)

      switch (eventType) {
        case 'status':
          handleStatusEvent(data as StatusEvent)
          break
        case 'component-start':
          handleComponentStartEvent(data as ComponentStartEvent)
          break
        case 'component':
          handleComponentEvent(data as ComponentEvent)
          break
        case 'complete':
          handleCompleteEvent(data as CompleteMetadata)
          break
        case 'error':
          handleErrorEvent(data as StreamError)
          break
        default:
          logger.warn('Unknown SSE event type', { eventType })
      }
    } catch (error) {
      logger.error('Failed to parse SSE event', {
        error: error instanceof Error ? error.message : String(error),
        eventType,
      })
    }
  }

  /**
   * Start SSE streaming
   */
  const startStreaming = () => {
    // SSR Guard: Prevent execution on server-side (Node.js environment)
    // fetch() and ReadableStream APIs are only available in browsers
    if (isServer) {
      logger.warn('startStreaming called on server-side - skipping')
      setError({
        error: 'ssr',
        message: 'Streaming UI cannot start on server-side',
        recoverable: false,
      })
      setIsLoading(false)
      return
    }

    // Reset state
    setComponents([])
    setError(null)
    setIsLoading(true)
    setIsStreaming(true)
    componentBuffer = {}
    nextSequenceId = 0

    setProgress({
      receivedCount: 0,
      totalCount: null,
      message: 'Connecting to server...',
      timestamp: new Date().toISOString(),
    })

    logger.info('Starting SSE stream', {
      query: options.query,
      spaceIds: options.spaceIds,
    })

    // Build request body
    const requestBody = {
      query: options.query,
      spaceIds: options.spaceIds,
      sessionId: options.sessionId,
      options: options.options,
    }

    // Create EventSource (SSE connection)
    // Note: EventSource doesn't support POST, so we need to use fetch + ReadableStream
    fetch('/api/mcp/generative-ui-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Stream request failed')
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        let buffer = ''

        // Read stream
        const readChunk = async (): Promise<void> => {
          const { done, value } = await reader.read()

          if (done) {
            logger.info('Stream ended')
            return
          }

          buffer += decoder.decode(value, { stream: true })

          // Process SSE messages
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          let currentEvent: SSEEventType | null = null

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7) as SSEEventType
            } else if (line.startsWith('data: ') && currentEvent) {
              const data = line.slice(6)
              parseSSEEvent({ data } as MessageEvent, currentEvent)
              currentEvent = null
            }
          }

          // Continue reading
          return readChunk()
        }

        await readChunk()
      })
      .catch((err) => {
        logger.error('Stream fetch failed', {
          error: err instanceof Error ? err.message : String(err),
        })

        handleErrorEvent({
          error: 'Stream connection failed',
          message: err instanceof Error ? err.message : 'Unknown error',
          recoverable: true,
        })
      })
  }

  /**
   * Stop streaming
   */
  const stopStreaming = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    setIsStreaming(false)
    setIsLoading(false)

    logger.info('Streaming stopped')
  }

  /**
   * Cleanup on unmount
   */
  onCleanup(() => {
    stopStreaming()
  })

  // Auto-start streaming
  startStreaming()

  // Return state accessors and controls
  return {
    components,
    isLoading,
    isStreaming,
    error,
    progress,
    metadata,
    startStreaming,
    stopStreaming,
  }
}
