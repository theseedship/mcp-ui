/**
 * UI Resource Renderer Component
 * Phase 0: Foundation with iframe sandbox and composite grid support
 */

import { Component, createSignal, Show, For, createMemo, createEffect, onMount, onCleanup } from 'solid-js'
import { isServer } from 'solid-js/web'
import { sanitizeHtml, canSanitizeHtml, SANITIZE_PROFILES } from '../utils/sanitize-html'
import { escapeHtml } from '../utils/escape-html'
import { safeUrl } from '../utils/safe-url'
import { SafeHtml } from './SafeHtml'
import type { UIComponent, UILayout, RendererError, TableVirtualizeOptions } from '../types'
import { validateComponent, DEFAULT_RESOURCE_LIMITS, getIframeSandbox, isTrustedIframeDomain } from '../services/validation'
import { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'
import { markRenderStart, markRenderEnd, PERF_PREFIX } from '../utils/perf'
import { isDebugEnabled } from '../utils/logger'
import { getUiResourceStableKey } from '../utils/stable-key'
import {
  _registerMount,
  _unregisterMount,
  getDuplicateMountReporter,
  type DuplicateMountInfo,
} from '../utils/duplicate-mount-registry'
import { useTelemetry } from '../context/MCPUITelemetryContext'
import {
  DEFAULT_MCPUI_STRINGS,
  formatMCPUIString,
  useMCPUIStrings,
} from '../context/MCPUIStringsContext'
import { useMCPUIConfig } from '../context/MCPUIConfigContext'
import { shouldSetCredentialless } from '../utils/iframe-coep'
import { IframeFallbackLink } from './IframeFallbackLink'

/**
 * How `<UIResourceRenderer>` reacts when `validateComponent()` rejects a
 * component (v5.4.0).
 *
 * - `'block'`  : full-slot red error card (default — backward compatible)
 * - `'inline-warn'` : compact yellow chip in the slot, tooltip carries the
 *                    error message — keeps the surrounding layout clean
 *                    (e.g. inside a chat message)
 * - `'silent'` : render nothing in the slot; `onError` still fires so the
 *                consumer can log/alert
 *
 * Runtime errors caught by `<GenerativeUIErrorBoundary>` are NOT affected by
 * this prop — they always show the boundary's fallback UI.
 */
export type ValidationErrorMode = 'block' | 'inline-warn' | 'silent'
import { GridRenderer } from './GridRenderer'
import { FooterRenderer } from './FooterRenderer'
import { CarouselRenderer } from './CarouselRenderer'
import { ArtifactRenderer } from './ArtifactRenderer'
import { FormRenderer } from './FormRenderer'
import { ModalRenderer } from './ModalRenderer'
import { ActionGroupRenderer } from './ActionGroupRenderer'
import { ChartJSRenderer, isChartJSAvailable } from './ChartJSRenderer'
import { DegradedFallback } from './DegradedFallback'
import { chartToDegradedTable } from '../utils/degraded-projections'
import { ImageGalleryRenderer } from './ImageGalleryRenderer'
import { VideoRenderer } from './VideoRenderer'
import { CodeBlockRenderer } from './CodeBlockRenderer'
import { MapRenderer } from './MapRenderer'
import { GraphRenderer } from './GraphRenderer'
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper'
import { PortalDropdownMenu } from './PortalDropdownMenu'
import { RenderProvider } from './RenderContext'
import { useAction } from '../hooks/useAction'
import { createResponsiveGrid } from '../hooks/createResponsiveGrid'
import { marked } from 'marked'

/**
 * Copy button component with visual feedback
 */
function CopyButton(props: { getText: () => string; title?: string; position?: 'top-right' | 'bottom-right' }) {
  const strings = useMCPUIStrings()
  const [copied, setCopied] = createSignal(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const positionClasses = () => {
    return props.position === 'bottom-right'
      ? 'absolute -right-2 -bottom-3'
      : 'absolute right-2 top-2'
  }

  return (
    <button
      onClick={handleCopy}
      class={`${positionClasses()} opacity-60 hover:opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm z-10`}
      title={props.title || strings.copy}
      aria-label={props.title || strings.copy}
      data-mcp-ui-action="copy"
      type="button"
    >
      <Show
        when={!copied()}
        fallback={
          <svg class="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        }
      >
        <svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </Show>
    </button>
  )
}

/**
 * Props for UIResourceRenderer
 */
export interface UIResourceRendererProps {
  /**
   * Single component or full layout to render
   */
  content: UIComponent | UILayout

  /**
   * Lazy loading (default: true)
   */
  lazyLoad?: boolean

  /**
   * Error callback
   */
  onError?: (error: RendererError) => void

  /**
   * Custom CSS class
   */
  class?: string

  /**
   * How to react when a component fails `validateComponent()` (v5.4.0).
   * Defaults to `'block'` (replaces the slot with a red error card —
   * the pre-v5.4.0 behavior).
   *
   * @see ValidationErrorMode
   */
  errorMode?: ValidationErrorMode

  /**
   * Visibility behavior of the inline expand button shipped by every
   * renderer wrapped in `<ExpandableWrapper>` (v6.3.1 — closes axe 4 of
   * the deposium handoff).
   *   - `'hover'` (default) : button fades in on hover. Backwards-compatible.
   *   - `'always-visible'` : button visible at rest. Use this on chat
   *     surfaces / touch surfaces where the hover affordance is hidden.
   *
   * Forwarded to all internal renderers : table, chart (Chart.js path),
   * graph, map, video, carousel, image-gallery, code.
   */
  toolbarVariant?: 'hover' | 'always-visible'

  /**
   * Allow the chart renderer to fall back to the **quickchart.io** image API
   * when the native `chart.js` peer is unavailable (v6.14.0, audit P1.7).
   *
   * The quickchart fallback sends the **entire chart config** (labels + data)
   * to an external service inside an image URL — an implicit network call that
   * can leak potentially sensitive data and behaves differently offline. For a
   * public, LLM/connector-driven package the safe default is **off**: when
   * Chart.js is missing (or `renderer: 'iframe'` is requested) the chart
   * **degrades to a local data table** and emits a `render:error` telemetry
   * signal instead of silently calling out.
   *
   * This is a **host-level** trust decision, deliberately NOT a payload field
   * (a payload could otherwise opt itself in). Set it to `true` only when the
   * data is non-sensitive and an external image render is acceptable.
   *
   * @default false
   */
  allowQuickchartFallback?: boolean

  /**
   * Per-instance hook fired when this renderer mounts a content key that
   * is already mounted elsewhere in the document (v6.5.0 — closes Demande 2
   * of `BRIEF-MCPUI-2026-05-10.md`).
   *
   * The key comes from `getUiResourceStableKey(content)` — `content.id` if
   * provided, else a content hash. The reporter fires every time the
   * concurrent mount count crosses 2+ ; consumers decide what to do
   * (`console.warn`, telemetry beacon, debug overlay, …). The renderer
   * never deduplicates visually on its own.
   */
  onMountDuplicate?: (info: DuplicateMountInfo) => void

  /**
   * When `true`, log duplicate mounts to `console.warn` from this instance
   * even when the global `isDebugEnabled()` flag is off. Use to opt-in to
   * console noise on a single suspect surface without flipping the global
   * debug switch (v6.5.0).
   */
  debugDuplicateMounts?: boolean
}

/**
 * Render a single chart component in a sandboxed iframe
 */
/**
 * Smart Chart Renderer - Sprint 4
 * Supports native Chart.js or Quickchart.io iframe fallback
 */
function ChartRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
  toolbarVariant?: 'hover' | 'always-visible'
  /** Host opt-in for the external quickchart.io fallback (audit P1.7). */
  allowQuickchartFallback?: boolean
}) {
  const strings = useMCPUIStrings()
  const [useNative, setUseNative] = createSignal(false)
  const [iframeUrl, setIframeUrl] = createSignal<string>()
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  // Set when Chart.js is unavailable AND the host has not opted into the
  // external quickchart fallback — we then degrade to a local data table
  // rather than calling out to quickchart.io (audit P1.7).
  const [degraded, setDegraded] = createSignal(false)
  const telemetry = useTelemetry()

  const params = () => props.component.params as any
  const rendererPref = () => params()?.renderer || 'auto'
  const allowQuickchart = () => props.allowQuickchartFallback === true
  /** `alt` / `aria-label` of the quickchart image — localized chrome. */
  const chartImageAlt = () =>
    params()?.title
      ? formatMCPUIString(strings.chartWithTitleAlt, { title: String(params().title) })
      : strings.chartVisualizationAlt

  // Emit a clear, observable signal whenever we decline the external fallback.
  const signalBlockedFallback = (reason: string) => {
    setDegraded(true)
    setIsLoading(false)
    const message = `Chart degraded to a data table: ${reason}`
    telemetry?.dispatch({
      type: 'render:error',
      errorMessage: message,
      id: props.component.id ?? '',
      componentType: 'chart',
      ts: Date.now(),
    })
  }

  // Guard: if data or datasets missing, show error instead of crashing Chart.js
  if (!params()?.data?.datasets) {
    return (
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p class="text-red-500 dark:text-red-400 text-sm">{strings.chartInvalidData}</p>
      </div>
    )
  }

  // Check renderer preference and Chart.js availability
  createEffect(async () => {
    const pref = rendererPref()

    if (pref === 'iframe') {
      // Explicit external render requested. Honor it only when the host has
      // opted in (audit P1.7) — otherwise degrade to a local table.
      setUseNative(false)
      if (allowQuickchart()) {
        buildIframeUrl()
      } else {
        signalBlockedFallback(
          "renderer: 'iframe' requires the external quickchart.io service; " +
            'set allowQuickchartFallback on the host to enable it.'
        )
      }
    } else if (pref === 'native') {
      // Force native mode - will show error if Chart.js not available
      const available = await isChartJSAvailable()
      if (available) {
        setUseNative(true)
        setIsLoading(false)
      } else {
        setError(strings.chartJsUnavailable)
        setIsLoading(false)
      }
    } else {
      // Auto mode - use native if available. When Chart.js is missing, only
      // call out to quickchart.io if the host opted in; otherwise degrade to a
      // local data table instead of an implicit external network call (P1.7).
      const available = await isChartJSAvailable()
      if (available) {
        setUseNative(true)
        setIsLoading(false)
      } else if (allowQuickchart()) {
        setUseNative(false)
        buildIframeUrl()
      } else {
        setUseNative(false)
        signalBlockedFallback('Chart.js peer is not installed.')
      }
    }
  })

  const buildIframeUrl = () => {
    const chartParams = params()
    if (!chartParams) return

    // Build Quickchart URL
    const chartConfig = {
      type: chartParams.type,
      data: chartParams.data,
      options: {
        ...chartParams.options,
        responsive: true,
        maintainAspectRatio: false,
      },
    }

    // Encode chart configuration for Quickchart API
    const configStr = encodeURIComponent(JSON.stringify(chartConfig))
    const url = `https://quickchart.io/chart?c=${configStr}&width=500&height=300&devicePixelRatio=2`

    setIframeUrl(url)
    setIsLoading(false)
  }

  // Reactive switch between native Chart.js and iframe fallback
  // Must use <Show> — signals in component body are not reactive in SolidJS
  return (
    <Show
      when={useNative()}
      fallback={
        <div class="relative w-full h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* P1.7 — Chart.js missing and quickchart fallback not allowed:
              show the chart data as a local table instead of an implicit
              call to quickchart.io. */}
          <Show when={degraded()}>
            <div class="p-3">
              <DegradedFallback
                message={strings.chartIframeUnavailable}
                caption={strings.chartQuickchartCaption}
                {...chartToDegradedTable(params() ?? {}, {
                  series: strings.degradedSeries,
                })}
              />
            </div>
          </Show>

          <Show when={isLoading()}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          </Show>

          <Show when={error()}>
            <div class="absolute inset-0 flex items-center justify-center p-4">
              <div class="text-center">
                <p class="text-red-600 dark:text-red-400 text-sm font-medium">{strings.chartError}</p>
                <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">{error()}</p>
              </div>
            </div>
          </Show>

          <Show when={iframeUrl() && !error()}>
            <div class="w-full h-full p-4">
              <Show when={params()?.title}>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {params()?.title}
                </h3>
              </Show>
              <div class="w-full h-full" role="img" aria-label={chartImageAlt()}>
                <img
                  src={iframeUrl()}
                  alt={chartImageAlt()}
                  class="w-full h-auto max-h-[300px] object-contain"
                  onError={() => {
                    setError(strings.chartLoadFailed)
                    props.onError?.({
                      type: 'render',
                      message: 'Chart rendering failed',
                      componentId: props.component.id,
                    })
                  }}
                />
              </div>
            </div>
          </Show>
        </div>
      }
    >
      <ChartJSRenderer
        component={props.component}
        toolbarVariant={props.toolbarVariant}
        onError={(err) => props.onError?.({
          type: 'render',
          message: err.message,
          componentId: props.component.id,
        })}
      />
    </Show>
  )
}

