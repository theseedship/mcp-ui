import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Chart from 'chart.js/auto';
import type { UIComponent } from '../types';
import { ChartJSRenderer } from './ChartJSRenderer';

// Run the real installed Chart.js controller/plugin pipeline. Only raster
// drawing is stubbed: palette selection and option resolution are not mocks.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    const state: Record<string, any> = {
      canvas: this,
      measureText: (value: unknown) => ({ width: String(value).length * 7 }),
      getLineDash: () => [],
    };
    return new Proxy(state, {
      get: (target, key: string) => (key in target ? target[key] : () => {}),
      set: (target, key: string, value) => {
        target[key] = value;
        return true;
      },
    }) as any;
  });
  const actual = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const result = actual(element);
    const original = result.getPropertyValue.bind(result);
    result.getPropertyValue = (name) => {
      if (name.startsWith('--mcp-ui-')) {
        let node: Element | null = element;
        while (node) {
          const value = (node as HTMLElement).style?.getPropertyValue(name);
          if (value) return value;
          node = node.parentElement;
        }
      }
      return original(name);
    };
    return result;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function component(options: any = {}, data?: any): UIComponent {
  return {
    id: 'real-chart',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      exportable: false,
      data: data ?? { labels: ['A', 'B'], datasets: [{ data: [1, 2] }, { data: [2, 3] }] },
      options: { responsive: false, animation: false, ...options },
    },
  };
}

async function mountedChart(container: HTMLElement) {
  return waitFor(() => {
    const canvas = container.querySelector('canvas')!;
    const chart = Chart.getChart(canvas);
    expect(chart).toBeDefined();
    expect(chart!.scales).not.toEqual({});
    return chart!;
  });
}

describe('real Chart.js scoped theme pipeline', () => {
  it.each([
    [{ borderColor: '#abcdef' }, '#123456', '#abcdef'],
    [{ backgroundColor: '#abcdef' }, '#abcdef', '#123456'],
    [{ backgroundColor: '#abcdef', borderColor: '#fedcba' }, '#abcdef', '#fedcba'],
    [{ datasets: { line: { borderColor: '#abcdef' } } }, '#123456', '#123456'],
    [{ elements: { point: { borderColor: '#abcdef' } } }, '#123456', '#123456'],
    [{ elements: { bar: { borderColor: '#abcdef' } } }, '#123456', '#abcdef'],
    [{ datasets: { bar: { backgroundColor: '#abcdef' } } }, '#abcdef', '#123456'],
  ])('resolves each paint independently under caller options %j', async (options, fill, border) => {
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={component(options)} /></div>);
    const chart = await mountedChart(container);
    const paint = chart.getDatasetMeta(0).data[0].options;
    expect(paint.backgroundColor).toBe(fill);
    expect(paint.borderColor).toBe(border);
  });
  it('isolates multiple host scopes rendering the exact same caller payload', async () => {
    const shared = component();
    const { container } = render(() => (
      <>
        <div data-scope="default">
          <ChartJSRenderer component={shared} />
        </div>
        <div data-scope="red" style={{ '--mcp-ui-chart-1': '#aa0000' }}>
          <ChartJSRenderer component={shared} />
        </div>
        <div data-scope="green" style={{ '--mcp-ui-chart-1': '#00aa00' }}>
          <ChartJSRenderer component={shared} />
        </div>
      </>
    ));
    const defaultChart = await mountedChart(
      container.querySelector<HTMLElement>('[data-scope="default"]')!
    );
    const redChart = await mountedChart(
      container.querySelector<HTMLElement>('[data-scope="red"]')!
    );
    const greenChart = await mountedChart(
      container.querySelector<HTMLElement>('[data-scope="green"]')!
    );
    expect(defaultChart.data.datasets[0].backgroundColor).toBe('rgba(54, 162, 235, 0.5)');
    expect(redChart.data.datasets[0].backgroundColor).toBe('#aa0000');
    expect(greenChart.data.datasets[0].backgroundColor).toBe('#00aa00');
    expect((shared.params as any).data.datasets[0].backgroundColor).toBeUndefined();
    expect((shared.params as any).data.datasets[0].borderColor).toBeUndefined();
  });
  it('retains actual engine colors outside sparse overrides and restores them after a hot change', async () => {
    const { container } = render(() => (
      <div style={{ '--mcp-ui-chart-1': '#112233' }}>
        <ChartJSRenderer component={component()} />
      </div>
    ));
    const chart = await mountedChart(container);
    expect(chart.data.datasets[0].backgroundColor).toBe('#112233');
    expect(chart.data.datasets[1].backgroundColor).toBe('rgba(255, 99, 132, 0.5)');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#445566');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('#445566'));
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() =>
      expect(chart.data.datasets[0].backgroundColor).toBe('rgba(54, 162, 235, 0.5)')
    );
    expect(Chart.getChart(container.querySelector('canvas')!)).toBe(chart);
  });

  it('does not add x/y axes to the real engine when the caller names both scales', async () => {
    const { container } = render(() => (
      <div style={{ '--mcp-ui-chart-label': '#112233' }}>
        <ChartJSRenderer
          component={component(
            { scales: { horizontal: { axis: 'x' }, vertical: { axis: 'y' } } },
            { labels: ['A'], datasets: [{ data: [1], xAxisID: 'horizontal', yAxisID: 'vertical' }] }
          )}
        />
      </div>
    ));
    const chart = await mountedChart(container);
    expect(Object.keys(chart.scales)).toEqual(['horizontal', 'vertical']);
    expect(chart.scales.horizontal.options.ticks.color).toBe('#112233');
    expect(chart.scales.vertical.options.ticks.color).toBe('#112233');
  });

  it('the real engine sees tooltip defaults at construction and after a scoped change', async () => {
    const { container } = render(() => (
      <div style={{ '--mcp-ui-surface': '#112233', '--mcp-ui-fg': '#eeeeee' }}>
        <ChartJSRenderer
          component={component({ plugins: { tooltip: { bodyColor: '#abcdef' } } })}
        />
      </div>
    ));
    const chart = await mountedChart(container);
    expect(chart.options.plugins!.tooltip!.backgroundColor).toBe('#112233');
    expect(chart.options.plugins!.tooltip!.bodyColor).toBe('#abcdef');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-surface', '#445566');
    await waitFor(() => expect(chart.options.plugins!.tooltip!.backgroundColor).toBe('#445566'));
    expect(chart.options.plugins!.tooltip!.bodyColor).toBe('#abcdef');
  });
});
