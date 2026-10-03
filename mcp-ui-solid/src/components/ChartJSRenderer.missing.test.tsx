/**
 * ChartJSRenderer — explicit missing values and units (v6.24.0).
 *
 * Rule under test: absence is never zero. A `null` keeps its slot (no label
 * dropped, no 0 drawn, a line breaks), and every view marks it. A payload with
 * NO missing value and NO unit must still build exactly the 6.23.0 config.
 */

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSX } from 'solid-js';
import type { UIComponent } from '../types';
import {
  DEFAULT_MCPUI_STRINGS,
  MCPUIStringsProvider,
  type MCPUIStrings,
} from '../context/MCPUIStringsContext';
import { ChartJSRenderer } from './ChartJSRenderer';

const chartHarness = vi.hoisted(() => {
  const harness = {
    configs: [] as any[],
    fail: false,
    Chart: undefined as any,
  };
  class FakeChart {
    static defaults: any = undefined;
    static register = vi.fn();
    destroy = vi.fn();
    resize = vi.fn();

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      if (harness.fail) throw new Error('paint failed');
      harness.configs.push(config);
    }
  }
  harness.Chart = FakeChart;
  return harness;
});

vi.mock('chart.js/auto', () => ({ default: chartHarness.Chart }));

function chartComponent(params: Record<string, unknown> = {}): UIComponent {
  return {
    id: 'chart-1',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      title: 'Quarterly sales',
      data: {
        labels: ['Q1', 'Q2', 'Q3'],
        datasets: [{ label: 'Revenue', data: [10, null, 30] }],
      },
      exportable: false,
      ...params,
    },
  } as UIComponent;
}

const complete = (params: Record<string, unknown> = {}) =>
  chartComponent({
    data: { labels: ['Q1', 'Q2'], datasets: [{ label: 'Revenue', data: [10, 20] }] },
    ...params,
  });

const withStrings = (strings: Partial<MCPUIStrings>, ui: () => JSX.Element) =>
  render(() => <MCPUIStringsProvider strings={strings}>{ui()}</MCPUIStringsProvider>);

