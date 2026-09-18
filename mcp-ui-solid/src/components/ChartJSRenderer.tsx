/**
 * ChartJSRenderer - Native Chart.js rendering
 * Sprint 4: State & Charts
 *
 * Requires chart.js peer dependency:
 * ```
 * pnpm add chart.js
 * ```
 *
 * Wheel-zoom / drag-pan / pinch (v6.22.0) need a SECOND optional peer, since a
 * canvas cannot be zoomed with a CSS transform without blurring:
 * ```
 * pnpm add chartjs-plugin-zoom
 * ```
 * Without it the chart renders exactly as it did before 6.22.0. Where zoom is
 * offered is the host's call — see `MCPUIConfig.chartZoom`, default
 * `'expanded'` (fullscreen modal only).
 */

import {
  Component,
  For,
  createEffect,
  createMemo,
  createUniqueId,
  onCleanup,
  createSignal,
  untrack,
  Show,
} from 'solid-js';
import type { Accessor, JSX } from 'solid-js';
import type { UIComponent, ChartComponentParams } from '../types';
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper';
import { DegradedFallback } from './DegradedFallback';
import { chartToDataTable } from './chart-data-table';
import { useTelemetry } from '../context/MCPUITelemetryContext';
import { useMCPUIConfig } from '../context/MCPUIConfigContext';
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

// ─── Optional zoom peer (v6.22.0) ─────────────────────────────────────────
//
// A chart is a CANVAS, so the CSS-transform approach used by `createPanZoom`
// for DOM surfaces would just magnify a bitmap into a blurry one. Real chart
// zoom means re-projecting the scales, which only Chart.js itself can do —
// hence `chartjs-plugin-zoom`, wired here as an OPTIONAL peer dependency
// alongside `chart.js`, `leaflet` and `@antv/g6`. A host that does not install
// it gets exactly the chart this renderer built before 6.22.0.

let zoomPluginPromise: Promise<unknown | null> | null = null;
let zoomPluginRegistered = false;

/**
 * Import `chartjs-plugin-zoom` once, lazily.
 *
 * Resolves to `null` instead of rejecting when the peer is absent: an optional
 * dependency that is simply not installed is not an error condition, and the
 * caller must be able to fall through to the unzoomable chart without an error
 * state or console noise. The `null` is cached with the promise — a peer that
 * is missing now is still missing on the next chart, and retrying the import
 * per render would re-log the module-resolution failure every time.
 *
 * Only ever called from an effect, never at module scope or during render, so
 * SSR never reaches `hammerjs` (a plugin dependency that reads `document` as
 * it loads).
 *
 * `@vite-ignore` for the same reason `duckdb.ts` and `MapRenderer.tsx` carry
 * it on THEIR optional peers: this library is built with the peer externalised,
 * so the bare specifier survives into the published bundle and a consumer's
 * bundler resolves it statically — an app that never installed the plugin then
 * fails its own dependency scan at build time, long before the `.catch()`
 * below could turn the absence into the supported `null`. The four peers that
 * anyone using the feature at all has installed (`chart.js`, `leaflet`,
 * `@antv/g6`, `highlight.js`) stay bare on purpose: they benefit from the
 * pre-bundling this comment opts out of.
 */
const loadZoomPlugin = (): Promise<unknown | null> => {
  if (!zoomPluginPromise) {
    zoomPluginPromise = import(/* @vite-ignore */ 'chartjs-plugin-zoom')
      .then((module: any) => module.default ?? module)
      .catch(() => null);
  }

  return zoomPluginPromise;
};

