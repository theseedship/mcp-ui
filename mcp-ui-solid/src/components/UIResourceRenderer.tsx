/**
 * UI Resource Renderer Component
 * Phase 0: Foundation with iframe sandbox and composite grid support
 */

import DOMPurify from 'dompurify'
import { Component, createSignal, Show, For, createMemo, createEffect } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { UIComponent, UILayout, RendererError, ComponentType } from '../types'
import { validateComponent, DEFAULT_RESOURCE_LIMITS } from '../services/validation'
import { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'
import { GridRenderer } from './GridRenderer'
import { FooterRenderer } from './FooterRenderer'
import { useAction } from '../hooks/useAction'
import { marked } from 'marked'

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
}

/**
 * Render a single chart component in a sandboxed iframe
 */
function ChartRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
}) {
  const [iframeUrl, setIframeUrl] = createSignal<string>()
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()

  // Use createEffect instead of onMount for SSR compatibility
  // createEffect runs after hydration on client-side
  createEffect(() => {
    const chartParams = props.component.params as any
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

    // Validate domain (should always pass for quickchart.io)
    setIframeUrl(url)
    setIsLoading(false)
  })

  return (
    <div class="relative w-full h-full min-h-[300px] bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Show when={isLoading()}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="text-center">
            <p class="text-red-600 dark:text-red-400 text-sm font-medium">Chart Error</p>
            <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">{error()}</p>
          </div>
        </div>
      </Show>

      <Show when={iframeUrl() && !error()}>
        <div class="w-full h-full p-4">
          <Show when={(props.component.params as any).title}>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {(props.component.params as any).title}
            </h3>
          </Show>
          <div class="w-full h-full">
            <img
              src={iframeUrl()}
              alt="Chart visualization"
              class="w-full h-auto max-h-[300px] object-contain"
              onError={() => {
                setError('Failed to load chart')
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
  )
}

/**
 * Smart cell value renderer that handles markdown links and other formats
 */
function renderCellValue(value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '-'
  }

  // Handle object with url/name properties (common source/link format from LLM)
  if (typeof value === 'object' && value !== null) {
    // Check for link-like objects: { url: "...", name/label/title: "..." }
    if (value.url) {
      const label = value.name || value.label || value.title || value.url
      const sanitizedLabel = DOMPurify.sanitize(String(label))
      const sanitizedUrl = DOMPurify.sanitize(String(value.url))
      return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${sanitizedLabel}</a>`
    }
    // Fallback: extract meaningful text from object properties
    if (value.name || value.label || value.title) {
      return DOMPurify.sanitize(String(value.name || value.label || value.title))
    }
    // Last resort: JSON stringify for debugging (better than [object Object])
    try {
      return JSON.stringify(value)
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

  // Detect and convert markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  if (markdownLinkRegex.test(strValue)) {
    // Replace all markdown links with HTML links
    const htmlValue = strValue.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>'
    )
    return DOMPurify.sanitize(htmlValue, { ADD_ATTR: ['target', 'rel'] })
  }

  // Check if value contains markdown formatting (bold, italic, code, etc.)
  const hasMarkdown = /[*_`\[\]#]/.test(strValue)
  if (hasMarkdown) {
    // Parse with marked and sanitize
    const parsed = marked.parse(strValue, { async: false }) as string
    return DOMPurify.sanitize(parsed, { ADD_ATTR: ['target', 'rel'] })
  }

  // Plain text
  return strValue
}

/**
 * Render a table component
 */
function TableRenderer(props: {
  component: UIComponent
  onError?: (error: RendererError) => void
}) {
  const tableParams = props.component.params as any

  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-4">
        <Show when={tableParams.title}>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {tableParams.title}
          </h3>
        </Show>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-separate border-spacing-0">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <For each={tableParams.columns}>
                  {(column: any) => (
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 first:pl-6 last:pr-6"
                      style={column.width ? { width: column.width } : {}}
                    >
                      {column.label}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <For each={tableParams.rows.slice(0, DEFAULT_RESOURCE_LIMITS.maxTableRows)}>
                {(row: any, i) => (
                  <tr class={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${i() % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-800/50'}`}>
                    <For each={tableParams.columns}>
                      {(column: any) => (
                        <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words leading-relaxed first:pl-6 last:pr-6">
                          <div innerHTML={renderCellValue(row[column.key])} />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={tableParams.pagination}>
          <div class="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Showing {tableParams.pagination.currentPage * tableParams.pagination.pageSize + 1} -{' '}
              {Math.min(
                (tableParams.pagination.currentPage + 1) * tableParams.pagination.pageSize,
                tableParams.pagination.totalRows
              )}{' '}
              of {tableParams.pagination.totalRows}
            </span>
          </div>
        </Show>
      </div>
    </div>
  )
}

/**
 * Render a metric card component
 */
function MetricRenderer(props: { component: UIComponent }) {
  const metricParams = props.component.params as any

  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
function extractImageFromMarkdown(content: string): { alt: string; imageUrl: string; linkUrl: string; credit: string } | null {
  // Pattern: [![alt text](image-url)](link-url) followed by optional credit line
  const imagePattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)\s*\*([^*]+)\*/
  const match = content.match(imagePattern)

  if (match) {
    return {
      alt: match[1] || 'Image',
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
  const textParams = props.component.params as any

  // Check if this is an image markdown that should be rendered as image component
  const imageData = createMemo(() => {
    if (textParams.markdown && textParams.content) {
      return extractImageFromMarkdown(textParams.content)
    }
    return null
  })

  // Convert markdown to HTML if markdown flag is true (and not an image component)
  const htmlContent = createMemo(() => {
    if (textParams.markdown && !imageData()) {
      return marked.parse(textParams.content, { async: false }) as string
    }
    return textParams.content
  })

  // Render as image component if we extracted image data
  return (
    <Show
      when={imageData()}
      fallback={
        <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div
            class={`prose prose-sm dark:prose-invert max-w-none ${textParams.className || ''}`}
            innerHTML={htmlContent()}
          />
        </div>
      }
    >
      {(data) => (
        <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div class="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 min-h-[200px]">
            <a href={data().linkUrl} target="_blank" rel="noopener noreferrer" class="cursor-zoom-in">
              <img
                src={data().imageUrl}
                alt={data().alt}
                class="max-w-full max-h-[400px] object-contain rounded shadow-sm hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          </div>
          <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center italic">{data().credit}</p>
          </div>
        </div>
      )}
    </Show>
  )
}

/**
 * Render an iframe component
 */
function IframeRenderer(props: { component: UIComponent }) {
  const params = props.component.params as any
  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <Show when={params.title}>
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{params.title}</h3>
        </div>
      </Show>
      <iframe
        src={params.url}
        title={params.title || 'Embedded content'}
        class="w-full border-0 flex-1"
        style={`height: ${params.height || '400px'}; min-height: 300px;`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
      />
    </div>
  )
}

/**
 * Render an image component
 */
function ImageRenderer(props: { component: UIComponent }) {
  const params = props.component.params as any

  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <div class="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 min-h-[200px]">
        <a href={params.url} target="_blank" rel="noopener noreferrer" class="cursor-zoom-in">
          <img
            src={params.url}
            alt={params.alt || 'Image'}
            class="max-w-full max-h-[500px] object-contain rounded shadow-sm hover:opacity-95 transition-opacity"
            loading="lazy"
          />
        </a>
      </div>
      <Show when={params.caption}>
        <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <p class="text-sm text-gray-600 dark:text-gray-400 text-center">{params.caption}</p>
        </div>
      </Show>
    </div>
  )
}

/**
 * Render a link component
 */
/**
 * Render a link component
 */
function LinkRenderer(props: { component: UIComponent }) {
  const params = props.component.params as any

  return (
    <a
      href={params.url}
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group h-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div class="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 shrink-0 transition-colors">
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
}) {
  // Validate component before rendering
  const validation = validateComponent(props.component)
  if (!validation.valid) {
    props.onError?.({
      type: 'validation',
      message: 'Component validation failed',
      componentId: props.component.id,
      details: validation.errors,
    })

    return (
      <div class="w-full h-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-sm font-medium text-red-900 dark:text-red-100">Validation Error</p>
        <p class="text-xs text-red-700 dark:text-red-300 mt-1">
          {validation.errors?.[0]?.message || 'Unknown validation error'}
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
        <ChartRenderer component={props.component} onError={props.onError} />
      </Show>
      <Show when={props.component.type === 'table'}>
        <TableRenderer component={props.component} onError={props.onError} />
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
    </GenerativeUIErrorBoundary>
  )
}

/**
 * Render an action component (button or link)
 * Refactored in Phase 5.0 to use useAction hook for Context-based execution
 */
function ActionRenderer(props: { component: UIComponent }) {
  const params = props.component.params as any
  const { execute, isExecuting } = useAction()

  // Handle click to execute tool via Context (falls back to CustomEvent if no provider)
  const handleClick = async (e: MouseEvent) => {
    if (params.action === 'tool-call' && params.toolName) {
      e.preventDefault()
      await execute(params.toolName, params.params || {})
    }
  }

  // Determine if button should be disabled (explicit disable or currently executing)
  const isDisabled = () => params.disabled || (params.action === 'tool-call' && isExecuting())

  if (params.type === 'link' || params.action === 'link') {
    return (
      <a
        href={params.url || '#'}
        target={params.url ? '_blank' : undefined}
        rel="noopener noreferrer"
        class={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${params.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
            params.variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800' :
              'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'}`}
        onClick={handleClick}
      >
        <Show when={params.icon}>
          <span>{params.icon}</span>
        </Show>
        {params.label}
      </a>
    )
  }

  return (
    <button
      type={params.action === 'submit' ? 'submit' : 'button'}
      disabled={isDisabled()}
      class={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${params.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' :
          params.variant === 'secondary' ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600' :
            params.variant === 'outline' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800' :
              params.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}
        ${isDisabled() ? 'opacity-50 cursor-not-allowed' : ''}
        ${params.size === 'sm' ? 'px-3 py-1.5 text-xs' : params.size === 'lg' ? 'px-6 py-3 text-base' : ''}`}
      onClick={handleClick}
    >
      <Show when={isExecuting() && params.action === 'tool-call'}>
        <span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      </Show>
      <Show when={params.icon && !(isExecuting() && params.action === 'tool-call')}>
        <span>{params.icon}</span>
      </Show>
      {params.label}
    </button>
  )
}

/**
 * Main UIResourceRenderer component
 */
export const UIResourceRenderer: Component<UIResourceRendererProps> = (props) => {
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
  const gridContainerStyle = () => {
    const layoutData = layout()
    return `grid-template-columns: repeat(${layoutData.grid.columns}, 1fr); gap: ${layoutData.grid.gap}`
  }

  // Convert component grid styles to CSS string
  const getGridStyleString = (component: UIComponent) => {
    // Defensive check for position field - default to full width
    if (!component.position) {
      return 'grid-column: 1 / span 12; grid-row: auto'
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

  const layoutData = layout()

  return (
    <div class={`w-full ${props.class || ''}`}>
      <div class="grid gap-4" style={gridContainerStyle()}>
        <For each={layoutData.components}>
          {(component) => (
            <div style={getGridStyleString(component)}>
              <ComponentRenderer component={component} onError={props.onError} />
            </div>
          )}
        </For>
      </div>

      {/* Auto-injected footer (Phase 5.0) */}
      <Show when={shouldShowAutoFooter()}>
        <FooterRenderer params={autoFooterParams()} />
      </Show>
    </div>
  )
}
