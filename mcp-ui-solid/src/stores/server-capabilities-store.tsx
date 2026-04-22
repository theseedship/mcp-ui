/**
 * Server Capabilities Store — reactive snapshot of the MCP `initialize`
 * response echoed by the server.
 *
 * @experimental
 * @since v5.3.0
 *
 * mcp-ui doesn't speak MCP protocol directly — the consumer's transport
 * layer (stdio child process, HTTP/SSE client, ...) parses the
 * `initialize` JSON-RPC response and pushes the relevant fields into this
 * store via `setServerCapabilities(info)`. Components then read
 * reactively via `useServerCapabilities()` to gate behavior :
 *
 * ```tsx
 * const { capabilities } = useServerCapabilities()
 * <Show when={capabilities()?.tools?.listChanged}>
 *   <ToolListSubscriber />
 * </Show>
 * ```
 *
 * ## Two consumption modes (mirrors `scratchpad-store`)
 *
 * 1. **Singleton mode (default)** — `setServerCapabilities(info)` mutates
 *    the module-level singleton. `useServerCapabilities()` reads from it.
 *    Use for single-MCP-server consumers (the common case).
 *
 * 2. **Multi-instance mode** — wrap a subtree in
 *    `<ServerCapabilitiesProvider>` to scope a separate handle. Pass
 *    `store={createServerCapabilitiesStore()}` explicitly when you need to
 *    drive it from a non-reactive scope (e.g. a transport adapter living
 *    at the app root).
 *
 * ## Note on `elicitation`
 *
 * Per MCP spec 2025-06-18, `elicitation` is a **CLIENT** capability, not
 * a server one. Servers do not declare it. If you need to gate
 * `<ElicitationForm>` rendering on whether the connected client *itself*
 * supports elicitation — that's a separate concern (your own state, set
 * by your transport layer based on its own configuration).
 */

