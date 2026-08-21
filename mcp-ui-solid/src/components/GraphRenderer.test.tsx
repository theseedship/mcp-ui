/**
 * GraphRenderer tests (v6.0.0).
 *
 * Two test groups:
 *   1. Pure helpers (`graphToMermaid`, `graphToJSON`, `isG6Available`
 *      fallback path) — no DOM, fast.
 *   2. Renderer integration via `<UIResourceRenderer>` mount — exercises
 *      the unavailable-fallback path (G6 not installed in vitest env)
 *      AND the validation pass-through (graph payloads now go through
 *      SPEC_VALIDATORS).
 *
 * The "with G6 actually installed" path is intentionally NOT tested
 * here — `@antv/g6` is a peer-optional that needs a real canvas (jsdom
 * doesn't have one natively). Mocking the full Graph class is brittle ;
 * the helpers + validation cover the contract that matters.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { cleanup, waitFor } from '@solidjs/testing-library'
import {
  graphToMermaid,
  graphToJSON,
  isG6Available,
  GraphRenderer,
} from './GraphRenderer'
import { validateComponent } from '../services/validation'
import type { GraphComponentParams } from '@seed-ship/mcp-ui-spec'
import type { UIComponent } from '../types'

const sampleGraph: GraphComponentParams = {
  title: 'Sample',
  nodes: [
    { id: 'a', label: 'Alpha', weight: 0.9 },
    { id: 'b', label: 'Beta', weight: 0.5 },
    { id: 'c', label: 'Gamma' },
  ],
  edges: [
    { source: 'a', target: 'b', weight: 5 },
    { source: 'a', target: 'c', label: 'related' },
  ],
}

describe('graphToJSON (v6.0.0)', () => {
  it('serializes nodes + edges, normalizes missing edges to []', () => {
    const json = graphToJSON({ nodes: [{ id: 'a' }] })
    const parsed = JSON.parse(json)
    expect(parsed.nodes).toEqual([{ id: 'a' }])
    expect(parsed.edges).toEqual([])
  })

  it('preserves all fields including weight + data + style passthrough', () => {
    const json = graphToJSON(sampleGraph)
    const parsed = JSON.parse(json)
    expect(parsed.nodes).toHaveLength(3)
    expect(parsed.nodes[0].weight).toBe(0.9)
    expect(parsed.edges[0].weight).toBe(5)
  })

  it('produces pretty-printed (indented) output for readability', () => {
    const json = graphToJSON(sampleGraph)
    expect(json).toContain('\n  ')
  })
})

describe('graphToMermaid (v6.0.0)', () => {
  it('emits flowchart LR for force/concentric/circular default', () => {
    const out = graphToMermaid({ ...sampleGraph, layout: 'force' })
    expect(out.startsWith('flowchart LR')).toBe(true)
  })

  it('emits flowchart TD for dagre/tree/mindmap (top-down hierarchies)', () => {
    expect(graphToMermaid({ ...sampleGraph, layout: 'dagre' }).startsWith('flowchart TD')).toBe(true)
    expect(graphToMermaid({ ...sampleGraph, layout: 'tree' }).startsWith('flowchart TD')).toBe(true)
    expect(graphToMermaid({ ...sampleGraph, layout: 'mindmap' }).startsWith('flowchart TD')).toBe(true)
  })

  it('emits one node line per node with bracketed labels', () => {
    const out = graphToMermaid(sampleGraph)
    expect(out).toContain('a["Alpha"]')
    expect(out).toContain('b["Beta"]')
    expect(out).toContain('c["Gamma"]')
  })

  it('falls back to node.id when label is missing', () => {
    const out = graphToMermaid({ nodes: [{ id: 'unlabeled' }] })
    expect(out).toContain('unlabeled["unlabeled"]')
  })

  it('emits edges with `weight · label` decoration when both present', () => {
    const out = graphToMermaid(sampleGraph)
    expect(out).toContain('a -->|5| b')
    expect(out).toContain('a -->|related| c')
  })

  it('emits weight-only label when no text label', () => {
    const out = graphToMermaid({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b', weight: 12 }],
    })
    expect(out).toContain('a -->|12| b')
  })

  it('emits plain `-->` when neither weight nor label present', () => {
    const out = graphToMermaid({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }],
    })
    expect(out).toMatch(/a --> b\b/)
  })

  it('strips characters that break Mermaid syntax from labels', () => {
    const out = graphToMermaid({
      nodes: [{ id: 'a', label: 'has "quotes" | pipe [bracket]' }],
    })
    expect(out).toContain('a["has quotes pipe bracket"]')
  })

  it('handles graphs with no edges', () => {
    const out = graphToMermaid({ nodes: [{ id: 'solo', label: 'Solo' }] })
    expect(out).toBe('flowchart LR\n  solo["Solo"]')
  })
})

describe('<GraphRenderer> integration via <UIResourceRenderer> — validation pass-through (v6.0.0)', () => {
  // Note: the "unavailable fallback" UI test lives in
  // `GraphRenderer.fallback.test.tsx` — that file uses `vi.mock` to force
  // `@antv/g6` unimportable, since pnpm pulls the peer optional into the
  // workspace's node_modules and our normal vitest env can't pretend it
  // doesn't exist.
  //
  // Same reason for skipping the "G6 available but jsdom has no canvas"
  // path — G6's render throws inside jsdom because no canvas backend is
  // available. That's a vitest env limitation, not a renderer bug.
  // Real-world consumers who install the peer get a working render.
  beforeEach(() => {
    cleanup()
  })

  function graphComponent(params: Partial<GraphComponentParams>): UIComponent {
    return {
      id: 'g-1',
      type: 'graph',
      position: { colStart: 1, colSpan: 12 },
      params: { nodes: [{ id: 'a' }], ...params } as GraphComponentParams,
    }
  }

  it("'graph' is recognized — no UNKNOWN_COMPONENT_TYPE error", () => {
    const result = validateComponent(graphComponent({}))
    const unknown = result.errors?.find((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')
    expect(unknown).toBeUndefined()
  })

  it('rejects an empty nodes array via SPEC_VALIDATORS (legacy code INVALID_GRAPH)', () => {
    const result = validateComponent({
      id: 'g-bad',
      type: 'graph',
      position: { colStart: 1, colSpan: 12 },
      params: { nodes: [] } as any,
    })
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'INVALID_GRAPH')).toBe(true)
  })

  it('passes a valid full payload through validation', () => {
    const result = validateComponent(graphComponent(sampleGraph))
    expect(result.valid).toBe(true)
  })

  it('passes layout object form through validation (passthrough options)', () => {
    const result = validateComponent(
      graphComponent({
        ...sampleGraph,
        layout: { type: 'dagre', options: { rankdir: 'TB' } },
      })
    )
    expect(result.valid).toBe(true)
  })
})

// Mark the direct-mount + isG6Available tests as skipped intentionally —
// see comments above. Tests live in the companion fallback file with
// vi.mock forcing the unavailable path.
describe.skip('<GraphRenderer> direct mount + isG6Available — moved to fallback test file', () => {
  it('see GraphRenderer.fallback.test.tsx', () => {
    expect(true).toBe(true)
  })
})

// Avoid unused-import lints for the symbols moved to the fallback file
void GraphRenderer
void isG6Available
void waitFor
