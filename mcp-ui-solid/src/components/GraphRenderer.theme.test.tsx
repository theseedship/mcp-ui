import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIComponent } from '../types';
import { buildGraphConfig, GraphRenderer } from './GraphRenderer';

const harness = vi.hoisted(() => ({
  instances: [] as any[],
  renderGate: undefined as Promise<void> | undefined,
}));
vi.mock('@antv/g6', () => ({
  Graph: class {
    options: any;
    render = vi.fn(async () => {
      await harness.renderGate;
    });
    draw = vi.fn(async () => {});
    destroy = vi.fn();
    setOptions = vi.fn((options) => {
      this.options = { ...this.options, ...options };
    });
    constructor(options: any) {
      this.options = options;
      harness.instances.push(this);
    }
  },
}));

const params = {
  nodes: [{ id: 'a' }, { id: 'b', style: { fill: 'caller-fill', labelFill: 'caller-label' } }],
  edges: [{ source: 'a', target: 'b', style: { stroke: 'caller-edge' } }],
};

describe('GraphRenderer scoped canvas theme', () => {
  beforeEach(() => {
    harness.instances.length = 0;
    harness.renderGate = undefined;
    const actual = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = actual(element);
      const own = style.getPropertyValue.bind(style);
      style.getPropertyValue = (name) => {
        let node: Element | null = element;
        while (name.startsWith('--mcp-ui-') && node) {
          const value = (node as HTMLElement).style?.getPropertyValue(name);
          if (value) return value;
          node = node.parentElement;
        }
        return own(name);
      };
      return style;
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not replace engine styles when no tokens are set', () => {
    const config = buildGraphConfig(params);
    expect(config.node).toBeUndefined();
    expect(config.edge).toBeUndefined();
  });

  it('uses sparse theme mappers while explicit node/edge styles win', () => {
    const config: any = buildGraphConfig(params, undefined, {
      '--mcp-ui-chart-1': 'token-fill',
      '--mcp-ui-chart-2': 'other-fill',
      '--mcp-ui-chart-label': 'token-label',
      '--mcp-ui-chart-grid': 'token-edge',
    });
    expect(config.node.style(params.nodes[0])).toMatchObject({
      fill: 'token-fill',
      labelFill: 'token-label',
    });
    expect(config.node.style(params.nodes[1])).toMatchObject({
      fill: 'caller-fill',
      labelFill: 'caller-label',
    });
    expect(config.edge.style(params.edges[0]).stroke).toBe('caller-edge');
  });

  it('preserves default tooltip markup and resolves themed tooltip styles at hover time', () => {
    const container = document.createElement('div');
    const config: any = buildGraphConfig(params, container);
    const getContent = config.plugins[0].getContent;
    const item = { label: '<script>alert("x")</script>', data: { value: '<img src=x>' } };
    const original = getContent(undefined, [item]);
    expect(original).toContain('<div style="padding:4px 8px">');
    expect(original).not.toContain('<script>');
    expect(original).not.toContain('<img');
    expect(original).toContain('&lt;script&gt;');
    container.style.setProperty('--mcp-ui-surface', '#111111');
    container.style.setProperty('--mcp-ui-fg', '#eeeeee');
    container.style.setProperty('--mcp-ui-border', '#333333');
    const themed = getContent(undefined, [item]);
    expect(themed).toContain('background-color:#111111');
    expect(themed).toContain('color:#eeeeee');
    expect(themed).toContain('border:1px solid #333333');
    container.style.setProperty('--mcp-ui-fg', '#dddddd');
    container.setAttribute('data-theme', 'changed');
    expect(getContent(undefined, [item])).toContain('color:#dddddd');
    container.style.removeProperty('--mcp-ui-surface');
    container.style.removeProperty('--mcp-ui-fg');
    container.style.removeProperty('--mcp-ui-border');
    expect(getContent(undefined, [item])).toBe(original);
  });

  it('catches theme changes during an asynchronous initial graph layout', async () => {
    let finish!: () => void;
    harness.renderGate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const component: UIComponent = {
      id: 'slow-g',
      type: 'graph',
      position: { colStart: 1, colSpan: 6 },
      params,
    };
    const { container } = render(() => (
      <div style={{ '--mcp-ui-chart-1': 'red' }}>
        <GraphRenderer component={component} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const graph = harness.instances[0];
    (container.firstElementChild as HTMLElement).style.setProperty('--mcp-ui-chart-1', 'green');
    finish();
    await waitFor(() => expect(graph.options.node.style(params.nodes[0]).fill).toBe('green'));
    expect(graph.draw).toHaveBeenCalledTimes(1);
    expect(graph.render).toHaveBeenCalledTimes(1);
  });

  it('updates the mounted graph in place on ancestor theme changes and stops after cleanup', async () => {
    const component: UIComponent = {
      id: 'g',
      type: 'graph',
      position: { colStart: 1, colSpan: 6 },
      params,
    };
    const { container, unmount } = render(() => (
      <div style={{ '--mcp-ui-chart-1': 'red' }}>
        <GraphRenderer component={component} />
      </div>
    ));
    await waitFor(() => expect(harness.instances).toHaveLength(1));
    const graph = harness.instances[0];
    expect(graph.options.node.style(params.nodes[0]).fill).toBe('red');
    const scope = container.firstElementChild as HTMLElement;
    scope.style.setProperty('--mcp-ui-chart-1', 'green');
    scope.classList.add('alternate-theme');
    await waitFor(() => expect(graph.draw).toHaveBeenCalledTimes(1));
    expect(graph.options.node.style(params.nodes[0]).fill).toBe('green');
    expect(graph.render).toHaveBeenCalledTimes(1);
    expect(harness.instances).toHaveLength(1);
    scope.style.removeProperty('--mcp-ui-chart-1');
    await waitFor(() => expect(graph.draw).toHaveBeenCalledTimes(2));
    expect(graph.options.node.style(params.nodes[0]).fill).toBeUndefined();
    expect(graph.options.node.style(params.nodes[1]).fill).toBe('caller-fill');
    unmount();
    expect(graph.destroy).toHaveBeenCalledTimes(1);
    scope.style.setProperty('--mcp-ui-chart-1', 'blue');
    await Promise.resolve();
    expect(graph.draw).toHaveBeenCalledTimes(2);
  });
});