/**
 * Smart cell value renderer that handles markdown links and other formats
 */
/** Class list carried by every `<mark>` that `highlightQuery` injects. */
const HIGHLIGHT_MARK_CLASS = 'bg-yellow-200 dark:bg-[#222F49] text-inherit rounded px-0.5'

/**
 * Wrap matches of `query` in `<mark>` tags within an HTML string.
 * Case-insensitive. v6.19.0 — DOM-based.
 *
 * The previous implementation tokenized the markup with a regex, which put
 * `<mark>` *inside* HTML entities and attribute text: searching `amp` in a
 * cell containing `&amp;` spliced a tag through the entity and corrupted it.
 * Parsing into a detached `<template>` and walking only text nodes makes both
 * classes of corruption impossible — attribute values are never visited, and
 * an entity is a single character by the time the walker sees it.
 *
 * The input is always post-sanitize markup (see `sanitize-html`), and a
 * `<template>`'s content is an inert document fragment, so parsing here
 * neither runs script nor fetches anything.
 *
 * No-DOM environments (SSR) return the html unchanged.
 */
export function highlightQuery(html: string, query: string): string {
  const q = query.trim()
  if (!q) return html
  if (typeof document === 'undefined') return html

  // Escape regex metacharacters
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')

  const template = document.createElement('template')
  template.innerHTML = html

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text)
  }

  for (const node of textNodes) {
    const text = node.data
    regex.lastIndex = 0
    if (!regex.test(text)) continue

    regex.lastIndex = 0
    const fragment = document.createDocumentFragment()
    let cursor = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match[0] === '') {
        regex.lastIndex++
        continue
      }
      if (match.index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)))
      }
      const mark = document.createElement('mark')
      mark.className = HIGHLIGHT_MARK_CLASS
      mark.textContent = match[0]
      fragment.appendChild(mark)
      cursor = match.index + match[0].length
    }
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)))
    }
    node.parentNode?.replaceChild(fragment, node)
  }

  return template.innerHTML
}

/**
 * Citation context — opt-in input to `renderCellValue` (v5.7.0).
 *
 * When passed, `[N]`, `Citation [N]`, `[CITATION N]` and `[📄 CITATION N]`
 * markers in the cell text are normalized then replaced with chip HTML.
 * Chips carry `data-citation-page`, `data-citation-doc`, and
 * `data-citation-verified` attributes (already in the DOMPurify whitelist
 * since v5.6.0) so a host's `target.closest('[data-citation-page]')`
 * delegated click handler routes the click to the source-doc panel.
 *
 * See `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md`.
 */
export interface CitationCtx {
  /**
   * `Record<id, mapping>` keyed by the citation marker number (string-keyed
   * because JSON serialization always produces strings; the runtime call
   * sites accept either number or string ids and normalize internally).
   */
  map: Record<string | number, { page: number | string; file?: string; file_id?: number | string }>
  /**
   * Optional override returning sanitized chip HTML for one marker. Wins
   * over the default `defaultCitationChip` shape. Function inputs are
   * intentionally `any`-loose so consumers can swap shapes (e.g. web
   * citations vs doc citations) without subtyping the entry shape here.
   */
  render?: (
    id: number,
    mapping: { page: number | string; file?: string; file_id?: number | string } | undefined
  ) => string
  /**
   * Template for the visible placeholder kept when `map` is EMPTY and a
   * marker therefore resolves to nothing — `{id}` is the marker number.
   *
   * Optional: `transformCellCitations` falls back to
   * `DEFAULT_MCPUI_STRINGS.citationUnresolved` (`'[ref. {id}]'`). The
   * renderers populate it from `strings.citationUnresolved`, so a host with a
   * `<MCPUIStringsProvider>` gets its own wording; a direct
   * `renderCellValue(value, ctx)` call may pass it explicitly.
   *
   * @since v6.20.0 — the hardcoded placeholder used to be French.
   */
  unresolvedLabel?: string
  /**
   * Tooltip template of the default citation chip button — `{label}` is the
   * file name and page. Falls back to `DEFAULT_MCPUI_STRINGS.citationViewSource`;
   * the renderers populate it from `strings.citationViewSource`.
   *
   * @since v6.20.0
   */
  viewSourceLabel?: string
}

/**
 * Default chip HTML emitted by `transformCellCitations` when no
 * `citationRender` override is supplied. Neutral Tailwind classes — hosts
 * can override visual styling via the `.citation-ref` CSS class without
 * passing a render override.
 */