import { createContext, useContext, type ParentComponent, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'

// ─── Types ────────────────────────────────────────────────────

/**
 * Server capabilities object as advertised in the MCP `initialize` response.
 * Mirrors the spec 2025-06-18 `ServerCapabilities` shape with permissive
 * `experimental` for forward compatibility.
 */
export interface ServerCapabilities {
  experimental?: Record<string, unknown>
  logging?: Record<string, never>
  tools?: { listChanged?: boolean }
  prompts?: { listChanged?: boolean }
  resources?: { listChanged?: boolean; subscribe?: boolean }
  completions?: Record<string, never>
}

/**
 * Subset of the MCP `initialize` response relevant to the UI layer.
 * Consumers may extend this via the `experimental` field.
 */
export interface ServerInitializeInfo {
  protocolVersion: string
  serverInfo: { name: string; version: string; title?: string; [key: string]: unknown }
  capabilities: ServerCapabilities
  instructions?: string
}

// ─── Handle ───────────────────────────────────────────────────

export interface ServerCapabilitiesStoreHandle {
  /** Push a fresh `initialize` snapshot into the store, or clear with `null`. */
  set: (info: ServerInitializeInfo | null) => void
  /** Reactive accessor for the full info (null when no initialize received). */
  info: () => ServerInitializeInfo | null
  /** Reactive accessor for just the `capabilities` field. */
  capabilities: () => ServerCapabilities | null
  /** Reactive accessor for just the `serverInfo` field. */
  serverInfo: () => ServerInitializeInfo['serverInfo'] | null
  /** Reactive accessor for the protocol version string. */
  protocolVersion: () => string | null
  /**
   * Helper : returns true if the server advertised the named capability key
   * with a truthy value (i.e. the key is present, even as an empty object).
   */
  hasCapability: (key: keyof ServerCapabilities) => boolean
}

// ─── Factory ──────────────────────────────────────────────────

/**
 * Create an isolated server-capabilities store instance.
 *
 * Use this when you need to track multiple MCP servers in parallel (rare),
 * or to drive the store from a non-reactive transport adapter. Pair with
 * `<ServerCapabilitiesProvider store={...}>` to scope a SolidJS subtree.
 *
 * @experimental
 * @since v5.3.0
 */
export function createServerCapabilitiesStore(): ServerCapabilitiesStoreHandle {
  const [state, setState] = createStore<{ info: ServerInitializeInfo | null }>({ info: null })

  return {
    set: (info) => setState('info', info),
    info: () => state.info,
    capabilities: () => state.info?.capabilities ?? null,
    serverInfo: () => state.info?.serverInfo ?? null,
    protocolVersion: () => state.info?.protocolVersion ?? null,
    hasCapability: (key) => Boolean(state.info?.capabilities?.[key]),
  }
}

// ─── Module-level singleton ───────────────────────────────────

const defaultStore: ServerCapabilitiesStoreHandle = createServerCapabilitiesStore()

/**
 * Push the parsed MCP `initialize` response into the module-level singleton
 * store. Pass `null` to clear (e.g. on disconnect / server change).
 *
 * @experimental
 * @since v5.3.0
 *
 * @example
 * // In your transport adapter, after receiving the initialize response :
 * setServerCapabilities({
 *   protocolVersion: response.result.protocolVersion,
 *   serverInfo: response.result.serverInfo,
 *   capabilities: response.result.capabilities,
 *   instructions: response.result.instructions,
 * })
 */
export function setServerCapabilities(info: ServerInitializeInfo | null): void {
  defaultStore.set(info)
}

// ─── Context ──────────────────────────────────────────────────

/**
 * Context for a scoped server-capabilities store. Populated by
 * `<ServerCapabilitiesProvider>`. Read by `useServerCapabilities()` with
 * automatic fallback to the module-level singleton when absent.
 *
 * @experimental
 * @since v5.3.0
 */
export const ServerCapabilitiesContext = createContext<ServerCapabilitiesStoreHandle | undefined>(
  undefined
)

/**
 * Provide a scoped `ServerCapabilitiesStoreHandle` to a SolidJS subtree.
 * Children calling `useServerCapabilities()` bind to this store instead of
 * the module singleton.
 *
 * If no `store` prop is passed, a fresh store is created for the provider's
 * lifetime. Pass `store` explicitly when you need the handle outside the
 * tree (e.g. in a transport adapter living at the app root).
 *
 * @experimental
 * @since v5.3.0
 */
export const ServerCapabilitiesProvider: ParentComponent<{
  store?: ServerCapabilitiesStoreHandle
}> = (props): JSX.Element => {
  const store = props.store ?? createServerCapabilitiesStore()
  return (
    <ServerCapabilitiesContext.Provider value={store}>
      {props.children}
    </ServerCapabilitiesContext.Provider>
  )
}

// ─── Reactive hook ────────────────────────────────────────────

/**
 * Hook for components — reads the server capabilities reactively.
 *
 * If called inside a `<ServerCapabilitiesProvider>`, reads the scoped
 * handle; otherwise falls back to the module singleton.
 *
 * @experimental
 * @since v5.3.0
 *
 * @example
 * const { capabilities, serverInfo, hasCapability } = useServerCapabilities()
 *
 * <Show when={capabilities()}>
 *   <p>Connected to {serverInfo()?.name} v{serverInfo()?.version}</p>
 *   <Show when={hasCapability('tools')}>
 *     <ToolPalette />
 *   </Show>
 * </Show>
 */
export function useServerCapabilities(): {
  info: () => ServerInitializeInfo | null
  capabilities: () => ServerCapabilities | null
  serverInfo: () => ServerInitializeInfo['serverInfo'] | null
  protocolVersion: () => string | null
  hasCapability: (key: keyof ServerCapabilities) => boolean
} {
  const scoped = useContext(ServerCapabilitiesContext)
  const handle = scoped ?? defaultStore
  return {
    info: handle.info,
    capabilities: handle.capabilities,
    serverInfo: handle.serverInfo,
    protocolVersion: handle.protocolVersion,
    hasCapability: handle.hasCapability,
  }
}
