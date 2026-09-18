import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from 'solid-js';
import type { UIComponent } from '../types';
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext';
import { ChartJSRenderer } from './ChartJSRenderer';
import { ScratchpadPanel } from './ScratchpadPanel';
import { UIResourceRenderer } from './UIResourceRenderer';
import { chartToDataTable } from './chart-data-table';

const chartHarness = vi.hoisted(() => ({
  fail: false,
  configs: [] as unknown[],
  instances: [] as Array<{ destroy: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn> }>,
}));

vi.mock('chart.js/auto', () => {
  class FakeChart {
    destroy = vi.fn();
    resize = vi.fn();

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      if (chartHarness.fail) throw new Error('paint failed');
      chartHarness.configs.push(config);
      chartHarness.instances.push(this);
    }
  }

  return { default: FakeChart };
});

function chartComponent(params: Record<string, unknown> = {}): UIComponent {
  return {
    id: 'chart-1',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      title: 'Quarterly sales',
      data: {
        labels: ['Q1', 'Q2'],
        datasets: [{ label: 'Revenue', data: [10, 20] }],
      },
      exportable: false,
      ...params,
    },
  } as UIComponent;
}

describe('chartToDataTable', () => {
  it('projects categorical bar and line data without dropping uneven values', () => {
    expect(
      chartToDataTable({
        type: 'line',
        data: {
          labels: ['Jan', 'Feb'],
          datasets: [
            { label: 'North', data: [1, 2] },
            { label: 'South', data: [3] },
          ],
        },
      }),
    ).toEqual({
      columns: ['Label', 'North', 'South'],
      rows: [
        ['Jan', 1, 3],
        ['Feb', 2, ''],
      ],
    });
  });

  it('keeps scatter x/y and bubble x/y/r in separate cells', () => {
    expect(
      chartToDataTable({
        type: 'scatter',
        data: { datasets: [{ label: 'Observations', data: [{ x: 2, y: 8 }] }] },
      }),
    ).toEqual({
      columns: ['Series', 'Point', 'x', 'y'],
      rows: [['Observations', 1, 2, 8]],
    });

    expect(
      chartToDataTable({
        type: 'bubble',
        data: { datasets: [{ label: 'Cities', data: [{ x: 4, y: 6, r: 12 }] }] },
      }),
    ).toEqual({
      columns: ['Series', 'Point', 'x', 'y', 'r'],
      rows: [['Cities', 1, 4, 6, 12]],
    });
  });
});

