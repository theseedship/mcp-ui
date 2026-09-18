/**
 * Chart zoom gating (v6.22.0) — `chartjs-plugin-zoom` PRESENT.
 *
 * A chart is a canvas, so it cannot borrow `createPanZoom` the way the
 * lightbox does: a CSS transform would magnify a bitmap. Zoom therefore means
 * the real Chart.js plugin, registered globally and irreversibly — which is
 * why the renderer defers registration until a surface that OWNS its viewport
 * actually asks for it (`MCPUIConfig.chartZoom`, default `'expanded'`).
 *
 * The registration flag lives at module scope, so a "never registered" claim
 * is only meaningful inside a module registry where nothing registered yet:
 * `chartHarness.register` is deliberately NOT cleared between tests, and the
 * inline case asserts its CUMULATIVE count. `chartZoom: 'never'` gets its own
 * file (`ChartJSRenderer.zoom.never.test.tsx`) for the same reason, as does
 * the missing-peer path (`ChartJSRenderer.zoom-absent.test.tsx`).
 */

import { cleanup, fireEvent, render, waitFor, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { MCPUIConfigProvider } from '../context/MCPUIConfigContext';
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext';
import { ChartJSRenderer } from './ChartJSRenderer';

const chartHarness = vi.hoisted(() => ({
  register: vi.fn(),
  configs: [] as any[],
  instances: [] as any[],
}));

/** Stand-in for the plugin object: the renderer only ever forwards it. */
const zoomPlugin = vi.hoisted(() => ({ id: 'zoom' }));

vi.mock('chartjs-plugin-zoom', () => ({ default: zoomPlugin }));

vi.mock('chart.js/auto', () => {
  class FakeChart {
    static register = chartHarness.register;

    destroy = vi.fn();
    resize = vi.fn();
    /** Mirrors the plugin's own instance API, which the renderer reads. */
    zoomed = false;
    /** Cumulative zoom factor, rounded so 1.5 × 1/1.5 comes back to exactly 1. */
    level = 1;
    isZoomedOrPanned = () => this.zoomed;
    zoom = vi.fn((factor: number) => {
      this.level = Math.round(this.level * factor * 1e6) / 1e6;
      this.zoomed = this.level !== 1;
    });
    resetZoom = vi.fn(() => {
      this.zoomed = false;
      this.level = 1;
    });

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      chartHarness.configs.push(config);
      chartHarness.instances.push(this);
    }
  }

  return { default: FakeChart };
});

function chartComponent(params: Record<string, unknown> = {}): UIComponent {
  return {
    id: 'chart-zoom',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      title: 'Quarterly sales',
      data: { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [10, 20] }] },
      exportable: false,
      ...params,
    },
  } as UIComponent;
}

/** The `plugins.zoom` block of the chart built last, or `undefined`. */
const latestZoomOptions = () =>
  chartHarness.configs.at(-1)?.options?.plugins?.zoom as any | undefined;

