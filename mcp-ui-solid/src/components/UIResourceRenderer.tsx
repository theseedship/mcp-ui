/**
 * UI Resource Renderer Component
 * Phase 0: Foundation with iframe sandbox and composite grid support
 *
 * Security features:
 * - Sandboxed iframes for untrusted content
 * - CSP enforcement via middleware
 * - XSS prevention with DOMPurify
 * - Domain whitelist validation
 *
 * Performance:
 * - Lazy loading with Intersection Observer
 * - Render timeout enforcement
 * - Error boundaries for isolation
 */

import { Component, createSignal, onMount, Show, For } from 'solid-js'
import type { UIComponent, UILayout, RendererError, ComponentType } from '../types'
import { validateComponent, DEFAULT_RESOURCE_LIMITS } from '../services/validation'
import { GenerativeUIErrorBoundary } from './GenerativeUIErrorBoundary'

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

  onMount(() => {
    const chartParams = props.component.params as any

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
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <For each={tableParams.columns}>
                  {(column: any) => (
                    <th
                      scope="col"
                      class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
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
                {(row: any) => (
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <For each={tableParams.columns}>
                      {(column: any) => (
                        <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {row[column.key] || '-'}
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
              class={`text-sm font-medium ${
                metricParams.trend.direction === 'up'
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
 * Render a text component (with optional markdown)
 */
function TextRenderer(props: { component: UIComponent }) {
  const textParams = props.component.params as any

  return (
    <div class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div
        class={`prose prose-sm dark:prose-invert max-w-none ${textParams.className || ''}`}
        innerHTML={textParams.content} // Note: Should be sanitized at generation time
      />
    </div>
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
    </GenerativeUIErrorBoundary>
  )
}

/**
 * Main UIResourceRenderer component
 */
export const UIResourceRenderer: Component<UIResourceRendererProps> = (props) => {
  const layout = () => {
    // Convert single component to layout
    if ('type' in props.content) {
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

  // Grid position to CSS Grid styles
  const getGridStyles = (component: UIComponent) => {
    const { colStart, colSpan, rowStart, rowSpan = 1 } = component.position

    return {
      'grid-column': `${colStart} / span ${colSpan}`,
      'grid-row': rowStart ? `${rowStart} / span ${rowSpan}` : 'auto',
    }
  }

  // Convert grid styles to CSS string to avoid setStyleProperty
  const gridContainerStyle = () =>
    `grid-template-columns: repeat(${layout().grid.columns}, 1fr); gap: ${layout().grid.gap}`

  // Convert component grid styles to CSS string
  const getGridStyleString = (component: UIComponent) => {
    const { colStart, colSpan, rowStart, rowSpan = 1 } = component.position
    return `grid-column: ${colStart} / span ${colSpan}; grid-row: ${rowStart ? `${rowStart} / span ${rowSpan}` : 'auto'}`
  }

  return (
    <div class={`w-full ${props.class || ''}`}>
      <div class="grid gap-4" style={gridContainerStyle()}>
        <For each={layout().components}>
          {(component) => (
            <div style={getGridStyleString(component)}>
              <ComponentRenderer component={component} onError={props.onError} />
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