describe('<ChartJSRenderer>', () => {
  beforeEach(() => {
    chartHarness.fail = false;
    chartHarness.configs.length = 0;
    chartHarness.instances.length = 0;
  });

  afterEach(() => cleanup());

  it('keeps the native chart default and exposes a titled, described canvas', async () => {
    const { getByRole } = render(() => <ChartJSRenderer component={chartComponent()} />);

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    const canvas = getByRole('img', { name: 'Quarterly sales' });
    const description = document.getElementById(canvas.getAttribute('aria-describedby')!);

    expect(description?.textContent).toContain('Quarterly sales');
    expect(description?.textContent).toContain('Exact values are available in the data view.');
    expect(chartHarness.configs[0]).toMatchObject({
      type: 'bar',
      data: { labels: ['Q1', 'Q2'] },
    });
  });

  it('uses keyboard-native buttons to toggle a successful chart to its exact data', async () => {
    const { getByRole, getAllByRole } = render(() => (
      <ChartJSRenderer component={chartComponent({ exportable: true })} />
    ));
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    const chartButton = getByRole('button', { name: 'Chart' });
    const dataButton = getByRole('button', { name: 'Data' });
    expect(chartButton.tagName).toBe('BUTTON');
    expect(dataButton.tabIndex).toBe(0);
    expect(chartButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(dataButton);
    expect(dataButton.getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'Download chart as PNG' }).hasAttribute('disabled')).toBe(true);
    expect(getByRole('table', { name: 'Quarterly sales — Chart data' })).toBeTruthy();
    expect(getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Label',
      'Revenue',
    ]);
    expect(getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Q1', '10', 'Q2', '20']);

    fireEvent.click(chartButton);
    await waitFor(() => expect(chartHarness.instances[0].resize).toHaveBeenCalled());
  });

  it('bounds every inline data row to the configured height and fills the expanded viewport', async () => {
    const labels = Array.from({ length: 40 }, (_, index) => `Row ${index + 1}`);
    const values = labels.map((_, index) => index + 1);
    const { getByRole, getByLabelText } = render(() => (
      <ChartJSRenderer
        component={chartComponent({
          height: '18rem',
          data: { labels, datasets: [{ label: 'Revenue', data: values }] },
        })}
      />
    ));

    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    fireEvent.click(getByRole('button', { name: 'Data' }));
    const table = getByRole('table', { name: 'Quarterly sales — Chart data' });
    const viewport = table.parentElement!;

    expect(viewport.style.height).toBe('18rem');
    expect(viewport.style.maxHeight).toBe('70vh');
    expect(viewport.classList.contains('overflow-auto')).toBe(true);
    expect(table.textContent).toContain('Row 40');
    expect(table.textContent).toContain('40');

    fireEvent.click(getByLabelText('Expand'));
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Quarterly sales"]')).toBeTruthy(),
    );
    expect(viewport.style.height).toBe('');
    expect(viewport.style.maxHeight).toBe('');
    expect(viewport.classList.contains('flex-1')).toBe(true);
    expect(viewport.classList.contains('min-h-0')).toBe(true);
    expect(table.textContent).toContain('Row 40');

    // v6.22.0 — the default `chartZoom: 'expanded'` does ask for zoom inside
    // the modal, but the `FakeChart` above is a partial Chart build with no
    // static `register`, so the plugin can never be registered and zoom is
    // never offered. Nothing about the chart config changed, so the canvas is
    // reparented into the modal with its ORIGINAL instance still on it: no
    // rebuild, no destroy, no double-render. The rebuild-on-register path is
    // covered where a Chart stub actually exposes `register`
    // (`ChartJSRenderer.zoom.test.tsx`), and the stub without one gets its own
    // file (`ChartJSRenderer.zoom.no-register.test.tsx`).
    //
    // "Nothing happened" is only worth asserting once the thing that would
    // have happened has had its chance. This file does not mock
    // `chartjs-plugin-zoom`, so the renderer is waiting on the REAL module —
    // awaiting the same two registry entries its plugin effect awaits puts
    // this test behind them, and the loop drains the handful of microtask
    // hops `ensureZoomPlugin`'s async body adds on top. A bare
    // `await Promise.resolve()` returns long before the import settles, which
    // would pass whether or not the partial build is handled.
    await import('chartjs-plugin-zoom').catch(() => null);
    await import('chart.js/auto');
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(chartHarness.instances).toHaveLength(1);
    expect(chartHarness.instances[0].destroy).not.toHaveBeenCalled();
  });

  it('uses the default data height and applies a custom class to the chart wrapper', () => {
    const { container, getByRole } = render(() => (
      <ChartJSRenderer component={chartComponent({ className: 'consumer-chart-shell' })} />
    ));

    fireEvent.click(getByRole('button', { name: 'Data' }));
    const table = getByRole('table', { name: 'Quarterly sales — Chart data' });
    const wrapper = container.querySelector('.consumer-chart-shell');

    expect(table.parentElement?.style.height).toBe('250px');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.contains(table)).toBe(true);
    expect(wrapper?.classList.contains('rounded-lg')).toBe(true);
  });

  it('makes the data view available while the native chart is still loading', () => {
    const { getByRole, queryByText } = render(() => (
      <ChartJSRenderer component={chartComponent()} />
    ));

    fireEvent.click(getByRole('button', { name: 'Data' }));
    expect(getByRole('table', { name: 'Quarterly sales — Chart data' })).toBeTruthy();
    expect(queryByText('Loading chart...')).toBeNull();
  });

  it('updates both Chart.js and the selected data view when props change', async () => {
    const [component, setComponent] = createSignal(chartComponent());
    const { getByRole } = render(() => <ChartJSRenderer component={component()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));
    fireEvent.click(getByRole('button', { name: 'Data' }));

    setComponent(
      chartComponent({
        title: 'Updated sales',
        data: { labels: ['Q3'], datasets: [{ label: 'Revenue', data: [30] }] },
      }),
    );

    await waitFor(() => expect(chartHarness.instances).toHaveLength(2));
    expect(chartHarness.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(getByRole('table', { name: 'Updated sales — Chart data' }).textContent).toContain('30');
  });

  it('shows a localized empty state and localized view controls', async () => {
    const component = chartComponent({
      title: 'Vide',
      data: { labels: [], datasets: [] },
    });
    const { getByRole, getByText } = render(() => (
      <MCPUIStringsProvider
        strings={{
          chartView: 'Graphique',
          chartDataView: 'Données',
          chartViewSelector: 'Vue graphique ou données',
          chartDataTable: 'Données du graphique',
          chartDataSummary: 'Les valeurs exactes sont disponibles dans la vue données.',
          chartNoData: 'Aucune donnée',
        }}
      >
        <ChartJSRenderer component={component} />
      </MCPUIStringsProvider>
    ));
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    expect(getByRole('group', { name: 'Vue graphique ou données' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Données' }));
    expect(getByRole('table', { name: 'Vide — Données du graphique' })).toBeTruthy();
    expect(getByText('Aucune donnée')).toBeTruthy();
  });

  it('retains a useful, coordinate-faithful table when Chart.js throws', async () => {
    chartHarness.fail = true;
    const onError = vi.fn();
    const component = chartComponent({
      type: 'bubble',
      title: 'Bubbles',
      data: { datasets: [{ label: 'Sample', data: [{ x: 1, y: 2, r: 3 }] }] },
    });
    const { getByText, getAllByRole } = render(() => (
      <ChartJSRenderer component={component} onError={onError} />
    ));

    await waitFor(() => expect(getByText('Chart rendering failed: paint failed')).toBeTruthy());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Series',
      'Point',
      'x',
      'y',
      'r',
    ]);
    expect(getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Sample',
      '1',
      '1',
      '2',
      '3',
    ]);
  });

  it('destroys the Chart.js instance on unmount', async () => {
    const view = render(() => <ChartJSRenderer component={chartComponent()} />);
    await waitFor(() => expect(chartHarness.instances).toHaveLength(1));

    view.unmount();
    expect(chartHarness.instances[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('exposes the data view through UIResourceRenderer native charts', async () => {
    const { getByRole } = render(() => (
      <UIResourceRenderer content={chartComponent({ renderer: 'native' })} />
    ));

    await waitFor(() => expect(getByRole('group', { name: 'Chart or data view' })).toBeTruthy());
    fireEvent.click(getByRole('button', { name: 'Data' }));
    expect(getByRole('table', { name: 'Quarterly sales — Chart data' })).toBeTruthy();
  });

  it('exposes the data view through ScratchpadPanel chart sections', async () => {
    const { getByRole } = render(() => (
      <ScratchpadPanel
        state={{
          id: 'scratch-1',
          title: 'Analysis',
          status: 'ready',
          filters: {},
          agentMessages: [],
          sections: [
            {
              id: 'section-chart',
              title: 'Sales',
              type: 'chart',
              editable: false,
              source: 'agent',
              content: chartComponent().params,
            },
          ],
        }}
      />
    ));

    await waitFor(() => expect(getByRole('group', { name: 'Chart or data view' })).toBeTruthy());
    fireEvent.click(getByRole('button', { name: 'Data' }));
    expect(getByRole('table', { name: 'Quarterly sales — Chart data' })).toBeTruthy();
  });
});
