import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { ChartJSRenderer } from './ChartJSRenderer';
import { createSignal } from 'solid-js';

const harness = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('chart.js/auto', () => {
  class Chart {
    config: any;
    data: any;
    ctx = { save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), fillStyle: '' };
    chartArea = { left: 0, top: 0, right: 100, bottom: 100 };
    destroy = vi.fn();
    resize = vi.fn();
    update = vi.fn(() => this.paint());
    constructor(_canvas: unknown, config: any) {
      this.config = config;
      this.data = config.data;
      this.config.plugins?.forEach((plugin: any) => plugin.beforeInit?.(this));
      // Stand in for the global Colors plugin, which runs before local hooks.
      this.data.datasets.forEach((dataset: any) => {
        dataset.backgroundColor ??=
          Array.isArray(dataset.data) && ['pie', 'doughnut', 'polarArea'].includes(config.type)
            ? dataset.data.map(() => 'engine-fill')
            : 'engine-fill';
        dataset.borderColor ??= 'engine-border';
      });
      this.paint();
      harness.instances.push(this);
    }
    paint() {
      this.config.plugins?.forEach((plugin: any) => plugin.beforeLayout?.(this));
      this.config.plugins?.forEach((plugin: any) => plugin.afterDatasetsDraw?.(this));
    }
  }
  return { default: Chart };
});

function component(overrides: any = {}): UIComponent {
  return {
    id: 'themed-chart',
    type: 'chart',
    position: { colStart: 1, colSpan: 6 },
    params: {
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ label: 'Series', data: [1, 2] }] },
      exportable: false,
      ...overrides,
    },
  };
}

// jsdom does not implement inherited custom properties; model browser inheritance
// while retaining real getComputedStyle for every ordinary property.
function inheritedProperties() {
  const actual = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const result = actual(element);
    const own = result.getPropertyValue.bind(result);
    result.getPropertyValue = (name) => {
      if (!name.startsWith('--mcp-ui-')) return own(name);
      let node: Element | null = element;
      while (node) {
        const value = (node as HTMLElement).style?.getPropertyValue(name);
        if (value) return value;
        node = node.parentElement;
      }
      return own(name);
    };
    return result;
  });
}