function defaultCitationChip(
  pageNum: number | string,
  fileName: string,
  verified = true,
  viewSourceLabel: string = DEFAULT_MCPUI_STRINGS.citationViewSource
): string {
  const safeDocName = encodeURIComponent(fileName || '')
  const label = fileName ? `${fileName} - ${pageNum}` : `${pageNum}`
  if (!verified) {
    return `<span class="citation-ref inline-flex items-center gap-0.5 align-middle opacity-60"><span class="text-gray-500 line-through">[${label}]</span></span>`
  }
  return [
    '<span class="citation-ref inline-flex items-center gap-0.5 align-middle">',
    `<span class="text-gray-500">[${label}]</span>`,
    '<button class="inline-flex items-center ml-0.5 px-1 py-0.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-teal-500 rounded cursor-pointer transition-colors align-middle"',
    ` data-citation-page="${pageNum}"`,
    ` data-citation-doc="${safeDocName}"`,
    ' data-citation-verified="true"',
    ` title="${escapeHtml(formatMCPUIString(viewSourceLabel, { label }))}">`,
    '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    '</button>',
    '</span>',
  ].join('')
}

/**
 * Normalize bare `[N]`, `Citation [N]`, `[CITATION N]` markers to canonical
 * `[📄 CITATION N]` then replace each canonical marker with chip HTML.
 *
 * Negative lookbehind `(?<![p.])` skips `[p.5]` (page form). Negative
 * lookahead `(?!\()` skips `[text](url)` markdown links.
 */
