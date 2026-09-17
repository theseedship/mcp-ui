/**
 * Chrome-strings i18n sweep — default pinning + template helper.
 *
 * Every key added by the sweep replaced a literal that used to be hardcoded
 * in a component. The table below pins each default to the EXACT former
 * literal: a consumer with no `<MCPUIStringsProvider>` must see the same
 * chrome as before the sweep. Changing a value here is a breaking change for
 * anyone asserting on accessible names.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MCPUI_STRINGS,
  formatMCPUIString,
  type MCPUIStrings,
} from './MCPUIStringsContext'

/** key → the literal the component hardcoded before the sweep. */
const FORMER_LITERALS: Record<string, string> = {
  // AutocompleteDropdown
  autocompleteSuggestions: 'Suggestions',
  // CarouselRenderer / MapRenderer expandable titles
  carouselTitle: 'Carousel',
  mapTitle: 'Map',
  // ChartJSRenderer PNG export
  chartDownloadPng: 'Download PNG',
  chartDownloadPngAria: 'Download chart as PNG',
  // Second pass — ExpandableWrapper `copyLabel` of each wrapped renderer
  carouselCopy: 'Copy items (JSON)',
  chartCopy: 'Copy chart data (JSON)',
  graphCopy: 'Copy graph (JSON)',
  galleryCopy: 'Copy image URLs',
  mapCopy: 'Copy markers as GeoJSON',
  videoCopy: 'Copy video URL',
  // CodeBlockRenderer toolbar
  codeSearchPlaceholder: 'Search…',
  codeSearchAria: 'Search in code',
  codeDownloadAria: 'Download code as file',
  codeDownload: 'Download code',
  codeToggleWordWrap: 'Toggle word wrap',
  codeCopy: 'Copy code',
  codeTitle: 'Code',
  // DataPreviewSection (templates)
  exportCsvRows: 'Export CSV ({count} rows)',
  exportJsonRows: 'Export JSON ({count} rows)',
  sortBy: 'Sort by {column}',
  // FormFieldRenderer / ScratchpadPanel
  removeItem: 'Remove {name}',
  filterPlaceholder: 'Filter...',
  scratchpadClose: 'Close',
  // FormFieldRenderer prefill-source badges (former SOURCE_BADGES titles)
  sourceDetected: 'Detected from message',
  sourceInferred: 'Inferred from context',
  sourcePrevious: 'Previously provided',
  // ScratchpadPanel inline filter editor
  ok: 'OK',
  // GraphRenderer
  graphExport: 'Export graph',
  // 6.20.0 — graph chrome.
  graphTitle: 'Graph',
  graphExportMenu: 'Export \u25BE',
  graphDownloadPng: 'Download PNG',
  graphDownloadPngHint: 'visual snapshot',
  graphDownloadMermaid: 'Download Mermaid',
  graphDownloadMermaidHint: 'markdown / GitHub',
  graphDownloadJson: 'Download JSON',
  graphDownloadJsonHint: 'raw data',
  // LightboxOverlay
  lightboxLabel: 'Image lightbox',
  lightboxClose: 'Close lightbox',
  lightboxPrevious: 'Previous image',
  lightboxNext: 'Next image',
  // ModalRenderer
  modalClose: 'Close modal',
  // UIResourceRenderer — copy buttons
  copy: 'Copy',
  copyMetric: 'Copy metric',
  copyText: 'Copy text',
  copyErrorDetails: 'Copy error details',
  // UIResourceRenderer — table chrome
  tableTitle: 'Table',
  tableCopyCsv: 'Copy table (CSV)',
  tableExport: 'Export table',
  tableClearSearch: 'Clear search',
  tableAriaLabel: 'Data table',
  // Export menu + pagination visible chrome (second pass)
  tableCopyTsv: 'Copy TSV',
  tableDownloadCsv: 'Download CSV',
  tableDownloadJson: 'Download JSON',
  perPageSuffix: '/ page',
  // UIResourceRenderer — media and links
  imageAlt: 'Image',
  imageViewFullSize: 'View full size: {alt}',
  iframeTitle: 'Embedded content',
  linkLabel: 'Link',
  linkOpensInNewTab: '{label}: {description} (opens in new tab)',
  // UIResourceRenderer — misc chrome
  validationWarning: 'Component validation warning',
  resourceTitle: 'Resource',
  // VerifiedText
  verifiedTitle: 'Verified against source data',
  verifiedAria: 'verified',
  unverifiedAria: 'unverified',
  verifiedNotFound: 'Not found in source data',
  verifiedNotFoundClosest: 'Not found in source data. Closest: {closest} ({pct}% off)',
  verifiedConfidence: '{pct}% verified',
  verifiedUnverifiedCount: '({count} unverified)',

  // ── 6.20.0 ─────────────────────────────────────────────
  // Generic chrome reused by several components.
  cancel: 'Cancel',
  confirm: 'Confirm',
  submit: 'Submit',
  dismiss: 'Dismiss',
  yes: 'Yes',
  no: 'No',
  // AutocompleteDropdown states
  autocompleteLoading: 'Loading...',
  autocompleteEmpty: 'No suggestions found',
  // ChartJSRenderer loading overlay
  chartLoading: 'Loading chart...',
  // CodeBlockRenderer word-wrap toggle (was a two-branch ternary)
  codeWordWrapEnable: 'Enable word wrap',
  codeWordWrapDisable: 'Disable word wrap',
  // FormFieldRenderer
  fieldNotSupported: 'Not supported',
  fieldNoMatches: 'No matches',
  fieldGroupContainer: 'Group container',
  fieldSelectPlaceholder: 'Select...',
  fieldTagsPlaceholder: 'Type and press Enter...',
  // ImageGalleryRenderer / VideoRenderer untitled fallbacks
  galleryTitle: 'Gallery',
  videoTitle: 'Video',
  // ScratchpadPanel
  scratchpadPreview: 'Preview',
  scratchpadNoResults: 'No results for these filters',
  scratchpadModifyFilters: 'Modify filters',
  scratchpadNoFilters: 'No filters',
  scratchpadSend: 'Send',
  scratchpadShowRaw: 'Show raw SSE payload',
  scratchpadHideRaw: 'Hide raw SSE payload',
  scratchpadCommentPlaceholder: 'Add a comment...',
  scratchpadError: 'Error',
  scratchpadSource: 'Source',
  // ChatPrompt
  promptLoadingPreview: 'Loading preview...',
  promptConfirmed: 'Confirmed',
  promptCancelled: 'Cancelled',
  promptFormSubmitted: 'Form submitted',
  // FormRenderer
  formSubmissionFailed: 'Submission failed',
  formSubmitCountdown: '{label} in {seconds}s...',
  // ActionGroupRenderer / ArtifactRenderer / DegradedFallback
  actionGroupLabel: 'Action group',
  artifactDescription: 'Generated artifact',
  degradedCaption: 'Showing the underlying data \u2014 the interactive view is unavailable.',
  // StreamingUIRenderer metadata panel
  metaProvider: 'Provider',
  metaModel: 'Model',
  metaExecutionTime: 'Execution Time',
  metaCost: 'Cost',
  metaTtfb: 'TTFB',
  metaCached: 'Cached',
  // UIResourceRenderer error / validation chrome
  chartError: 'Chart Error',
  validationError: 'Validation Error',
  validationUnknownError: 'Unknown validation error',
  errorUnknown: 'Unknown error',
  errorUnknownToolName: 'Unknown',
  errorToolExecution: 'An error occurred during tool execution',

  // ── 6.20.0 ─────────────────────────────────
  // Generic chrome
  download: 'Download',
  unknown: 'unknown',
  // UIResourceRenderer error / fallback chrome
  invalidComponent: 'Invalid {type}',
  toolErrorTitle: 'Tool Error: {tool}',
  errorTypeLabel: 'Type: {type}',
  errorSuggestions: 'Suggestions:',
  chartInvalidData: 'Invalid chart data: missing data.datasets',
  unsupportedComponentType: 'Unsupported component type:',
  // DataPreviewSection pagination
  previewPrev: 'Prev',
  previewNext: 'Next',
  previewPageIndicator: 'Page {page} / {total}',
  // FormFieldRenderer
  fieldResolving: 'Resolving...',
  // FormRenderer
  formSubmitting: 'Submitting...',
  formReset: 'Reset',
  // GenerativeUIErrorBoundary default fallback
  errorBoundaryTitle: 'Component Failed to Render',
  errorBoundaryMeta: 'Type: {type} | ID: {id}...',
  errorBoundaryRetry: 'Retry Rendering',
  // ScratchpadPanel
  scratchpadSearch: 'Search',
  scratchpadNextStep: 'Next',
  scratchpadPlan: 'Plan:',
  scratchpadModify: 'Modify',
  scratchpadDetails: 'Details',
  scratchpadItems: 'items',
  // VideoRenderer
  videoUnsupported: 'Your browser does not support the video tag.',

  // ── 6.20.0 ────────────────────────────────────────────────────────
  // DataPreviewSection page info (the range used to embed a hardcoded
  // 'fr-FR' locale; the count is now formatted with the runtime locale).
  previewShowingRange: 'Showing {start}\u2013{end} of {total}',
  previewRowsOne: '{count} row',
  previewRowsMany: '{count} rows',
  previewTotalSuffix: ' ({total} total)',
  // ScratchpadPanel STATUS_BADGES (the error badge reuses scratchpadError)
  statusLoading: 'Loading...',
  statusActionAvailable: 'Action available',
  statusYourTurn: 'Your turn',
  statusProcessing: 'Processing...',
  statusComplete: 'Complete',
  // AgentCard STATUS_CONFIG
  agentStatusIdle: 'Idle',
  agentStatusRunning: 'Running',
  agentStatusWaiting: 'Waiting',
  agentStatusDone: 'Done',
  agentStatusError: 'Error',
  // AgentHandoff
  handoffItems: '{count} items',
  // DegradedFallback + its call sites
  degradedMoreRows: '+{count} more rows not shown.',
  chartDegradedCaption:
    'Showing the chart data as a table \u2014 the interactive chart is unavailable.',
  chartRenderFailed: 'Chart rendering failed: {error}',
  chartQuickchartCaption: 'Showing the chart data as a table.',
  graphDegradedCaption:
    'Showing the graph data as a table \u2014 the interactive view is unavailable.',
  graphRenderFailed: 'Graph rendering failed: {error}',
  graphRenderError: 'Failed to render graph',
  chartRenderError: 'Chart rendering failed',
  graphPngUnsupported: 'PNG export not supported in current renderer mode',
  graphPngExportFailed: 'PNG export failed',
  mapLibraryUnavailable: 'Map library could not be loaded.',
  mapDegradedCaption:
    'Showing the map data as a coordinate table \u2014 the interactive map is unavailable.',
  mapRenderFailed: 'Map rendering failed: {error}',
  mapRenderError: 'Failed to render map',
  // Degraded / accessible table headers (former helper literals)
  degradedColType: 'Type',
  degradedColLat: 'Lat',
  degradedColLng: 'Lng',
  degradedColInfo: 'Info',
  degradedColSource: 'Source',
  degradedColTarget: 'Target',
  degradedColNode: 'Node',
  degradedColLabel: 'Label',
  degradedSeries: 'Series {n}',
  chartTableSeries: 'Series',
  chartTablePoint: 'Point',
  // AutocompleteDropdown hint prose (the <kbd> caps stay hardcoded, P1)
  autocompleteHintNavigate: ' to navigate, ',
  autocompleteHintSelect: ' to select, ',
  autocompleteHintDismiss: ' to dismiss',
  autocompleteTabToAccept: 'Tab to accept',
  // FormFieldRenderer entity picker
  fieldAddMorePlaceholder: 'Add more...',
  // ImageGalleryRenderer + the image lightbox link
  galleryViewImage: 'View image {index}',
  galleryImageAlt: 'Image {index}',
  imageAltFallback: 'image',
  // UIResourceRenderer quickchart image
  chartVisualizationAlt: 'Chart visualization',
  chartWithTitleAlt: 'Chart: {title}',
  chartLoadFailed: 'Failed to load chart',
  paginationAllRows: 'All',
  // Form validation (services/validation.ts)
  fieldRequired: '{field} is required',
  fieldMustBeChecked: '{field} must be checked',
  fieldMinLength: 'Minimum {min} characters required',
  fieldMaxLength: 'Maximum {max} characters allowed',
  fieldInvalidPattern: 'Invalid format',
  fieldInvalidEmail: 'Invalid email address',
  fieldInvalidNumber: 'Must be a valid number',
  fieldMinValue: 'Minimum value is {min}',
  fieldMaxValue: 'Maximum value is {max}',
  fieldMinDate: 'Date must be after {min}',
  fieldMaxDate: 'Date must be before {max}',
  fieldInvalidOption: 'Please select a valid option',
  fieldInvalidFormat: 'Invalid format (expected: {format})',

  // ── 6.20.0 — AST scanner + pseudo-locale findings ──
  // BriefingDiff stats (`+{n} added` / `{n} removed` / `{n} changed`)
  briefingAdded: '+{count} added',
  briefingRemoved: '{count} removed',
  briefingChanged: '{count} changed',
  // FooterRenderer (`{sourceCount} sources`)
  footerSources: '{count} sources',
  // FormFieldRenderer unknown-type warning + multiselect trigger
  fieldUnknownType: 'Unknown field type: {type}',
  fieldSelectedCount: '{count} selected',
  // ScratchpadPanel error code + data-source row count
  scratchpadErrorCode: 'Code: {code}',
  scratchpadResultCount: '{count} results',
  // UIResourceRenderer table
  tableVirtualizedRows: '(virtualized: {count} rows)',
  // Former `{n} result{s} on {total}` — split into singular / plural.
  tableSearchResultsOne: '{count} result on {total}',
  tableSearchResultsMany: '{count} results on {total}',
  tableServerPageRange: 'Showing {start} - {end} of {total}',
  // Tool-error card clipboard text (`Error in ${tool || 'unknown tool'}: …`)
  errorCopyText: 'Error in {tool}: {message}',
  errorUnknownTool: 'unknown tool',
  // Map degraded table `Type` cells (`'marker'` / `'feature'`)
  degradedMarker: 'marker',
  degradedFeature: 'feature',
  // useStreamingUI progress / error messages rendered by StreamingUIRenderer
  streamInitializing: 'Initializing...',
  streamConnecting: 'Connecting to server...',
  streamLoadingComponent: 'Loading {type} component...',
  streamDashboardLoaded: 'Dashboard loaded',
  streamErrorProgress: 'Error: {message}',
  streamConnectionFailed: 'Stream connection failed',
  streamRequestFailed: 'Stream request failed',
  streamEmptyResponse: 'Response body is null',
  streamServerSide: 'Streaming UI cannot start on server-side',
  streamUnknownError: 'Unknown error',
  graphUnavailable: 'Graph rendering unavailable',
  mapPmtilesUnavailable:
    'PMTiles layer unavailable \u2014 the optional "protomaps-leaflet" peer dependency failed to load or render.',
  mapBaseMapStillShown: 'The base map is still shown.',
  chartJsUnavailable: 'Chart.js is not available. Install chart.js peer dependency.',
  chartIframeUnavailable:
    'Interactive chart unavailable \u2014 install the chart.js peer dependency, or set allowQuickchartFallback to use the external quickchart.io renderer.',
  previewInvalidContent: '[DataPreviewSection] Invalid content format',
  citationViewSource: 'View source - {label}',
  sizeBytes: '{size} B',
  sizeKilobytes: '{size} KB',
  sizeMegabytes: '{size} MB',
}

