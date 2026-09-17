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
  /** Label of a generic inline "confirm" button (scratchpad filter editor). */
  ok?: string
  /** Label of a generic "cancel" button (scratchpad, chat prompt). */
  cancel?: string
  /** Label of a generic "confirm" button (chat prompt). */
  confirm?: string
  /** Label of a generic "submit" button (chat prompt, form renderers). */
  submit?: string
  /** `aria-label` of a generic "dismiss" button (chat prompt). */
  dismiss?: string
  /** Affirmative value label (streaming metadata, scratchpad feedback). */
  yes?: string
  /** Negative value label (scratchpad feedback). */
  no?: string

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

  // ── AutocompleteDropdown ───────────────────────────────────
  /** `aria-label` of the suggestions listbox. */
  autocompleteSuggestions?: string
  /** Fallback loading message of the suggestions listbox. */
  autocompleteLoading?: string
  /** Fallback empty state of the suggestions listbox. */
  autocompleteEmpty?: string

  // ── CarouselRenderer ───────────────────────────────────────
  /** Toolbar title of the carousel's expandable wrapper. */
  carouselTitle?: string
  /** `copyLabel` of the carousel's copy button (title + `aria-label`). */
  carouselCopy?: string

  // ── MapRenderer ────────────────────────────────────────────
  /** Toolbar title of the map's expandable wrapper. */
  mapTitle?: string
  /** `copyLabel` of the map's copy button (title + `aria-label`). */
  mapCopy?: string

  // ── ChartJSRenderer export ─────────────────────────────────
  /** `title` of the chart PNG export button. */
  chartDownloadPng?: string
  /** `aria-label` of the chart PNG export button. */
  chartDownloadPngAria?: string
  /** `copyLabel` of the chart's copy button (title + `aria-label`). */
  chartCopy?: string
  /** Overlay shown while the chart library and data are loading. */
  chartLoading?: string

  // ── CodeBlockRenderer toolbar ──────────────────────────────
  /** `placeholder` of the in-code search input. */
  codeSearchPlaceholder?: string
  /** `aria-label` of the in-code search input. */
  codeSearchAria?: string
  /** `aria-label` of the code download button. */
  codeDownloadAria?: string
  /** `title` of the code download button. */
  codeDownload?: string
  /** `aria-label` of the word-wrap toggle. */
  codeToggleWordWrap?: string
  /** `aria-label` and `title` of the code copy button. */
  codeCopy?: string
  /** Heading and toolbar title of a code block with no filename or language. */
  codeTitle?: string
  /** `title` of the word-wrap toggle while word wrap is OFF. */
  codeWordWrapEnable?: string
  /** `title` of the word-wrap toggle while word wrap is ON. */
  codeWordWrapDisable?: string

  // ── DataPreviewSection ─────────────────────────────────────
  /** `title` of the CSV export button. Template — `{count}` = row count. */
  exportCsvRows?: string
  /** `title` of the JSON export button. Template — `{count}` = row count. */
  exportJsonRows?: string
  /**
   * `title` of a sortable column header (data preview and tables).
   * Template — `{column}` = the column label.
   */
  sortBy?: string

  // ── Form fields (chips, tags, filters) ─────────────────────
  /**
   * `aria-label` of a chip/tag/filter removal button.
   * Template — `{name}` = the item being removed.
   */
  removeItem?: string
  /** `placeholder` of the multi-select options filter input. */
  filterPlaceholder?: string
  /** Badge shown next to a field whose type the renderer does not support. */
  fieldNotSupported?: string
  /** Empty state of the multi-select / autocomplete option list. */
  fieldNoMatches?: string
  /** Fallback help text of a `fieldset` field with none. */
  fieldGroupContainer?: string
  /** Fallback `placeholder` of the multi-select trigger. */
  fieldSelectPlaceholder?: string
  /** Fallback `placeholder` of the tags input. */
  fieldTagsPlaceholder?: string

  // ── ScratchpadPanel ────────────────────────────────────────
  /** `aria-label` of the scratchpad close button. */
  scratchpadClose?: string
  /** Heading of the filter preview block. */
  scratchpadPreview?: string
  /** Empty state of the filter preview block. */
  scratchpadNoResults?: string
  /** Label of the "refine the filters" button in the empty preview. */
  scratchpadModifyFilters?: string
  /** Empty state of the active-filter chip row. */
  scratchpadNoFilters?: string
  /** Label of the collapsed embedded form's "edit" button. */
  scratchpadEdit?: string
  /** Label of the free-text feedback "send" button. */
  scratchpadSend?: string
  /** Label of the debug toggle while the raw SSE payload is hidden. */
  scratchpadShowRaw?: string
  /** Label of the debug toggle while the raw SSE payload is shown. */
  scratchpadHideRaw?: string
  /** Fallback `placeholder` of the free-text feedback input. */
  scratchpadCommentPlaceholder?: string
  /** Fallback message of an error section with none. */
  scratchpadError?: string
  /** Fallback name of a source card with none. */
  scratchpadSource?: string

  // ── GraphRenderer ──────────────────────────────────────────
  /** `title` and `aria-label` of the graph export menu trigger. */
  graphExport?: string
  /** `copyLabel` of the graph's copy button (title + `aria-label`). */
  graphCopy?: string
  /** Toolbar title of the graph's expandable wrapper when untitled. */
  graphTitle?: string
  /**
   * Visible label of the graph export menu trigger button.
   * @since 6.20.0
   */
  graphExportMenu?: string
  /** Label of the "download PNG" item in the graph export menu. */
  graphDownloadPng?: string
  /** Hint under the "download PNG" item. */
  graphDownloadPngHint?: string
  /** Label of the "download Mermaid" item in the graph export menu. */
  graphDownloadMermaid?: string
  /** Hint under the "download Mermaid" item. */
  graphDownloadMermaidHint?: string
  /** Label of the "download JSON" item in the graph export menu. */
  graphDownloadJson?: string
  /** Hint under the "download JSON" item. */
  graphDownloadJsonHint?: string

  // ── ImageGalleryRenderer ───────────────────────────────────
  /** `copyLabel` of the gallery's copy button (title + `aria-label`). */
  galleryCopy?: string
  /** Toolbar title of the gallery's expandable wrapper when untitled. */
  galleryTitle?: string

  // ── VideoRenderer ──────────────────────────────────────────
  /** `copyLabel` of the video's copy button (title + `aria-label`). */
  videoCopy?: string
  /** Toolbar title and iframe `title` of an untitled video. */
  videoTitle?: string

  // ── FormFieldRenderer — prefill source badges ──────────────
  /** `title` of the `detected` prefill-source badge. */
  sourceDetected?: string
  /** `title` of the `inferred` prefill-source badge. */
  sourceInferred?: string
  /** `title` of the `user` prefill-source badge. */
  sourcePrevious?: string

  // ── LightboxOverlay ────────────────────────────────────────
  /** `aria-label` of the lightbox dialog. */
  lightboxLabel?: string
  /** `aria-label` of the lightbox close button. */
  lightboxClose?: string
  /** `aria-label` of the lightbox "previous image" button. */
  lightboxPrevious?: string
  /** `aria-label` of the lightbox "next image" button. */
  lightboxNext?: string

  // ── ModalRenderer ──────────────────────────────────────────
  /** `aria-label` of the modal close button. */
  modalClose?: string

  // ── UIResourceRenderer — copy buttons ──────────────────────
  /** Default `title`/`aria-label` of the generic copy button. */
  copy?: string
  /** `title` of the metric card copy button. */
  copyMetric?: string
  /** `title` of the text card copy button. */
  copyText?: string
  /** `title` of the error card copy button. */
  copyErrorDetails?: string

  // ── UIResourceRenderer — table chrome ──────────────────────
  /** Toolbar title of the table's expandable wrapper when untitled. */
  tableTitle?: string
  /** `title`/`copyLabel` of the table CSV copy button. */
  tableCopyCsv?: string
  /** `title` and `aria-label` of the table export menu trigger. */
  tableExport?: string
  /** `aria-label` of the table search reset button. */
  tableClearSearch?: string
  /** Fallback `aria-label` of the table scroll region when untitled. */
  tableAriaLabel?: string
  /**
   * `placeholder` of the table search input. The payload's
   * `params.searchPlaceholder` still wins when set.
   */
  tableSearchPlaceholder?: string
  /** Label of the "copy as TSV" item in the export menu. */
  tableCopyTsv?: string
  /** Label of the "download CSV" item in the export menu. */
  tableDownloadCsv?: string
  /** Label of the "download JSON" item in the export menu. */
  tableDownloadJson?: string
  /** Suffix rendered after the pagination page-size selector. */
  perPageSuffix?: string

  // ── UIResourceRenderer — media and links ───────────────────
  /** Fallback `alt` text of an image without one. */
  imageAlt?: string
  /**
   * `aria-label` of the image zoom link.
   * Template — `{alt}` = the image's alternative text.
   */
  imageViewFullSize?: string
  /** Fallback `title` of an iframe without one. */
  iframeTitle?: string
  /**
   * Label of the "open in a new tab" link rendered under an embed
   * (`IframeRenderer`, `VideoRenderer`). A COEP-blocked iframe fires no
   * observable event, so this link is the only way out of a blank frame.
   * @since 6.21.0
   */
  iframeOpenInNewTab?: string
  /** Fallback label of a link component without one. */
  linkLabel?: string
  /**
   * `aria-label` of a link component.
   * Template — `{label}` and `{description}`.
   */
  linkOpensInNewTab?: string

  // ── UIResourceRenderer — misc chrome ───────────────────────
  /** `aria-label` of the inline component-validation warning chip. */
  validationWarning?: string
  /** Fallback heading of an HTML resource without a title or URI. */
  resourceTitle?: string
  /** Heading of the chart renderer's error overlay. */
  chartError?: string
  /** Heading of the blocking component-validation error card. */
  validationError?: string
  /** Fallback detail of a validation error carrying no message. */
  validationUnknownError?: string
  /** Fallback message inside the error card's copyable text. */
  errorUnknown?: string
  /** Fallback tool name in the error card heading. */
  errorUnknownToolName?: string
  /** Fallback body of an error card carrying no message. */
  errorToolExecution?: string

  // ── VerifiedText ───────────────────────────────────────────
  /** `title` of a segment verified against the source data. */
  verifiedTitle?: string
  /** `aria-label` of the verified marker glyph. */
  verifiedAria?: string
  /** `aria-label` of the unverified marker glyph. */
  unverifiedAria?: string
  /** `title` of an unverified number with no closest source match. */
  verifiedNotFound?: string
  /**
   * `title` of an unverified number that has a closest source match.
   * Template — `{closest}` = the nearest source number, `{pct}` = the
   * relative distance in percent.
   */
  verifiedNotFoundClosest?: string
  /** Placeholder rendered in `strip` mode in place of the number. */
  verifiedStripLabel?: string
  /**
   * Confidence summary of a validated answer.
   * Template — `{pct}` = the confidence as a whole percentage.
   */
  verifiedConfidence?: string
  /**
   * Count of unverified numbers next to the confidence summary.
   * Template — `{count}` = how many numbers failed verification.
   */
  verifiedUnverifiedCount?: string

  // ── ChatPrompt ─────────────────────────────────────────────
  /** Placeholder shown while the form's live preview is loading. */
  promptLoadingPreview?: string
  /** Submitted label of a confirmed `confirm` prompt (no `confirmLabel`). */
  promptConfirmed?: string
  /** Submitted label of a cancelled `confirm` prompt (no `cancelLabel`). */
  promptCancelled?: string
  /** Submitted label of a `form` prompt whose fields are all empty. */
  promptFormSubmitted?: string

  // ── FormRenderer ───────────────────────────────────────────
  /** Fallback error when the submit action fails without a message. */
  formSubmissionFailed?: string
  /**
   * Auto-submit countdown notice.
   * Template — `{label}` = the submit label, `{seconds}` = seconds left.
   */
  formSubmitCountdown?: string

  // ── ActionGroupRenderer ────────────────────────────────────
  /** Fallback `aria-label` of an action group without one. */
  actionGroupLabel?: string

  // ── ArtifactRenderer ───────────────────────────────────────
  /** Fallback description of an artifact card without one. */
  artifactDescription?: string

  // ── DegradedFallback ───────────────────────────────────────
  /** Fallback caption of the degraded-renderer notice. */
  degradedCaption?: string

  // ── StreamingUIRenderer — metadata panel ───────────────────
  /** Label of the provider cell. */
  metaProvider?: string
  /** Label of the model cell. */
  metaModel?: string
  /** Label of the execution-time cell. */
  metaExecutionTime?: string
  /** Label of the cost cell. */
  metaCost?: string
  /** Label of the time-to-first-byte cell. */
  metaTtfb?: string
  /** Label of the cache-hit cell. */
  metaCached?: string

  // ── 6.20.0 — generic chrome ─────────────────
  /** Label of a generic "download" link (artifact card). */
  download?: string
  /** Placeholder shown in place of a value the renderer could not determine. */
  unknown?: string

  // ── UIResourceRenderer — table citation chips ─────────────
  /**
   * Visible placeholder kept in a table cell for a citation marker that no
   * `citationMap` resolves (empty map only — see `transformCellCitations`).
   * Template — `{id}` = the marker number.
   *
   * The former literal was French (`[réf. {id}]`).
   */
  citationUnresolved?: string

  // ── UIResourceRenderer — error / fallback chrome ──────────
  /**
   * Inline (`errorMode: 'inline-warn'`) validation chip text.
   * Template — `{type}` = the component type.
   */
  invalidComponent?: string
  /**
   * Heading of the tool-error card.
   * Template — `{tool}` = the tool name (`errorUnknownToolName` when absent).
   */
  toolErrorTitle?: string
  /**
   * Error-type line of the tool-error card.
   * Template — `{type}` = the error type.
   */
  errorTypeLabel?: string
  /** Heading above the tool-error suggestion list. */
  errorSuggestions?: string
  /** Message shown in place of a chart whose payload has no `data.datasets`. */
  chartInvalidData?: string
  /** Prefix of the unsupported-component notice (the type follows in a `<code>`). */
  unsupportedComponentType?: string

  // ── DataPreviewSection — pagination ───────────────────────
  /** Visible label of the previous-page button (glyph stays decorative). */
  previewPrev?: string
  /** Visible label of the next-page button (glyph stays decorative). */
  previewNext?: string
  /**
   * Page indicator between the two buttons.
   * Template — `{page}` = the 1-based page, `{total}` = the page count.
   */
  previewPageIndicator?: string

  // ── FormFieldRenderer ─────────────────────────────────────
  /** Inline notice while an entity reference is being resolved. */
  fieldResolving?: string

  // ── FormRenderer / ScratchpadPanel — prefill summary ──────
  /**
   * Prefill summary for a single pre-filled field.
   * Template — `{count}` = always 1, `{total}` = the field count.
   *
   * The former literal was French (`{count} champ pré-rempli sur {total}`).
   */
  formPrefilledOne?: string
  /**
   * Prefill summary for several pre-filled fields.
   * Template — `{count}` = how many, `{total}` = the field count.
   *
   * The former literal was French (`{count} champs pré-remplis sur {total}`).
   */
  formPrefilledMany?: string
  /** Busy label of the submit button while the form is submitting. */
  formSubmitting?: string
  /** Label of the form's reset button. */
  formReset?: string

  // ── GenerativeUIErrorBoundary — default fallback ──────────
  /** Heading of the default error-boundary fallback card. */
  errorBoundaryTitle?: string
  /**
   * Metadata line of the fallback card.
   * Template — `{type}` = the component type, `{id}` = its truncated id.
   * Both fall back to `unknown`.
   */
  errorBoundaryMeta?: string
  /** Label of the fallback card's retry button. */
  errorBoundaryRetry?: string

  // ── ScratchpadPanel (continued) ───────────────────────────
  /** Label of the `waiting_human` search button. */
  scratchpadSearch?: string
  /** Label of the "advance to the next step" button in the steps view. */
  scratchpadNextStep?: string
  /** Label preceding the interrogation plan summary. */
  scratchpadPlan?: string
  /** Label of the "modify this prompt" button of a prompt section. */
  scratchpadModify?: string
  /** Label of the "show details" toggle of an error section. */
  scratchpadDetails?: string
  /** Unit suffix after an action section's item count. */
  scratchpadItems?: string

  // ── VideoRenderer ─────────────────────────────────────────
  /** Fallback text of a `<video>` element the browser cannot play. */
  videoUnsupported?: string

  // ── DataPreviewSection (page info) ────────────────────────
  /** Paginated row range. Template — `{start}`, `{end}`, `{total}`. */
  previewShowingRange?: string
  /** Unpaginated row count, singular. Template — `{count}`. */
  previewRowsOne?: string
  /** Unpaginated row count, plural. Template — `{count}`. */
  previewRowsMany?: string
  /**
   * Suffix appended when the payload declares more rows than were sent.
   * Template — `{total}`. Keeps its leading space.
   */
  previewTotalSuffix?: string

  // ── ScratchpadPanel status badge ──────────────────────────
  /** Status badge — the run is still loading. */
  statusLoading?: string
  /** Status badge — an action is available to the user. */
  statusActionAvailable?: string
  /** Status badge — the run is waiting for a human answer. */
  statusYourTurn?: string
  /** Status badge — the run is processing. */
  statusProcessing?: string
  /** Status badge — the run finished. (The error badge reuses `scratchpadError`.) */
  statusComplete?: string

  // ── AgentCard status ──────────────────────────────────────
  /** Agent badge — idle. */
  agentStatusIdle?: string
  /** Agent badge — running. */
  agentStatusRunning?: string
  /** Agent badge — waiting. */
  agentStatusWaiting?: string
  /** Agent badge — done. */
  agentStatusDone?: string
  /** Agent badge — errored. */
  agentStatusError?: string

  // ── AgentHandoff ──────────────────────────────────────────
  /**
   * Fallback summary of a handoff that carries only an item count.
   * Template — `{count}`. `content.summary` still wins.
   */
  handoffItems?: string

  // ── DegradedFallback (fallback ladder) ────────────────────
  /** Truncation notice under the degraded table. Template — `{count}`. */
  degradedMoreRows?: string
  /** Caption of the chart's degraded table. */
  chartDegradedCaption?: string
  /** Notice above the chart's degraded table. Template — `{error}`. */
  chartRenderFailed?: string
  /** Caption of the degraded table shown when chart.js is missing. */
  chartQuickchartCaption?: string
  /** Caption of the graph's degraded table. */
  graphDegradedCaption?: string
  /** Notice above the graph's degraded table. Template — `{error}`. */
  graphRenderFailed?: string
  /** Fallback reason when the G6 render throws without a message. */
  graphRenderError?: string
  /** Fallback reason when the Chart.js render throws without a message. */
  chartRenderError?: string
  /** Error shown when the PNG export is unavailable in the active renderer. */
  graphPngUnsupported?: string
  /** Error shown when the PNG export throws without a message. */
  graphPngExportFailed?: string
  /** Error shown when the Leaflet bundle fails to load. */
  mapLibraryUnavailable?: string
  /** Caption of the map's degraded coordinate table. */
  mapDegradedCaption?: string
  /** Notice above the map's degraded table. Template — `{error}`. */
  mapRenderFailed?: string
  /** Fallback reason when the Leaflet render throws without a message. */
  mapRenderError?: string

  // ── Degraded / accessible table headers ───────────────────
  /** Column header of the map projection — feature type. */
  degradedColType?: string
  /** Column header of the map projection — latitude. */
  degradedColLat?: string
  /** Column header of the map projection — longitude. */
  degradedColLng?: string
  /** Column header of the map projection — property summary. */
  degradedColInfo?: string
  /** `Type` cell of a marker row in the map projection (6.20.0). */
  degradedMarker?: string
  /** `Type` cell of a GeoJSON feature without a geometry type (6.20.0). */
  degradedFeature?: string
  /** Column header of the graph projection — edge source. */
  degradedColSource?: string
  /** Column header of the graph projection — edge target. */
  degradedColTarget?: string
  /** Column header of the graph projection — node id. */
  degradedColNode?: string
  /** Column header of the graph / chart projections — label. */
  degradedColLabel?: string
  /** Fallback name of a dataset without a label. Template — `{n}`. */
  degradedSeries?: string
  /** Column header of the chart data table — series name. */
  chartTableSeries?: string
  /** Column header of the chart data table — point index. */
  chartTablePoint?: string

  // ── AutocompleteDropdown / AutocompleteFormField ──────────
  /** Hint prose between the arrow keys and the Enter key cap. */
  autocompleteHintNavigate?: string
  /** Hint prose between the Enter and Esc key caps. */
  autocompleteHintSelect?: string
  /** Hint prose after the Esc key cap. */
  autocompleteHintDismiss?: string
  /** Ghost-text hint of the completion field. */
  autocompleteTabToAccept?: string

  // ── FormFieldRenderer (entity picker) ─────────────────────
  /** Placeholder of a multi-value entity picker that already has values. */
  fieldAddMorePlaceholder?: string

  // ── ImageGalleryRenderer ──────────────────────────────────
  /** Accessible name of a gallery thumbnail. Template — `{index}`. */
  galleryViewImage?: string
  /** `alt` of a gallery image without one. Template — `{index}`. */
  galleryImageAlt?: string
  /** Noun substituted into `imageViewFullSize` when the image has no `alt`. */
  imageAltFallback?: string

  // ── Chart image fallback (quickchart) ─────────────────────
  /** `alt` / `aria-label` of the chart image when the payload has no title. */
  chartVisualizationAlt?: string
  /** `alt` / `aria-label` of the chart image with a title. Template — `{title}`. */
  chartWithTitleAlt?: string
  /** Error shown when the chart image fails to load. */
  chartLoadFailed?: string

  // ── Table pagination (continued) ──────────────────────────
  /** Page-size option that disables pagination. */
  paginationAllRows?: string

  // ── Form validation messages ──────────────────────────────
  /** Template — `{field}`. */
  fieldRequired?: string
  /** Template — `{field}`. */
  fieldMustBeChecked?: string
  /** Template — `{min}`. */
  fieldMinLength?: string
  /** Template — `{max}`. */
  fieldMaxLength?: string
  /** Value does not match the field's `pattern`. */
  fieldInvalidPattern?: string
  /** Value is not a valid email address. */
  fieldInvalidEmail?: string
  /** Value is not a number. */
  fieldInvalidNumber?: string
  /** Template — `{min}`. */
  fieldMinValue?: string
  /** Template — `{max}`. */
  fieldMaxValue?: string
  /** Template — `{min}`. */
  fieldMinDate?: string
  /** Template — `{max}`. */
  fieldMaxDate?: string
  /** Value is not one of the field's options. */
  fieldInvalidOption?: string
  /**
   * Value does not match the field's `valueFormat`. Template — `{format}`.
   * `field.valueFormatHint` still wins.
   */
  fieldInvalidFormat?: string

  // ── Locale (6.20.0) ───────────────────────────
  /**
   * BCP-47 tag used for number / date formatting and string collation in
   * library chrome and table cells (`toLocaleString`, `localeCompare`).
   * Default `'en-US'`. Former behaviour: a hardcoded `'fr-FR'` / `'fr'` in
   * table sorting, DataPreviewSection cells and map popups, and the
   * runtime's implicit locale elsewhere (non-deterministic across SSR and
   * hydration).
   */
  locale?: string

  // ── BriefingDiff ──────────────────────────────────────────
  /** Stats summary — added entries. Template — `{count}`. */
  briefingAdded?: string
  /** Stats summary — removed entries. Template — `{count}`. */
  briefingRemoved?: string
  /** Stats summary — changed entries. Template — `{count}`. */
  briefingChanged?: string

  // ── FooterRenderer ────────────────────────────────────────
  /** Number of sources in the footer. Template — `{count}`. */
  footerSources?: string

  // ── FormFieldRenderer (6.20.0) ────────────────────────
  /** Warning under a field whose `type` is unknown. Template — `{type}`. */
  fieldUnknownType?: string
  /** Trigger text of a multiselect with selections. Template — `{count}`. */
  fieldSelectedCount?: string

  // ── ScratchpadPanel (6.20.0) ──────────────────────────
  /** Error code line of the error state. Template — `{code}`. */
  scratchpadErrorCode?: string
  /** Row count of a data-source section. Template — `{count}`. */
  scratchpadResultCount?: string

  // ── UIResourceRenderer table (6.20.0) ─────────────────
  /** Suffix of the table title while rows are virtualized. Template — `{count}`. */
  tableVirtualizedRows?: string
  /** Search result count, singular. Template — `{count}`, `{total}`. */
  tableSearchResultsOne?: string
  /** Search result count, plural. Template — `{count}`, `{total}`. */
  tableSearchResultsMany?: string
  /** Server-side pagination range. Template — `{start}`, `{end}`, `{total}`. */
  tableServerPageRange?: string

  // ── UIResourceRenderer tool-error card (6.20.0) ───────
  /**
   * Text put on the clipboard by the error card's Copy button.
   * Template — `{tool}`, `{message}`.
   */
  errorCopyText?: string
  /** Tool name substituted into `errorCopyText` when the error has none. */
  errorUnknownTool?: string

  // ── StreamingUIRenderer / useStreamingUI (6.20.0) ─────
  /** Progress message before the stream starts. */
  streamInitializing?: string
  /** Progress message while connecting. */
  streamConnecting?: string
  /** Progress message while a component streams in. Template — `{type}`. */
  streamLoadingComponent?: string
  /** Progress message once the stream completed. */
  streamDashboardLoaded?: string
  /** Progress message after a stream error. Template — `{message}`. */
  streamErrorProgress?: string
  /** Error title when the stream connection fails. */
  streamConnectionFailed?: string
  /** Error message when the server answers with a non-OK status and no message. */
  streamRequestFailed?: string
  /** Error message when the server answers without a body. */
  streamEmptyResponse?: string
  /** Error message when streaming is started during SSR. */
  streamServerSide?: string
  /** Error message when the failure carries no message. */
  streamUnknownError?: string

  // ── Degraded and unavailable states shown to end users (6.20.0) ──
  /** StreamingUIRenderer error heading when streaming was started during SSR (the hook keeps the machine code `'ssr'`). */
  streamServerSideTitle?: string
  /** GraphRenderer heading when the `@antv/g6` peer is missing (the install hint below it stays English, policy P3). */
  graphUnavailable?: string
  /** MapRenderer banner when the PMTiles overlay fails to load or render. */
  mapPmtilesUnavailable?: string
  /** MapRenderer sentence appended to the PMTiles banner. */
  mapBaseMapStillShown?: string
  /** Chart error when `renderer: 'native'` is forced and chart.js is missing. */
  chartJsUnavailable?: string
  /** DegradedFallback message when chart.js is missing and the quickchart fallback is not allowed. */
  chartIframeUnavailable?: string
  /** DataPreviewSection fallback when the section content is not `{ columns, rows }`. */
  previewInvalidContent?: string
  /** Tooltip of the default citation chip button. Template — `{label}` (file name and page). */
  citationViewSource?: string
  /** ArtifactRenderer file size below 1 KB. Template — `{size}`. */
  sizeBytes?: string
  /** ArtifactRenderer file size in kilobytes. Template — `{size}`. */
  sizeKilobytes?: string
  /** ArtifactRenderer file size in megabytes. Template — `{size}`. */
  sizeMegabytes?: string
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
  ok: 'OK',
  cancel: 'Cancel',
  confirm: 'Confirm',
  submit: 'Submit',
  dismiss: 'Dismiss',
  yes: 'Yes',
  no: 'No',
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
  autocompleteSuggestions: 'Suggestions',
  autocompleteLoading: 'Loading...',
  autocompleteEmpty: 'No suggestions found',
  carouselTitle: 'Carousel',
  carouselCopy: 'Copy items (JSON)',
  mapTitle: 'Map',
  mapCopy: 'Copy markers as GeoJSON',
  chartDownloadPng: 'Download PNG',
  chartDownloadPngAria: 'Download chart as PNG',
  chartCopy: 'Copy chart data (JSON)',
  chartLoading: 'Loading chart...',
  codeSearchPlaceholder: 'Search\u2026',
  codeSearchAria: 'Search in code',
  codeDownloadAria: 'Download code as file',
  codeDownload: 'Download code',
  codeToggleWordWrap: 'Toggle word wrap',
  codeCopy: 'Copy code',
  codeTitle: 'Code',
  codeWordWrapEnable: 'Enable word wrap',
  codeWordWrapDisable: 'Disable word wrap',
  exportCsvRows: 'Export CSV ({count} rows)',
  exportJsonRows: 'Export JSON ({count} rows)',
  sortBy: 'Sort by {column}',
  removeItem: 'Remove {name}',
  filterPlaceholder: 'Filter...',
  fieldNotSupported: 'Not supported',
  fieldNoMatches: 'No matches',
  fieldGroupContainer: 'Group container',
  fieldSelectPlaceholder: 'Select...',
  fieldTagsPlaceholder: 'Type and press Enter...',
  scratchpadClose: 'Close',
  scratchpadPreview: 'Preview',
  scratchpadNoResults: 'No results for these filters',
  scratchpadModifyFilters: 'Modify filters',
  scratchpadNoFilters: 'No filters',
  // Former literal was French ('Modifier') — the library ships English
  // defaults, so this one changed on purpose.
  scratchpadEdit: 'Edit',
  scratchpadSend: 'Send',
  scratchpadShowRaw: 'Show raw SSE payload',
  scratchpadHideRaw: 'Hide raw SSE payload',
  scratchpadCommentPlaceholder: 'Add a comment...',
  scratchpadError: 'Error',
  scratchpadSource: 'Source',
  graphExport: 'Export graph',
  graphCopy: 'Copy graph (JSON)',
  graphTitle: 'Graph',
  graphExportMenu: 'Export \u25BE',
  graphDownloadPng: 'Download PNG',
  graphDownloadPngHint: 'visual snapshot',
  graphDownloadMermaid: 'Download Mermaid',
  graphDownloadMermaidHint: 'markdown / GitHub',
  graphDownloadJson: 'Download JSON',
  graphDownloadJsonHint: 'raw data',
  galleryCopy: 'Copy image URLs',
  galleryTitle: 'Gallery',
  videoCopy: 'Copy video URL',
  videoTitle: 'Video',
  sourceDetected: 'Detected from message',
  sourceInferred: 'Inferred from context',
  sourcePrevious: 'Previously provided',
  lightboxLabel: 'Image lightbox',
  lightboxClose: 'Close lightbox',
  lightboxPrevious: 'Previous image',
  lightboxNext: 'Next image',
  modalClose: 'Close modal',
  copy: 'Copy',
  copyMetric: 'Copy metric',
  copyText: 'Copy text',
  copyErrorDetails: 'Copy error details',
  tableTitle: 'Table',
  tableCopyCsv: 'Copy table (CSV)',
  tableExport: 'Export table',
  tableClearSearch: 'Clear search',
  tableAriaLabel: 'Data table',
  // Former literal was French ('Rechercher dans le tableau...') — the
  // library ships English defaults, so this one changed on purpose.
  tableSearchPlaceholder: 'Search the table...',
  tableCopyTsv: 'Copy TSV',
  tableDownloadCsv: 'Download CSV',
  tableDownloadJson: 'Download JSON',
  perPageSuffix: '/ page',
  imageAlt: 'Image',
  imageViewFullSize: 'View full size: {alt}',
  iframeTitle: 'Embedded content',
  linkLabel: 'Link',
  linkOpensInNewTab: '{label}: {description} (opens in new tab)',
  validationWarning: 'Component validation warning',
  resourceTitle: 'Resource',
  chartError: 'Chart Error',
  validationError: 'Validation Error',
  validationUnknownError: 'Unknown validation error',
  errorUnknown: 'Unknown error',
  errorUnknownToolName: 'Unknown',
  errorToolExecution: 'An error occurred during tool execution',
  verifiedTitle: 'Verified against source data',
  verifiedAria: 'verified',
  unverifiedAria: 'unverified',
  verifiedNotFound: 'Not found in source data',
  verifiedNotFoundClosest: 'Not found in source data. Closest: {closest} ({pct}% off)',
  // Former literal was French ('[non v\u00E9rifi\u00E9]') — see above.
  verifiedStripLabel: '[unverified]',
  verifiedConfidence: '{pct}% verified',
  verifiedUnverifiedCount: '({count} unverified)',
  promptLoadingPreview: 'Loading preview...',
  promptConfirmed: 'Confirmed',
  promptCancelled: 'Cancelled',
  promptFormSubmitted: 'Form submitted',
  formSubmissionFailed: 'Submission failed',
  formSubmitCountdown: '{label} in {seconds}s...',
  actionGroupLabel: 'Action group',
  artifactDescription: 'Generated artifact',
  degradedCaption: 'Showing the underlying data \u2014 the interactive view is unavailable.',
  metaProvider: 'Provider',
  metaModel: 'Model',
  metaExecutionTime: 'Execution Time',
  metaCost: 'Cost',
  metaTtfb: 'TTFB',
  metaCached: 'Cached',
  download: 'Download',
  unknown: 'unknown',
  // Former literal was French ('[r\u00E9f. {id}]') — see above.
  citationUnresolved: '[ref. {id}]',
  invalidComponent: 'Invalid {type}',
  toolErrorTitle: 'Tool Error: {tool}',
  errorTypeLabel: 'Type: {type}',
  errorSuggestions: 'Suggestions:',
  chartInvalidData: 'Invalid chart data: missing data.datasets',
  unsupportedComponentType: 'Unsupported component type:',
  previewPrev: 'Prev',
  previewNext: 'Next',
  previewPageIndicator: 'Page {page} / {total}',
  fieldResolving: 'Resolving...',
  // Former literals were French ('{count} champ(s) pr\u00E9-rempli(s) sur {total}').
  formPrefilledOne: '{count} field pre-filled out of {total}',
  formPrefilledMany: '{count} fields pre-filled out of {total}',
  formSubmitting: 'Submitting...',
  formReset: 'Reset',
  errorBoundaryTitle: 'Component Failed to Render',
  errorBoundaryMeta: 'Type: {type} | ID: {id}...',
  errorBoundaryRetry: 'Retry Rendering',
  scratchpadSearch: 'Search',
  scratchpadNextStep: 'Next',
  scratchpadPlan: 'Plan:',
  scratchpadModify: 'Modify',
  scratchpadDetails: 'Details',
  scratchpadItems: 'items',
  videoUnsupported: 'Your browser does not support the video tag.',
  previewShowingRange: 'Showing {start}–{end} of {total}',
  previewRowsOne: '{count} row',
  previewRowsMany: '{count} rows',
  previewTotalSuffix: ' ({total} total)',
  statusLoading: 'Loading...',
  statusActionAvailable: 'Action available',
  statusYourTurn: 'Your turn',
  statusProcessing: 'Processing...',
  statusComplete: 'Complete',
  agentStatusIdle: 'Idle',
  agentStatusRunning: 'Running',
  agentStatusWaiting: 'Waiting',
  agentStatusDone: 'Done',
  agentStatusError: 'Error',
  handoffItems: '{count} items',
  degradedMoreRows: '+{count} more rows not shown.',
  chartDegradedCaption:
    'Showing the chart data as a table — the interactive chart is unavailable.',
  chartRenderFailed: 'Chart rendering failed: {error}',
  chartQuickchartCaption: 'Showing the chart data as a table.',
  graphDegradedCaption:
    'Showing the graph data as a table — the interactive view is unavailable.',
  graphRenderFailed: 'Graph rendering failed: {error}',
  graphRenderError: 'Failed to render graph',
  chartRenderError: 'Chart rendering failed',
  graphPngUnsupported: 'PNG export not supported in current renderer mode',
  graphPngExportFailed: 'PNG export failed',
  mapLibraryUnavailable: 'Map library could not be loaded.',
  mapDegradedCaption:
    'Showing the map data as a coordinate table — the interactive map is unavailable.',
  mapRenderFailed: 'Map rendering failed: {error}',
  mapRenderError: 'Failed to render map',
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
  autocompleteHintNavigate: ' to navigate, ',
  autocompleteHintSelect: ' to select, ',
  autocompleteHintDismiss: ' to dismiss',
  autocompleteTabToAccept: 'Tab to accept',
  fieldAddMorePlaceholder: 'Add more...',
  galleryViewImage: 'View image {index}',
  galleryImageAlt: 'Image {index}',
  imageAltFallback: 'image',
  chartVisualizationAlt: 'Chart visualization',
  chartWithTitleAlt: 'Chart: {title}',
  chartLoadFailed: 'Failed to load chart',
  paginationAllRows: 'All',
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

  // ── 6.20.0 ─────────────────────────────────────
  // DEFAULT CHANGE: formatting / collation used 'fr-FR' / 'fr' (or the
  // runtime's implicit locale) — now one explicit, overridable tag.
  locale: 'en-US',
  briefingAdded: '+{count} added',
  briefingRemoved: '{count} removed',
  briefingChanged: '{count} changed',
  footerSources: '{count} sources',
  degradedMarker: 'marker',
  degradedFeature: 'feature',
  fieldUnknownType: 'Unknown field type: {type}',
  fieldSelectedCount: '{count} selected',
  scratchpadErrorCode: 'Code: {code}',
  scratchpadResultCount: '{count} results',
  tableVirtualizedRows: '(virtualized: {count} rows)',
  tableSearchResultsOne: '{count} result on {total}',
  tableSearchResultsMany: '{count} results on {total}',
  tableServerPageRange: 'Showing {start} - {end} of {total}',
  errorCopyText: 'Error in {tool}: {message}',
  errorUnknownTool: 'unknown tool',
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
  streamServerSideTitle: 'Streaming unavailable',
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

  // ── 6.21.0 — iframe COEP fallback ──────────────────────────
  iframeOpenInNewTab: 'Open in a new tab',
}

