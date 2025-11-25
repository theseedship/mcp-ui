/**
 * useAction - Hook for executing MCP actions from components
 * Phase 5.0: Quick Wins - Simplified API for ActionRenderer and custom components
 */

import { createSignal, Accessor } from 'solid-js'
import { useMCPActionSafe, ActionRequest, ActionResult } from '../context/MCPActionContext'

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
 */
export function useAction(): UseActionReturn {
  const context = useMCPActionSafe()
  const [lastError, setLastError] = createSignal<string>()

  const execute = async (toolName: string, params?: Record<string, any>): Promise<ActionResult> => {
    setLastError(undefined)

    const result = await context.executeAction({
      toolName,
      params,
    })

    if (!result.success && result.error) {
      setLastError(result.error)
    }

    return result
  }

  const executeAction = async (request: ActionRequest): Promise<ActionResult> => {
    setLastError(undefined)

    const result = await context.executeAction(request)

    if (!result.success && result.error) {
      setLastError(result.error)
    }

    return result
  }

  return {
    execute,
    executeAction,
    isExecuting: context.isExecuting,
    lastResult: context.lastResult,
    lastError,
  }
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
 */
export function useToolAction(toolName: string): {
  execute: (params?: Record<string, any>) => Promise<ActionResult>
  isExecuting: Accessor<boolean>
  lastResult: Accessor<ActionResult | undefined>
  lastError: Accessor<string | undefined>
} {
  const { execute: baseExecute, isExecuting, lastResult, lastError } = useAction()

  const execute = async (params?: Record<string, any>): Promise<ActionResult> => {
    return baseExecute(toolName, params)
  }

  return {
    execute,
    isExecuting,
    lastResult,
    lastError,
  }
}

export type { ActionRequest, ActionResult }
