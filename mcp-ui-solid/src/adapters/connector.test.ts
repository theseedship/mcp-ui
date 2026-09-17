/**
 * v6.6.0 — connector adapters (D5 / D6 of ROADMAP-opendata-macro-mcpui).
 *
 * Coverage:
 *   1. connectorActionsToActionGroup wraps actions into an action-group
 *   2. connectorResultToUILayout assembles primary + supplemental + actions
 *   3. primary that is itself a layout has its components spread in
 *   4. unknown schemaVersion + usable envelope → degraded-but-rendered (R2)
 *   5. unreadable payload → explicit error layout, never throws (R2)
 *   6. purity — same input yields a deep-equal output
 *   7. every shipped spec fixture assembles without a degraded layout
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  connectorResultToUILayout,
  connectorActionsToActionGroup,
  DEFAULT_CONNECTOR_MESSAGES,
} from './connector'
import { CONNECTOR_DYNAMIC_RESULT_V1 } from '@seed-ship/mcp-ui-spec'

const VALID = {
  schemaVersion: CONNECTOR_DYNAMIC_RESULT_V1,
  connectorId: 'datagouv',
  toolName: 'datagouv.search',
  query: 'immobilier toulouse',
  queryHash: 'abc123',
  primary: {
    id: 'tbl',
    type: 'table',
    position: { colStart: 1, colSpan: 12 },
    params: { columns: [{ key: 'a', label: 'A' }], rows: [] },
  },
  supplemental: [
    { id: 'mtr', type: 'metric', position: { colStart: 1, colSpan: 4 }, params: { title: 'M', value: 1 } },
  ],
  actions: [
    { label: 'Compare', action: 'tool-call', toolName: 'datagouv.search', params: { query: 'x' } },
  ],
}

describe('connectorActionsToActionGroup (v6.6.0)', () => {
  it('wraps actions into an action-group UIComponent', () => {
    const ag = connectorActionsToActionGroup(VALID.actions as never)
    expect(ag.type).toBe('action-group')
    expect((ag.params as { actions: unknown[] }).actions).toHaveLength(1)
    expect(ag.position).toEqual({ colStart: 1, colSpan: 12 })
  })

  it('honors id / title / layout / gap options', () => {
    const ag = connectorActionsToActionGroup(VALID.actions as never, {
      id: 'my-actions',
      title: 'Suite',
      layout: 'end',
      gap: 'sm',
    })
    expect(ag.id).toBe('my-actions')
    const params = ag.params as { title: string; layout: string; gap: string }
    expect(params.title).toBe('Suite')
    expect(params.layout).toBe('end')
    expect(params.gap).toBe('sm')
  })
})

describe('connectorResultToUILayout (v6.6.0)', () => {
  it('assembles primary + supplemental + actions into one UILayout', () => {
    const layout = connectorResultToUILayout(VALID)
    // primary (1) + supplemental (1) + action-group (1)
    expect(layout.components).toHaveLength(3)
    expect(layout.components[0].id).toBe('tbl')
    expect(layout.components[1].id).toBe('mtr')
    expect(layout.components[2].type).toBe('action-group')
    expect(layout.grid.columns).toBe(12)
  })

  it('derives a stable layout id from connectorId + queryHash', () => {
    const layout = connectorResultToUILayout(VALID)
    expect(layout.id).toBe('connector-datagouv-abc123')
  })

  it('omits the action-group when there are no actions', () => {
    const { actions, ...noActions } = VALID
    void actions
    const layout = connectorResultToUILayout(noActions)
    expect(layout.components.every((c) => c.type !== 'action-group')).toBe(true)
  })

  it('spreads the components of a primary that is itself a layout', () => {
    const withLayoutPrimary = {
      ...VALID,
      primary: {
        id: 'inner',
        components: [
          { id: 'p1', type: 'metric', position: { colStart: 1, colSpan: 6 }, params: {} },
          { id: 'p2', type: 'metric', position: { colStart: 7, colSpan: 6 }, params: {} },
        ],
        grid: { columns: 12, gap: '1rem' },
      },
    }
    const layout = connectorResultToUILayout(withLayoutPrimary)
    const ids = layout.components.map((c) => c.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
  })

  it('fills a missing grid position with full-width', () => {
    const noPos = {
      ...VALID,
      supplemental: undefined,
      actions: undefined,
      primary: { id: 'np', type: 'text', params: { content: 'x' } },
    }
    const layout = connectorResultToUILayout(noPos)
    expect(layout.components[0].position).toEqual({ colStart: 1, colSpan: 12 })
  })

  // ── R2 — unknown schemaVersion, never throw ───────────────
  it('renders a degraded-but-usable layout for an unknown schemaVersion', () => {
    const futureVersion = { ...VALID, schemaVersion: 'connector-dynamic-result/v2' }
    const layout = connectorResultToUILayout(futureVersion)
    expect(layout.id).toMatch(/^connector-degraded/)
    // First component is the version warning, the real components follow.
    expect(layout.components[0].id).toBe('connector-version-warning')
    expect(layout.components.some((c) => c.id === 'tbl')).toBe(true)
  })

  it('renders an explicit error layout for an unreadable payload — never throws', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, { foo: 'bar' }]) {
      let layout!: ReturnType<typeof connectorResultToUILayout>
      expect(() => {
        layout = connectorResultToUILayout(bad)
      }).not.toThrow()
      expect(layout.id).toBe('connector-degraded')
      expect(layout.components[0].id).toBe('connector-degraded-notice')
      expect(layout.components[0].type).toBe('text')
    }
  })

  it('is pure — same input yields a deep-equal output', () => {
    expect(connectorResultToUILayout(VALID)).toEqual(connectorResultToUILayout(VALID))
  })
})

/**
 * v6.20.0 — the two degraded paragraphs used to be hardcoded FRENCH:
 *
 *   '### Résultat non rendu\n\nLe résultat du connecteur n'a pas pu être
 *    interprété (schéma : `X`). Cet état explicite remplace une disparition
 *    silencieuse du rendu.'
 *   '> ⚠ Schéma connecteur non reconnu (`X`, attendu `Y`). Le rendu
 *    ci-dessous est en mode dégradé.'
 *
 * They now default to English and are overridable per call. They are NOT
 * `MCPUIStrings` keys: the adapters are runtime-free and never import
 * `solid-js`, so the wording travels through `options.messages`.
 */