/**
 * Load the plugin and register it on the Chart.js singleton, once per process.
 *
 * Registration is global and not undoable, which is precisely why it is
 * deferred to the first surface that actually asks for zoom
 * (`MCPUIConfig.chartZoom`): with the default `'expanded'`, a chart sitting
 * inline in a chat feed never even downloads the plugin.
 *
 * Chart.js only gives the plugin's hooks to charts constructed AFTER the
 * `register()` call, so the caller rebuilds its chart once this resolves.
 *
 * Resolves to `null` on EVERY failure and never rejects. Its one call site is
 * a fire-and-forget `.then()` inside an effect, with nowhere to put a rejection
 * handler that would mean anything to the host: `loadZoomPlugin()` already
 * swallows the missing optional peer, but `loadChartJS()` below rejects on a
 * host that installed neither, and that rejection would surface as an
 * unhandled one. The chart's own render effect reports the missing `chart.js`
 * through `onError` and the degraded table; zoom just quietly is not offered.
 */
const ensureZoomPlugin = async (): Promise<unknown | null> => {
  try {
    const plugin = await loadZoomPlugin();
    if (!plugin) return null;

    if (!zoomPluginRegistered) {
      const Chart: any = await loadChartJS();
      // A stubbed or partial Chart build may not expose `register`; treat that
      // like an absent peer. Returning the plugin here would be worse than
      // returning nothing: the renderer would hang zoom options off a chart
      // that has no zoom hooks, and paint a toolbar whose buttons do nothing.
      if (typeof Chart?.register !== 'function') return null;

      Chart.register(plugin);
      // Set only now that a registration has actually happened, so a later
      // call still gets its chance on a Chart build that does expose it.
      zoomPluginRegistered = true;
    }

    return plugin;
  } catch {
    return null;
  }
};

/**
 * Chart types whose axes zoom meaningfully.
 *
 * `pie`, `doughnut`, `polarArea` and `radar` carry no cartesian scales, so the
 * plugin would capture the wheel and move nothing — strictly worse than not
 * offering zoom at all.
 */
const ZOOMABLE_CHART_TYPES = new Set(['bar', 'line', 'scatter', 'bubble']);

/**
 * Ratio one press of the chart's zoom buttons applies.
 *
 * The same 1.5 the lightbox uses for `+` / `-`: coarse enough that a couple of
 * presses get somewhere, fine enough to stop on a region of interest.
 */
const CHART_ZOOM_BUTTON_FACTOR = 1.5;

/**
 * Whether a chart instance currently sits off its initial viewport.
 *
 * `isZoomedOrPanned()` is the plugin's own API (2.x). The `getZoomLevel()`
 * branch covers an older plugin build that only exposes the zoom factor, and
 * the `false` covers a chart created before the plugin was registered.
 */
const isChartZoomed = (chart: any): boolean => {
  if (typeof chart?.isZoomedOrPanned === 'function') return Boolean(chart.isZoomedOrPanned());
  const level = chart?.getZoomLevel?.();
  return typeof level === 'number' ? level !== 1 : false;
};

/** A JSON-ish object — the only shape a zoom option tree is ever built from. */
const isPlainZoomObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Deep-merge this renderer's zoom block with the consumer's own.
 *
 * `ChartComponentParams.options` is the public Chart.js escape hatch, and
 * `plugins.zoom` is where a host tunes what this renderer cannot guess:
 * `limits`, wheel `speed`, a pan `modifierKey`, its own callbacks. Spreading
 * the renderer's block over it would silently drop the lot, so the two trees
 * are merged branch by branch (`zoom.wheel`, `zoom.pinch`, `zoom.drag`, `pan`,
 * `limits`, …).
 *
 * Two rules, both deliberate:
 *   - on a plain value the CALLER wins — an explicit `mode: 'x'` is a more
 *     specific instruction than this renderer's default `'xy'`;
 *   - on a function both run, renderer first. The only functions the renderer
 *     puts in that tree are `onZoom` / `onPan`, and they are what keeps the
 *     reset control in sync with the viewport — letting a caller's callback
 *     REPLACE them would leave the toolbar lying about the chart, so they are
 *     composed instead.
 */