/**
 * Substitutes `{name}` placeholders in a chrome string template.
 *
 * Lives in `../utils/format-string` — a runtime-free module — so the pure
 * adapters under `src/adapters` can interpolate their own templates without
 * importing `solid-js`. Re-exported here (and from the root barrel) so every
 * existing import path keeps working.
 */
export { formatMCPUIString } from '../utils/format-string'

export const MCPUIStringsContext = createContext<MCPUIStrings>(DEFAULT_MCPUI_STRINGS)

/**
 * Reads the active chrome strings. Returns `DEFAULT_MCPUI_STRINGS` when no
 * `<MCPUIStringsProvider>` is mounted above — every renderer works
 * standalone with English chrome.
 */
const resolvedLocales = new Map<string, string>()

/**
 * Returns `locale` in canonical BCP-47 form, or `DEFAULT_MCPUI_STRINGS.locale`
 * (`'en-US'`) when it is missing or not a valid tag. Renderers pass the result
 * straight to `Intl` / `toLocaleString` / `localeCompare`, which throw a
 * `RangeError` on an invalid tag such as `'not_a_locale'`.
 *
 * @since v6.20.0
 */
export function resolveMCPUILocale(locale: unknown): string {
  const fallback = DEFAULT_MCPUI_STRINGS.locale
  if (typeof locale !== 'string' || locale.trim() === '') return fallback
  const cached = resolvedLocales.get(locale)
  if (cached) return cached
  let resolved = fallback
  try {
    const [canonical] = Intl.getCanonicalLocales(locale)
    if (canonical) resolved = canonical
  } catch {
    resolved = fallback
  }
  if (resolvedLocales.size < 64) resolvedLocales.set(locale, resolved)
  return resolved
}

export function useMCPUIStrings(): Required<MCPUIStrings> {
  const context = useContext(MCPUIStringsContext)
  // The last source wins: `locale` is always a valid tag, whatever the provider passed.
  return mergeProps(DEFAULT_MCPUI_STRINGS, context, {
    get locale() {
      return resolveMCPUILocale(context?.locale)
    },
  })
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
