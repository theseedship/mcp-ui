/**
 * MCPUITelemetryProvider + useTelemetry hook (B.5 — v5.6.0)
 *
 * SolidJS Context wrapper around `createTelemetryDispatcher`. Optional —
 * when no Provider is present, `useTelemetry()` returns `null` and dispatch
 * sites no-op (zero behavior change for apps that don't opt in).
 *
 * See `services/telemetry.ts` for the dispatcher contract and
 * `MCP-UI-AUDIT-2026-04-26.md` §M.6 for the full specification.
 */

import {
  createContext,
  useContext,
  onCleanup,
  type Component,
  type JSX,
} from 'solid-js'
import {
  createTelemetryDispatcher,
  type TelemetryDispatcher,
  type TelemetrySink,
  type TelemetryOptions,
} from '../services/telemetry'

export const MCPUITelemetryContext = createContext<TelemetryDispatcher | null>(null)

export interface MCPUITelemetryProviderProps {
  /** Consumer-supplied sink. Receives a batch of events. Fail-open. */
  sink: TelemetrySink
  /** Sampling + buffering knobs (defaults: 100% / 100ms / max 50). */
  options?: TelemetryOptions
  children: JSX.Element
}

export const MCPUITelemetryProvider: Component<MCPUITelemetryProviderProps> = (props) => {
  // Dispatcher is created once per Provider mount. `props.sink` and
  // `props.options` are captured at that moment — consumers should treat
  // them as effectively immutable for the Provider's lifetime (re-mount the
  // Provider to swap them).
  const dispatcher = createTelemetryDispatcher(props.sink, props.options)

  // Force-flush on unmount so any buffered events from the last bufferMs
  // window aren't lost (e.g. tab close, route change with cleanup).
  onCleanup(() => {
    dispatcher.flush()
  })

  return (
    <MCPUITelemetryContext.Provider value={dispatcher}>
      {props.children}
    </MCPUITelemetryContext.Provider>
  )
}

/**
 * Returns the current telemetry dispatcher, or `null` when no Provider is
 * mounted in the tree above. Dispatch sites should null-check and no-op
 * when null — telemetry is OPT-IN and must not impose a Provider on apps.
 *
 * @example
 * ```tsx
 * const telemetry = useTelemetry()
 * onMount(() => {
 *   telemetry?.dispatch({ type: 'component:mounted', id, componentType, ts: Date.now() })
 * })
 * ```
 */
export function useTelemetry(): TelemetryDispatcher | null {
  return useContext(MCPUITelemetryContext)
}