async function lastConfig(): Promise<any> {
  await waitFor(() => expect(chartHarness.configs.length).toBeGreaterThan(0));
  return chartHarness.configs[chartHarness.configs.length - 1];
}

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('<ChartJSRenderer> missing values and unit', () => {
  beforeEach(() => {
    chartHarness.configs.length = 0;
    chartHarness.Chart.defaults = undefined;
    chartHarness.Chart.register.mockClear();
  });
  afterEach(() => cleanup());

  describe('preserving the other usages', () => {
    it('builds exactly the 6.23.0 config for a payload without missing value or unit', async () => {
      const component = complete();
      const params = component.params as any;
      render(() => <ChartJSRenderer component={component} />);
      const config = await lastConfig();

      expect(Object.keys(config).sort()).toEqual(['data', 'options', 'type']);
      expect(config.type).toBe('bar');
      expect(config.data).toBe(params.data);
      expect(config).not.toHaveProperty('plugins');
      expect(config.options).toEqual({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom' } },
      });
      expect(config.options.plugins).not.toHaveProperty('tooltip');
      expect(config.options.plugins.legend).not.toHaveProperty('labels');
      expect(config.options).not.toHaveProperty('scales');
    });

    it('keeps the 6.23.0 DOM: no notes, no legend, canvas described by the summary only', async () => {
      const { container, getByRole } = render(() => <ChartJSRenderer component={complete()} />);
      await lastConfig();
      const canvas = getByRole('img', { name: 'Quarterly sales' });
      expect(canvas.getAttribute('aria-describedby')).not.toContain(' ');
      expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      expect(container.querySelector('[data-mcp-missing-value]')).toBeNull();
      expect(container.querySelector('[data-mcp-missing-legend]')).toBeNull();
    });

    it('does not turn a legend or tooltip the payload set into something else', async () => {
      const options = {
        plugins: { legend: { position: 'top' }, tooltip: { mode: 'index' } },
      };
      render(() => <ChartJSRenderer component={complete({ options })} />);
      const config = await lastConfig();
      expect(config.options.plugins.legend).toEqual({ display: true, position: 'top' });
      expect(config.options.plugins.tooltip).toBe(options.plugins.tooltip);
    });
  });

  describe('data', () => {
    it('keeps every null at its index, never mutates the payload, and stops lines joining', async () => {
      const component = chartComponent({ type: 'line' });
      const params = deepFreeze(component.params) as any;
      render(() => <ChartJSRenderer component={component} />);
      const config = await lastConfig();

      expect(config.data.labels).toBe(params.data.labels);
      expect(config.data.labels).toEqual(['Q1', 'Q2', 'Q3']);
      expect(config.data.datasets[0].data).toEqual([10, null, 30]);
      expect(config.data.datasets[0].data[1]).toBeNull();
      expect(config.data.datasets[0].spanGaps).toBe(false);
      // Cloned, so the payload never gains spanGaps.
      expect(config.data.datasets[0]).not.toBe(params.data.datasets[0]);
      expect(params.data.datasets[0]).not.toHaveProperty('spanGaps');
    });

    it('keeps every other dataset key', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [{ label: 'S', data: [1, null], borderColor: '#f00', tension: 0.3, fill: true }],
        },
      });
      render(() => <ChartJSRenderer component={component} />);
      const dataset = (await lastConfig()).data.datasets[0];
      expect(dataset).toMatchObject({ label: 'S', borderColor: '#f00', tension: 0.3, fill: true });
    });

    it('keeps scatter points with a null y', async () => {
      const component = chartComponent({
        type: 'scatter',
        data: { datasets: [{ label: 'P', data: [{ x: 1, y: null }, { x: 2, y: 3 }] }] },
      });
      render(() => <ChartJSRenderer component={component} />);
      const config = await lastConfig();
      expect(config.data.datasets[0].data).toEqual([{ x: 1, y: null }, { x: 2, y: 3 }]);
    });

    it('installs a per-chart plugin only when something is missing, and never registers it', async () => {
      render(() => <ChartJSRenderer component={chartComponent()} />);
      const config = await lastConfig();
      expect(config.plugins).toHaveLength(1);
      expect(config.plugins[0].id).toBe('mcpuiMissingValues');
      expect(typeof config.plugins[0].afterDatasetsDraw).toBe('function');
      expect(chartHarness.Chart.register).not.toHaveBeenCalled();
    });

    // `data: []` is how a 6.23.0 payload said "nothing yet" (e.g. while
    // streaming): there is no entry, so nothing is MISSING, and the chart keeps
    // rendering exactly as it did then — for a pie too, which must not hit the
    // "cannot show missing values" fallback.
    it.each(['bar', 'line', 'pie', 'doughnut', 'polarArea'])(
      'builds the 6.23.0 config for a %s chart whose dataset has no entry at all, with no notes',
      async (type) => {
        // A default legend generator is exposed, so a wrapper around it would show.
        chartHarness.Chart.defaults = {
          plugins: { legend: { labels: { generateLabels: vi.fn(() => []) } } },
        };
        const onError = vi.fn();
        const component = chartComponent({
          type,
          data: { labels: ['a'], datasets: [{ label: 'Empty', data: [] }] },
        });
        const params = component.params as any;
        const { container, getByRole } = render(() => (
          <ChartJSRenderer component={component} onError={onError} />
        ));
        const config = await lastConfig();

        // The chart is built, with the payload's own data object and nothing added.
        expect(config.type).toBe(type);
        expect(Object.keys(config).sort()).toEqual(['data', 'options', 'type']);
        expect(config).not.toHaveProperty('plugins');
        expect(config.data).toBe(params.data);
        expect(config.data.datasets[0]).not.toHaveProperty('spanGaps');
        expect(config.options).toEqual({
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'bottom' } },
        });
        expect(config.options.plugins).not.toHaveProperty('tooltip');
        expect(config.options.plugins.legend).not.toHaveProperty('labels');

        // No fallback, no error, and no note: the canvas is described by the summary only.
        expect(container.querySelector('[role="alert"]')).toBeNull();
        expect(onError).not.toHaveBeenCalled();
        expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
        expect(container.querySelector('[data-mcp-chart-note]')).toBeNull();
        expect(
          getByRole('img', { name: 'Quarterly sales' }).getAttribute('aria-describedby')
        ).not.toContain(' ');
      }
    );

    it('still treats a null next to an empty dataset as missing', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [{ label: 'Tax', data: [] }, { label: 'Cost', data: [null, null] }],
        },
      });
      const { container } = render(() => <ChartJSRenderer component={component} />);
      const config = await lastConfig();
      expect(config.plugins).toHaveLength(1);
      expect(container.querySelector('[data-mcp-chart-note="no-data"]')?.textContent).toBe('No data for Cost.');
    });
  });

  describe('legend', () => {
    const fakeDefault = vi.fn((_chart: unknown) => [
      { text: 'Revenue', datasetIndex: 0, fillStyle: '#111' },
      { text: 'Cost', datasetIndex: 1, fillStyle: '#222' },
    ]);
    const twoSeries = () =>
      chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [
            { label: 'Revenue', data: [1, 2] },
            { label: 'Cost', data: [null, null] },
          ],
        },
      });

    it('marks a fully-missing series through a wrapper around the default generator', async () => {
      chartHarness.Chart.defaults = {
        plugins: { legend: { labels: { generateLabels: fakeDefault } } },
      };
      render(() => <ChartJSRenderer component={twoSeries()} />);
      const config = await lastConfig();
      const fakeChart = { id: 'fake' };
      const items = config.options.plugins.legend.labels.generateLabels(fakeChart);
      expect(fakeDefault).toHaveBeenCalledWith(fakeChart);
      expect(items).toEqual([
        { text: 'Revenue', datasetIndex: 0, fillStyle: '#111' },
        { text: 'Cost (no data)', datasetIndex: 1, fillStyle: '#222' },
      ]);
    });

    it('uses the localized template and keeps the payload legend options', async () => {
      chartHarness.Chart.defaults = {
        plugins: { legend: { labels: { generateLabels: fakeDefault } } },
      };
      const component = twoSeries();
      (component.params as any).options = {
        plugins: { legend: { position: 'top', labels: { boxWidth: 8 } } },
      };
      withStrings({ chartLegendNoData: '{series} (aucune donnée)' }, () => (
        <ChartJSRenderer component={component} />
      ));
      const legend = (await lastConfig()).options.plugins.legend;
      expect(legend).toMatchObject({ display: true, position: 'top', labels: { boxWidth: 8 } });
      expect(legend.labels.generateLabels({})[1].text).toBe('Cost (aucune donnée)');
    });

    it('does not install the wrapper when the Chart.js build exposes no default generator', async () => {
      render(() => <ChartJSRenderer component={twoSeries()} />);
      const config = await lastConfig();
      expect(config.options.plugins.legend).toEqual({ display: true, position: 'bottom' });
    });
  });

  describe('tooltip', () => {
    const labelOf = async () => (await lastConfig()).options.plugins.tooltip.callbacks.label;

    it('says "Missing value" for a null bar and keeps the default text for a present one', async () => {
      render(() => <ChartJSRenderer component={chartComponent()} />);
      const label = await labelOf();
      const dataset = { label: 'Revenue' };
      expect(label({ dataset, raw: null, formattedValue: '', parsed: { y: null } })).toBe(
        'Revenue: Missing value'
      );
      expect(label({ dataset, raw: 10, formattedValue: '10', parsed: { y: 10 } })).toBe('Revenue: 10');
      expect(label({ dataset: {}, raw: 10, formattedValue: '10', parsed: { y: 10 } })).toBe('10');
    });

    it('is a callback Chart.js can bind: in tooltip mode "dataset" the category prefixes the value', async () => {
      render(() => <ChartJSRenderer component={chartComponent({ unit: '€' })} />);
      const label = await labelOf();
      const item = { label: 'Q1', dataset: { label: 'Revenue' }, raw: 10, formattedValue: '10' };
      // Chart.js calls `callbacks.label` with the tooltip as `this`.
      const dataset = { options: { mode: 'dataset' } };
      expect(label.call(dataset, item)).toBe('Q1: 10 €');
      expect(label.call(dataset, { ...item, raw: null, formattedValue: '' })).toBe('Q1: Missing value');
      // Any other mode, and a detached call, keep the dataset label.
      expect(label.call({ options: { mode: 'index' } }, item)).toBe('Revenue: 10 €');
      expect(label(item)).toBe('Revenue: 10 €');
    });

    it('recognises a missing value from a point or from the parsed value-axis value', async () => {
      render(() => <ChartJSRenderer component={chartComponent()} />);
      const label = await labelOf();
      const dataset = { label: 'S' };
      expect(label({ dataset, raw: { x: 1, y: null }, formattedValue: '(1, null)' })).toBe(
        'S: Missing value'
      );
      expect(label({ dataset, raw: undefined, parsed: { y: null }, formattedValue: '' })).toBe(
        'S: Missing value'
      );
    });

    it('localizes the missing-value wording', async () => {
      withStrings({ missingValue: 'Valeur manquante' }, () => (
        <ChartJSRenderer component={chartComponent()} />
      ));
      const label = await labelOf();
      expect(label({ dataset: { label: 'CA' }, raw: null, formattedValue: '' })).toBe(
        'CA: Valeur manquante'
      );
    });

    it('appends the unit to present values, with the localized template', async () => {
      withStrings({ chartValueWithUnit: '{value}{unit}' }, () => (
        <ChartJSRenderer component={chartComponent({ unit: '°C' })} />
      ));
      const label = await labelOf();
      expect(label({ dataset: { label: 'Revenue' }, raw: 10, formattedValue: '10' })).toBe(
        'Revenue: 10°C'
      );
      expect(label({ dataset: { label: 'Revenue' }, raw: null, formattedValue: '' })).toBe(
        'Revenue: Missing value'
      );
    });

    it('leaves the (x, y) value of scatter and bubble tooltips without a unit', async () => {
      const component = chartComponent({
        type: 'scatter',
        unit: 'km',
        data: { datasets: [{ label: 'P', data: [{ x: 1, y: 2 }] }] },
      });
      render(() => <ChartJSRenderer component={component} />);
      const label = await labelOf();
      expect(label({ dataset: { label: 'P' }, raw: { x: 1, y: 2 }, formattedValue: '(1, 2)' })).toBe(
        'P: (1, 2)'
      );
    });

    it('installs the callback for a unit alone, with no plugin and the payload data untouched', async () => {
      const component = complete({ unit: '%' });
      render(() => <ChartJSRenderer component={component} />);
      const config = await lastConfig();
      expect(config.options.plugins.tooltip.callbacks.label).toBeTypeOf('function');
      expect(config).not.toHaveProperty('plugins');
      expect(config.data).toBe((component.params as any).data);
    });

    it('keeps the payload tooltip options and a host-supplied label callback', async () => {
      const hostLabel = () => 'host';
      const component = chartComponent({
        options: { plugins: { tooltip: { mode: 'index', callbacks: { label: hostLabel, title: () => 'T' } } } },
      });
      render(() => <ChartJSRenderer component={component} />);
      const tooltip = (await lastConfig()).options.plugins.tooltip;
      expect(tooltip.mode).toBe('index');
      expect(tooltip.callbacks.label).toBe(hostLabel);
      expect(tooltip.callbacks.title()).toBe('T');
    });

    it('merges its label callback with the other callbacks the payload set', async () => {
      const title = () => 'T';
      const component = chartComponent({
        options: { plugins: { tooltip: { mode: 'index', callbacks: { title } } } },
      });
      render(() => <ChartJSRenderer component={component} />);
      const tooltip = (await lastConfig()).options.plugins.tooltip;
      expect(tooltip.mode).toBe('index');
      expect(tooltip.callbacks.title).toBe(title);
      expect(tooltip.callbacks.label).toBeTypeOf('function');
    });
  });

  describe('unit axis title', () => {
    const scalesOf = async (params: Record<string, unknown>) => {
      render(() => <ChartJSRenderer component={chartComponent({ unit: '°C', ...params })} />);
      return (await lastConfig()).options.scales;
    };

    it('titles the y axis of a vertical bar', async () => {
      expect(await scalesOf({})).toEqual({ y: { title: { display: true, text: '°C' } } });
    });

    it('titles the x axis of a horizontal bar', async () => {
      expect(await scalesOf({ options: { indexAxis: 'y' } })).toEqual({
        x: { title: { display: true, text: '°C' } },
      });
    });

    it.each(['line', 'scatter', 'bubble'])('titles the value axis of a %s chart', async (type) => {
      const data =
        type === 'line'
          ? { labels: ['a'], datasets: [{ label: 'S', data: [1] }] }
          : { datasets: [{ label: 'S', data: [{ x: 1, y: 1, r: 2 }] }] };
      expect(await scalesOf({ type, data })).toEqual({ y: { title: { display: true, text: '°C' } } });
    });

    it('never overrides a title the payload set, and keeps the rest of its scale', async () => {
      const scales = await scalesOf({
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Mine' } } } },
      });
      expect(scales).toEqual({ y: { beginAtZero: true, title: { display: true, text: 'Mine' } } });
    });

    it('merges with the payload scale config of the same axis', async () => {
      const scales = await scalesOf({ options: { scales: { y: { beginAtZero: true }, x: { stacked: true } } } });
      expect(scales.y).toEqual({ beginAtZero: true, title: { display: true, text: '°C' } });
      expect(scales.x).toEqual({ stacked: true });
    });

    it('keeps the time axis block next to the unit title', async () => {
      const scales = await scalesOf({
        type: 'line',
        data: { labels: ['2024-01-01'], datasets: [{ label: 'S', data: [1] }] },
        timeAxis: { unit: 'month' },
      });
      expect(scales.x.type).toBe('time');
      expect(scales.x.time.unit).toBe('month');
      expect(scales.y).toEqual({ title: { display: true, text: '°C' } });
    });

    it('keeps the time axis x scale when the unit lands on x of a horizontal line', async () => {
      const scales = await scalesOf({
        type: 'line',
        options: { indexAxis: 'y' },
        data: { labels: ['2024-01-01'], datasets: [{ label: 'S', data: [1] }] },
        timeAxis: { unit: 'month' },
      });
      expect(scales.x.type).toBe('time');
      expect(scales.x.title).toEqual({ display: true, text: '°C' });
    });

    it.each(['radar', 'pie', 'doughnut', 'polarArea'])('leaves a %s chart without axes alone', async (type) => {
      const data = { labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, 2] }] };
      expect(await scalesOf({ type, data })).toBeUndefined();
    });
  });

  describe('notes under the canvas', () => {
    const noteOf = (container: HTMLElement, kind: string) =>
      container.querySelector(`[data-mcp-chart-note="${kind}"]`);

    it.each([
      ['line', 'gaps', 'Breaks in a line mark missing values.'],
      ['radar', 'gaps', 'Breaks in a line mark missing values.'],
      ['bar', 'bars', 'Dashed outlines mark missing values.'],
      ['scatter', 'omitted', 'Missing values are not plotted.'],
      ['bubble', 'omitted', 'Missing values are not plotted.'],
    ])('a %s chart gets the %s convention line', async (type, kind, text) => {
      const data =
        type === 'scatter' || type === 'bubble'
          ? { datasets: [{ label: 'P', data: [{ x: 1, y: null, r: 1 }, { x: 2, y: 2, r: 1 }] }] }
          : { labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, null] }] };
      const { container } = render(() => <ChartJSRenderer component={chartComponent({ type, data })} />);
      await lastConfig();
      const notes = container.querySelector('[data-mcp-chart-notes]');
      expect(notes).not.toBeNull();
      expect(notes!.querySelectorAll('[data-mcp-chart-note]')).toHaveLength(1);
      expect(noteOf(container, kind)?.textContent).toBe(text);
    });

    describe('stacked bar charts', () => {
      // A stacked bar has no baseline of its own (it starts where the series
      // below ends), so no dashed outline is drawn for it: the chart omits the
      // value, like a scatter, and says so.
      const stackedBar = (options: Record<string, unknown>, datasets?: unknown[]) =>
        chartComponent({
          type: 'bar',
          options,
          data: {
            labels: ['Q1', 'Q2', 'Q3'],
            datasets: datasets ?? [{ label: 'Revenue', data: [1, null, 3] }],
          },
        });

      it.each([
        ['x and y', { scales: { x: { stacked: true }, y: { stacked: true } } }],
        ['y only', { scales: { y: { stacked: true } } }],
        ['x only', { scales: { x: { stacked: true } } }],
      ])('a bar chart stacked on %s gets the omitted convention line, not the dashed-outline one', async (_axes, options) => {
        const { container } = render(() => <ChartJSRenderer component={stackedBar(options)} />);
        await lastConfig();
        const notes = container.querySelector('[data-mcp-chart-notes]');
        expect(notes).not.toBeNull();
        expect(notes!.querySelectorAll('[data-mcp-chart-note]')).toHaveLength(1);
        expect(noteOf(container, 'omitted')?.textContent).toBe('Missing values are not plotted.');
        expect(noteOf(container, 'bars')).toBeNull();
      });

      it('keeps the dashed-outline convention while the scales are not stacked', async () => {
        const options = { scales: { x: { stacked: false }, y: { stacked: false } } };
        const { container } = render(() => <ChartJSRenderer component={stackedBar(options)} />);
        await lastConfig();
        expect(noteOf(container, 'bars')?.textContent).toBe('Dashed outlines mark missing values.');
        expect(noteOf(container, 'omitted')).toBeNull();
      });

      it('uses the localized wording of the omitted convention', async () => {
        const options = { scales: { y: { stacked: true } } };
        const { container } = withStrings({ chartMissingPoints: 'Valeurs manquantes non tracées.' }, () => (
          <ChartJSRenderer component={stackedBar(options)} />
        ));
        await lastConfig();
        expect(noteOf(container, 'omitted')?.textContent).toBe('Valeurs manquantes non tracées.');
      });

      it('gives a stacked series with no value at all the no-data line only', async () => {
        const options = { scales: { x: { stacked: true }, y: { stacked: true } } };
        const component = stackedBar(options, [
          { label: 'Revenue', data: [1, 2, 3] },
          { label: 'Cost', data: [null, null, null] },
        ]);
        const { container } = render(() => <ChartJSRenderer component={component} />);
        await lastConfig();
        // Nothing is drawn for a series that has no value, so no convention to explain.
        expect(noteOf(container, 'omitted')).toBeNull();
        expect(noteOf(container, 'bars')).toBeNull();
        expect(noteOf(container, 'no-data')?.textContent).toBe('No data for Cost.');
      });
    });

    it('lists the fully-missing series with Intl.ListFormat in the provider locale', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [
            { label: 'Revenue', data: [1, 2] },
            { label: 'Cost', data: [null, null] },
            { data: [null] },
            // No entry at all: not missing, so never listed (it would sit between the two).
            { label: 'Tax', data: [] },
            { label: 'Fuel', data: [null, null] },
          ],
        },
      });
      const { container } = withStrings({ locale: 'fr-FR', chartSeriesNoData: 'Aucune donnée pour {series}.' }, () => (
        <ChartJSRenderer component={component} />
      ));
      await lastConfig();
      const expected = new Intl.ListFormat('fr-FR', { type: 'conjunction' }).format([
        'Cost',
        'Series 3',
        'Fuel',
      ]);
      expect(expected).toContain(' et ');
      expect(noteOf(container, 'no-data')?.textContent).toBe(`Aucune donnée pour ${expected}.`);
      expect(noteOf(container, 'no-data')?.textContent).not.toContain('Tax');
    });

    it('falls back to a comma list when Intl.ListFormat is missing or throws', async () => {
      const original = Intl.ListFormat;
      (Intl as any).ListFormat = class {
        constructor() {
          throw new RangeError('nope');
        }
      };
      try {
        const component = chartComponent({
          type: 'line',
          data: { labels: ['a'], datasets: [{ label: 'X', data: [null] }, { label: 'Y', data: [null] }] },
        });
        const { container } = render(() => <ChartJSRenderer component={component} />);
        await lastConfig();
        expect(noteOf(container, 'no-data')?.textContent).toBe('No data for X, Y.');
      } finally {
        (Intl as any).ListFormat = original;
      }
    });

    it('has no no-data line while every series has at least one value', async () => {
      const { container } = render(() => <ChartJSRenderer component={chartComponent()} />);
      await lastConfig();
      expect(noteOf(container, 'no-data')).toBeNull();
    });

    it('shows no line-break convention when no series that has values has a hole', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [
            { label: 'Revenue', data: [1, 2] },
            { label: 'Cost', data: [null, null] },
          ],
        },
      });
      const { container } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      expect(noteOf(container, 'gaps')).toBeNull();
      expect(noteOf(container, 'no-data')?.textContent).toBe('No data for Cost.');
    });

    it('keeps the dashed-outline convention for a bar series with no value at all', async () => {
      const component = chartComponent({
        type: 'bar',
        data: {
          labels: ['a', 'b'],
          datasets: [
            { label: 'Revenue', data: [1, 2] },
            { label: 'Cost', data: [null, null] },
          ],
        },
      });
      const { container } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      expect(noteOf(container, 'bars')?.textContent).toBe('Dashed outlines mark missing values.');
      expect(noteOf(container, 'no-data')?.textContent).toBe('No data for Cost.');
    });

    it('adds the notes to the canvas description, and drops them in the data view', async () => {
      const { container, getByRole } = render(() => <ChartJSRenderer component={chartComponent()} />);
      await lastConfig();
      const canvas = getByRole('img', { name: 'Quarterly sales' });
      const notes = container.querySelector('[data-mcp-chart-notes]')!;
      expect(notes.id).not.toBe('');
      const ids = canvas.getAttribute('aria-describedby')!.split(' ');
      expect(ids).toHaveLength(2);
      expect(ids[1]).toBe(notes.id);
      expect(document.getElementById(ids[0])?.textContent).toContain('Quarterly sales');

      fireEvent.click(getByRole('button', { name: 'Data' }));
      expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
      expect(canvas.getAttribute('aria-describedby')).not.toContain(' ');

      fireEvent.click(getByRole('button', { name: 'Chart' }));
      expect(container.querySelector('[data-mcp-chart-notes]')).not.toBeNull();
    });
  });

  describe('part-to-whole types', () => {
    it.each(['pie', 'doughnut', 'polarArea'])(
      'never builds a %s chart with a missing value: data table with the cell marked',
      async (type) => {
        const onError = vi.fn();
        const component = chartComponent({
          type,
          data: { labels: ['A', 'B', 'C'], datasets: [{ label: 'Share', data: [1, null, 3] }] },
        });
        const { container } = render(() => <ChartJSRenderer component={component} onError={onError} />);
        await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());

        expect(chartHarness.configs).toHaveLength(0);
        const alert = container.querySelector('[role="alert"]')!;
        expect(alert.textContent).toContain('This chart type cannot show missing values.');
        expect(onError).toHaveBeenCalledTimes(1);
        expect(alert.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(1);
        expect(alert.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
        const cells = Array.from(alert.querySelectorAll('tbody tr')).map((row) =>
          Array.from(row.querySelectorAll('td')).map((td) => td.textContent)
        );
        expect(cells[0]).toEqual(['A', '1']);
        expect(cells[1][0]).toBe('B');
        expect(cells[1][1]).toContain('-');
        expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
      }
    );

    it.each(['pie', 'doughnut', 'polarArea'])(
      'never shows the notes of a %s chart with a missing value, not even before the render effect has run',
      async (type) => {
        const component = chartComponent({
          type,
          data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, null] }] },
        });
        const { container } = render(() => <ChartJSRenderer component={component} />);

        // Synchronously after mount nothing was awaited yet: the render effect
        // has not reached its part-to-whole guard (it loads Chart.js first), so
        // no error is set. The notes must be absent by the chart TYPE alone —
        // a "dashed outlines" or "breaks" line would describe a chart that
        // never gets drawn.
        expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
        expect(container.querySelector('canvas')!.getAttribute('aria-describedby')).not.toContain(' ');

        // And once the effect settled on the data table fallback.
        await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
        expect(container.querySelector('[data-mcp-chart-notes]')).toBeNull();
        expect(container.querySelector('canvas')!.getAttribute('aria-describedby')).not.toContain(' ');
      }
    );

    it('control: the same payload as a bar chart does show its notes synchronously', async () => {
      const component = chartComponent({
        type: 'bar',
        data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, null] }] },
      });
      const { container } = render(() => <ChartJSRenderer component={component} />);
      // Same moment as the part-to-whole test above: only the chart type differs.
      expect(container.querySelector('[data-mcp-chart-notes]')).not.toBeNull();
      await lastConfig();
      expect(container.querySelector('[data-mcp-chart-notes]')).not.toBeNull();
    });

    it('still builds a pie without a missing value', async () => {
      const component = chartComponent({
        type: 'pie',
        data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, 2] }] },
      });
      const { container } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    it('recovers when the payload stops carrying a missing value', async () => {
      const [params, setParams] = (await import('solid-js')).createSignal(
        chartComponent({
          type: 'pie',
          data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, null] }] },
        })
      );
      const { container } = render(() => <ChartJSRenderer component={params()} />);
      await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
      setParams(
        chartComponent({
          type: 'pie',
          data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [1, 2] }] },
        })
      );
      await waitFor(() => expect(chartHarness.configs).toHaveLength(1));
      await waitFor(() => expect(container.querySelector('[role="alert"]')).toBeNull());
    });
  });

  describe('data view', () => {
    it('marks the missing cell, keeps its row, and shows one legend', async () => {
      const { container, getByRole } = render(() => <ChartJSRenderer component={chartComponent()} />);
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));

      const rows = Array.from(container.querySelectorAll('tbody tr'));
      expect(rows).toHaveLength(3);
      expect(rows[1].children[0].textContent).toBe('Q2');
      const mark = rows[1].children[1].querySelector('[data-mcp-missing-value]');
      expect(mark).not.toBeNull();
      expect(mark!.textContent).toContain('Missing value');
      expect(mark!.querySelector('[aria-hidden="true"]')?.textContent).toBe('-');
      expect(rows[0].querySelector('[data-mcp-missing-value]')).toBeNull();
      expect(rows[0].children[1].textContent).toBe('10');
      expect(container.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
    });

    it('leaves a slot past the end of a short dataset as a plain empty cell, with no mark and no legend', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b'],
          datasets: [{ label: 'Long', data: [1, 2] }, { label: 'Short', data: [3] }],
        },
      });
      const { container, getByRole } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      // The slot has no entry: an empty cell, as in 6.23.0 ...
      expect(rows[1].children[2].textContent).toBe('');
      expect(rows[1].children[2].querySelector('[data-mcp-missing-value]')).toBeNull();
      // ... and nothing else is missing, so there is no mark anywhere and no legend.
      expect(container.querySelector('[data-mcp-missing-value]')).toBeNull();
      expect(container.querySelector('[data-mcp-missing-legend]')).toBeNull();
    });

    it('marks only the explicit null of a short dataset, never the slots after it', async () => {
      const component = chartComponent({
        type: 'line',
        data: {
          labels: ['a', 'b', 'c'],
          datasets: [{ label: 'Long', data: [1, 2, 3] }, { label: 'Short', data: [4, null] }],
        },
      });
      const { container, getByRole } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(3);
      expect(rows[1].children[2].querySelector('[data-mcp-missing-value]')).not.toBeNull();
      expect(rows[2].children[2].querySelector('[data-mcp-missing-value]')).toBeNull();
      expect(rows[2].children[2].textContent).toBe('');
      expect(container.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(1);
      expect(container.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
    });

    it('marks the y cell of a point whose y is null, and nothing else', async () => {
      const component = chartComponent({
        type: 'scatter',
        data: { datasets: [{ label: 'P', data: [{ x: 1, y: null }, { x: 2, y: 5 }] }] },
      });
      const { container, getByRole } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0].children[3].querySelector('[data-mcp-missing-value]')).not.toBeNull();
      expect(rows[0].children[2].textContent).toBe('1');
      expect(rows[1].querySelector('[data-mcp-missing-value]')).toBeNull();
    });

    it('puts the unit in the value column headers, only when there is one', async () => {
      const { container, getByRole } = render(() => (
        <ChartJSRenderer component={complete({ unit: '°C' })} />
      ));
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent);
      expect(headers).toEqual(['Label', 'Revenue (°C)']);
    });

    it('uses the localized unit header template', async () => {
      const { container, getByRole } = withStrings({ chartLabelWithUnit: '{label} en {unit}' }, () => (
        <ChartJSRenderer component={complete({ unit: 'kg' })} />
      ));
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      expect(Array.from(container.querySelectorAll('th')).map((th) => th.textContent)).toEqual([
        'Label',
        'Revenue en kg',
      ]);
    });

    it('applies the unit to the y header of the per-point table', async () => {
      const component = chartComponent({
        type: 'scatter',
        unit: 'km',
        data: { datasets: [{ label: 'P', data: [{ x: 1, y: 2 }] }] },
      });
      const { container, getByRole } = render(() => <ChartJSRenderer component={component} />);
      await lastConfig();
      fireEvent.click(getByRole('button', { name: 'Data' }));
      expect(Array.from(container.querySelectorAll('th')).map((th) => th.textContent)).toEqual([
        'Series',
        'Point',
        'x',
        'y (km)',
      ]);
    });
  });

  describe('degraded view on a render failure', () => {
    it('keeps the missing cell marked and carries the unit into the headers', async () => {
      chartHarness.fail = true;
      try {
        const { container } = render(() => <ChartJSRenderer component={chartComponent({ unit: '°C' })} />);
        await waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
        const alert = container.querySelector('[role="alert"]')!;
        expect(Array.from(alert.querySelectorAll('th')).map((th) => th.textContent)).toEqual([
          'Label',
          'Revenue (°C)',
        ]);
        expect(alert.querySelectorAll('[data-mcp-missing-value]')).toHaveLength(1);
        expect(alert.querySelectorAll('[data-mcp-missing-legend]')).toHaveLength(1);
      } finally {
        chartHarness.fail = false;
      }
    });
  });
});

