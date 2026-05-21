/**
 * @seed-ship/mcp-ui-solid/adapters
 *
 * Opt-in, pure adapters that turn connector / macro contracts into MCP-UI
 * render structures. Published as a dedicated subpath so the core renderer
 * path never depends on them.
 *
 * @example
 * ```ts
 * import { connectorResultToUILayout } from '@seed-ship/mcp-ui-solid/adapters'
 *
 * const layout = connectorResultToUILayout(connectorResult)
 * // → <UIResourceRenderer content={layout} />
 * ```
 */

export {
  connectorResultToUILayout,
  connectorActionsToActionGroup,
} from './connector'
export type {
  ConnectorResultToUILayoutOptions,
  ConnectorActionsToActionGroupOptions,
} from './connector'