function transformCellCitations(text: string, ctx: CitationCtx): string {
  // 1. normalize bare [N] / Citation [N] / [CITATION N] → [📄 CITATION N]
  let out = text.replace(/(?<![p.])\[(\d{1,2})\](?!\()/g, '[📄 CITATION $1]')
  out = out.replace(/\bCitations?\s*\[(\d+)\]/gi, '[📄 CITATION $1]')
  out = out.replace(/\[CITATION\s+(\d+)\]/gi, '[📄 CITATION $1]')

  // 2. replace each canonical marker with chip HTML
  return out.replace(
    /[【[]\s*📄\s*CITATION\s*(\d+)\s*[】\]]/gi,
    (_m, idStr) => {
      const id = parseInt(idStr, 10)
      const mapping = ctx.map[id] ?? ctx.map[String(id)]
      if (ctx.render) return ctx.render(id, mapping)
      if (mapping) return defaultCitationChip(mapping.page, mapping.file ?? '', true, ctx.viewSourceLabel)
      // Unresolved id: when the map is non-empty (consumer claims to know
      // the citations), drop silently — it's likely an LLM hallucination.
      // When the map is empty (consumer didn't supply one), preserve a
      // human-visible placeholder so the marker isn't lost.
      return Object.keys(ctx.map).length > 0
        ? ''
        : formatMCPUIString(ctx.unresolvedLabel ?? DEFAULT_MCPUI_STRINGS.citationUnresolved, {
            id,
          })
    }
  )
}

export function renderCellValue(value: any, citationCtx?: CitationCtx): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '-'
  }

  // Handle object with url/name properties (common source/link format from LLM)
  if (typeof value === 'object' && value !== null) {
    // Check for link-like objects: { url: "...", name/label/title: "..." }
    if (value.url) {
      const label = value.name || value.label || value.title || value.url
      const sanitizedLabel = sanitizeHtml(String(label))
      const sanitizedUrl = sanitizeHtml(String(value.url))
      const anchor = `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${sanitizedLabel}</a>`
      // Re-sanitize the composed anchor: sanitizing the bare `url` string
      // leaves quotes and `javascript:` untouched, so a crafted value could
      // otherwise break out of the attribute or smuggle a scriptable href.
      return sanitizeHtml(anchor, SANITIZE_PROFILES.cellLink)
    }
    // Fallback: extract meaningful text from object properties
    if (value.name || value.label || value.title) {
      return sanitizeHtml(String(value.name || value.label || value.title))
    }
    // Last resort: JSON stringify for debugging (better than [object Object]).
    // The result is bound into an `innerHTML` sink by the table renderers, so
    // it must be escaped — `{ details: '<img src=x onerror=alert(1)>' }` used
    // to execute.
    try {
      return escapeHtml(JSON.stringify(value))
    } catch {
      return '-'
    }
  }

  // Convert to string
  let strValue = String(value)

  // Clean up "undefined" patterns from backend data
  // Pattern 1: "Text – undefined" or "Text - undefined" → "Text"
  strValue = strValue.replace(/\s*[–-]\s*undefined\s*$/gi, '')
  // Pattern 2: "undefined – Text" or "undefined - Text" → "Text"
  strValue = strValue.replace(/^undefined\s*[–-]\s*/gi, '')
  // Pattern 3: standalone "undefined" → "-"
  if (strValue.trim().toLowerCase() === 'undefined') {
    return '-'
  }
  // Pattern 4: empty string after cleanup → "-"
  if (strValue.trim() === '') {
    return '-'
  }

  // Detect and convert markdown links: [text](url) — runs FIRST because
  // the citation transform's negative lookahead `(?!\()` would also skip
  // these, but handling them here keeps the existing return path.
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  if (markdownLinkRegex.test(strValue)) {
    // Replace all markdown links with HTML links
    const htmlValue = strValue.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>'
    )
    return sanitizeHtml(htmlValue, SANITIZE_PROFILES.cellLink)
  }

  // v5.7.0 — citation transform (opt-in). Replaces `[N]` style markers
  // with chip HTML carrying `data-citation-*` attrs. Runs BEFORE the
  // hasHtml / hasMarkdown branches so the resulting string flows through
  // them naturally (chips are inline HTML; surviving markdown like
  // **bold** is preserved by marked.parse since marked passes inline HTML
  // through unchanged).
  if (citationCtx) {
    strValue = transformCellCitations(strValue, citationCtx)
  }

  // Markdown markers WITHOUT square brackets — `[` and `]` were excluded
  // because chip labels (`[Doc - 5]`) and unresolved-marker fallbacks
  // (`[réf. 12]`) would otherwise force a marked.parse for cells that
  // have no actual markdown. The hasMarkdown check ALSO runs before
  // hasHtml so that mixed cells (`**bold** [1]` → `**bold** <chip>`)
  // get marked first; marked preserves the inline chip HTML, then
  // DOMPurify keeps the citation attrs via the extended whitelist.
  const hasMarkdown = /[*_`#]/.test(strValue)
  if (hasMarkdown) {
    const parsed = marked.parse(strValue, { async: false }) as string
    return sanitizeHtml(parsed, SANITIZE_PROFILES.cellMarkdown)
  }

  // Detect raw HTML in cell values (e.g. <a href="..." data-citation-page="5">text</a>)
  // This handles cases where cell data comes from innerHTML extraction
  // OR where the citation transform above injected chip HTML.
  const hasHtml = /<[a-z][\s\S]*>/i.test(strValue)
  if (hasHtml) {
    return sanitizeHtml(strValue, SANITIZE_PROFILES.cellHtml)
  }

  // Plain text — sanitize to prevent XSS via innerHTML
  return sanitizeHtml(strValue)
}

/**
 * Render a table component
 * Sprint Ultimate U.3: Added virtualization support for large datasets
 */
function TableRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
  toolbarVariant?: 'hover' | 'always-visible'
}) {
  const tableParams = props.component.params as any
  let scrollContainerRef: HTMLDivElement | undefined
  const strings = useMCPUIStrings()

  // v5.7.0 — opt-in citation chip rendering inside cells. When `citationMap`
  // is present in params, build a CitationCtx once and thread it through
  // every `renderCellValue` call below. Absent → undefined → cells render
  // as before (regression-safe).
  const citationCtx: CitationCtx | undefined = tableParams.citationMap
    ? {
        map: tableParams.citationMap,
        render: tableParams.citationRender,
        // Getters, not snapshots: cells read the provider's current wording.
        get unresolvedLabel() {
          return strings.citationUnresolved
        },
        get viewSourceLabel() {
          return strings.citationViewSource
        },
      }
    : undefined

  // ─── Client-side sorting (v4.0.5) ────────────────────────
  const allRows = () => tableParams.rows || []
  const columns = () => tableParams.columns || []
  const [sortKey, setSortKey] = createSignal<string | null>(null)
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc' | null>(null)

  const handleSort = (key: string) => {
    if (sortKey() === key) {
      if (sortDir() === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setClientPage(0)
  }

  const sortedRows = createMemo(() => {
    const r = allRows()
    const key = sortKey()
    const dir = sortDir()
    if (!key || !dir) return r
    const col = columns().find((c: any) => c.key === key)
    const isNum = col?.type === 'number' || (r.length > 0 && typeof r[0]?.[key] === 'number')
    return [...r].sort((a: any, b: any) => {
      const va = a[key], vb = b[key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      let cmp: number
      if (isNum) {
        cmp = (Number(va) || 0) - (Number(vb) || 0)
      } else {
        cmp = String(va).localeCompare(String(vb), strings.locale, { sensitivity: 'base' })
      }
      return dir === 'desc' ? -cmp : cmp
    })
  })

  const sortIndicator = (key: string) => {
    if (sortKey() !== key) return '\u2195'
    return sortDir() === 'asc' ? '\u2191' : '\u2193'
  }

  // ─── Client-side search filter (v4.3.3) ─────────────────────
  const [searchQuery, setSearchQuery] = createSignal('')
  const [debouncedQuery, setDebouncedQuery] = createSignal('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  // v6.1.0 — search visibility :
  //   - undefined / true → always shown (new default, was conditional on >10 rows)
  //   - false            → hidden (explicit opt-out, unchanged)
  // Rationale: even small tables benefit from search in a chat / dashboard
  // context where users scan many tables across messages. Backward-compat
  // for anyone who explicitly disabled.
  const isSearchable = () => tableParams.searchable !== false
  const searchPlaceholder = () => tableParams.searchPlaceholder || strings.tableSearchPlaceholder

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      setDebouncedQuery(value)
      setClientPage(0)
    }, 200)
  }

  /** Normalize string for accent-insensitive matching */
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const filteredRows = createMemo(() => {
    const q = normalize(debouncedQuery())
    if (!q) return sortedRows()
    const cols = columns()
    return sortedRows().filter((row: any) =>
      cols.some((col: any) => {
        const val = row[col.key]
        if (val == null) return false
        return normalize(String(val)).includes(q)
      })
    )
  })

  // ─── Client-side pagination (v4.0.4, context-aware v4.3.4, selector v4.3.7) ─────
  // This renderer renders its own `<ExpandableWrapper>` below, so the
  // wrapper's context provider sits UNDER us: `useExpanded()` here only sees
  // an outer wrapper (always false when the table is self-wrapped — the
  // fullscreen page size never applied before v6.19.0). The wrapper reports
  // its own state through `onExpandedChange`; the outer context still counts.
  const outerExpanded = useExpanded()
  const [selfExpanded, setSelfExpanded] = createSignal(false)
  const isExpanded = () => selfExpanded() || outerExpanded()
  const defaultPageSize = () => tableParams.pageSize ?? 25
  const chatDefault = () => tableParams.chatPageSize ?? Math.min(10, defaultPageSize())
  const [userPageSize, setUserPageSize] = createSignal<number | null>(null) // null = use default
  const clientPageSize = () => {
    const ups = userPageSize()
    if (ups !== null) return ups // user chose a size
    return isExpanded() ? defaultPageSize() : chatDefault()
  }
  const showAll = () => userPageSize() === 0
  const hasServerPagination = () => !!tableParams.pagination
  const needsClientPagination = () =>
    !hasServerPagination() && !showAll() && clientPageSize() > 0 && filteredRows().length > clientPageSize()
  const [requestedClientPage, setClientPage] = createSignal(tableParams.initialPage ?? 0)
  const clientTotalPages = () => needsClientPagination() ? Math.ceil(filteredRows().length / clientPageSize()) : 1
  const clientPage = createMemo(() => Math.max(0, Math.min(requestedClientPage(), clientTotalPages() - 1)))
  createEffect(() => {
    if (requestedClientPage() !== clientPage()) setClientPage(clientPage())
  })
  const clientVisibleRows = createMemo(() => {
    if (showAll() || !needsClientPagination()) return filteredRows()
    const start = clientPage() * clientPageSize()
    return filteredRows().slice(start, start + clientPageSize())
  })
  const clientRangeStart = () => needsClientPagination() ? clientPage() * clientPageSize() + 1 : 1
  const clientRangeEnd = () => needsClientPagination()
    ? Math.min((clientPage() + 1) * clientPageSize(), filteredRows().length)
    : filteredRows().length

  // Page size options for selector (fullscreen)
  const pageSizeOptions = () => {
    const total = filteredRows().length
    const opts: Array<{ value: number; label: string }> = []
    for (const n of [10, 30, 60, 100]) {
      if (n < total) opts.push({ value: n, label: String(n) })
    }
    opts.push({ value: 0, label: strings.paginationAllRows })
    return opts
  }

  const handlePageSizeChange = (val: number) => {
    setUserPageSize(val === 0 ? 0 : val)
    setClientPage(0)
  }

  // ─── Virtualization ──────────────────────────────────────
  const [virtualizer, setVirtualizer] = createSignal<any>(null)
  const [isVirtualizing, setIsVirtualizing] = createSignal(false)

  // Disable virtualization when client pagination is active (they conflict)
  const shouldVirtualize = createMemo(() => {
    if (needsClientPagination()) return false // pagination handles slicing
    const opts = tableParams.virtualize
    if (opts === false) return false
    if (opts === true) return true
    if (typeof opts === 'object') {
      if (opts.enabled !== undefined) return opts.enabled
      const threshold = opts.threshold ?? 100
      return (tableParams.rows?.length ?? 0) > threshold
    }
    return (tableParams.rows?.length ?? 0) > 100
  })

  // Get virtualization options
  const virtualizeOpts = createMemo((): TableVirtualizeOptions => {
    const opts = tableParams.virtualize
    if (typeof opts === 'object') return opts
    return {}
  })

  // Initialize virtualizer when needed
  createEffect(async () => {
    if (isServer || !shouldVirtualize()) {
      setIsVirtualizing(false)
      return
    }

    try {
      const { createVirtualizer } = await import('@tanstack/solid-virtual')
      const opts = virtualizeOpts()
      const rowHeight = opts.rowHeight ?? 48
      const overscan = opts.overscan ?? 5

      const v = createVirtualizer({
        get count() { return tableParams.rows?.length ?? 0 },
        getScrollElement: () => scrollContainerRef ?? null,
        estimateSize: () => rowHeight,
        overscan,
      })

      setVirtualizer(v)
      setIsVirtualizing(true)
    } catch (e) {
      console.warn('Failed to load @tanstack/solid-virtual, falling back to regular table', e)
      setIsVirtualizing(false)
    }
  })

  // Cell value extraction helper
  const getCellValue = (row: any, key: string): string => {
    const value = row[key]
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return value.name || value.label || JSON.stringify(value)
    return String(value)
  }

  // Generate copyable text from table data (TSV format for spreadsheet compatibility)
  const getTableText = () => {
    const columns = tableParams.columns || []
    const rows = tableParams.rows || []
    const header = columns.map((c: any) => c.label).join('\t')
    const dataRows = rows.map((row: any) =>
      columns.map((c: any) => getCellValue(row, c.key)).join('\t')
    ).join('\n')
    return `${header}\n${dataRows}`
  }

  // CSV generation (RFC 4180 compliant)
  const getTableCSV = () => {
    const columns = tableParams.columns || []
    const rows = tableParams.rows || []
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }
    const header = columns.map((c: any) => escapeCSV(c.label)).join(',')
    const dataRows = rows.map((row: any) =>
      columns.map((c: any) => escapeCSV(getCellValue(row, c.key))).join(',')
    ).join('\n')
    return `${header}\n${dataRows}`
  }

  // JSON generation
  const getTableJSON = () => {
    const columns = tableParams.columns || []
    const rows = tableParams.rows || []
    return JSON.stringify({ columns: columns.map((c: any) => ({ key: c.key, label: c.label })), rows }, null, 2)
  }

  // Download helper
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export config
  const exportable = tableParams.exportable
  const exportFormats = typeof exportable === 'object' && exportable?.formats
    ? exportable.formats
    : ['csv', 'json']
  const exportFilename = (typeof exportable === 'object' && exportable?.filename) || `table-${Math.random().toString(36).slice(2, 9)}`

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = createSignal(false)
  // v6.4.0 — trigger ref consumed by <PortalDropdownMenu> for positioning
  let exportTriggerRef: HTMLButtonElement | undefined

  const handleExport = (format: string) => {
    setShowExportMenu(false)
    switch (format) {
      case 'tsv':
        navigator.clipboard.writeText(getTableText())
        break
      case 'csv':
        downloadFile(getTableCSV(), `${exportFilename}.csv`, 'text/csv')
        break
      case 'json':
        downloadFile(getTableJSON(), `${exportFilename}.json`, 'application/json')
        break
    }
  }

  const tableId = `table-${Math.random().toString(36).slice(2, 9)}`

  // Standard table body (non-virtualized) — uses client pagination when active
  const StandardTableBody = () => (
    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      <For each={clientVisibleRows().slice(0, DEFAULT_RESOURCE_LIMITS.maxTableRows)}>
        {(row: any, i) => (
          <tr class={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${i() % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-800/50'}`}>
            <For each={tableParams.columns}>
              {(column: any) => (
                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words leading-relaxed first:pl-6 last:pr-6">
                  <SafeHtml html={() => highlightQuery(renderCellValue(row[column.key], citationCtx), debouncedQuery())} />
                </td>
              )}
            </For>
          </tr>
        )}
      </For>
    </tbody>
  )

  // Virtualized table body
  const VirtualizedTableBody = () => {
    const v = virtualizer()
    if (!v) return null

    const items = v.getVirtualItems()
    const totalSize = v.getTotalSize()
    const opts = virtualizeOpts()
    const rowHeight = opts.rowHeight ?? 48

    return (
      <tbody
        class="bg-white dark:bg-gray-800 relative"
        style={{ height: `${totalSize}px` }}
      >
        <For each={items}>
          {(virtualRow: any) => {
            const row = tableParams.rows[virtualRow.index]
            return (
              <tr
                class={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors absolute left-0 right-0 ${virtualRow.index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-800/50'}`}
                style={{
                  height: `${rowHeight}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <For each={tableParams.columns}>
                  {(column: any) => (
                    <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words leading-relaxed first:pl-6 last:pr-6">
                      <SafeHtml html={() => highlightQuery(renderCellValue(row[column.key], citationCtx), debouncedQuery())} />
                    </td>
                  )}
                </For>
              </tr>
            )
          }}
        </For>
      </tbody>
    )
  }

  return (
    <ExpandableWrapper title={tableParams.title || strings.tableTitle} copyData={getTableCSV()} copyLabel={strings.tableCopyCsv} toolbarVariant={props.toolbarVariant} onExpandedChange={setSelfExpanded}>
      <div class={`relative w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group ${
        isExpanded() ? 'flex-1 min-h-0 flex flex-col' : 'h-full'
      } ${tableParams.className || ''}`}>
        <Show when={exportable} fallback={<CopyButton getText={getTableCSV} title={strings.tableCopyCsv} position="top-right" />}>
          <div class="absolute right-10 top-2 z-10">
            <button
              ref={exportTriggerRef}
              onClick={() => setShowExportMenu(!showExportMenu())}
              class="opacity-60 hover:opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
              title={strings.tableExport}
              aria-label={strings.tableExport}
              aria-haspopup="menu"
              aria-expanded={showExportMenu()}
            >
              <svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <PortalDropdownMenu
              open={showExportMenu()}
              onClose={() => setShowExportMenu(false)}
              trigger={exportTriggerRef}
              width={144}
            >
              <Show when={(exportFormats as string[]).includes('tsv')}>
                <button onClick={() => handleExport('tsv')} class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">{strings.tableCopyTsv}</button>
              </Show>
              <Show when={(exportFormats as string[]).includes('csv')}>
                <button onClick={() => handleExport('csv')} class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">{strings.tableDownloadCsv}</button>
              </Show>
              <Show when={(exportFormats as string[]).includes('json')}>
                <button onClick={() => handleExport('json')} class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">{strings.tableDownloadJson}</button>
              </Show>
            </PortalDropdownMenu>
          </div>
        </Show>
        <div class={`p-4 ${isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
          <Show when={tableParams.title}>
            <h3 id={`${tableId}-title`} class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex-shrink-0">
              {tableParams.title}
              <Show when={isVirtualizing()}>
                <span class="ml-2 text-xs font-normal text-gray-400">
                  {formatMCPUIString(strings.tableVirtualizedRows, { count: tableParams.rows?.length ?? 0 })}
                </span>
              </Show>
            </h3>
          </Show>

          {/* Search input (v4.3.3) */}
          <Show when={isSearchable()}>
            <div class="relative mb-3">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm">{'\uD83D\uDD0D'}</span>
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                placeholder={searchPlaceholder()}
                class="w-full max-w-xs min-w-[200px] pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => { handleSearch(''); setSearchQuery(''); setDebouncedQuery('') }}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                  aria-label={strings.tableClearSearch}
                >&times;</button>
              </Show>
            </div>
            <Show when={debouncedQuery() && filteredRows().length !== sortedRows().length}>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {formatMCPUIString(
                  filteredRows().length === 1 ? strings.tableSearchResultsOne : strings.tableSearchResultsMany,
                  { count: filteredRows().length, total: sortedRows().length }
                )}
              </p>
            </Show>
          </Show>

          <div
            ref={scrollContainerRef}
            class={`overflow-x-auto ${isExpanded() ? 'flex-1 min-h-0' : ''}`}
            style={
              // v6.1.0 — when expanded, the scroll container fills the
              // remaining vertical space and scrolls internally.
              // v6.3.0 — `params.maxHeight` opt-out (axe 1 deposium handoff)
              //   - 'auto' → no cap, parent handles overflow
              //   - number → `${n}px`, string → CSS as-is
              //   - undefined → existing 400/500px heuristic
              (() => {
                if (isExpanded()) return { 'overflow-y': 'auto' }
                const mh = tableParams.maxHeight
                if (mh === 'auto') return {}
                if (mh !== undefined) {
                  return {
                    'max-height': typeof mh === 'number' ? `${mh}px` : mh,
                    'overflow-y': 'auto',
                  }
                }
                if (isVirtualizing()) return { 'max-height': '500px', 'overflow-y': 'auto' }
                if (clientVisibleRows().length > 8) return { 'max-height': '400px', 'overflow-y': 'auto' }
                return {}
              })()
            }
            role="region"
            aria-label={tableParams.title || strings.tableAriaLabel}
            tabindex="0"
          >
            <table
              class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-separate border-spacing-0"
              aria-labelledby={tableParams.title ? `${tableId}-title` : undefined}
            >
              <thead class="bg-gray-100 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <For each={tableParams.columns}>
                    {(column: any) => (
                      <th
                        scope="col"
                        class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 first:pl-6 last:pr-6 bg-gray-100 dark:bg-gray-900 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        style={column.width ? { width: column.width } : {}}
                        on:click={() => handleSort(column.key)}
                        title={formatMCPUIString(strings.sortBy, { column: column.label })}
                      >
                        <span class="inline-flex items-center gap-1">
                          {column.label}
                          <span
                            class="text-[10px] leading-none"
                            classList={{
                              'opacity-30': sortKey() !== column.key,
                              'opacity-100 text-blue-600 dark:text-blue-400': sortKey() === column.key,
                            }}
                          >
                            {sortIndicator(column.key)}
                          </span>
                        </span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <Show when={isVirtualizing()} fallback={<StandardTableBody />}>
                <VirtualizedTableBody />
              </Show>
            </table>
          </div>

          {/* Server-side pagination (legacy) */}
          <Show when={tableParams.pagination}>
            <div class="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {formatMCPUIString(strings.tableServerPageRange, {
                  start: tableParams.pagination.currentPage * tableParams.pagination.pageSize + 1,
                  end: Math.min(
                    (tableParams.pagination.currentPage + 1) * tableParams.pagination.pageSize,
                    tableParams.pagination.totalRows
                  ),
                  total: tableParams.pagination.totalRows,
                })}
              </span>
            </div>
          </Show>

          {/* Client-side pagination (v4.3.7) */}
          <Show when={needsClientPagination()}>
            <div class="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {clientRangeStart()}&ndash;{clientRangeEnd()} / {filteredRows().length.toLocaleString(strings.locale)}
              </span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={clientPage() === 0}
                  onClick={() => setClientPage(p => p - 1)}
                  aria-label={strings.paginationPrevious}
                  data-mcp-ui-action="page-prev"
                >
                  <span aria-hidden="true">&#x25C0;</span>
                </button>
                <span aria-live="polite">{clientPage() + 1} / {clientTotalPages()}</span>
                <button
                  type="button"
                  class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={clientPage() >= clientTotalPages() - 1}
                  onClick={() => setClientPage(p => p + 1)}
                  aria-label={strings.paginationNext}
                  data-mcp-ui-action="page-next"
                >
                  <span aria-hidden="true">&#x25B6;</span>
                </button>
                {/* Page size selector — fullscreen only */}
                <Show when={isExpanded() && filteredRows().length > 10}>
                  <select
                    class="ml-2 px-1 py-0.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    value={clientPageSize()}
                    onChange={(e) => handlePageSizeChange(Number(e.currentTarget.value))}
                    aria-label={strings.paginationPageSize}
                    data-mcp-ui-action="page-size"
                  >
                    <For each={pageSizeOptions()}>
                      {(opt) => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>
                  <span class="text-gray-400">{strings.perPageSuffix}</span>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </ExpandableWrapper>
  )
}

/**
 * Render a metric card component
 */
function MetricRenderer(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  const metricParams = props.component.params as any

  // Generate copyable text for metric
  const getMetricText = () => {
    const title = metricParams.title || metricParams.label || ''
    const value = metricParams.value
    const unit = metricParams.unit || ''
    return `${title}: ${value}${unit ? ' ' + unit : ''}`
  }

  return (
    <div class="relative w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 group">
      <CopyButton getText={getMetricText} title={strings.copyMetric} position="top-right" />
      <div class="flex flex-col h-full justify-between">
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {metricParams.title}
          </p>
          <div class="mt-2 flex items-baseline">
            <p class="text-2xl font-semibold text-gray-900 dark:text-white">{metricParams.value}</p>
            <Show when={metricParams.unit}>
              <span class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                {metricParams.unit}
              </span>
            </Show>
          </div>
        </div>

        <Show when={metricParams.trend}>
          <div class="mt-3 flex items-center">
            <span
              class={`text-sm font-medium ${metricParams.trend.direction === 'up'
                ? 'text-green-600 dark:text-green-400'
                : metricParams.trend.direction === 'down'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
                }`}
            >
              {metricParams.trend.direction === 'up'
                ? '�'
                : metricParams.trend.direction === 'down'
                  ? '�'
                  : '�'}{' '}
              {Math.abs(metricParams.trend.value)}%
            </span>
          </div>
        </Show>

        <Show when={metricParams.subtitle}>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{metricParams.subtitle}</p>
        </Show>
      </div>
    </div>
  )
}

/**
 * Extract image data from markdown image link format
 * Pattern: [![alt](image-url)](link-url)\n*Photo by Author*
 */
function extractImageFromMarkdown(
  content: string,
  fallbackAlt: string
): { alt: string; imageUrl: string; linkUrl: string; credit: string } | null {
  // Pattern: [![alt text](image-url)](link-url) followed by optional credit line
  const imagePattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)\s*\*([^*]+)\*/
  const match = content.match(imagePattern)

  if (match) {
    return {
      alt: match[1] || fallbackAlt,
      imageUrl: match[2],
      linkUrl: match[3],
      credit: match[4].trim()
    }
  }

  return null
}

/**
 * Render a text component (with optional markdown)
 */
function TextRenderer(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  const textParams = props.component.params as any

  // Check if this is an image markdown that should be rendered as image
  // component. Both URLs come from LLM-authored markdown and are bound into
  // `src`/`href`, which `sanitizeHtml` never sees — so they go through the
  // `safeUrl` allow-list here (v6.19.0). An unusable image URL makes the whole
  // branch decline, and the content falls back to the normal sanitized
  // markdown path; an unusable link URL only drops the anchor.
  const imageData = createMemo(() => {
    if (textParams.markdown && textParams.content) {
      const extracted = extractImageFromMarkdown(textParams.content, strings.imageAlt)
      if (!extracted) return null
      const imageUrl = safeUrl(extracted.imageUrl, { allowDataImage: true })
      if (!imageUrl) return null
      return { ...extracted, imageUrl, linkUrl: safeUrl(extracted.linkUrl) }
    }
    return null
  })

  // Convert markdown to HTML if markdown flag is true (and not an image component).
  //
  // BOTH branches are sanitized: the result is bound to `innerHTML`, and
  // `params.content` is LLM-authored — the non-markdown branch used to reach
  // the sink completely raw. `sanitizeHtml` also makes the SSR pass emit
  // escaped text instead of live markup.
  const htmlContent = createMemo(() => {
    const raw = textParams.content
    if (raw === null || raw === undefined) return ''
    // No DOMPurify here (server, or a client where it bailed out):
    // `sanitizeHtml` would escape *`marked` output*, i.e. ship `&lt;p&gt;` and
    // `&lt;table&gt;` as visible text. Escape the markdown SOURCE instead —
    // it reads as prose, and `<SafeHtml>`'s onMount upgrades it to the
    // sanitized rich version once the client takes over.
    if (!canSanitizeHtml()) {
      return escapeHtml(String(raw))
    }
    if (textParams.markdown && !imageData()) {
      return sanitizeHtml(marked.parse(raw, { async: false }) as string, SANITIZE_PROFILES.prose)
    }
    return sanitizeHtml(String(raw), SANITIZE_PROFILES.prose)
  })

  // Get plain text content for copying (strip markdown/HTML)
  const getTextContent = () => {
    return textParams.content || ''
  }

  // Render as image component if we extracted image data
  return (
    <Show
      when={imageData()}
      fallback={
        <div class="relative w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 group">
          <CopyButton getText={getTextContent} title={strings.copyText} position="top-right" />
          <SafeHtml
            class={`prose prose-sm dark:prose-invert max-w-none ${textParams.className || ''}`}
            html={htmlContent}
          />
        </div>
      }
    >
      {(data) => {
        // Rebuilt per branch on purpose: a JSX element cannot be mounted twice.
        const image = () => (
          <img
            src={data().imageUrl}
            alt={data().alt}
            class="max-w-full max-h-[400px] object-contain rounded shadow-sm hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        )
        return (
        <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div class="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 min-h-[200px]">
            {/* The anchor only exists when the link URL passed `safeUrl` — a
                `javascript:` link degrades to a plain, unlinked image. */}
            <Show when={data().linkUrl} fallback={image()}>
              {(href) => (
                <a href={href()} target="_blank" rel="noopener noreferrer" class="cursor-zoom-in">
                  {image()}
                </a>
              )}
            </Show>
          </div>
          <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center italic">{data().credit}</p>
          </div>
        </div>
        )
      }}
    </Show>
  )
}

/**
 * Render an iframe component
 */
function IframeRenderer(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  const config = useMCPUIConfig()
  const params = props.component.params as any
  // v6.21.0 — the host's custom trusted hosts now reach BOTH the sandbox (they
  // used not to: `getIframeSandbox(params.url)` was called with no options) and
  // the `credentialless` decision.
  const trustOptions = () => ({ customTrustedDomains: config.customTrustedIframeDomains })
  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <Show when={params.title}>
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{params.title}</h3>
        </div>
      </Show>
      <iframe
        src={params.url}
        title={params.title || strings.iframeTitle}
        class="w-full border-0 flex-1"
        style={`height: ${params.height || '400px'}; min-height: 300px;`}
        sandbox={getIframeSandbox(params.url, trustOptions())}
        // `attr:` is required: `credentialless` is in dom-expressions'
        // `Properties` set, so a plain `credentialless={…}` compiles to a JS
        // property assignment and never reaches the DOM as an attribute.
        // `true | undefined` keeps it a BOOLEAN attribute — bare in SSR
        // markup, removed (not `="false"`) when it does not apply.
        attr:credentialless={
          shouldSetCredentialless(params.url, config, {
            // This iframe's sandbox never carries `allow-same-origin` for an
            // untrusted host, so it already runs without cookies.
            sandboxedWithoutSameOrigin: !isTrustedIframeDomain(params.url, trustOptions()),
          }) || undefined
        }
        loading="lazy"
      />
      <IframeFallbackLink url={params.url} class="border-t border-gray-200 dark:border-gray-700" />
    </div>
  )
}

/**
 * Render an image component
 */
function ImageRenderer(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  const params = props.component.params as any

  return (
    <figure class={`w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col ${params.className || ''}`}>
      <div class="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 min-h-[200px]">
        <a
          href={safeUrl(params.url)}
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
          aria-label={formatMCPUIString(strings.imageViewFullSize, {
            alt: params.alt || strings.imageAltFallback,
          })}
        >
          <img
            src={safeUrl(params.url, { allowDataImage: true })}
            alt={params.alt || strings.imageAlt}
            class="max-w-full max-h-[500px] object-contain rounded shadow-sm hover:opacity-95 transition-opacity"
            loading="lazy"
          />
        </a>
      </div>
      <Show when={params.caption}>
        <figcaption class="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <p class="text-sm text-gray-600 dark:text-gray-400 text-center">{params.caption}</p>
        </figcaption>
      </Show>
    </figure>
  )
}

/**
 * Render a link component
 */
function LinkRenderer(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  const params = props.component.params as any

  return (
    <a
      href={safeUrl(params.url)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={formatMCPUIString(strings.linkOpensInNewTab, {
        label: params.label || strings.linkLabel,
        description: params.description || params.url,
      })}
      class={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group h-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${params.className || ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 shrink-0 transition-colors" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {params.label || params.url}
        </h4>
        <Show when={params.description}>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{params.description}</p>
        </Show>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 shrink-0 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

/**
 * Render a single component with error boundary
 */
function ComponentRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
  errorMode?: ValidationErrorMode
  toolbarVariant?: 'hover' | 'always-visible'
  /** Host opt-in for the external quickchart.io chart fallback (audit P1.7). */
  allowQuickchartFallback?: boolean
}) {
  // Performance marks — visible in Chrome DevTools "Performance" panel under
  // user timings. Always-on, SSR-safe (see utils/perf.ts).
  markRenderStart(props.component.id)

  // Telemetry sink (B.5 — v5.6.0). null when no MCPUITelemetryProvider is
  // mounted above; null-checked at every dispatch site so apps that don't
  // opt in see zero behavior change.
  const telemetry = useTelemetry()
  const strings = useMCPUIStrings()
  const componentConfig = useMCPUIConfig()

  onMount(() => {
    markRenderEnd(props.component.id)
    if (telemetry) {
      const ts = Date.now()
      telemetry.dispatch({
        type: 'component:mounted',
        id: props.component.id,
        componentType: props.component.type,
        ts,
      })
      // Read the perf measure we just emitted to surface durationMs without
      // double-measuring. The measure may be missing if `performance` is
      // unavailable (SSR) — skip rendered event in that case.
      if (typeof performance !== 'undefined' && typeof performance.getEntriesByName === 'function') {
        const entries = performance.getEntriesByName(`${PERF_PREFIX}${props.component.id}:render`, 'measure')
        const last = entries[entries.length - 1]
        if (last) {
          telemetry.dispatch({
            type: 'component:rendered',
            id: props.component.id,
            componentType: props.component.type,
            durationMs: last.duration,
            ts,
          })
        }
      }
    }
  })

  onCleanup(() => {
    if (telemetry) {
      telemetry.dispatch({
        type: 'component:unmounted',
        id: props.component.id,
        componentType: props.component.type,
        ts: Date.now(),
      })
    }
  })

  // Validate component before rendering. The host's allow-list extension
  // (v6.21.0) has to reach validation too: an unlisted host is replaced by the
  // validation card before any renderer runs.
  const validation = validateComponent(props.component, {
    iframePolicy: componentConfig.iframePolicy,
    customIframeDomains: componentConfig.customIframeDomains,
  })
  if (!validation.valid) {
    props.onError?.({
      type: 'validation',
      message: 'Component validation failed',
      componentId: props.component.id,
      details: validation.errors,
    })

    // Privacy: only counts + first error code, NO error messages or paths
    // (which could leak payload data — §M.6.2 hard rule).
    if (telemetry) {
      telemetry.dispatch({
        type: 'validation:failed',
        id: props.component.id,
        componentType: props.component.type,
        errorCount: validation.errors?.length ?? 0,
        firstErrorCode: validation.errors?.[0]?.code ?? null,
        ts: Date.now(),
      })
    }

    const mode: ValidationErrorMode = props.errorMode ?? 'block'
    const firstError = validation.errors?.[0]?.message || strings.validationUnknownError

    // P1.6 — an UNKNOWN component type must never produce a silent blank,
    // whatever the errorMode. The renderer has no branch for it, so even
    // `silent` would otherwise render nothing. Always surface a visible
    // "Unsupported component type" notice + a render:error telemetry signal.
    if (validation.errors?.some((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')) {
      return <UnsupportedComponentFallback component={props.component} />
    }

    if (mode === 'silent') {
      return null
    }

    if (mode === 'inline-warn') {
      return (
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200"
          role="alert"
          aria-label={strings.validationWarning}
          title={firstError}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{formatMCPUIString(strings.invalidComponent, { type: props.component.type })}</span>
        </div>
      )
    }

    // mode === 'block' (default, pre-v5.4.0 behavior)
    return (
      <div class="w-full h-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-sm font-medium text-red-900 dark:text-red-100">{strings.validationError}</p>
        <p class="text-xs text-red-700 dark:text-red-300 mt-1">
          {firstError}
        </p>
      </div>
    )
  }

  // Render based on component type with enhanced error boundary
  return (
    <GenerativeUIErrorBoundary
      componentId={props.component.id}
      componentType={props.component.type}
      onError={props.onError}
      allowRetry={true}
    >
      <Show when={props.component.type === 'chart'}>
        <ChartRenderer component={props.component} onError={props.onError} toolbarVariant={props.toolbarVariant} allowQuickchartFallback={props.allowQuickchartFallback} />
      </Show>
      <Show when={props.component.type === 'table'}>
        <TableRenderer component={props.component} onError={props.onError} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'metric'}>
        <MetricRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'text'}>
        <TextRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'iframe'}>
        <IframeRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'image'}>
        <ImageRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'link'}>
        <LinkRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'action'}>
        <ActionRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'grid'}>
        <GridRenderer component={props.component} onError={props.onError} />
      </Show>
      <Show when={props.component.type === 'carousel'}>
        <CarouselRenderer items={(props.component.params as any)?.items || []} height={(props.component.params as any)?.height} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'artifact'}>
        <ArtifactRenderer params={props.component.params as any} />
      </Show>
      <Show when={props.component.type === 'form'}>
        <FormRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'modal'}>
        <ModalRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'action-group'}>
        <ActionGroupRenderer component={props.component} />
      </Show>
      <Show when={props.component.type === 'image-gallery'}>
        <ImageGalleryRenderer component={props.component} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'video'}>
        <VideoRenderer component={props.component} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'code'}>
        <CodeBlockRenderer component={props.component} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'map'}>
        <MapRenderer component={props.component} toolbarVariant={props.toolbarVariant} />
      </Show>
      <Show when={props.component.type === 'graph'}>
        <GraphRenderer component={props.component} toolbarVariant={props.toolbarVariant} />
      </Show>
      {/* P1.6 — `footer` is a valid type with a real renderer but had no
          dispatch branch, so a standalone footer component rendered a silent
          blank (it was only auto-injected at the layout level). */}
      <Show when={props.component.type === 'footer'}>
        <FooterRenderer params={props.component.params as any} />
      </Show>
      {/* `composite` is a UILayout discriminator, not a leaf renderer — a
          top-level composite is handled as a layout (see `layout()` above). If
          one arrives as a `components[]` entry or a streamed component it has no
          leaf branch and now passes the (spec-derived) validation gate, so
          surface the visible notice instead of a silent blank (audit P1.6). */}
      <Show when={props.component.type === 'composite'}>
        <UnsupportedComponentFallback component={props.component} />
      </Show>
    </GenerativeUIErrorBoundary>
  )
}