describe('connector degraded messages (v6.20.0)', () => {
  const contentOf = (layout: ReturnType<typeof connectorResultToUILayout>, id: string): string =>
    (layout.components.find((c) => c.id === id)!.params as { content: string }).content

  it('ships English defaults, not the former French literals', () => {
    expect(DEFAULT_CONNECTOR_MESSAGES.degradedNotice).toContain('### Result not rendered')
    expect(DEFAULT_CONNECTOR_MESSAGES.degradedNotice).not.toContain('Résultat non rendu')
    expect(DEFAULT_CONNECTOR_MESSAGES.degradedVersionSuffix).toBe(' (schema: `{version}`)')
    expect(DEFAULT_CONNECTOR_MESSAGES.versionWarning).toContain('Unrecognized connector schema')
    expect(DEFAULT_CONNECTOR_MESSAGES.versionWarning).not.toContain('Schéma connecteur')
  })

  it('unreadable payload WITHOUT a string schemaVersion → no version suffix', () => {
    const content = contentOf(connectorResultToUILayout({ foo: 'bar' }), 'connector-degraded-notice')
    expect(content).toBe(
      '### Result not rendered\n\nThe connector result could not be interpreted. This explicit state replaces a silent disappearance of the rendering.'
    )
    expect(content).not.toContain('{versionSuffix}')
  })

  it('unreadable payload WITH a string schemaVersion → suffix interpolated', () => {
    const content = contentOf(
      connectorResultToUILayout({ schemaVersion: 'weird/v9' }),
      'connector-degraded-notice'
    )
    expect(content).toContain(' (schema: `weird/v9`)')
    expect(content).not.toContain('{version}')
  })

  it('unknown version → the warning names the version read and the one expected', () => {
    const content = contentOf(
      connectorResultToUILayout({ ...VALID, schemaVersion: 'connector-dynamic-result/v2' }),
      'connector-version-warning'
    )
    expect(content).toBe(
      '> \u26A0 Unrecognized connector schema (`connector-dynamic-result/v2`, expected `' +
        CONNECTOR_DYNAMIC_RESULT_V1 +
        '`). The rendering below is in degraded mode.'
    )
  })

  it('honors a `messages` override (and merges it over the defaults)', () => {
    const layout = connectorResultToUILayout(
      { ...VALID, schemaVersion: 'connector-dynamic-result/v2' },
      { messages: { versionWarning: 'Schéma {version} inconnu (attendu {expected}).' } }
    )
    expect(contentOf(layout, 'connector-version-warning')).toBe(
      `Schéma connector-dynamic-result/v2 inconnu (attendu ${CONNECTOR_DYNAMIC_RESULT_V1}).`
    )

    const degraded = connectorResultToUILayout(
      { schemaVersion: 'weird/v9' },
      {
        messages: {
          degradedNotice: 'Rendu impossible{versionSuffix}.',
          degradedVersionSuffix: ' (schéma : {version})',
        },
      }
    )
    expect(contentOf(degraded, 'connector-degraded-notice')).toBe(
      'Rendu impossible (schéma : weird/v9).'
    )
  })

  it('a partial override leaves the other messages at their English default', () => {
    const layout = connectorResultToUILayout(
      { foo: 'bar' },
      { messages: { versionWarning: 'ignored here' } }
    )
    expect(contentOf(layout, 'connector-degraded-notice')).toContain('### Result not rendered')
  })
})

describe('connector adapters — spec fixtures', () => {
  const FIXTURE_DIR = join(
    __dirname,
    '..',
    '..',
    '..',
    'mcp-ui-spec',
    'examples',
    'connector'
  )
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))

  for (const file of fixtures) {
    it(`fixture ${file} assembles into a non-degraded layout`, () => {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8'))
      const layout = connectorResultToUILayout(raw)
      expect(layout.id).not.toMatch(/^connector-degraded/)
      expect(layout.components.length).toBeGreaterThan(0)
    })
  }
})