/**
 * These defaults deliberately do NOT pin the former literal: the component
 * shipped French, and `DEFAULT_MCPUI_STRINGS` is the English baseline. The
 * French wording is now reachable through `<MCPUIStringsProvider>`.
 *
 * The connector adapter's two French degraded-state paragraphs moved the same
 * way, but they are an adapter option (`DEFAULT_CONNECTOR_MESSAGES`), not an
 * `MCPUIStrings` key — they are pinned in `src/adapters/connector.test.ts`.
 */
const DEFAULT_CHANGES: Array<{ key: keyof MCPUIStrings; former: string; now: string }> = [
  {
    key: 'streamServerSideTitle',
    // StreamingUIRenderer rendered the hook's machine code `'ssr'` as the
    // error heading during SSR; the hook keeps the code, the renderer maps it.
    former: 'ssr',
    now: 'Streaming unavailable',
  },
  {
    key: 'locale',
    // 6.20.0: number / date formatting and collation hardcoded 'fr-FR' / 'fr'
    // (UIResourceRenderer table sort + client range count, DataPreviewSection
    // cells, sort and page-info counts, MapRenderer popups) or used the
    // runtime's implicit locale (ScratchpadPanel counts, tool-error
    // timestamp). All now read `strings.locale`.
    former: 'fr-FR',
    now: 'en-US',
  },
  {
    key: 'tableSearchPlaceholder',
    // UIResourceRenderer: `tableParams.searchPlaceholder || 'Rechercher dans le tableau...'`
    former: 'Rechercher dans le tableau...',
    now: 'Search the table...',
  },
  {
    key: 'verifiedStripLabel',
    // VerifiedText `strip` mode rendered `[non v&eacute;rifi&eacute;]`.
    former: '[non v\u00E9rifi\u00E9]',
    now: '[unverified]',
  },
  {
    key: 'scratchpadEdit',
    // ScratchpadPanel's collapsed embedded form rendered `>Modifier</button>`.
    former: 'Modifier',
    now: 'Edit',
  },

  // ── 6.20.0 ─────────────────────────────────
  {
    key: 'citationUnresolved',
    // `transformCellCitations` emitted `[r\u00E9f. ${id}]` for an unresolved
    // marker when the citation map was empty.
    former: '[réf. {id}]',
    now: '[ref. {id}]',
  },
  {
    key: 'formPrefilledOne',
    // FormRenderer / ScratchpadPanel rendered
    // `{n} champ pr\u00E9-rempli sur {total}`.
    former: '{count} champ pré-rempli sur {total}',
    now: '{count} field pre-filled out of {total}',
  },
  {
    key: 'formPrefilledMany',
    // Plural branch of the same summary.
    former: '{count} champs pré-remplis sur {total}',
    now: '{count} fields pre-filled out of {total}',
  },
]

