/**
 * GraphRenderer — G6 v5 config contract test (v6.8.1).
 *
 * This is the gap the 2026-05-30 audit (P0.2) identified: the existing
 * `GraphRenderer.test.tsx` only covers the pure transforms (Mermaid/JSON) and
 * `GraphRenderer.fallback.test.tsx` only covers the peer-missing path. NO test
 * exercised the config actually handed to the G6 `Graph` constructor — which
 * is exactly how the `renderer: 'canvas' | 'svg'` string regression (G6 v5
 * expects a renderer *factory*, not a string → "renderer is not a function")
 * shipped unnoticed, crashing every `type:'graph'`.
 *
 * Rather than drive the full component through jsdom (whose container ref is
 * gated behind an async availability `<Show>`, so `new Graph(...)` is never
 * reached in a test renderer), we assert the contract on the **pure**
 * `buildGraphConfig()` helper the component delegates to. Same guarantee,
 * deterministic, no DOM/canvas needed.
 */

import { describe, it, expect } from 'vitest';
import { buildGraphConfig } from './GraphRenderer';
import type { GraphComponentParams } from '@seed-ship/mcp-ui-spec';

const fakeContainer = {} as HTMLElement;

function params(overrides: Partial<GraphComponentParams> = {}): GraphComponentParams {
  return { nodes: [{ id: 'a' }], ...overrides } as GraphComponentParams;
}

describe('buildGraphConfig — G6 v5 constructor contract', () => {
  it('passes the container and node/edge data through', () => {
    const config = buildGraphConfig(
      params({
        nodes: [{ id: 'a', label: 'A' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
      }),
      fakeContainer
    );
    expect(config.container).toBe(fakeContainer);
    expect((config.data as { nodes: unknown[] }).nodes).toHaveLength(2);
    expect((config.data as { edges: unknown[] }).edges).toHaveLength(1);
  });

  it('does NOT pass a `renderer` field on the default (canvas) path', () => {
    // The bug: `renderer: 'canvas'` (a string) → G6 v5 throws
    // "renderer is not a function". The fix omits it entirely.
    const config = buildGraphConfig(params(), fakeContainer);
    expect('renderer' in config).toBe(false);
  });

  it('never passes a string `renderer` for rendererPref: "canvas" (regression guard)', () => {
    const config = buildGraphConfig(params({ rendererPref: 'canvas' }), fakeContainer);
    expect(typeof config.renderer).not.toBe('string');
    expect('renderer' in config).toBe(false);
  });

  it('never passes a string `renderer` for rendererPref: "svg" (degrades to canvas)', () => {
    // svg is not wired yet — it must NOT inject the string 'svg' (the bug).
    // It degrades to the canvas default, i.e. no `renderer` field at all.
    const config = buildGraphConfig(params({ rendererPref: 'svg' }), fakeContainer);
    expect(typeof config.renderer).not.toBe('string');
    expect('renderer' in config).toBe(false);
  });

  it('resolves a layout and behaviors array', () => {
    const config = buildGraphConfig(
      params({ edges: [{ source: 'a', target: 'a' }] }),
      fakeContainer
    );
    expect((config.layout as { type: string }).type).toBeTruthy();
    expect(Array.isArray(config.behaviors)).toBe(true);
  });

  it('omits autoFit when fitView is false', () => {
    expect('autoFit' in buildGraphConfig(params(), fakeContainer)).toBe(true);
    expect('autoFit' in buildGraphConfig(params({ fitView: false }), fakeContainer)).toBe(false);
  });
});
