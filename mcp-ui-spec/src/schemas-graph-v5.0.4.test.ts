/**
 * Tests for Graph schemas added in v5.0.4 — generic node-link primitive.
 * Domain-neutral by design ; the renderer side ships in
 * `@seed-ship/mcp-ui-solid` lazy-loading `@antv/g6 ^5`.
 */

import { describe, it, expect } from 'vitest'
import {
  ComponentTypeSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  GraphLayoutSchema,
  GraphLayoutNameSchema,
  GraphComponentParamsSchema,
} from './schemas'

describe('ComponentTypeSchema includes "graph" (v5.0.4)', () => {
  it('accepts "graph"', () => {
    expect(ComponentTypeSchema.safeParse('graph').success).toBe(true)
  })
})

describe('GraphNodeSchema (v5.0.4)', () => {
  it('accepts a minimal node (id only)', () => {
    expect(GraphNodeSchema.safeParse({ id: 'a' }).success).toBe(true)
  })

  it('accepts the rich form (label + weight + style + data)', () => {
    expect(
      GraphNodeSchema.safeParse({
        id: 'a',
        label: 'Alpha',
        type: 'circle',
        size: 24,
        weight: 0.85,
        style: { fill: '#1f6feb', stroke: '#fff' },
        data: { foo: 'bar', any: { nested: true } },
      }).success
    ).toBe(true)
  })

  it('accepts size as either number or [w, h] tuple', () => {
    expect(GraphNodeSchema.safeParse({ id: 'a', size: 32 }).success).toBe(true)
    expect(GraphNodeSchema.safeParse({ id: 'a', size: [40, 24] }).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(GraphNodeSchema.safeParse({ id: '' }).success).toBe(false)
  })

  it('rejects non-numeric weight', () => {
    expect(GraphNodeSchema.safeParse({ id: 'a', weight: 'high' }).success).toBe(false)
  })
})

describe('GraphEdgeSchema (v5.0.4)', () => {
  it('accepts a minimal edge (source + target)', () => {
    expect(GraphEdgeSchema.safeParse({ source: 'a', target: 'b' }).success).toBe(true)
  })

  it('accepts the rich form (label + weight + type + style + data)', () => {
    expect(
      GraphEdgeSchema.safeParse({
        source: 'a',
        target: 'b',
        label: 'depends on',
        type: 'cubic',
        weight: 12,
        style: { stroke: '#888', lineWidth: 2 },
        data: { kind: 'tool-call', count: 12 },
      }).success
    ).toBe(true)
  })

  it('rejects empty source / target (must be non-empty strings)', () => {
    expect(GraphEdgeSchema.safeParse({ source: '', target: 'b' }).success).toBe(false)
    expect(GraphEdgeSchema.safeParse({ source: 'a', target: '' }).success).toBe(false)
  })
})

describe('GraphLayoutSchema (v5.0.4)', () => {
  const validLayouts = ['force', 'dagre', 'mindmap', 'tree', 'circular', 'grid', 'concentric']

  it.each(validLayouts)('accepts shorthand "%s"', (name) => {
    expect(GraphLayoutSchema.safeParse(name).success).toBe(true)
    expect(GraphLayoutNameSchema.safeParse(name).success).toBe(true)
  })

  it('accepts the object form with passthrough options', () => {
    expect(
      GraphLayoutSchema.safeParse({
        type: 'dagre',
        options: { rankdir: 'TB', nodeSep: 30, rankSep: 80 },
      }).success
    ).toBe(true)
  })

  it('accepts the object form with no options', () => {
    expect(GraphLayoutSchema.safeParse({ type: 'force' }).success).toBe(true)
  })

  it('rejects unknown layout names', () => {
    expect(GraphLayoutSchema.safeParse('spiral').success).toBe(false)
    expect(GraphLayoutSchema.safeParse({ type: 'spiral' }).success).toBe(false)
  })
})

describe('GraphComponentParamsSchema (v5.0.4)', () => {
  const minimal = { nodes: [{ id: 'a' }] }

  it('accepts a minimal params (nodes only)', () => {
    expect(GraphComponentParamsSchema.safeParse(minimal).success).toBe(true)
  })

  it('accepts a full payload with weights, layout object, options', () => {
    const result = GraphComponentParamsSchema.safeParse({
      title: 'Network',
      nodes: [
        { id: 'a', label: 'A', weight: 0.9 },
        { id: 'b', label: 'B', weight: 0.5 },
        { id: 'c', label: 'C', weight: 0.3 },
      ],
      edges: [
        { source: 'a', target: 'b', weight: 5 },
        { source: 'a', target: 'c', weight: 2 },
      ],
      layout: { type: 'concentric', options: { sortBy: 'weight' } },
      height: '500px',
      rendererPref: 'canvas',
      fitView: true,
      tooltip: true,
      enableSelect: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty nodes array', () => {
    expect(GraphComponentParamsSchema.safeParse({ nodes: [] }).success).toBe(false)
  })

  it('rejects missing nodes', () => {
    expect(GraphComponentParamsSchema.safeParse({}).success).toBe(false)
  })

  it('accepts edges omitted (graph with isolated nodes)', () => {
    const result = GraphComponentParamsSchema.safeParse({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown rendererPref', () => {
    expect(
      GraphComponentParamsSchema.safeParse({ ...minimal, rendererPref: 'webgl' }).success
    ).toBe(false)
  })

  it('all interactivity flags are optional booleans', () => {
    expect(
      GraphComponentParamsSchema.safeParse({
        ...minimal,
        enableZoom: false,
        enableDrag: false,
        enableSelect: false,
        tooltip: false,
      }).success
    ).toBe(true)
  })
})