/** Keys that already shipped before the sweep (v6.6.0 … v6.19.1). */
const PRE_SWEEP_KEYS: Record<string, string> = {
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

describe('DEFAULT_MCPUI_STRINGS — sweep defaults pin the former literals', () => {
  for (const [key, literal] of Object.entries(FORMER_LITERALS)) {
    it(`${key} defaults to ${JSON.stringify(literal)}`, () => {
      expect(DEFAULT_MCPUI_STRINGS[key as keyof MCPUIStrings]).toBe(literal)
    })
  }

  for (const { key, former, now } of DEFAULT_CHANGES) {
    it(`${key} ships English ${JSON.stringify(now)} in place of the former French literal`, () => {
      expect(DEFAULT_MCPUI_STRINGS[key]).toBe(now)
      expect(DEFAULT_MCPUI_STRINGS[key]).not.toBe(former)
    })
  }

  it('keeps every pre-sweep default untouched', () => {
    for (const [key, literal] of Object.entries(PRE_SWEEP_KEYS)) {
      expect(DEFAULT_MCPUI_STRINGS[key as keyof MCPUIStrings]).toBe(literal)
    }
  })

  it('has no undefined/empty value — satisfies Required<MCPUIStrings> at runtime', () => {
    const entries = Object.entries(DEFAULT_MCPUI_STRINGS)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, value] of entries) {
      expect(typeof value, `${key} must be a string`).toBe('string')
      expect(value.length, `${key} must not be empty`).toBeGreaterThan(0)
    }
  })

  it('covers exactly the pre-sweep keys plus the sweep keys', () => {
    const expected = [
      ...Object.keys(PRE_SWEEP_KEYS),
      ...Object.keys(FORMER_LITERALS),
      ...DEFAULT_CHANGES.map((c) => c.key as string),
    ].sort()
    expect(Object.keys(DEFAULT_MCPUI_STRINGS).sort()).toEqual(expected)
  })
})

