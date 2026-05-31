/**
 * v6.13.0 — graph is now first-class in the `UIComponent` params union
 * (audit follow-up to P1.4/P1.5).
 *
 * Compile-time: a `graph` component with `nodes`/`edges` params must be
 * assignable to `UIComponent` (it was not before — the union ended at
 * `MapComponentParams`). Runtime asserts keep the shape visible in reports.
 */
import { describe, it, expect } from 'vitest'
import type { UIComponent, GraphComponentParams, GraphNode, GraphEdge } from './index'

describe('GraphComponentParams in the UIComponent union (P1.4/P1.5 follow-up)', () => {
  it('accepts a graph component with nodes/edges/layout/directed', () => {
    const nodes: GraphNode[] = [
      { id: 'a', label: 'A', group: 'g1' },
      { id: 'b', label: 'B' },
    ]
    const edges: GraphEdge[] = [{ source: 'a', target: 'b', label: 'rel', weight: 1 }]
    const params: GraphComponentParams = { nodes, edges, layout: 'dagre', directed: true }

    const component: UIComponent = {
      id: 'g1',
      type: 'graph',
      position: { colStart: 1, colSpan: 12 },
      params,
    }

    expect(component.type).toBe('graph')
    expect((component.params as GraphComponentParams).nodes).toHaveLength(2)
    expect((component.params as GraphComponentParams).edges).toHaveLength(1)
    expect((component.params as GraphComponentParams).layout).toBe('dagre')
  })

  it('requires nodes (edges optional) and tolerates passthrough props', () => {
    const minimal: GraphComponentParams = { nodes: [{ id: 'only' }] }
    expect(minimal.edges).toBeUndefined()

    const extra: GraphComponentParams = { nodes: [{ id: 'x', custom: 42 }], theme: 'dark' }
    expect((extra.nodes[0] as Record<string, unknown>).custom).toBe(42)
    expect((extra as Record<string, unknown>).theme).toBe('dark')
  })
})