describe('ChartJSRenderer scoped canvas theme', () => {
  beforeEach(() => {
    harness.instances.length = 0;
    inheritedProperties();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps engine defaults and isolates caller data when tokens are absent', async () => {
    const value = component();
    render(() => <ChartJSRenderer component={value} />);
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.data.datasets[0].backgroundColor).toBe('engine-fill');
    expect(chart.config.options.scales).toBeUndefined();
    expect(chart.config.data).not.toBe((value.params as any).data);
    expect(chart.config.data.datasets[0]).not.toBe((value.params as any).data.datasets[0]);
    expect((value.params as any).data.datasets[0].backgroundColor).toBeUndefined();
    expect(chart.config.plugins.map((plugin: any) => plugin.id)).toEqual(['mcp-ui-theme']);
    expect(chart.update).not.toHaveBeenCalled();
  });

  it('reads scoped tokens at mount and updates the same instance, restoring engine colors on removal', async () => {
    const { container, unmount } = render(() => (
      <div
        style={{
          '--mcp-ui-chart-1': '#123456',
          '--mcp-ui-chart-grid': '#abcabc',
          '--mcp-ui-chart-label': '#fedfed',
        }}
      >
        <ChartJSRenderer component={component()} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.data.datasets[0].backgroundColor).toBe('#123456');
    expect(chart.config.options.scales.x.grid.color).toBe('#abcabc');
    expect(chart.config.options.plugins.legend.labels.color).toBe('#fedfed');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#abcdef');
    scope.setAttribute('data-theme', 'changed');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('#abcdef'));
    expect(chart.update).toHaveBeenCalledWith('none');
    expect(harness.instances).toHaveLength(1);
    expect(chart.destroy).not.toHaveBeenCalled();
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('engine-fill'));
    unmount();
    const updates = chart.update.mock.calls.length;
    scope.style.setProperty('--mcp-ui-chart-1', '#000000');
    await Promise.resolve();
    expect(chart.update).toHaveBeenCalledTimes(updates);
    expect(chart.destroy).toHaveBeenCalledTimes(1);
  });

  it('isolates two renderer scopes and preserves caller colors, scale options and tooltip opt-out', async () => {
    const options = {
      scales: { x: { grid: { color: 'caller-grid' } } },
      plugins: { tooltip: false, legend: { labels: { color: 'caller-label' } } },
    };
    render(() => (
      <>
        <div
          style={{
            '--mcp-ui-chart-1': 'red',
            '--mcp-ui-chart-grid': 'red',
            '--mcp-ui-chart-label': 'red',
          }}
        >
          <ChartJSRenderer
            component={component({
              options,
              data: {
                labels: ['A'],
                datasets: [
                  { data: [1], backgroundColor: 'caller-fill', borderColor: ['caller-border'] },
                ],
              },
            })}
          />
        </div>
        <div style={{ '--mcp-ui-chart-1': 'green' }}>
          <ChartJSRenderer component={component()} />
        </div>
      </>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(2));
    expect(harness.instances[0].data.datasets[0]).toMatchObject({
      backgroundColor: 'caller-fill',
      borderColor: ['caller-border'],
    });
    expect(harness.instances[0].config.options.scales.x.grid.color).toBe('caller-grid');
    expect(harness.instances[0].config.options.plugins.legend.labels.color).toBe('caller-label');
    expect(harness.instances[0].config.options.plugins.tooltip).toBe(false);
    expect(harness.instances[1].data.datasets[0].backgroundColor).toBe('green');
    expect(options.scales.x.grid.color).toBe('caller-grid');
  });

  it('uses token 8 for a pie slice without replacing unspecified engine palette entries', async () => {
    render(() => (
      <div style={{ '--mcp-ui-chart-8': '#888888' }}>
        <ChartJSRenderer
          component={component({
            type: 'pie',
            data: { labels: Array(9).fill('A'), datasets: [{ data: Array(9).fill(1) }] },
          })}
        />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    expect(harness.instances[0].data.datasets[0].backgroundColor).toEqual([
      'engine-fill',
      'engine-fill',
      'engine-fill',
      'engine-fill',
      'engine-fill',
      'engine-fill',
      'engine-fill',
      '#888888',
      'engine-fill',
    ]);
  });

  it('activates tokens added after mount without rebuilding or losing the engine baseline', async () => {
    const { container } = render(() => (
      <div>
        <ChartJSRenderer component={component()} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.config.plugins.map((plugin: any) => plugin.id)).toEqual(['mcp-ui-theme']);
    expect(chart.update).not.toHaveBeenCalled();
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#333333');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('#333333'));
    expect(harness.instances).toHaveLength(1);
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(chart.data.datasets[0].backgroundColor).toBe('engine-fill'));
  });

  it('retains caller-level inherited text and dataset options', async () => {
    render(() => (
      <div style={{ '--mcp-ui-chart-label': 'red', '--mcp-ui-chart-1': 'red' }}>
        <ChartJSRenderer
          component={component({
            options: {
              color: 'caller-text',
              datasets: { bar: { backgroundColor: 'caller-option-fill' } },
            },
          })}
        />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.config.options.color).toBe('caller-text');
    expect(chart.config.options.plugins.legend.labels).toBeUndefined();
    expect(chart.config.options.datasets.bar.backgroundColor).toBe('caller-option-fill');
    expect(chart.data.datasets[0].backgroundColor).toBe('caller-option-fill');
    expect(chart.data.datasets[0].borderColor).toBe('red');
  });

  it('does not invent default axes alongside the caller custom scale IDs', async () => {
    const scales = { horizontal: { axis: 'x' }, vertical: { axis: 'y' } };
    render(() => (
      <div style={{ '--mcp-ui-chart-label': '#123456', '--mcp-ui-chart-grid': '#654321' }}>
        <ChartJSRenderer
          component={component({
            options: { scales },
            data: {
              labels: ['A'],
              datasets: [{ data: [1], xAxisID: 'horizontal', yAxisID: 'vertical' }],
            },
          })}
        />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    expect(Object.keys(harness.instances[0].config.options.scales)).toEqual([
      'horizontal',
      'vertical',
    ]);
    expect(harness.instances[0].config.options.scales.horizontal.ticks.color).toBe('#123456');
    expect(scales.horizontal).toEqual({ axis: 'x' });
  });

  it('does not mistake engine-mutated caller data for explicit colors after a rebuild', async () => {
    const original = component();
    const [value, setValue] = createSignal(original);
    const { container } = render(() => (
      <div>
        <ChartJSRenderer component={value()} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    expect((original.params as any).data.datasets[0].backgroundColor).toBeUndefined();
    setValue({ ...original, params: { ...original.params, title: 'Rebuilt' } });
    await waitFor(() => expect(harness.instances).toHaveLength(2));
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', '#112233');
    await waitFor(() =>
      expect(harness.instances[1].data.datasets[0].backgroundColor).toBe('#112233')
    );
  });

  it('draws all-missing text in the current label token and restores the original grey', async () => {
    const { container } = render(() => (
      <div>
        <ChartJSRenderer
          component={component({ data: { labels: ['A'], datasets: [{ data: [null] }] } })}
        />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.ctx.fillText).toHaveBeenCalled();
    expect(chart.ctx.fillStyle).toBe('#6b7280');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-label', '#112233');
    await waitFor(() => expect(chart.ctx.fillStyle).toBe('#112233'));
    expect(harness.instances).toHaveLength(1);
    scope.style.setProperty('--mcp-ui-chart-label', '#445566');
    await waitFor(() => expect(chart.ctx.fillStyle).toBe('#445566'));
    scope.style.removeProperty('--mcp-ui-chart-label');
    await waitFor(() => expect(chart.ctx.fillStyle).toBe('#6b7280'));
  });

  it('themes tooltip canvas colors live without overwriting explicit caller fields', async () => {
    const tooltip = { bodyColor: 'caller-body', callbacks: { label: () => 'caller tooltip' } };
    const { container } = render(() => (
      <div
        style={{
          '--mcp-ui-surface': '#111111',
          '--mcp-ui-fg': '#eeeeee',
          '--mcp-ui-border': '#222222',
        }}
      >
        <ChartJSRenderer component={component({ options: { plugins: { tooltip } } })} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const chart = harness.instances[0];
    expect(chart.config.options.plugins.tooltip).toMatchObject({
      backgroundColor: '#111111',
      titleColor: '#eeeeee',
      bodyColor: 'caller-body',
      footerColor: '#eeeeee',
      borderColor: '#222222',
    });
    expect(chart.config.options.plugins.tooltip.callbacks.label).toBe(tooltip.callbacks.label);
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-fg', '#dddddd');
    scope.setAttribute('data-theme', 'changed');
    await waitFor(() => expect(chart.config.options.plugins.tooltip.titleColor).toBe('#dddddd'));
    expect(chart.config.options.plugins.tooltip.bodyColor).toBe('caller-body');
    expect(harness.instances).toHaveLength(1);
    expect(tooltip).toEqual({
      bodyColor: 'caller-body',
      callbacks: { label: tooltip.callbacks.label },
    });
  });

  it('preserves explicit tooltip opt-outs even when core tokens are supplied', async () => {
    render(() => (
      <div
        style={{
          '--mcp-ui-surface': '#111111',
          '--mcp-ui-fg': '#eeeeee',
          '--mcp-ui-border': '#222222',
        }}
      >
        <ChartJSRenderer component={component({ options: { plugins: { tooltip: false } } })} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    expect(harness.instances[0].config.options.plugins.tooltip).toBe(false);
  });
});
