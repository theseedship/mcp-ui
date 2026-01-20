/**
 * useAction - Hook for executing MCP actions from components
 * Phase 5.0: Quick Wins - Simplified API for ActionRenderer and custom components
 * Sprint 2: Lifecycle callbacks and retry support
 */

import { createSignal, Accessor } from 'solid-js'
import { useMCPActionSafe, ActionRequest, ActionResult } from '../context/MCPActionContext'
import type { ActionLifecycleCallbacks } from '../types'

/**
 * Options for useAction hook
 */
export interface UseActionOptions extends ActionLifecycleCallbacks {
  /**
   * Number of retry attempts on failure
   */
  retryCount?: number

  /**
   * Delay between retries in milliseconds
   */
  retryDelay?: number
}

/**
 * Return type for useAction hook
 */
export interface UseActionReturn {
  /**
   * Execute a tool action
   */
  execute: (toolName: string, params?: Record<string, any>) => Promise<ActionResult>

  /**
   * Full execute with ActionRequest
   */
  executeAction: (request: ActionRequest) => Promise<ActionResult>

  /**
   * Whether an action is currently executing
   */
  isExecuting: Accessor<boolean>

  /**
   * Last result from action execution
   */
  lastResult: Accessor<ActionResult | undefined>

  /**
   * Last error (if any)
   */
  lastError: Accessor<string | undefined>

  /**
   * Retry the last failed action
   */
  retry: () => Promise<ActionResult | undefined>

  /**
   * Clear the last error
   */
  clearError: () => void

  /**
   * Reset all state
   */
  reset: () => void
}

/**
 * Hook for executing MCP actions
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const { execute, isExecuting, lastError } = useAction()
 *
 *   const handleClick = async () => {
 *     const result = await execute('search.hub', { query: 'test' })
 *     if (result.success) {
 *       console.log('Data:', result.data)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleClick} disabled={isExecuting()}>
 *       {isExecuting() ? 'Loading...' : 'Search'}
 *     </button>
 *   )
 * }
 * ```
 *
 * @example With lifecycle callbacks
 * ```tsx
 * function MyActionButton() {
 *   const { execute, retry, clearError, lastError } = useAction({
 *     onBefore: (req) => {
 *       console.log('About to execute:', req.toolName)
 *       return true // proceed
 *     },
 *     onSuccess: (result) => {
 *       toast.success('Action completed!')
 *     },
 *     onError: (error) => {
 *       toast.error(`Action failed: ${error}`)
 *     },
 *     retryCount: 3,
 *     retryDelay: 1000,
 *   })
 *
 *   return (
 *     <div>
 *       <button onClick={() => execute('search.hub', { query: 'test' })}>
 *         Search
 *       </button>
 *       <Show when={lastError()}>
 *         <button onClick={retry}>Retry</button>
 *         <button onClick={clearError}>Dismiss</button>
 *       </Show>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAction(options: UseActionOptions = {}): UseActionReturn {
  const context = useMCPActionSafe()
  const [lastError, setLastError] = createSignal<string>()
  const [lastRequest, setLastRequest] = createSignal<ActionRequest>()
  const [retryAttempt, setRetryAttempt] = createSignal(0)

  const executeWithLifecycle = async (request: ActionRequest): Promise<ActionResult> => {
    setLastError(undefined)
    setLastRequest(request)

    // onBefore callback (can cancel)
    if (options.onBefore) {
      const shouldProceed = await options.onBefore({
        toolName: request.toolName,
        params: request.params,
      })
      if (!shouldProceed) {
        const cancelledResult: ActionResult = {
          success: false,
          error: 'Action cancelled by onBefore callback',
          timestamp: new Date().toISOString(),
          toolName: request.toolName,
        }
        return cancelledResult
      }
    }

    const result = await context.executeAction(request)

    if (result.success) {
      options.onSuccess?.({
        success: result.success,
        data: result.data,
        timestamp: result.timestamp,
        toolName: result.toolName,
      })
    } else {
      setLastError(result.error)
      options.onError?.(result.error || 'Unknown error', {
        toolName: request.toolName,
        params: request.params,
      })
    }

    options.onComplete?.({
      success: result.success,
      data: result.data,
      error: result.error,
      timestamp: result.timestamp,
      toolName: result.toolName,
    })

    return result
  }

  const execute = async (toolName: string, params?: Record<string, any>): Promise<ActionResult> => {
    setRetryAttempt(0)
    return executeWithLifecycle({ toolName, params })
  }

  const executeAction = async (request: ActionRequest): Promise<ActionResult> => {
    setRetryAttempt(0)
    return executeWithLifecycle(request)
  }

  const retry = async (): Promise<ActionResult | undefined> => {
    const request = lastRequest()
    if (!request) return undefined

    const maxRetries = options.retryCount || 3
    const attempt = retryAttempt() + 1

    if (attempt > maxRetries) {
      setLastError(`Max retries (${maxRetries}) exceeded`)
      return undefined
    }

    setRetryAttempt(attempt)

    if (options.retryDelay) {
      await new Promise((r) => setTimeout(r, options.retryDelay))
    }

    return executeWithLifecycle(request)
  }

  const clearError = () => setLastError(undefined)

  const reset = () => {
    setLastError(undefined)
    setLastRequest(undefined)
    setRetryAttempt(0)
  }

  return {
    execute,
    executeAction,
    isExecuting: context.isExecuting,
    lastResult: context.lastResult,
    lastError,
    retry,
    clearError,
    reset,
  }
}

/**
 * Return type for useToolAction hook
 */
export interface UseToolActionReturn {
  execute: (params?: Record<string, any>) => Promise<ActionResult>
  isExecuting: Accessor<boolean>
  lastResult: Accessor<ActionResult | undefined>
  lastError: Accessor<string | undefined>
  retry: () => Promise<ActionResult | undefined>
  clearError: () => void
  reset: () => void
}

/**
 * Hook for binding action to a specific tool
 *
 * @example
 * ```tsx
 * function SearchButton() {
 *   const { execute, isExecuting } = useToolAction('search.hub')
 *
 *   return (
 *     <button onClick={() => execute({ query: 'test' })} disabled={isExecuting()}>
 *       Search
 *     </button>
 *   )
 * }
 * ```
 *
 * @example With lifecycle callbacks
 * ```tsx
 * function SearchButton() {
 *   const { execute, retry, lastError } = useToolAction('search.hub', {
 *     onSuccess: (result) => toast.success('Search complete!'),
 *     onError: (error) => toast.error(`Search failed: ${error}`),
 *     retryCount: 2,
 *   })
 *
 *   return (
 *     <div>
 *       <button onClick={() => execute({ query: 'test' })}>Search</button>
 *       <Show when={lastError()}>
 *         <button onClick={retry}>Retry</button>
 *       </Show>
 *     </div>
 *   )
 * }
 * ```
 */
export function useToolAction(
  toolName: string,
  options: UseActionOptions = {}
): UseToolActionReturn {
  const {
    execute: baseExecute,
    isExecuting,
    lastResult,
    lastError,
    retry,
    clearError,
    reset,
  } = useAction(options)

  const execute = async (params?: Record<string, any>): Promise<ActionResult> => {
    return baseExecute(toolName, params)
  }

  return {
    execute,
    isExecuting,
    lastResult,
    lastError,
    retry,
    clearError,
    reset,
  }
}

export type { ActionRequest, ActionResult }
