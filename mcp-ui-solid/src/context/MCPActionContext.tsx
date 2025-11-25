/**
 * MCPActionContext - Context provider for MCP action execution
 * Phase 5.0: Quick Wins - Replaces CustomEvent with typed context for Mastra integration
 */

import { createContext, createSignal, useContext, ParentComponent, Accessor } from 'solid-js'

/**
 * Action request payload
 */
export interface ActionRequest {
  /**
   * MCP tool name to execute
   */
  toolName: string

  /**
   * Tool parameters
   */
  params?: Record<string, any>

  /**
   * Optional space IDs for multi-space context
   */
  spaceIds?: string[]

  /**
   * Optional macro ID for template execution
   */
  macroId?: string
}

/**
 * Action result from execution
 */
export interface ActionResult {
  /**
   * Whether the action was successful
   */
  success: boolean

  /**
   * Result data (if successful)
   */
  data?: any

  /**
   * Error message (if failed)
   */
  error?: string

  /**
   * Execution timestamp
   */
  timestamp: string

  /**
   * Tool that was executed
   */
  toolName: string
}

/**
 * Context value interface
 */
export interface MCPActionContextValue {
  /**
   * Execute an MCP action
   */
  executeAction: (request: ActionRequest) => Promise<ActionResult>

  /**
   * Currently available tools (from MCP server)
   */
  availableTools: Accessor<string[]>

  /**
   * Space IDs in current context
   */
  spaceIds: Accessor<string[]>

  /**
   * Current macro ID (if executing within a template)
   */
  macroId: Accessor<string | undefined>

  /**
   * Whether an action is currently executing
   */
  isExecuting: Accessor<boolean>

  /**
   * Last action result
   */
  lastResult: Accessor<ActionResult | undefined>
}

/**
 * Props for MCPActionProvider
 */
export interface MCPActionProviderProps {
  /**
   * Space IDs for multi-space queries
   */
  spaceIds?: string[]

  /**
   * Macro ID when executing within a template
   */
  macroId?: string

  /**
   * Available MCP tools
   */
  availableTools?: string[]

  /**
   * Callback for action execution (for audit logging)
   */
  onAction?: (request: ActionRequest, result: ActionResult) => void

  /**
   * Callback for webhook events (n8n, Zapier integration)
   */
  onWebhook?: (event: { type: string; payload: any }) => void

  /**
   * Custom action executor (override default)
   */
  executor?: (request: ActionRequest) => Promise<ActionResult>
}

// Create the context with undefined default
const MCPActionContext = createContext<MCPActionContextValue>()

/**
 * Default action executor using CustomEvent fallback
 * This maintains backward compatibility while allowing Context-based usage
 */
const defaultExecutor = async (request: ActionRequest): Promise<ActionResult> => {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString()

    // Dispatch CustomEvent for backward compatibility with existing listeners
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('mcp-action', {
        detail: {
          toolName: request.toolName,
          params: request.params || {},
          spaceIds: request.spaceIds,
          macroId: request.macroId,
        },
        bubbles: true,
      })

      // Listen for response event
      const responseHandler = (e: Event) => {
        const customEvent = e as CustomEvent
        window.removeEventListener('mcp-action-response', responseHandler)
        resolve({
          success: customEvent.detail?.success ?? true,
          data: customEvent.detail?.data,
          error: customEvent.detail?.error,
          timestamp,
          toolName: request.toolName,
        })
      }

      window.addEventListener('mcp-action-response', responseHandler)
      window.dispatchEvent(event)

      // Timeout fallback - resolve as success if no response in 100ms
      // (indicates no listener, action was dispatched)
      setTimeout(() => {
        window.removeEventListener('mcp-action-response', responseHandler)
        resolve({
          success: true,
          data: { dispatched: true },
          timestamp,
          toolName: request.toolName,
        })
      }, 100)
    } else {
      // Server-side: return immediately
      resolve({
        success: false,
        error: 'Actions not available server-side',
        timestamp,
        toolName: request.toolName,
      })
    }
  })
}