/**
 * Visible fallback for a component whose `type` is not recognized (audit P1.6).
 *
 * An unknown type has no renderer branch, so without this it would render a
 * **silent blank** — even under `errorMode: 'silent'`. The validation gate
 * routes unknown types here regardless of mode, so the user always sees an
 * "Unsupported component type: X" notice. The telemetry signal is emitted by
 * the gate itself (`validation:failed` with `firstErrorCode:
 * 'UNKNOWN_COMPONENT_TYPE'`), so this component stays purely presentational.
 */
function UnsupportedComponentFallback(props: { component: UIComponent }) {
  const strings = useMCPUIStrings()
  return (
    <div
      role="alert"
      class="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200"
    >
      {strings.unsupportedComponentType} <code class="font-mono">{props.component.type}</code>
    </div>
  )
}

/**
 * Render an action component (button or link)
 * Refactored in Phase 5.0 to use useAction hook for Context-based execution
 */
function ActionRenderer(props: { component: UIComponent }) {
  const params = props.component.params as any
  const { execute, executeAction, isExecuting } = useAction()
  const telemetry = useTelemetry()

  // tool-call and submit both run through the host executor — loading +
  // disabled state apply to both. link does neither.
  const isExecutable = () => params.action === 'tool-call' || params.action === 'submit'

  // Telemetry: action:dispatched on click (B.5 — v5.6.0). Fires for every
  // click attempt (tool-call or link), regardless of execute success.
  // Privacy: actionName is `toolName` (tool-call) or the action kind
  // (link/submit) — NO `params.params` payload, NO URL.
  function dispatchTelemetry() {
    if (!telemetry) return
    const actionName: string = params.toolName ?? params.action ?? 'unknown'
    telemetry.dispatch({
      type: 'action:dispatched',
      id: props.component.id,
      componentType: 'action',
      actionName,
      ts: Date.now(),
    })
  }

  // Handle click to execute tool via Context (falls back to CustomEvent if no provider)
  const handleClick = async (e: MouseEvent) => {
    dispatchTelemetry()
    if (params.action === 'tool-call' && params.toolName) {
      e.preventDefault()
      await execute(params.toolName, params.params || {})
    } else if (params.action === 'submit') {
      // submit is NOT a tool call — route through the executor with the
      // `action: 'submit'` kind preserved. Works outside any <form>.
      e.preventDefault()
      await executeAction({
        action: 'submit',
        toolName: params.toolName || 'submit',
        params: params.params || {},
      })
    }
  }

  // Determine if button should be disabled (explicit disable or currently executing)
  const isDisabled = () => params.disabled || (isExecutable() && isExecuting())

  if (params.type === 'link' || params.action === 'link') {
    return (
      <a
        href={safeUrl(params.url) ?? '#'}
        target={safeUrl(params.url) ? '_blank' : undefined}
        rel="noopener noreferrer"
        aria-label={params.ariaLabel || params.label}
        class={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          ${params.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
            params.variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800' :
              'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'}
          ${params.className || ''}`}
        onClick={handleClick}
      >
        <Show when={params.icon}>
          <span aria-hidden="true">{params.icon}</span>
        </Show>
        {params.label}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={isDisabled()}
      aria-busy={isExecuting() && isExecutable()}
      aria-label={params.ariaLabel || params.label}
      class={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${params.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' :
          params.variant === 'secondary' ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600' :
            params.variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800' :
              params.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}
        ${isDisabled() ? 'opacity-50 cursor-not-allowed' : ''}
        ${params.size === 'sm' ? 'px-3 py-1.5 text-xs' : params.size === 'lg' ? 'px-6 py-3 text-base' : ''}
        ${params.className || ''}`}
      onClick={handleClick}
    >
      <Show when={isExecuting() && isExecutable()}>
        <span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
      </Show>
      <Show when={params.icon && !(isExecuting() && isExecutable())}>
        <span aria-hidden="true">{params.icon}</span>
      </Show>
      {params.label}
    </button>
  )
}

/**
 * Error card renderer for tool execution errors
 * Handles {error: true, message: "...", tool: "...", suggestions: [...]} format
 */
function ErrorCardRenderer(props: { error: any }) {
  const strings = useMCPUIStrings()
  // The timestamp depends on the viewer's time zone, which the server cannot
  // know. Render it only after mount so SSR and hydration produce the same markup.
  const [mounted, setMounted] = createSignal(false)
  onMount(() => setMounted(true))
  const getErrorText = () => {
    return formatMCPUIString(strings.errorCopyText, {
      tool: props.error.tool || strings.errorUnknownTool,
      message: props.error.message || strings.errorUnknown,
    })
  }

  return (
    <div class="relative w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 group">
      <CopyButton getText={getErrorText} title={strings.copyErrorDetails} position="top-right" />
      <div class="flex items-start gap-3">
        <div class="p-2 bg-red-100 dark:bg-red-900/40 rounded-full shrink-0">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-semibold text-red-800 dark:text-red-200">
            {formatMCPUIString(strings.toolErrorTitle, {
              tool: props.error.tool || strings.errorUnknownToolName,
            })}
          </h4>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">
            {props.error.message || strings.errorToolExecution}
          </p>
          <Show when={props.error.type}>
            <p class="text-xs text-red-600 dark:text-red-400 mt-1">
              {formatMCPUIString(strings.errorTypeLabel, { type: props.error.type })}
            </p>
          </Show>
          <Show when={props.error.suggestions?.length}>
            <div class="mt-3">
              <p class="text-xs font-medium text-red-700 dark:text-red-300">{strings.errorSuggestions}</p>
              <ul class="mt-1 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                <For each={props.error.suggestions}>
                  {(suggestion: string) => <li>{suggestion}</li>}
                </For>
              </ul>
            </div>
          </Show>
          <Show when={mounted() && props.error.timestamp}>
            <p class="text-xs text-red-500 dark:text-red-500 mt-2">
              {new Date(props.error.timestamp).toLocaleString(strings.locale)}
            </p>
          </Show>
        </div>
      </div>
    </div>
  )
}

/**
 * Check if content is an error response from MCP tool
 */
function isErrorResponse(content: any): boolean {
  return content && typeof content === 'object' && content.error === true
}

/**
 * Check if content is a UIResource (raw HTML or URI-based resource)
 * UIResource has: { uri, content: { type: 'rawHtml', htmlString }, encoding, metadata }
 */
function isUIResource(content: any): boolean {
  return content && typeof content === 'object' && (
    content.uri?.startsWith('ui://') ||
    content.content?.type === 'rawHtml' ||
    content.content?.htmlString
  )
}

/**
 * Render UIResource (raw HTML) content
 * Handles HTML resources returned by tools like ui_show_dashboard, ui_show_health
 */
function UIResourceHtmlRenderer(props: { resource: any }) {
  const strings = useMCPUIStrings()
  const htmlContent = () => {
    if (props.resource.content?.htmlString) {
      return sanitizeHtml(String(props.resource.content.htmlString), SANITIZE_PROFILES.resource)
    }
    return ''
  }

  const resourceTitle = () => {
    return props.resource.metadata?.title || props.resource.uri?.replace('ui://deposium/', '') || strings.resourceTitle
  }

  return (
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Show when={props.resource.metadata?.title || props.resource.uri}>
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white capitalize">
            {resourceTitle()}
          </h3>
        </div>
      </Show>
      <SafeHtml
        class="p-4 prose prose-sm dark:prose-invert max-w-none"
        html={htmlContent}
      />
    </div>
  )
}

/**
 * Main UIResourceRenderer component
 */
export const UIResourceRenderer: Component<UIResourceRendererProps> = (props) => {
  // Handle error responses early (Sprint 9b fix)
  if (isErrorResponse(props.content)) {
    return <ErrorCardRenderer error={props.content} />
  }

  // Handle UIResource (raw HTML) - skip grid validation (Sprint 9c fix)
  if (isUIResource(props.content)) {
    return <UIResourceHtmlRenderer resource={props.content} />
  }

  const layout = () => {
    // Check if content is a UIComponent (non-composite) vs UILayout (composite)
    if ('type' in props.content && (props.content as any).type !== 'composite') {
      return {
        id: 'single-component',
        components: [props.content as UIComponent],
        grid: {
          columns: 12,
          gap: '1rem',
        },
      } as UILayout
    }
    return props.content as UILayout
  }

  // Convert grid styles to CSS string
  const responsiveGrid = createResponsiveGrid()
  const gridContainerStyle = () => {
    const layoutData = layout()
    return `display: grid; grid-template-columns: repeat(${responsiveGrid.stacked() ? 1 : layoutData.grid.columns}, minmax(0, 1fr)); gap: ${layoutData.grid.gap}`
  }

  // Convert component grid styles to CSS string
  const getGridStyleString = (component: UIComponent) => {
    // Defensive check for position field - default to full width
    if (responsiveGrid.stacked() || !component.position) {
      return 'grid-column: 1 / -1; grid-row: auto'
    }
    const { colStart, colSpan, rowStart, rowSpan = 1 } = component.position
    return `grid-column: ${colStart} / span ${colSpan}; grid-row: ${rowStart ? `${rowStart} / span ${rowSpan}` : 'auto'}`
  }

  // Auto-footer logic (Phase 5.0)
  // Automatically inject footer when metadata is present and no explicit footer exists
  const shouldShowAutoFooter = createMemo(() => {
    const layoutData = layout()

    // Don't show if explicitly hidden
    if (layoutData.metadata?.hideFooter) {
      return false
    }

    // Don't show if no metadata (nothing to display)
    if (!layoutData.metadata) {
      return false
    }

    // Don't show if explicit footer component exists
    const hasExplicitFooter = layoutData.components.some((c) => c.type === 'footer')
    if (hasExplicitFooter) {
      return false
    }

    // Show auto-footer if metadata has relevant info
    return !!(
      layoutData.metadata.executionTime ||
      layoutData.metadata.sourceCount ||
      layoutData.metadata.llmModel
    )
  })

  // Build auto-footer params from metadata
  const autoFooterParams = createMemo(() => {
    const layoutData = layout()
    return {
      poweredBy: 'Deposium',
      executionTime: layoutData.metadata?.executionTime,
      model: layoutData.metadata?.llmModel,
      sourceCount: layoutData.metadata?.sourceCount,
    }
  })

  // ── Identity + duplicate-mount detection (v6.5.0) ─────────────
  // `isLayoutContent` distinguishes a real composite/layout payload from
  // the synthetic single-component wrapping above. Drives whether the
  // outer wrapper carries `data-mcp-ui-layout-id` or `data-mcp-ui-component-id`.
  const isLayoutContent =
    !('type' in props.content) || (props.content as { type?: string }).type === 'composite'
  const outerKey = createMemo(() => getUiResourceStableKey(props.content))

  onMount(() => {
    const key = outerKey()
    const info = _registerMount(key)
    if (info.count > 1) {
      props.onMountDuplicate?.(info)
      getDuplicateMountReporter()?.(info)
      if (isDebugEnabled() || props.debugDuplicateMounts) {
        // eslint-disable-next-line no-console
        console.warn('[mcp-ui] duplicate UIResourceRenderer mount', info)
      }
    }
  })
  onCleanup(() => {
    _unregisterMount(outerKey())
  })

  // Wrapper function for RenderContext (breaks circular dependency)
  const renderComponent = (component: UIComponent, onError?: (error: RendererError) => void) => (
    <ComponentRenderer component={component} onError={onError} errorMode={props.errorMode} toolbarVariant={props.toolbarVariant} allowQuickchartFallback={props.allowQuickchartFallback} />
  )

  return (
    <RenderProvider renderComponent={renderComponent}>
      <div
        class={`w-full ${props.class || ''}`}
        {...(isLayoutContent
          ? { 'data-mcp-ui-layout-id': outerKey() }
          : { 'data-mcp-ui-component-id': outerKey() })}
      >
        <div ref={responsiveGrid.ref} class="grid gap-4" style={gridContainerStyle()} data-mcp-ui-grid data-mcp-ui-stacked={responsiveGrid.stacked()}>
          <For each={layout().components}>
            {(component) => (
              <div
                class="min-w-0"
                style={getGridStyleString(component)}
                data-mcp-ui-component-id={getUiResourceStableKey(component)}
              >
                <ComponentRenderer component={component} onError={props.onError} errorMode={props.errorMode} toolbarVariant={props.toolbarVariant} allowQuickchartFallback={props.allowQuickchartFallback} />
              </div>
            )}
          </For>
        </div>

        {/* Auto-injected footer (Phase 5.0) */}
        <Show when={shouldShowAutoFooter()}>
          <FooterRenderer params={autoFooterParams()} />
        </Show>
      </div>
    </RenderProvider>
  )
}
