/**
 * ChartJSRenderer - Native Chart.js rendering
 * Sprint 4: State & Charts
 *
 * Requires chart.js peer dependency:
 * ```
 * pnpm add chart.js
 * ```
 */

import { Component, createEffect, onCleanup, createSignal, Show } from 'solid-js'
import type { UIComponent, ChartComponentParams } from '../types'
import { ExpandableWrapper } from './ExpandableWrapper'

// Lazy load Chart.js to avoid bundling if not used
let ChartJS: any = null
let chartJSLoadPromise: Promise<any> | null = null

const loadChartJS = async () => {
  if (ChartJS) return ChartJS

  if (!chartJSLoadPromise) {
    chartJSLoadPromise = import('chart.js/auto')
      .then((module) => {
        ChartJS = module.default || module.Chart
        return ChartJS
      })
      .catch((err) => {
        chartJSLoadPromise = null
        throw err
      })
  }

  return chartJSLoadPromise
}

/**
 * Check if Chart.js is available
 */
export async function isChartJSAvailable(): Promise<boolean> {
  try {
    await loadChartJS()
    return true
  } catch {
    return false
  }
}

export interface ChartJSRendererProps {
  /**
   * UIComponent with chart params
   */
  component: UIComponent

  /**
   * Error callback
   */
  onError?: (error: Error) => void
}

/**
 * Native Chart.js renderer component
 *
 * @example
 * ```tsx
 * const chartComponent: UIComponent = {
 *   id: 'revenue-chart',
 *   type: 'chart',
 *   position: { colStart: 1, colSpan: 6 },
 *   params: {
 *     type: 'bar',
 *     title: 'Monthly Revenue',
 *     data: {
 *       labels: ['Jan', 'Feb', 'Mar'],
 *       datasets: [{ label: 'Revenue', data: [100, 200, 150] }]
 *     },
 *     renderer: 'native',
 *   },
 * }
 * <ChartJSRenderer component={chartComponent} />
 * ```
 */
export const ChartJSRenderer: Component<ChartJSRendererProps> = (props) => {
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let canvasRef: HTMLCanvasElement | undefined
  let chartInstance: any

  const params = () => props.component.params as ChartComponentParams

  // Chart PNG export
  const handleExportPNG = () => {
    if (!canvasRef) return
    const url = canvasRef.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${(params().title || 'chart').replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  // Create/update chart when params change
  createEffect(async () => {
    if (!canvasRef) return

    // Access params to track dependencies
    const chartParams = params()

    setIsLoading(true)
    setError(undefined)

    try {
      const Chart = await loadChartJS()

      // Destroy previous instance
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }

      // Create new chart
      chartInstance = new Chart(canvasRef, {
        type: chartParams.type,
        data: chartParams.data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...chartParams.options,
          plugins: {
            ...chartParams.options?.plugins,
            legend: {
              display: true,
              position: 'bottom',
              ...chartParams.options?.plugins?.legend,
            },
          },
        },
      })

      setIsLoading(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Chart rendering failed')
      setError(error.message)
      setIsLoading(false)
      props.onError?.(error)
    }
  })

  // Cleanup on unmount
  onCleanup(() => {
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
  })

  return (
    <ExpandableWrapper title={params().title || 'Chart'}>
      <div class="relative w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4 group">
        <Show when={params().title || params().exportable}>
          <div class="flex items-center justify-between mb-3">
            <Show when={params().title}>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                {params().title}
              </h3>
            </Show>
            <Show when={params().exportable}>
              <button
                onClick={handleExportPNG}
                class="opacity-0 group-hover:opacity-60 hover:!opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
                title="Download PNG"
                aria-label="Download chart as PNG"
              >
                <svg class="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </Show>
          </div>
        </Show>

        <Show when={isLoading()}>
          <div class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
            <div class="flex flex-col items-center gap-2">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span class="text-sm text-gray-500 dark:text-gray-400">Loading chart...</span>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div class="absolute inset-0 flex items-center justify-center p-4 bg-white dark:bg-gray-800">
            <div class="text-center">
              <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-3">
                <svg
                  class="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <p class="text-red-600 dark:text-red-400 text-sm font-medium">Chart Error</p>
              <p class="text-gray-600 dark:text-gray-400 text-xs mt-1 max-w-xs">{error()}</p>
            </div>
          </div>
        </Show>

        <div
          class="w-full"
          style={{ height: params().height || '250px', display: error() ? 'none' : 'block' }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
    </ExpandableWrapper>
  )
}