/**
 * MCPActionProvider - Provides action execution context to child components
 *
 * @example
 * ```tsx
 * <MCPActionProvider
 *   spaceIds={['space-123']}
 *   macroId="sales_overview"
 *   onAction={(req, res) => audit(req, res)}
 * >
 *   <UIResourceRenderer layout={layout} />
 * </MCPActionProvider>
 * ```
 */
export const MCPActionProvider: ParentComponent<MCPActionProviderProps> = (props) => {
  const [isExecuting, setIsExecuting] = createSignal(false)
  const [lastResult, setLastResult] = createSignal<ActionResult>()
  const [spaceIds, setSpaceIds] = createSignal<string[]>(props.spaceIds || [])
  const [macroId, setMacroId] = createSignal<string | undefined>(props.macroId)
  const [availableTools, setAvailableTools] = createSignal<string[]>(props.availableTools || [])

  // Update signals when props change
  // Note: This is a simple approach; for more complex scenarios, consider createEffect

  const executeAction = async (request: ActionRequest): Promise<ActionResult> => {
    setIsExecuting(true)

    try {
      // Enrich request with context
      const enrichedRequest: ActionRequest = {
        ...request,
        spaceIds: request.spaceIds || spaceIds(),
        macroId: request.macroId || macroId(),
      }

      // Execute using custom executor or default
      const executor = props.executor || defaultExecutor
      const result = await executor(enrichedRequest)

      setLastResult(result)

      // Call audit callback if provided
      props.onAction?.(enrichedRequest, result)

      // Trigger webhook if provided and action was successful
      if (result.success && props.onWebhook) {
        props.onWebhook({
          type: 'action-completed',
          payload: {
            request: enrichedRequest,
            result,
          },
        })
      }

      return result
    } catch (error) {
      const errorResult: ActionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        toolName: request.toolName,
      }

      setLastResult(errorResult)
      props.onAction?.(request, errorResult)

      return errorResult
    } finally {
      setIsExecuting(false)
    }
  }

  const contextValue: MCPActionContextValue = {
    executeAction,
    availableTools,
    spaceIds,
    macroId,
    isExecuting,
    lastResult,
  }

  return (
    <MCPActionContext.Provider value={contextValue}>
      {props.children}
    </MCPActionContext.Provider>
  )
}

/**
 * Hook to access MCP action context
 * Throws if used outside of MCPActionProvider
 *
 * @example
 * ```tsx
 * const { executeAction, isExecuting } = useMCPAction()
 *
 * const handleClick = async () => {
 *   const result = await executeAction({
 *     toolName: 'search.hub',
 *     params: { query: 'revenue Q4' },
 *   })
 * }
 * ```
 */
export function useMCPAction(): MCPActionContextValue {
  const context = useContext(MCPActionContext)
  if (!context) {
    throw new Error('useMCPAction must be used within an MCPActionProvider')
  }
  return context
}

/**
 * Hook to access MCP action context with fallback for components
 * outside of provider (uses CustomEvent fallback)
 *
 * @example
 * ```tsx
 * const { executeAction, isExecuting } = useMCPActionSafe()
 * // Works even without MCPActionProvider
 * ```
 */
export function useMCPActionSafe(): MCPActionContextValue {
  const context = useContext(MCPActionContext)

  if (context) {
    return context
  }

  // Fallback implementation for components outside provider
  const [isExecuting, setIsExecuting] = createSignal(false)
  const [lastResult, setLastResult] = createSignal<ActionResult>()

  const executeAction = async (request: ActionRequest): Promise<ActionResult> => {
    setIsExecuting(true)
    try {
      const result = await defaultExecutor(request)
      setLastResult(result)
      return result
    } finally {
      setIsExecuting(false)
    }
  }

  return {
    executeAction,
    availableTools: () => [],
    spaceIds: () => [],
    macroId: () => undefined,
    isExecuting,
    lastResult,
  }
}

export { MCPActionContext }