describe('<ChartJSRenderer> pseudo-locale', () => {
  beforeEach(() => {
    chartHarness.configs.length = 0;
  });
  afterEach(() => cleanup());

  const PSEUDO: Required<MCPUIStrings> = Object.fromEntries(
    Object.entries(DEFAULT_MCPUI_STRINGS).map(([key, value]) => {
      if (key === 'locale') return [key, 'fr-FR'];
      const placeholders = (value as string).match(/\{\w+\}/g) ?? [];
      return [key, `⟦${[key, ...placeholders].join(' ')}⟧`];
    })
  ) as Required<MCPUIStrings>;

  const stripMarkers = (text: string) => {
    let out = text;
    while (/⟦[^⟦⟧]*⟧/.test(out)) out = out.replace(/⟦[^⟦⟧]*⟧/g, ' ');
    return out;
  };

  const leaks = (root: ParentNode): string[] => {
    const found: string[] = [];
    const attrs = ['aria-label', 'aria-description', 'title', 'alt', 'placeholder'];
    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
      const raws: string[] = [];
      if (node.nodeType === Node.TEXT_NODE) raws.push(node.textContent ?? '');
      else for (const a of attrs) raws.push((node as Element).getAttribute(a) ?? '');
      for (const raw of raws) {
        const runs = stripMarkers(raw).match(/[A-Za-z]{2,}/g);
        if (runs) found.push(`${raw.trim()} → ${runs.join(',')}`);
      }
    }
    return found;
  };

  it('renders the notes and the data view without any hardcoded Latin chrome', async () => {
    const component = chartComponent({
      type: 'line',
      unit: '℃',
      title: '売上',
      data: {
        labels: ['一月', '二月', '三月'],
        datasets: [
          { label: '東京', data: [1, null, 3] },
          { label: '大阪', data: [null, null, null] },
        ],
      },
    });
    const { container, getByRole } = render(() => (
      <MCPUIStringsProvider strings={PSEUDO}>
        <ChartJSRenderer component={component} />
      </MCPUIStringsProvider>
    ));
    await waitFor(() => expect(chartHarness.configs).toHaveLength(1));

    const notes = container.querySelector('[data-mcp-chart-notes]')!;
    expect(notes.textContent).toContain('⟦chartMissingGaps⟧');
    expect(notes.textContent).toContain('⟦chartSeriesNoData');
    expect(notes.textContent).toContain('大阪');
    expect(leaks(container)).toEqual([]);

    fireEvent.click(getByRole('button', { name: /chartDataView/ }));
    expect(container.querySelectorAll('[data-mcp-missing-value]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-mcp-missing-legend]')?.textContent).toContain(
      '⟦missingValueLegend'
    );
    expect(container.textContent).toContain('⟦missingValue⟧');
    expect(leaks(container)).toEqual([]);
  });

  it('shows the pseudo-localized tooltip wording', async () => {
    const component = chartComponent({ unit: '℃', data: { labels: ['一'], datasets: [{ label: '東京', data: [null] }] } });
    render(() => (
      <MCPUIStringsProvider strings={PSEUDO}>
        <ChartJSRenderer component={component} />
      </MCPUIStringsProvider>
    ));
    const label = (await lastConfig()).options.plugins.tooltip.callbacks.label;
    expect(label({ dataset: { label: '東京' }, raw: null })).toBe('東京: ⟦missingValue⟧');
    expect(stripMarkers(label({ dataset: { label: '東京' }, raw: 5, formattedValue: '5' }))).not.toMatch(
      /[A-Za-z]{2,}/
    );
  });
});