describe('formatMCPUIString', () => {
  it('substitutes a named placeholder', () => {
    expect(formatMCPUIString('Remove {name}', { name: 'Paris' })).toBe('Remove Paris')
  })

  it('stringifies numbers', () => {
    expect(formatMCPUIString(DEFAULT_MCPUI_STRINGS.exportCsvRows, { count: 42 })).toBe(
      'Export CSV (42 rows)'
    )
    expect(formatMCPUIString('{count}', { count: 0 })).toBe('0')
  })

  it('substitutes several distinct placeholders', () => {
    expect(
      formatMCPUIString(DEFAULT_MCPUI_STRINGS.linkOpensInNewTab, {
        label: 'Docs',
        description: 'https://example.com',
      })
    ).toBe('Docs: https://example.com (opens in new tab)')
  })

  it('leaves an unknown placeholder intact', () => {
    expect(formatMCPUIString('Sort by {column} ({unit})', { column: 'Revenue' })).toBe(
      'Sort by Revenue ({unit})'
    )
  })

  it('replaces every occurrence of a repeated placeholder', () => {
    expect(formatMCPUIString('{name} → {name}', { name: 'x' })).toBe('x → x')
  })

  it('returns the template unchanged when it has no placeholder', () => {
    expect(formatMCPUIString('Close modal', { name: 'ignored' })).toBe('Close modal')
  })

  it('does not pick up inherited Object.prototype keys', () => {
    expect(formatMCPUIString('{toString}', {})).toBe('{toString}')
  })

  it('leaves malformed braces alone', () => {
    expect(formatMCPUIString('{ name } {}', { name: 'x' })).toBe('{ name } {}')
  })
})
