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
    ['line', true], ['line', false], ['bar', true], ['bar', false],
  ] as const)('keeps %s paints current after all-active hover and deactivation (initial theme: %s)', async (type, initiallyThemed) => {
    const value = component({ hover: { mode: 'dataset' }, elements: { point: { radius: 5 }, bar: { borderWidth: 2 } } }, { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] });
    (value.params as any).type = type;
    const { container } = render(() => <div style={initiallyThemed ? { '--mcp-ui-chart-1': '#123456' } : {}}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    const meta = chart.getDatasetMeta(0);
    const shared = meta.data[0].options;
    expect(meta.data[1].options).toBe(shared);
    const active = [{ datasetIndex: 0, index: 0 }, { datasetIndex: 0, index: 1 }];
    chart.setActiveElements(active);
    expect(meta.data.every((element) => element.active)).toBe(true);
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#654321');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('#654321'));
    expect(chart.getActiveElements().map(({ datasetIndex, index }) => ({ datasetIndex, index }))).toEqual(active);
    chart.setActiveElements([]);
    expect(meta.data[0].options).toBe(shared);
    expect(meta.data[1].options).toBe(shared);
    expect(shared.backgroundColor).toBe('#654321');
    expect(shared.borderColor).toBe('#654321');
    chart.setActiveElements(active);
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('rgba(54, 162, 235, 0.5)'));
    expect(chart.getActiveElements().map(({ datasetIndex, index }) => ({ datasetIndex, index }))).toEqual(active);
    chart.setActiveElements([]);
    expect(meta.data[0].options).toBe(shared);
    expect(meta.data[1].options).toBe(shared);
    expect(shared.backgroundColor).toBe('rgba(54, 162, 235, 0.5)');
    expect(shared.borderColor).toBe('rgb(54, 162, 235)');
    expect(type === 'line' ? shared.radius : shared.borderWidth).toBe(type === 'line' ? 5 : 2);
    expect(Chart.getChart(container.querySelector('canvas')!)).toBe(chart);
  });

  it.each(['line', 'radar'])('themes the %s line while retaining the explicit point outline', async (type) => {
    const point = { borderColor: '#abcdef', borderWidth: 3, radius: 5 };
    const value = component({ elements: { point } }, { labels: ['A', 'B', 'C'], datasets: [{ data: [1, 2, 3] }] });
    (value.params as any).type = type;
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    let meta = chart.getDatasetMeta(0);
    expect(meta.dataset.options.borderColor).toBe('#123456');
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[0].options.borderWidth).toBe(3);
    expect(meta.data[0].options.radius).toBe(5);
    expect(meta.data[0].options.backgroundColor).toBe('#123456');
    const pointOptions = meta.data[0].options;
    const usesSharedOptions = meta.data[1].options === pointOptions;
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#654321');
    await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('#654321'));
    meta = chart.getDatasetMeta(0);
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[0].options.backgroundColor).toBe('#654321');
    expect(meta.data[1].options === meta.data[0].options).toBe(usesSharedOptions);
    if (usesSharedOptions) expect(meta.data[0].options).toBe(pointOptions);
    expect(meta.data[0].options.borderWidth).toBe(3);
    expect(meta.data[0].options.radius).toBe(5);
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('rgba(0,0,0,0.1)'));
    meta = chart.getDatasetMeta(0);
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[0].options.backgroundColor).toBe('rgba(0,0,0,0.1)');
    expect(meta.data[0].options.borderWidth).toBe(3);
    expect(meta.data[0].options.radius).toBe(5);
    scope.style.setProperty('--mcp-ui-chart-1', '#112233');
    await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('#112233'));
    expect(chart.getDatasetMeta(0).data[0].options.borderColor).toBe('#abcdef');
    expect(chart.getDatasetMeta(0).data[0].options.backgroundColor).toBe('#112233');
    expect(point).toEqual({ borderColor: '#abcdef', borderWidth: 3, radius: 5 });
    expect((value.params as any).data.datasets[0]).toEqual({ data: [1, 2, 3] });
  });

  it.each(['scatter', 'bubble'])('keeps the explicit outline on point-only %s charts', async (type) => {
    const points = type === 'bubble' ? [{ x: 1, y: 2, r: 7 }, { x: 2, y: 3, r: 9 }] : [{ x: 1, y: 2 }, { x: 2, y: 3 }];
    const point = { borderColor: '#abcdef', borderWidth: 3 };
    const value = component({ elements: { point } }, { datasets: [{ data: points }] });
    (value.params as any).type = type;
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    const meta = chart.getDatasetMeta(0);
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[0].options.borderWidth).toBe(3);
    expect(meta.data[0].options.backgroundColor).toBe('#123456');
    expect(meta.data[0].options.radius).toBe(type === 'bubble' ? 7 : 3);
    expect(chart.data.datasets[0].borderColor).toBeUndefined();
    expect((value.params as any).data.datasets[0]).toEqual({ data: points });
    expect(point).toEqual({ borderColor: '#abcdef', borderWidth: 3 });
  });

  it('retains scriptable/indexable point paints while theming the dataset line', async () => {
    const borderColor = ['#abcdef', '#fedcba'];
    const backgroundColor = (context: any) => context.dataIndex === 0 ? '#aabbcc' : '#ccbbaa';
    const point = { borderColor, backgroundColor };
    const value = component({ elements: { point } }, { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] });
    (value.params as any).type = 'line';
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    let meta = chart.getDatasetMeta(0);
    expect(meta.dataset.options.borderColor).toBe('#123456');
    expect(meta.dataset.options.backgroundColor).toBe('#123456');
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[1].options.borderColor).toBe('#fedcba');
    expect(meta.data[0].options.backgroundColor).toBe('#aabbcc');
    expect(meta.data[1].options.backgroundColor).toBe('#ccbbaa');
    expect((chart.data.datasets[0] as any).pointBorderColor).toBe(borderColor);
    expect((chart.data.datasets[0] as any).pointBackgroundColor).toBe(backgroundColor);
    (container.firstElementChild as HTMLElement).style.setProperty('--mcp-ui-chart-1', '#654321');
    await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('#654321'));
    meta = chart.getDatasetMeta(0);
    expect(meta.data[0].options.borderColor).toBe('#abcdef');
    expect(meta.data[1].options.borderColor).toBe('#fedcba');
    expect(meta.data[0].options.backgroundColor).toBe('#aabbcc');
    expect(meta.data[1].options.backgroundColor).toBe('#ccbbaa');
    expect(point).toEqual({ borderColor, backgroundColor });
  });

  it.each(['line', 'radar'])('retains native dataset/global/prefixed point precedence for %s', async (type) => {
    const cases = [
      { name: 'dataset-scoped element', scoped: {}, dataset: {}, root: {}, expected: '#223344' },
      { name: 'dataset-prefixed', scoped: { pointBorderColor: '#334455' }, dataset: {}, root: {}, expected: '#334455' },
      { name: 'root-prefixed', scoped: {}, dataset: {}, root: { pointBorderColor: '#445566' }, expected: '#445566' },
      { name: 'source-prefixed', scoped: { pointBorderColor: '#334455' }, dataset: { pointBorderColor: '#556677' }, root: { pointBorderColor: '#445566' }, expected: '#556677' },
    ];
    for (const test of cases) {
      const options = { elements: { point: { borderColor: '#abcdef', radius: 6, borderWidth: 4 } },
        datasets: { [type]: { elements: { point: { borderColor: '#223344', borderWidth: 7 } }, ...test.scoped } }, ...test.root };
      const dataset = { data: [1, 2, 3], ...test.dataset };
      const value = component(options, { labels: ['A', 'B', 'C'], datasets: [dataset] });
      (value.params as any).type = type;
      const { container, unmount } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
      const chart = await mountedChart(container);
      expect(chart.getDatasetMeta(0).dataset.options.borderColor, test.name).toBe('#123456');
      expect(chart.getDatasetMeta(0).data[0].options.borderColor, test.name).toBe(test.expected);
      expect(chart.getDatasetMeta(0).data[0].options.borderWidth, test.name).toBe(7);
      expect(chart.getDatasetMeta(0).data[0].options.radius, test.name).toBe(6);
      const scope = container.firstElementChild as HTMLElement;
      scope.style.setProperty('--mcp-ui-chart-1', '#654321');
      await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor, test.name).toBe('#654321'));
      expect(chart.getDatasetMeta(0).data[0].options.borderColor, test.name).toBe(test.expected);
      scope.style.removeProperty('--mcp-ui-chart-1');
      await waitFor(() => expect(chart.getDatasetMeta(0).dataset.options.borderColor, test.name).toBe('rgba(0,0,0,0.1)'));
      expect(chart.getDatasetMeta(0).data[0].options.borderColor, test.name).toBe(test.expected);
      expect(dataset).toEqual({ data: [1, 2, 3], ...test.dataset });
      expect(options.elements.point).toEqual({ borderColor: '#abcdef', radius: 6, borderWidth: 4 });
      unmount();
    }
  });

  it('retains explicit source dataset paints and point prefixes instead of theming them', async () => {
    const dataset = { data: [1, 2], borderColor: '#445566', backgroundColor: '#556677', pointBorderColor: '#667788' };
    const value = component({ elements: { point: { borderColor: '#abcdef', radius: 6 } } }, { labels: ['A', 'B'], datasets: [dataset] });
    (value.params as any).type = 'line';
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('#445566');
    expect(chart.getDatasetMeta(0).dataset.options.backgroundColor).toBe('#556677');
    expect(chart.getDatasetMeta(0).data[0].options.borderColor).toBe('#667788');
    expect(chart.getDatasetMeta(0).data[0].options.backgroundColor).toBe('#556677');
    expect(chart.getDatasetMeta(0).data[0].options.radius).toBe(6);
    const update = vi.spyOn(chart, 'update');
    (container.firstElementChild as HTMLElement).style.setProperty('--mcp-ui-chart-1', '#654321');
    await waitFor(() => expect(update).toHaveBeenCalledWith('none'));
    expect(chart.getDatasetMeta(0).dataset.options.borderColor).toBe('#445566');
    expect(chart.getDatasetMeta(0).data[0].options.borderColor).toBe('#667788');
    expect(dataset).toEqual({ data: [1, 2], borderColor: '#445566', backgroundColor: '#556677', pointBorderColor: '#667788' });
  });

  it('refreshes actual shared bar paints on a live token change without replacing their options', async () => {
    const value = component({ elements: { bar: { borderWidth: 3, borderRadius: 4 } } });
    const { container } = render(() => <div style={{ '--mcp-ui-chart-1': '#123456' }}><ChartJSRenderer component={value} /></div>);
    const chart = await mountedChart(container);
    const meta = chart.getDatasetMeta(0);
    const shared = meta.data[0].options;
    expect(meta.data[1].options).toBe(shared);
    expect(shared.backgroundColor).toBe('#123456');
    expect(shared.borderColor).toBe('#123456');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#654321');
    await waitFor(() => expect(meta.data[0].options.backgroundColor).toBe('#654321'));
    expect(meta.data[0].options.borderColor).toBe('#654321');
    expect(meta.data[0].options).toBe(shared);
    expect(meta.data[1].options).toBe(shared);
    expect(shared.borderWidth).toBe(3);
    expect(shared.borderRadius).toBe(4);
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(shared.backgroundColor).toBe('rgba(54, 162, 235, 0.5)'));
    expect(shared.borderColor).toBe('rgb(54, 162, 235)');
  });

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
