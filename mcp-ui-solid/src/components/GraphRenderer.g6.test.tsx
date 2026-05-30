/**
 * GraphRenderer — "G6 available" contract test (v6.8.1).
 *
 * This is the gap the 2026-05-30 audit identified: the existing
 * `GraphRenderer.test.tsx` only covers the pure transforms, and
 * `GraphRenderer.fallback.test.tsx` only covers the peer-missing path. NO
 * test exercised the path where `@antv/g6` IS importable — which is exactly
 * how the `renderer: 'canvas' | 'svg'` string regression (G6 v5 expects a
 * renderer *factory*, not a string → "renderer is not a function") shipped
 * unnoticed.
 *
 * We don't mock the whole G6 runtime — we mock only the `Graph` constructor
 * and capture the config it receives, then assert the contract:
 *   - `Graph` is constructed and `render()` is called;
 *   - the default (canvas) config does NOT carry a `renderer` field (a string
 *     there is the bug; omitting it lets G6 use its built-in canvas default);
 *   - `rendererPref: 'svg'` wires a renderer *factory* (function), never a
 *     string;
 *   - the peer-missing fallback is NOT shown when the module imports fine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import type { UIComponent } from '../types';

// Capture every config passed to `new Graph(...)`.
let capturedConfigs: Array<Record<string, unknown>> = [];
const renderSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('@antv/g6', () => ({
  Graph: vi.fn().mockImplementation((config: Record<string, unknown>) => {
    capturedConfigs.push(config);
    return {
      render: renderSpy,
      destroy: vi.fn(),
      toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,'),
    };
  }),
}));

// SVG renderer factory module (a g6 dependency) — captured for the svg path.
const svgRendererCtor = vi.fn();
vi.mock('@antv/g-svg', () => ({
  Renderer: svgRendererCtor,
}));

// Imported AFTER the mocks are registered (vi.mock is hoisted regardless).
import { GraphRenderer } from './GraphRenderer';

function graph(params: Record<string, unknown>): UIComponent {
  return {
    id: 'test-graph',
    type: 'graph',
    position: { colStart: 1, colSpan: 12 },
    params: params as never,
  };
}

const settle = () => waitFor(() => expect(capturedConfigs.length).toBe(1), { timeout: 4000 });

describe('GraphRenderer — G6 available (contract)', () => {
  beforeEach(() => {
    capturedConfigs = [];
    renderSpy.mockClear();
    svgRendererCtor.mockClear();
  });

  it('constructs Graph and calls render() for a minimal graph', async () => {
    render(() => <GraphRenderer component={graph({ nodes: [{ id: 'a' }] })} />);
    await settle();
    expect(renderSpy).toHaveBeenCalled();
  });

  it('passes container and node data to the Graph constructor', async () => {
    render(() => (
      <GraphRenderer
        component={graph({
          nodes: [{ id: 'a', label: 'A' }, { id: 'b' }],
          edges: [{ source: 'a', target: 'b' }],
        })}
      />
    ));
    await settle();
    const config = capturedConfigs[0];
    expect(config.container).toBeDefined();
    expect((config.data as { nodes: unknown[] }).nodes).toHaveLength(2);
    expect((config.data as { edges: unknown[] }).edges).toHaveLength(1);
  });

  it('does NOT pass a `renderer` field on the default (canvas) path', async () => {
    // The bug: `renderer: 'canvas'` (a string) → G6 v5 throws
    // "renderer is not a function". The fix omits it entirely.
    render(() => <GraphRenderer component={graph({ nodes: [{ id: 'a' }] })} />);
    await settle();
    expect('renderer' in capturedConfigs[0]).toBe(false);
  });

  it('never passes a string `renderer` (regression guard)', async () => {
    render(() => (
      <GraphRenderer component={graph({ nodes: [{ id: 'a' }], rendererPref: 'canvas' })} />
    ));
    await settle();
    expect(typeof capturedConfigs[0].renderer).not.toBe('string');
  });

  it('wires a renderer FACTORY (function) for rendererPref: "svg"', async () => {
    render(() => (
      <GraphRenderer component={graph({ nodes: [{ id: 'a' }], rendererPref: 'svg' })} />
    ));
    await settle();
    const renderer = capturedConfigs[0].renderer;
    expect(typeof renderer).toBe('function');
    // Calling the factory instantiates the SVG renderer (no string anywhere).
    (renderer as () => unknown)();
    expect(svgRendererCtor).toHaveBeenCalled();
  });

  it('does NOT show the peer-missing fallback when @antv/g6 imports fine', async () => {
    const { queryByText } = render(() => (
      <GraphRenderer component={graph({ nodes: [{ id: 'a' }] })} />
    ));
    await settle();
    expect(queryByText('Graph rendering unavailable')).toBeNull();
  });
});
