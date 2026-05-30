/**
 * v6.6.0 — ConnectorDynamicResultV1 contract (R1 of ROADMAP-opendata-macro-mcpui).
 *
 * Validates the envelope schema and that every shipped fixture in
 * `examples/connector/` parses against it.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ConnectorDynamicResultV1Schema,
  CONNECTOR_DYNAMIC_RESULT_V1,
  ConnectorFollowupSchema,
  ConnectorPreferredLayoutSchema,
} from './schemas/index'

const FIXTURE_DIR = join(__dirname, '..', 'examples', 'connector')

const MINIMAL = {
  schemaVersion: CONNECTOR_DYNAMIC_RESULT_V1,
  connectorId: 'datagouv',
  toolName: 'datagouv.search',
  query: 'immobilier toulouse',
  primary: { id: 'c1', type: 'table', position: { colStart: 1, colSpan: 12 }, params: {} },
}

describe('ConnectorDynamicResultV1Schema (v6.6.0)', () => {
  it('accepts a minimal valid payload', () => {
    expect(ConnectorDynamicResultV1Schema.safeParse(MINIMAL).success).toBe(true)
  })

  it('requires schemaVersion to be the exact namespaced literal', () => {
    expect(
      ConnectorDynamicResultV1Schema.safeParse({ ...MINIMAL, schemaVersion: undefined }).success
    ).toBe(false)
    expect(
      ConnectorDynamicResultV1Schema.safeParse({ ...MINIMAL, schemaVersion: 1 }).success
    ).toBe(false)
    expect(
      ConnectorDynamicResultV1Schema.safeParse({ ...MINIMAL, schemaVersion: 'v1' }).success
    ).toBe(false)
    expect(
      ConnectorDynamicResultV1Schema.safeParse({
        ...MINIMAL,
        schemaVersion: 'connector-dynamic-result/v2',
      }).success
    ).toBe(false)
  })

  it('rejects empty connectorId / toolName', () => {
    expect(ConnectorDynamicResultV1Schema.safeParse({ ...MINIMAL, connectorId: '' }).success).toBe(
      false
    )
    expect(ConnectorDynamicResultV1Schema.safeParse({ ...MINIMAL, toolName: '' }).success).toBe(
      false
    )
  })

  it('rejects a missing primary', () => {
    const { primary, ...noPrimary } = MINIMAL
    void primary
    expect(ConnectorDynamicResultV1Schema.safeParse(noPrimary).success).toBe(false)
  })

  it('accepts the optional fields (queryHash, intent, actions, followups, renderHints)', () => {
    const full = {
      ...MINIMAL,
      queryHash: 'a1b2c3d4',
      intent: 'real_estate_city',
      supplemental: [{ id: 's1', type: 'metric', position: { colStart: 1, colSpan: 4 }, params: {} }],
      actions: [{ label: 'Compare', action: 'tool-call', toolName: 'datagouv.search' }],
      followups: [{ label: 'Refine', kind: 'refine' }],
      renderHints: { preferredLayout: 'table', domain: 'real_estate', confidence: 0.8 },
    }
    const result = ConnectorDynamicResultV1Schema.safeParse(full)
    expect(result.success).toBe(true)
  })

  it('rejects an out-of-range confidence in renderHints', () => {
    expect(
      ConnectorDynamicResultV1Schema.safeParse({
        ...MINIMAL,
        renderHints: { confidence: 1.5 },
      }).success
    ).toBe(false)
  })

  it('rejects an unknown followup kind', () => {
    expect(ConnectorFollowupSchema.safeParse({ label: 'X', kind: 'teleport' }).success).toBe(false)
    expect(ConnectorFollowupSchema.safeParse({ label: 'X', kind: 'compare' }).success).toBe(true)
  })
})

describe('ConnectorDynamicResultV1 fixtures', () => {
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))

  it('ships at least the 5 documented scenarios', () => {
    // real-estate, dpe, pollution, clinicaltrials, empty/error (non-regression #10)
    expect(fixtures.length).toBeGreaterThanOrEqual(5)
  })

  // The three documented P2.2 cases: provenance/source, dependencies/process,
  // ontology-lite / entities-relations.
  const GRAPH_FIXTURES = [
    'provenance-graph.json',
    'process-dependencies-graph.json',
    'ontology-entities-graph.json',
  ]

  it('ships the three documented graph-layout fixtures (P2.2)', () => {
    for (const name of GRAPH_FIXTURES) {
      expect(fixtures).toContain(name)
    }
  })

  for (const name of GRAPH_FIXTURES) {
    it(`graph fixture ${name} hints a generic node-link graph`, () => {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'))
      // The connector envelope accepts a `graph` hint...
      expect(raw.renderHints.preferredLayout).toBe('graph')
      expect(ConnectorPreferredLayoutSchema.safeParse('graph').success).toBe(true)
      // ...and the primary stays a generic node-link graph (not a specialised type, cf. P2.3).
      expect(raw.primary.type).toBe('graph')
      expect(Array.isArray(raw.primary.params.nodes)).toBe(true)
      expect(raw.primary.params.nodes.length).toBeGreaterThan(0)
      expect(Array.isArray(raw.primary.params.edges)).toBe(true)
    })
  }

  it('accepts `graph` as a preferredLayout and rejects unknown layouts', () => {
    expect(ConnectorPreferredLayoutSchema.safeParse('graph').success).toBe(true)
    expect(ConnectorPreferredLayoutSchema.safeParse('mindmap').success).toBe(false)
  })

  for (const file of fixtures) {
    it(`fixture ${file} parses against ConnectorDynamicResultV1Schema`, () => {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8'))
      const result = ConnectorDynamicResultV1Schema.safeParse(raw)
      if (!result.success) {
        throw new Error(
          `${file} failed validation:\n${JSON.stringify(result.error.issues, null, 2)}`
        )
      }
      expect(result.success).toBe(true)
    })
  }
})
