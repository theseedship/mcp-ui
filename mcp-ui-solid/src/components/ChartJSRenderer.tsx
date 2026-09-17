/**
 * ChartJSRenderer - Native Chart.js rendering
 * Sprint 4: State & Charts
 *
 * Requires chart.js peer dependency:
 * ```
 * pnpm add chart.js
 * ```
 */

import {
  Component,
  For,
  createEffect,
  createMemo,
  createUniqueId,
  onCleanup,
  createSignal,
  Show,
} from 'solid-js';
import type { Accessor, JSX } from 'solid-js';
import type { UIComponent, ChartComponentParams } from '../types';
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper';
import { DegradedFallback } from './DegradedFallback';
import { chartToDataTable } from './chart-data-table';
import { useTelemetry } from '../context/MCPUITelemetryContext';
import { formatMCPUIString, useMCPUIStrings } from '../context/MCPUIStringsContext';

// Lazy load Chart.js to avoid bundling if not used
let ChartJS: any = null;
let chartJSLoadPromise: Promise<any> | null = null;

const loadChartJS = async () => {
  if (ChartJS) return ChartJS;

  if (!chartJSLoadPromise) {
    chartJSLoadPromise = import('chart.js/auto')
      .then((module) => {
        ChartJS = module.default || module.Chart;
        return ChartJS;
      })
      .catch((err) => {
        chartJSLoadPromise = null;
        throw err;
      });
  }

  return chartJSLoadPromise;
};

/**
 * Check if Chart.js is available
 */
export async function isChartJSAvailable(): Promise<boolean> {
  try {
    await loadChartJS();
    return true;
  } catch {
    return false;
  }
}

export interface ChartJSRendererProps {
  /**
   * UIComponent with chart params
   */
  component: UIComponent;

  /**
   * Error callback
   */
  onError?: (error: Error) => void;

  /**
   * Forwarded to the underlying `<ExpandableWrapper>` (v6.3.1).
   * @see ExpandableWrapperProps.toolbarVariant
   */
  toolbarVariant?: 'hover' | 'always-visible';
}

