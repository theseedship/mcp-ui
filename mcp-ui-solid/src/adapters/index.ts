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
  DEFAULT_CONNECTOR_MESSAGES,
} from './connector';
export type {
  ConnectorResultToUILayoutOptions,
  ConnectorActionsToActionGroupOptions,
  ConnectorAdapterMessages,
} from './connector';

export {
  macroRunToScratchpadState,
  macroInterrogationToChatPromptConfig,
  DEFAULT_MACRO_RUN_MESSAGES,
} from './macro-run';
export type { MacroRunAdapterMessages, MacroRunAdapterOptions } from './macro-run';

export {
  createComparisonLayout,
  createGeographyLayout,
  createEvidenceLayout,
} from './presentation';
export type {
  ComparisonLayoutInput,
  GeographyLayoutInput,
  EvidenceLayoutInput,
  PresentationComponent,
  ChartComponent,
  TableComponent,
  MapComponent,
  MetricComponent,
  TextComponent,
  LinkComponent,
} from './presentation';
