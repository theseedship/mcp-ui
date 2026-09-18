/**
 * Chart zoom with the `chartjs-plugin-zoom` peer NOT installed (v6.22.0).
 *
 * The plugin is optional, so "not installed" is a normal, supported state —
 * not a degraded one. The renderer must build the exact chart config it built
 * before 6.22.0, stay silent on the console, and in particular must NOT rebuild
 * the chart when the modal opens: with no plugin to register, expanding changes
 * nothing about the chart.
 *
 * Forcing the import to reject needs its own module registry (the resolved
 * module and the "already asked" flag are module-scoped), which is why this is
 * a separate file — same reason as `GraphRenderer.fallback.test.tsx`.
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

vi.mock('chartjs-plugin-zoom', () => {
  // Throwing from the factory makes `import('chartjs-plugin-zoom')` reject —
  // the same observable behaviour as a peer a consumer never installed.
  throw new Error('peer not installed (test mock)');
});

vi.mock('chart.js/auto', () => {
  class FakeChart {
    static register = chartHarness.register;

    destroy = vi.fn();
    resize = vi.fn();

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      chartHarness.configs.push(config);
      chartHarness.instances.push(this);
    }
  }

  return { default: FakeChart };
});

function chartComponent(): UIComponent {
  return {
    id: 'chart-no-peer',
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

describe('<ChartJSRenderer> when chartjs-plugin-zoom is unimportable', () => {
  beforeEach(() => {
    chartHarness.register.mockClear();
    chartHarness.configs.length = 0;
    chartHarness.instances.length = 0;
  });

  afterEach(() => cleanup());

  it('renders the chart unchanged and stays silent on the console', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();

    const { getByRole } = render(() => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
        <ChartJSRenderer component={chartComponent()} onError={onError} />
      </MCPUIConfigProvider>
    ));

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    await Promise.resolve();

    expect(getByRole('img', { name: 'Quarterly sales' })).toBeTruthy();
    expect(chartHarness.configs[0].options.plugins.zoom).toBeUndefined();
    expect(chartHarness.register).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    // A missing OPTIONAL peer is not a problem worth reporting to the host.
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    error.mockRestore();
    warn.mockRestore();
  });

  it('does not rebuild the chart when the modal opens, and offers no reset control', async () => {
    const { getByLabelText } = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Quarterly sales"]')).toBeTruthy(),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(chartHarness.instances).toHaveLength(1);
    expect(chartHarness.instances[0].destroy).not.toHaveBeenCalled();
    expect(within(document.body).queryByLabelText('Reset zoom')).toBeNull();
  });
});
