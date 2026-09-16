/**
 * MCPUIStringsContext — i18n for the library's own "chrome" strings.
 *
 * @since v6.6.0 (D2 / R4 of ROADMAP-opendata-macro-mcpui)
 *
 * ## Scope — chrome only, NOT content
 *
 * MCP-UI renders two kinds of text :
 *
 * - **Content** — table headers, chart titles, action labels, prompt
 *   questions. These come from the payload and are ALREADY localized by
 *   whoever produced the payload (the connector / MCP server). MCP-UI
 *   renders them verbatim and this context never touches them.
 * - **Chrome** — the handful of strings the library itself hardcodes :
 *   the expand-button tooltip, the feedback acknowledgements, etc. THIS
 *   is what `MCPUIStrings` covers.
 *
 * There is deliberately no full i18n framework here : no per-renderer
 * `locale` prop, no message catalogue, no ICU. A flat string map behind a
 * context is enough — the chrome surface is small and static.
 *
 * ## Defaults are English
 *
 * `DEFAULT_MCPUI_STRINGS` is English. A published library should not ship
 * hardcoded French. Consumers that want another language wrap their tree
 * in `<MCPUIStringsProvider strings={...}>` with a partial override.
 *
 * Component props that already carry a label (e.g. `FeedbackInline`'s
 * `positiveAck`, `ExpandableWrapper`'s `copyLabel`) keep priority over the
 * provider — the provider only fills the gap when no explicit prop is set.
 *
 * @example
 * ```tsx
 * import { MCPUIStringsProvider } from '@seed-ship/mcp-ui-solid'
 *
 * <MCPUIStringsProvider strings={{ expand: 'Agrandir', feedbackUseful: 'Utile' }}>
 *   <App />
 * </MCPUIStringsProvider>
 * ```
 */

import { createContext, mergeProps, useContext, type JSX } from 'solid-js'

/**
 * The library's own chrome strings. Flat map, no interpolation.
 *
 * The original chrome keys remain required. Later additions are optional
 * so existing typed dictionaries remain valid across minor releases.
 * `useMCPUIStrings` resolves omitted keys to their English defaults.
 */
export interface MCPUIStrings {
  // ── ExpandableWrapper toolbar ──────────────────────────────
  /** `title` of the expand-to-fullscreen button. */
  expand: string
  /** Heading + `aria-label` of the fullscreen modal when no title is given. */
  expandedView: string
  /** Default tooltip of the copy button (overridden by `copyLabel` prop). */
  copyToClipboard: string
  /** `aria-label` of the close button in the fullscreen modal. */
  closeExpandedView: string

  // ── FeedbackInline (response-quality feedback) ─────────────
  /** `title` of the thumb-up button. */
  feedbackUseful: string
  /** `title` of the thumb-down button. */
  feedbackNotUseful: string
  /** Acknowledgement shown after a positive rating (overridden by `positiveAck`). */
  feedbackPositiveAck: string
  /** Acknowledgement shown after a negative rating (overridden by `negativeAck`). */
  feedbackNegativeAck: string

  // ── Generic chrome ────────────────────────────────────────
  /** Label of the streaming retry button. */
  retry: string

  // ── Chart data access ─────────────────────────────────────
  /** Label of the native chart view button. */
  chartView?: string
  /** Label of the exact-data table view button. */
  chartDataView?: string
  /** Accessible name of the chart/data view selector. */
  chartViewSelector?: string
  /** Caption and accessible name for the chart's data table. */
  chartDataTable?: string
  /** Screen-reader description associated with the chart canvas. */
  chartDataSummary?: string
  /** Empty state shown when a chart has no data points. */
  chartNoData?: string

  // ── Table pagination ──────────────────────────────────────
  /** Accessible name of the pagination "previous page" button. */
  paginationPrevious?: string
  /** Accessible name of the pagination "next page" button. */
  paginationNext?: string
  /** Accessible name of the pagination page-size `<select>`. */
  paginationPageSize?: string

  // ── Grid layout ────────────────────────────────────────────
  /** Fallback `aria-label` for a grid region without a title. */
  gridRegion?: string
}

/**
 * English defaults. A published library ships no hardcoded non-English
 * chrome — consumers localize via `<MCPUIStringsProvider>`.
 */
export const DEFAULT_MCPUI_STRINGS: Required<MCPUIStrings> = {
  expand: 'Expand',
  expandedView: 'Expanded view',
  copyToClipboard: 'Copy to clipboard',
  closeExpandedView: 'Close expanded view',
  feedbackUseful: 'Useful',
  feedbackNotUseful: 'Not useful',
  feedbackPositiveAck: 'Thanks!',
  feedbackNegativeAck: "Noted — we'll improve",
  retry: 'Retry',
  chartView: 'Chart',
  chartDataView: 'Data',
  chartViewSelector: 'Chart or data view',
  chartDataTable: 'Chart data',
  chartDataSummary: 'Exact values are available in the data view.',
  chartNoData: 'No chart data',
  paginationPrevious: 'Previous page',
  paginationNext: 'Next page',
  paginationPageSize: 'Rows per page',
  gridRegion: 'Layout grid',
}

export const MCPUIStringsContext = createContext<MCPUIStrings>(DEFAULT_MCPUI_STRINGS)

/**
 * Reads the active chrome strings. Returns `DEFAULT_MCPUI_STRINGS` when no
 * `<MCPUIStringsProvider>` is mounted above — every renderer works
 * standalone with English chrome.
 */
export function useMCPUIStrings(): Required<MCPUIStrings> {
  return mergeProps(DEFAULT_MCPUI_STRINGS, useContext(MCPUIStringsContext))
}

export interface MCPUIStringsProviderProps {
  /**
   * Partial override of the chrome strings. Any key left unset falls back
   * to the English `DEFAULT_MCPUI_STRINGS` — so a consumer can localize
   * just the strings they care about.
   */
  strings?: Partial<MCPUIStrings>
  children: JSX.Element
}

/**
 * Provides localized chrome strings to every MCP-UI renderer below it.
 * Merges the partial `strings` override over the English defaults.
 */
export function MCPUIStringsProvider(props: MCPUIStringsProviderProps): JSX.Element {
  // The function source keeps replacement `strings` objects reactive while
  // mergeProps fills any omitted key without taking a one-time snapshot.
  const value = mergeProps(DEFAULT_MCPUI_STRINGS, () => props.strings)
  return (
    <MCPUIStringsContext.Provider value={value}>
      {props.children}
    </MCPUIStringsContext.Provider>
  )
}