describe('<ChartJSRenderer> zoom — plugin installed', () => {
  beforeEach(() => {
    // `register` is NOT cleared: registration happens once per module
    // registry, so its cumulative count is the only honest signal.
    chartHarness.configs.length = 0;
    chartHarness.instances.length = 0;
  });

  afterEach(() => cleanup());

  it('leaves an inline chart alone under the default policy — no plugin, no wheel capture', async () => {
    const { queryByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    // Give the (unwanted) plugin effect every chance to fire before claiming it did not.
    await Promise.resolve();

    expect(chartHarness.register).not.toHaveBeenCalled();
    expect(latestZoomOptions()).toBeUndefined();
    expect(queryByLabelText('Reset zoom')).toBeNull();
    expect(queryByLabelText('Zoom in')).toBeNull();
    expect(queryByLabelText('Zoom out')).toBeNull();
  });

  it('registers the plugin and rebuilds the chart with zoom options when the modal opens', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    expect(latestZoomOptions()).toBeUndefined();

    fireEvent.click(getByLabelText('Expand'));

    await waitFor(() => expect(chartHarness.register).toHaveBeenCalledTimes(1));
    expect(chartHarness.register).toHaveBeenCalledWith(zoomPlugin);

    // Chart.js only hands the plugin's hooks to charts built after
    // `register()`, so the chart has to be rebuilt rather than patched.
    await waitFor(() => expect(chartHarness.instances).toHaveLength(2));
    expect(chartHarness.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(latestZoomOptions()).toMatchObject({
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        drag: { enabled: false },
        mode: 'xy',
      },
      pan: { enabled: true, mode: 'xy' },
    });
  });

  it('drops back to a zoom-free chart when the modal closes again', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());

    fireEvent.click(within(document.body).getByLabelText('Close expanded view'));
    await waitFor(() => expect(chartHarness.instances).toHaveLength(3));
    expect(latestZoomOptions()).toBeUndefined();
  });

  it('shows the reset control only once the chart is actually off its initial viewport', async () => {
    const { getByLabelText, queryByLabelText } = render(() => (
      <ChartJSRenderer component={chartComponent()} />
    ));
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());

    const modal = within(document.body);
    expect(modal.queryByLabelText('Reset zoom')).toBeNull();

    // Drive the plugin's own callback, the way a wheel gesture would.
    const chart = chartHarness.instances.at(-1);
    chart.zoomed = true;
    latestZoomOptions()!.zoom.onZoom({ chart });

    const reset = await waitFor(() => modal.getByLabelText('Reset zoom'));
    expect(reset.getAttribute('title')).toBe('Reset zoom');

    fireEvent.click(reset);
    expect(chart.resetZoom).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(modal.queryByLabelText('Reset zoom')).toBeNull());
    expect(queryByLabelText('Reset zoom')).toBeNull();
  });

  it('localizes the reset control and pans on drag as well as zooming on wheel', async () => {
    const { getByLabelText } = render(() => (
      <MCPUIStringsProvider
        strings={{ zoomReset: 'Réinitialiser le zoom', zoomIn: 'Agrandir', zoomOut: 'Réduire' }}
      >
        <ChartJSRenderer component={chartComponent()} />
      </MCPUIStringsProvider>
    ));
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());

    const chart = chartHarness.instances.at(-1);
    chart.zoomed = true;
    // `onPan` must feed the same state as `onZoom`: a pan alone already moves
    // the chart off its initial viewport.
    latestZoomOptions()!.pan.onPan({ chart });

    const reset = await waitFor(() => within(document.body).getByLabelText('Réinitialiser le zoom'));
    expect(reset.getAttribute('title')).toBe('Réinitialiser le zoom');
    // The keyboard controls go through the same catalogue.
    expect(within(document.body).getByLabelText('Agrandir').getAttribute('title')).toBe('Agrandir');
    expect(within(document.body).getByLabelText('Réduire')).toBeTruthy();
  });

  it('offers zoom in and out without a pointer gesture, so the feature is keyboard-reachable', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());

    // Every gesture the plugin offers — wheel, drag-pan, pinch — is a pointer
    // gesture, and the canvas takes no focus. Without these buttons a keyboard,
    // switch or voice user cannot magnify anything, and cannot even reach the
    // reset control, which does not exist until a gesture has already moved
    // the chart. The lightbox settled the same question the same way.
    const modal = within(document.body);
    expect(modal.queryByLabelText('Reset zoom')).toBeNull();

    fireEvent.click(modal.getByLabelText('Zoom in'));
    const chart = chartHarness.instances.at(-1);
    expect(chart.zoom).toHaveBeenLastCalledWith(1.5);
    // Zooming from the toolbar is a zoom like any other: the reset appears.
    await waitFor(() => expect(modal.getByLabelText('Reset zoom')).toBeTruthy());

    // Zoom out is the way back, one notch at a time: this one lands the chart
    // exactly on its initial viewport again, so the reset control goes away.
    fireEvent.click(modal.getByLabelText('Zoom out'));
    expect(chart.zoom).toHaveBeenLastCalledWith(1 / 1.5);
    await waitFor(() => expect(modal.queryByLabelText('Reset zoom')).toBeNull());

    fireEvent.click(modal.getByLabelText('Zoom in'));
    fireEvent.click(await waitFor(() => modal.getByLabelText('Reset zoom')));
    expect(chart.resetZoom).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(modal.queryByLabelText('Reset zoom')).toBeNull());
    // …but zoom in / out stay, because they are the way back in.
    expect(modal.getByLabelText('Zoom in')).toBeTruthy();
    expect(modal.getByLabelText('Zoom out')).toBeTruthy();
  });

  it('hides the zoom controls behind the data view, which has no viewport to zoom', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());

    const modal = within(document.body);
    expect(modal.getByLabelText('Zoom in')).toBeTruthy();

    fireEvent.click(modal.getByText('Data'));
    await waitFor(() => expect(modal.queryByLabelText('Zoom in')).toBeNull());
  });

  it('enables zoom inline when the host opts in with chartZoom "always"', async () => {
    render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer component={chartComponent()} />
      </MCPUIConfigProvider>
    ));

    // No modal is ever opened here — the inline chart itself carries the zoom.
    await waitFor(() => expect(latestZoomOptions()).toBeTruthy());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('never zooms a chart type that has no cartesian scales', async () => {
    render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer
          component={chartComponent({
            type: 'pie',
            data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, 2] }] },
          })}
        />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    await Promise.resolve();
    // A pie has no scales: the plugin would eat the wheel and move nothing.
    expect(latestZoomOptions()).toBeUndefined();
  });

  it("keeps the consumer's own plugins.zoom instead of overwriting it", async () => {
    // `ChartComponentParams.options` is the public Chart.js escape hatch, so
    // `plugins.zoom` is a supported place for a host to put what this renderer
    // cannot guess. Overwriting the key would throw away axis limits, wheel
    // speed and the host's own callbacks, silently.
    const onZoomComplete = vi.fn();

    const { getByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer
          component={chartComponent({
            options: {
              plugins: {
                legend: { position: 'top' },
                zoom: {
                  limits: { x: { min: 0, max: 100 }, y: { min: -10 } },
                  zoom: { wheel: { speed: 0.05 }, onZoomComplete },
                  pan: { modifierKey: 'ctrl' },
                },
              },
            },
          })}
        />
      </MCPUIConfigProvider>
    ));

    // `pinch` only ever comes from the renderer, so it marks the merged
    // config — the pre-plugin chart already carries the consumer's block.
    await waitFor(() => expect(latestZoomOptions()?.zoom?.pinch).toBeTruthy());
    const merged = latestZoomOptions()!;

    // Everything the host configured survives…
    expect(merged.limits).toEqual({ x: { min: 0, max: 100 }, y: { min: -10 } });
    expect(merged.zoom.onZoomComplete).toBe(onZoomComplete);
    expect(merged.pan.modifierKey).toBe('ctrl');
    // …merged into, not over, what the renderer needs to work.
    expect(merged.zoom.wheel).toEqual({ enabled: true, speed: 0.05 });
    expect(merged.zoom.pinch).toEqual({ enabled: true });
    expect(merged.zoom.drag).toEqual({ enabled: false });
    expect(merged.zoom.mode).toBe('xy');
    expect(merged.pan.enabled).toBe(true);
    expect(merged.pan.mode).toBe('xy');
    // The neighbouring plugin blocks are untouched by any of this.
    expect(chartHarness.configs.at(-1).options.plugins.legend).toMatchObject({
      display: true,
      position: 'top',
    });

    // And the renderer's own `onZoom` still fires, so the reset control still
    // knows when the chart is off its initial viewport.
    const chart = chartHarness.instances.at(-1);
    chart.zoomed = true;
    merged.zoom.onZoom({ chart });

    const reset = await waitFor(() => getByLabelText('Reset zoom'));
    fireEvent.click(reset);
    expect(chart.resetZoom).toHaveBeenCalledTimes(1);
  });

  it("treats an explicitly-undefined consumer value as an omission, not an erasure", async () => {
    // A host forwarding an optional prop — `onZoom: props.onZoom` with nothing
    // passed — serialises to a key whose value is `undefined`. Letting that
    // overwrite would delete the renderer's own hook and leave the reset
    // control lying about the chart.
    const { getByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer
          component={chartComponent({
            options: {
              plugins: {
                zoom: {
                  limits: undefined,
                  zoom: { mode: undefined, onZoom: undefined, wheel: { speed: 0.05 } },
                  pan: { mode: undefined },
                },
              },
            },
          })}
        />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(latestZoomOptions()?.zoom?.pinch).toBeTruthy());
    const merged = latestZoomOptions()!;

    // The renderer's own values survive the undefined keys…
    expect(merged.zoom.mode).toBe('xy');
    expect(merged.pan.mode).toBe('xy');
    expect(typeof merged.zoom.onZoom).toBe('function');
    // …and the one value the host really did set still wins.
    expect(merged.zoom.wheel).toEqual({ enabled: true, speed: 0.05 });

    // The surviving hook is what makes the reset control appear.
    const chart = chartHarness.instances.at(-1);
    chart.zoomed = true;
    merged.zoom.onZoom({ chart });
    await waitFor(() => expect(getByLabelText('Reset zoom')).toBeTruthy());
  });

  it('honours plugins.zoom: false, the documented Chart.js per-chart opt-out', async () => {
    // `false` disables one plugin for one chart. It is a deliberate host
    // instruction and must beat `chartZoom`, or a consumer who switched zoom
    // off finds it back on the moment the chart is expanded.
    const { queryByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer
          component={chartComponent({ options: { plugins: { zoom: false } } })}
        />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(chartHarness.instances.length).toBeGreaterThan(0));
    await Promise.resolve();

    // The host's value reaches Chart.js untouched — not a merged block.
    expect(latestZoomOptions()).toBe(false);
    expect(queryByLabelText('Zoom in')).toBeNull();
  });

  it("composes the consumer's onZoom / onPan with its own rather than replacing them", async () => {
    // Two callbacks want the same key. Either alone loses something real: the
    // host's telemetry, or the reset button's honesty. So both run.
    const onZoom = vi.fn();
    const onPan = vi.fn();

    const { getByLabelText, queryByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer
          component={chartComponent({
            options: {
              plugins: { zoom: { zoom: { onZoom }, pan: { mode: 'x', onPan } } },
            },
          })}
        />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(latestZoomOptions()?.zoom?.pinch).toBeTruthy());
    const merged = latestZoomOptions()!;
    // On a plain value the caller wins: an explicit `'x'` is the more specific
    // instruction, and the renderer's `'xy'` was only ever a default.
    expect(merged.pan.mode).toBe('x');

    const chart = chartHarness.instances.at(-1);
    chart.zoomed = true;
    merged.zoom.onZoom({ chart });

    expect(onZoom).toHaveBeenCalledWith({ chart });
    fireEvent.click(await waitFor(() => getByLabelText('Reset zoom')));
    await waitFor(() => expect(queryByLabelText('Reset zoom')).toBeNull());

    // Same bargain on the pan side.
    chart.zoomed = true;
    merged.pan.onPan({ chart });

    expect(onPan).toHaveBeenCalledWith({ chart });
    expect(await waitFor(() => getByLabelText('Reset zoom'))).toBeTruthy();
  });
});
