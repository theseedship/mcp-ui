/**
 * Chart zoom against a PARTIAL Chart.js build — one with no `register`
 * (v6.22.0).
 *
 * `chartjs-plugin-zoom` only ever reaches a chart through
 * `Chart.register(plugin)`. A build that does not expose `register` — a stub,
 * a trimmed tree-shaken bundle, a mock in a consumer's own test suite — can
 * therefore never receive the plugin's hooks, and the honest outcome is the
 * same as an uninstalled peer: the chart before 6.22.0, with no zoom toolbar.
 * Attaching `plugins.zoom` anyway would paint buttons over a chart whose
 * `zoom()` / `resetZoom()` do not exist.
 *
 * The "already registered" flag is module-scoped, so proving that nothing was
 * registered needs a module registry where nothing could be — hence a file of
 * its own, the same reason `ChartJSRenderer.zoom.never.test.tsx` has one.
 */

import { cleanup, fireEvent, render, waitFor, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { MCPUIConfigProvider } from '../context/MCPUIConfigContext';
import { ChartJSRenderer } from './ChartJSRenderer';

const chartHarness = vi.hoisted(() => ({
  configs: [] as any[],
  instances: [] as any[],
}));

const zoomPlugin = vi.hoisted(() => ({ id: 'zoom' }));

// Installed and importable: the peer is not what is missing here.
vi.mock('chartjs-plugin-zoom', () => ({ default: zoomPlugin }));

vi.mock('chart.js/auto', () => {
  // Deliberately NO static `register` — that is the whole subject of the file.
  class PartialChart {
    destroy = vi.fn();
    resize = vi.fn();

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      chartHarness.configs.push(config);
      chartHarness.instances.push(this);
    }
  }

  return { default: PartialChart };
});

function chartComponent(): UIComponent {
  return {
    id: 'chart-partial-chartjs',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      title: 'Quarterly sales',
      data: { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [10, 20] }] },
      exportable: false,
    },
  } as UIComponent;
}

describe('<ChartJSRenderer> against a Chart build without register()', () => {
  beforeEach(() => {
    chartHarness.configs.length = 0;
    chartHarness.instances.length = 0;
  });

  afterEach(() => cleanup());

  it('offers no zoom at all rather than zoom options the chart has no hooks for', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();

    const { queryByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer component={chartComponent()} onError={onError} />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    // Give the plugin effect every chance to resolve before claiming it did
    // not change anything.
    await Promise.resolve();
    await Promise.resolve();

    expect(chartHarness.configs.at(-1).options.plugins.zoom).toBeUndefined();
    // No plugin means no rebuild: the first chart is still the only one.
    expect(chartHarness.instances).toHaveLength(1);
    expect(chartHarness.instances[0].destroy).not.toHaveBeenCalled();

    expect(queryByLabelText('Zoom in')).toBeNull();
    expect(queryByLabelText('Zoom out')).toBeNull();
    expect(queryByLabelText('Reset zoom')).toBeNull();

    // A Chart build that cannot take plugins is not a host-facing error.
    expect(onError).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    error.mockRestore();
    warn.mockRestore();
  });

  it('keeps expanding cheap: the modal asks again and still gets nothing', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    // The default policy (`'expanded'`) asks for the plugin here for the first
    // time. Nothing was registered on the previous attempt either, so the
    // renderer must not have cached a false "registered" and started handing
    // the plugin out.
    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Quarterly sales"]')).toBeTruthy(),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(chartHarness.instances).toHaveLength(1);
    expect(chartHarness.configs.at(-1).options.plugins.zoom).toBeUndefined();
    expect(within(document.body).queryByLabelText('Zoom in')).toBeNull();
  });
});