const ContextAwareChartLayout: Component<{
  render: (isExpanded: Accessor<boolean>) => JSX.Element;
}> = (props) => props.render(useExpanded());

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
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string>();
  const [activeView, setActiveView] = createSignal<'chart' | 'data'>('chart');
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: any;
  let renderVersion = 0;

  const params = () => props.component.params as ChartComponentParams;
  const telemetry = useTelemetry();
  const strings = useMCPUIStrings();
  // The accessible data table is a pure projection: its column headers come
  // from the chrome strings, injected rather than hardcoded in the helper.
  const tableData = createMemo(() =>
    chartToDataTable(params(), {
      series: strings.chartTableSeries,
      point: strings.chartTablePoint,
      label: strings.degradedColLabel,
      seriesName: strings.degradedSeries,
    })
  );
  const descriptionId = createUniqueId();
  const title = () => params().title || strings.chartView;

  // v6.1.0 — export visibility :
  //   - undefined / true  → button shown (new default, was opt-in)
  //   - false             → button hidden (explicit opt-out, unchanged)
  const exportEnabled = () => params().exportable !== false;

  // v6.1.0 — copy data for the ExpandableWrapper modal-header copy button.
  // Lazy-stringified each time the button is clicked.
  const copyDataJSON = () => JSON.stringify({ type: params().type, data: params().data }, null, 2);

  // Chart PNG export
  const handleExportPNG = () => {
    if (!canvasRef) return;
    const url = canvasRef.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(params().title || 'chart').replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  // Create/update chart when params change
  createEffect(async () => {
    if (!canvasRef) return;

    // Access params to track dependencies
    const chartParams = params();
    const version = ++renderVersion;

    setIsLoading(true);
    setError(undefined);

    try {
      const Chart = await loadChartJS();

      // A newer prop update or an unmount superseded this async render.
      if (version !== renderVersion || !canvasRef) return;

      // Destroy previous instance
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      // Build options, merging time-axis config if present (v3.1.0)
      const baseOptions: any = {
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
      };

      // Time-series axis (v3.1.0)
      if (chartParams.timeAxis) {
        const ta = chartParams.timeAxis;
        baseOptions.scales = {
          ...baseOptions.scales,
          x: {
            ...baseOptions.scales?.x,
            type: 'time',
            time: {
              parser: ta.parser,
              unit: ta.unit,
              tooltipFormat: ta.tooltipFormat,
            },
            ...(ta.min ? { min: ta.min } : {}),
            ...(ta.max ? { max: ta.max } : {}),
          },
        };
      }

      // Create new chart
      chartInstance = new Chart(canvasRef, {
        type: chartParams.type,
        data: chartParams.data,
        options: baseOptions,
      });

      setIsLoading(false);
    } catch (err) {
      if (version !== renderVersion) return;
      const error = err instanceof Error ? err : new Error(strings.chartRenderError);
      setError(error.message);
      setIsLoading(false);
      // Fallback ladder (P2.5): record the failure so it's observable, then
      // degrade to the series table below instead of a blank canvas.
      telemetry?.dispatch({
        type: 'render:error',
        errorMessage: error.message,
        id: props.component?.id ?? '',
        componentType: 'chart',
        ts: Date.now(),
      });
      props.onError?.(error);
    }
  });

  // Chart.js may measure a zero-sized canvas while the data view is visible.
  // Resize once Solid has revealed it again.
  createEffect(() => {
    if (activeView() !== 'chart' || !chartInstance) return;
    queueMicrotask(() => chartInstance?.resize?.());
  });

  // Cleanup on unmount
  onCleanup(() => {
    renderVersion += 1;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  });

  return (
    <ExpandableWrapper
      title={title()}
      copyData={copyDataJSON()}
      copyLabel={strings.chartCopy}
      toolbarVariant={props.toolbarVariant}
    >
      <ContextAwareChartLayout
        render={(isExpanded) => (
          <div
            class={`relative w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-4 group ${
              isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''
            } ${params().className || ''}`}
          >
        <div class="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
          <div class="min-w-0">
            <Show when={params().title}>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{params().title}</h3>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <div
              class="inline-flex rounded-md border border-gray-200 p-0.5 dark:border-gray-600"
              role="group"
              aria-label={strings.chartViewSelector}
            >
              <button
                type="button"
                aria-pressed={activeView() === 'chart'}
                class={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeView() === 'chart'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveView('chart')}
              >
                {strings.chartView}
              </button>
              <button
                type="button"
                aria-pressed={activeView() === 'data'}
                class={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeView() === 'data'
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveView('data')}
              >
                {strings.chartDataView}
              </button>
            </div>
            <Show when={exportEnabled()}>
              <button
                type="button"
                onClick={handleExportPNG}
                disabled={activeView() !== 'chart' || isLoading() || Boolean(error())}
                class="opacity-0 group-hover:opacity-60 hover:!opacity-100 disabled:!opacity-30 disabled:cursor-not-allowed px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
                title={strings.chartDownloadPng}
                aria-label={strings.chartDownloadPngAria}
              >
                <svg
                  class="w-3 h-3 text-gray-500 dark:text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>
            </Show>
          </div>
        </div>

        <p id={descriptionId} class="sr-only">
          {title()}. {strings.chartDataSummary}
        </p>

        {/* Fallback ladder (P2.5): degrade to a series table on render error
            instead of a bare "Chart Error" message. */}
        <Show when={error() && activeView() === 'chart'}>
          <DegradedFallback
            message={formatMCPUIString(strings.chartRenderFailed, { error: String(error()) })}
            caption={strings.chartDegradedCaption}
            {...tableData()}
          />
        </Show>

        <Show when={activeView() === 'data'}>
          <div
            class={`w-full overflow-auto rounded border border-gray-200 dark:border-gray-700 ${
              isExpanded() ? 'flex-1 min-h-0' : ''
            }`}
            style={
              isExpanded()
                ? undefined
                : { height: params().height || '250px', 'max-height': '70vh' }
            }
          >
            <table class="w-full border-collapse text-left text-sm">
              <caption class="sr-only">
                {title()} — {strings.chartDataTable}
              </caption>
              <thead class="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <For each={tableData().columns}>
                    {(column) => (
                      <th scope="col" class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                        {column}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={tableData().rows}>
                  {(row) => (
                    <tr class="border-t border-gray-100 dark:border-gray-700">
                      <For each={tableData().columns}>
                        {(_column, index) => (
                          <td class="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {String(row[index()] ?? '')}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
                <Show when={tableData().rows.length === 0}>
                  <tr>
                    <td
                      colSpan={Math.max(1, tableData().columns.length)}
                      class="px-3 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      {strings.chartNoData}
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </Show>

        <div
          class={`relative w-full ${isExpanded() ? 'flex-1 min-h-0' : ''}`}
          style={
            error() || activeView() === 'data'
              ? { display: 'none' }
              : isExpanded()
                ? { height: '100%', display: 'block' }
                : { height: params().height || '250px', display: 'block' }
          }
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={title()}
            aria-describedby={descriptionId}
            aria-hidden={activeView() !== 'chart' || Boolean(error())}
          />
          <Show when={isLoading() && activeView() === 'chart'}>
            <div class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
              <div class="flex flex-col items-center gap-2">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span class="text-sm text-gray-500 dark:text-gray-400">{strings.chartLoading}</span>
              </div>
            </div>
          </Show>
        </div>
          </div>
        )}
      />
    </ExpandableWrapper>
  );
};
