/**
 * `MCPUIConfig.chartZoom: 'never'` (v6.22.0) — the opt-out.
 *
 * `Chart.register()` is global and not undoable, so "the plugin is never
 * registered" can only be proven in a module registry where nothing else
 * registered it. Vitest gives each test FILE its own registry, hence this
 * separate file: `ChartJSRenderer.zoom.test.tsx` registers the plugin on
 * purpose and would make the claim below vacuous.
 */

import { cleanup, fireEvent, render, waitFor, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { MCPUIConfigProvider } from '../context/MCPUIConfigContext';
import { ChartJSRenderer } from './ChartJSRenderer';

const chartHarness = vi.hoisted(() => ({
  register: vi.fn(),
  configs: [] as any[],
  instances: [] as any[],
}));

const zoomPlugin = vi.hoisted(() => ({ id: 'zoom' }));

// Installed and importable — the renderer must still leave it alone.
vi.mock('chartjs-plugin-zoom', () => ({ default: zoomPlugin }));

vi.mock('chart.js/auto', () => {
  class FakeChart {
    static register = chartHarness.register;

    destroy = vi.fn();
    resize = vi.fn();
    resetZoom = vi.fn();
    isZoomedOrPanned = () => false;

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      chartHarness.configs.push(config);
      chartHarness.instances.push(this);
    }
  }

  return { default: FakeChart };
});

function chartComponent(): UIComponent {
  return {
    id: 'chart-no-zoom',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'line',
      title: 'Quarterly sales',
      data: { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [10, 20] }] },
      exportable: false,
    },
  } as UIComponent;
}

describe('<ChartJSRenderer> with chartZoom "never"', () => {
  beforeEach(() => {
    chartHarness.configs.length = 0;
    chartHarness.instances.length = 0;
  });

  afterEach(() => cleanup());

  it('never registers the plugin, inline or expanded, and never rebuilds the chart', async () => {
    const { getByLabelText } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'never' }}>
        <ChartJSRenderer component={chartComponent()} />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    expect(chartHarness.configs[0].options.plugins.zoom).toBeUndefined();

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Quarterly sales"]')).toBeTruthy(),
    );
    // Flush the microtask queue the plugin effect would have used.
    await Promise.resolve();
    await Promise.resolve();

    expect(chartHarness.register).not.toHaveBeenCalled();
    // The chart config is unchanged, so there is nothing to rebuild for.
    expect(chartHarness.instances).toHaveLength(1);
    expect(within(document.body).queryByLabelText('Reset zoom')).toBeNull();
  });
});