const mergeZoomOptions = (
  base: Record<string, unknown>,
  override: unknown
): Record<string, unknown> => {
  if (!isPlainZoomObject(override)) return base;

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    // An explicitly-undefined key is an OMISSION, not an instruction to erase.
    // A host forwarding an optional prop — `zoom: { onZoom: props.onZoom }`
    // with nothing passed — would otherwise delete the renderer's own hook,
    // which is exactly what keeps the reset control honest. This is also the
    // semantics `mergeProps` gives every other merge in this package.
    if (value === undefined) continue;

    const ours = merged[key];

    if (isPlainZoomObject(ours) && isPlainZoomObject(value)) {
      merged[key] = mergeZoomOptions(ours, value);
    } else if (typeof ours === 'function' && typeof value === 'function') {
      const rendererHook = ours as (...args: unknown[]) => unknown;
      const callerHook = value as (...args: unknown[]) => unknown;
      merged[key] = (...args: unknown[]) => {
        rendererHook(...args);
        return callerHook(...args);
      };
    } else {
      merged[key] = value;
    }
  }

  return merged;
};

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
  // Reported by `<ExpandableWrapper onExpandedChange>` rather than read from
  // `useExpanded()`: this component IS the wrapper's owner, so its own
  // `useExpanded()` call sits above the wrapper's provider and would only ever
  // see an outer wrapper (see ExpandableWrapperProps.onExpandedChange).
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [zoomPlugin, setZoomPlugin] = createSignal<unknown | null>(null);
  const [isZoomed, setIsZoomed] = createSignal(false);
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: any;
  let renderVersion = 0;

  const params = () => props.component.params as ChartComponentParams;
  const telemetry = useTelemetry();
  const config = useMCPUIConfig();
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

  // ── Zoom / pan (v6.22.0) ───────────────────────────────────────────────

  /**
   * Whether this chart should be capturing the wheel right now: the host
   * policy (`MCPUIConfig.chartZoom`) crossed with the surface the chart
   * currently lives on, and with the chart type.
   *
   * `'expanded'` (the default) only says yes inside `ExpandableWrapper`'s
   * fullscreen modal — the one surface that owns its viewport. Inline, the
   * wheel belongs to the page the chart is scrolling in.
   */
  const zoomWanted = createMemo(() => {
    if (!ZOOMABLE_CHART_TYPES.has(params().type)) return false;
    // `false` (or `null`) on the host's own `plugins.zoom` is Chart.js's
    // documented per-chart plugin opt-out. It speaks about THIS chart, so it
    // beats the host-wide `chartZoom` policy — and gating here rather than at
    // the options merge keeps one source of truth, so the plugin is never even
    // downloaded and the toolbar never offers controls that would do nothing.
    const hostZoom = params().options?.plugins?.zoom;
    if (hostZoom === false || hostZoom === null) return false;
    const mode = config.chartZoom;
    if (mode === 'never') return false;
    if (mode === 'always') return true;
    return isExpanded();
  });

  // Download + register the plugin the first time a surface asks for zoom.
  // `zoomPlugin` is read untracked: setting it must not re-run this effect.
  createEffect(() => {
    if (!zoomWanted() || untrack(zoomPlugin)) return;
    void ensureZoomPlugin().then((plugin) => {
      if (plugin) setZoomPlugin(() => plugin);
    });
  });

  /**
   * The plugin's Chart.js options. Built once per renderer instance so that
   * `zoomOptions()` keeps a STABLE identity: a fresh object each read would
   * look like a config change and rebuild the chart on every update.
   */
  const zoomPluginOptions = {
    zoom: {
      wheel: { enabled: true },
      pinch: { enabled: true },
      // Drag is reserved for panning below; a drag-to-select zoom would make
      // the two gestures fight over the same mouse button.
      drag: { enabled: false },
      mode: 'xy',
      onZoom: ({ chart }: { chart: unknown }) => setIsZoomed(isChartZoomed(chart)),
    },
    pan: {
      enabled: true,
      mode: 'xy',
      onPan: ({ chart }: { chart: unknown }) => setIsZoomed(isChartZoomed(chart)),
    },
  };

  /**
   * The `plugins.zoom` block to merge into the chart config, or `null`.
   *
   * `null` while the peer is absent, which keeps the built config byte-for-byte
   * what it was before 6.22.0 — and, because the memo then never changes value,
   * also keeps expanding the modal from rebuilding the chart at all on a host
   * that did not install the plugin.
   */
  const zoomOptions = createMemo(() => (zoomWanted() && zoomPlugin() ? zoomPluginOptions : null));

  /**
   * Whether the zoom toolbar belongs on screen at all: the chart is zoomable
   * here (host policy × surface × chart type, and the peer actually loaded),
   * and the chart is what is currently being shown.
   */
  const zoomControlsShown = () =>
    Boolean(zoomOptions()) && activeView() === 'chart' && !error();

  /**
   * Zoom the chart by a fixed ratio, about its centre.
   *
   * Every gesture the plugin offers — wheel, drag-pan, pinch — is a POINTER
   * gesture, and the canvas is not focusable, so without these buttons the
   * whole feature is unreachable by keyboard, switch or voice (WCAG 2.1.1) —
   * including the reset control, which only exists once a gesture has already
   * moved the chart. The lightbox settled the same question the same way, with
   * persistent `+` / `-` controls next to its pointer gestures.
   *
   * `chart.zoom()` is `chartjs-plugin-zoom`'s own imperative API; the `?.`
   * covers a chart built before the plugin was registered. The plugin calls
   * `onZoom` itself, but the state is written here too so the reset control
   * appears even on a build whose hook does not fire for a programmatic zoom.
   */
  const handleZoomBy = (factor: number) => {
    chartInstance?.zoom?.(factor);
    setIsZoomed(isChartZoomed(chartInstance));
  };

  /** Back to the chart's initial viewport. */
  const handleResetZoom = () => {
    chartInstance?.resetZoom?.();
    setIsZoomed(false);
  };

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

    // Access params to track dependencies. `zoomOptions()` is read here, before
    // the first `await`, for the same reason: an async effect only tracks what
    // it reads synchronously, and toggling the expanded state has to rebuild
    // the chart rather than leave it on a stale config (Chart.js reads the
    // plugin options at construction and the plugin only hooks charts created
    // after it was registered).
    const chartParams = params();
    const zoom = zoomOptions();
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
      const hostZoomOptions = chartParams.options?.plugins?.zoom;
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
          // Present only once the optional peer has loaded AND the current
          // surface wants zoom. Merged rather than assigned, so a consumer's
          // own `plugins.zoom` survives; when zoom is off, the spread above
          // has already left their block exactly as they wrote it.
          // An explicit `plugins.zoom: false` never reaches here: `zoomWanted`
          // already returned false for it, so `zoom` is null and the spread
          // above carries the host's own value through untouched.
          ...(zoom ? { zoom: mergeZoomOptions(zoom, hostZoomOptions) } : {}),
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

      // A freshly built chart always sits on its initial viewport, so the
      // reset control goes away until the user zooms again.
      setIsZoomed(false);
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
      onExpandedChange={setIsExpanded}
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
            {/* Zoom controls — permanently visible (not hover-revealed like
                the export button) for as long as this chart is zoomable at
                all. Zoom in/out come FIRST and unconditionally: they are the
                only keyboard route into a feature whose gestures are all
                pointer gestures, on a canvas that takes no focus. Reset joins
                them only once the chart is actually off its initial viewport,
                so the toolbar stays quiet on a chart nobody moved. */}
            <Show when={zoomControlsShown()}>
              <div class="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleZoomBy(1 / CHART_ZOOM_BUTTON_FACTOR)}
                  class="opacity-60 hover:opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
                  title={strings.zoomOut}
                  aria-label={strings.zoomOut}
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
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleZoomBy(CHART_ZOOM_BUTTON_FACTOR)}
                  class="opacity-60 hover:opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
                  title={strings.zoomIn}
                  aria-label={strings.zoomIn}
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
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                    />
                  </svg>
                </button>

                <Show when={isZoomed()}>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    class="opacity-60 hover:opacity-100 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
                    title={strings.zoomReset}
                    aria-label={strings.zoomReset}
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </Show>
              </div>
            </Show>
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
