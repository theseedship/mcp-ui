/**
 * Connector adapters — `ConnectorDynamicResultV1` → MCP-UI render structures.
 *
 * @since v6.6.0 (D5 / D6 of ROADMAP-opendata-macro-mcpui)
 *
 * ## Opt-in, pure
 *
 * These adapters are published under the dedicated subpath
 * `@seed-ship/mcp-ui-solid/adapters` — they are NEVER imported by the core
 * renderer path, so a consumer that does not emit connector results pays
 * nothing for them.
 *
 * Every adapter here is a **pure function** (D5) : same input → same
 * output, no `fetch`, no `localStorage`, no global state, no clock, no
 * randomness. This is what lets a host re-run an adapter deterministically
 * after presentation feedback (D1) and replay fixtures in tests.
 *
 * ## Unknown schema version — never throw (R2)
 *
 * `connectorResultToUILayout()` never throws on the runtime render path.
 * A payload it cannot read becomes an explicit degraded `UILayout` (a
 * visible notice), never a silent disappearance and never an exception.
 */

import type { UIComponent, UILayout, GridPosition } from '../types'
import {
  ConnectorDynamicResultV1Schema,
  CONNECTOR_DYNAMIC_RESULT_V1,
  type ConnectorAction,
} from '@seed-ship/mcp-ui-spec'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────
// connectorActionsToActionGroup
// ─────────────────────────────────────────────────────────────

export interface ConnectorActionsToActionGroupOptions {
  /** Component id. Default `'connector-actions'`. */
  id?: string
  /** Optional heading shown above the buttons. */
  title?: string
  /** Button row layout. Default `'horizontal'`. */
  layout?: 'horizontal' | 'vertical' | 'space-between' | 'end' | 'center'
  /** Gap between buttons. Default `'md'`. */
  gap?: 'none' | 'sm' | 'md' | 'lg'
  /** Grid position. Default full-width. */
  position?: GridPosition
}

/**
 * Wraps a connector's `actions` into an `action-group` `UIComponent`.
 *
 * `ConnectorAction` is the exact `action-group` action shape, so this is a
 * thin, pure envelope — no transformation of the actions themselves.
 */
export function connectorActionsToActionGroup(
  actions: ConnectorAction[],
  options: ConnectorActionsToActionGroupOptions = {}
): UIComponent {
  return {
    id: options.id ?? 'connector-actions',
    type: 'action-group',
    position: options.position ?? { colStart: 1, colSpan: 12 },
    params: {
      actions,
      ...(options.title ? { title: options.title } : {}),
      layout: options.layout ?? 'horizontal',
      gap: options.gap ?? 'md',
    },
  } as UIComponent
}

// ─────────────────────────────────────────────────────────────
// connectorResultToUILayout
// ─────────────────────────────────────────────────────────────

export interface ConnectorResultToUILayoutOptions {
  /** Layout id. Default derived from `connectorId` + `queryHash` / `toolName`. */
  id?: string
  /** Heading for the actions `action-group`. */
  actionsTitle?: string
}

/**
 * Lenient mirror of `ConnectorDynamicResultV1Schema` — `schemaVersion`
 * relaxed to any string. Used to tell apart "unknown version but otherwise
 * a usable envelope" (→ render with a warning, R2) from "truly unreadable"
 * (→ explicit error state).
 */
const LenientResultSchema = z.object({
  schemaVersion: z.string(),
  connectorId: z.string().min(1),
  toolName: z.string().min(1),
  query: z.string(),
  queryHash: z.string().optional(),
  intent: z.string().optional(),
  primary: z.record(z.unknown()),
  supplemental: z.array(z.record(z.unknown())).optional(),
  actions: z.array(z.record(z.unknown())).optional(),
})

const DEFAULT_GRID = { columns: 12, gap: '1rem' } as const

function withPosition(component: UIComponent): UIComponent {
  if (component && component.position) return component
  return { ...component, position: { colStart: 1, colSpan: 12 } }
}

/** A component is a UILayout when it carries a `components` array. */
function isLayoutShape(value: Record<string, unknown>): boolean {
  return Array.isArray((value as { components?: unknown }).components)
}

function degradedTextComponent(id: string, message: string): UIComponent {
  return {
    id,
    type: 'text',
    position: { colStart: 1, colSpan: 12 },
    params: { markdown: true, content: message },
  } as UIComponent
}

/**
 * Assembles a `ConnectorDynamicResultV1` into a single `UILayout` :
 * `primary` + `supplemental[]` + (`actions` → an `action-group`).
 *
 * - When `primary` is itself a layout, its components are spread in.
 * - Raw data is never sacrificed — every supplied component is kept.
 * - Pure : no side effects, deterministic.
 *
 * ### Degraded behavior (R2)
 *
 * - Valid v1 payload → normal assembled layout.
 * - Unknown `schemaVersion` but an otherwise-usable envelope → the
 *   components are still rendered, prefixed with a visible warning notice.
 * - Unreadable payload → an explicit error `UILayout` (a single `text`
 *   notice). Never throws, never returns an empty layout silently.
 *
 * A degraded layout always has an `id` starting with `connector-degraded`,
 * so a host can detect it (e.g. for telemetry) without inspecting content.
 */
export function connectorResultToUILayout(
  result: unknown,
  options: ConnectorResultToUILayoutOptions = {}
): UILayout {
  const strict = ConnectorDynamicResultV1Schema.safeParse(result)

  // ── Tier 3 : unreadable ───────────────────────────────────
  if (!strict.success) {
    const lenient = LenientResultSchema.safeParse(result)
    if (!lenient.success) {
      const version =
        result && typeof result === 'object'
          ? (result as { schemaVersion?: unknown }).schemaVersion
          : undefined
      return {
        id: 'connector-degraded',
        components: [
          degradedTextComponent(
            'connector-degraded-notice',
            `### Résultat non rendu\n\nLe résultat du connecteur n'a pas pu être interprété${
              typeof version === 'string' ? ` (schéma : \`${version}\`)` : ''
            }. Cet état explicite remplace une disparition silencieuse du rendu.`
          ),
        ],
        grid: { ...DEFAULT_GRID },
      }
    }
    // ── Tier 2 : usable envelope, unknown version ───────────
    const r = lenient.data
    const components: UIComponent[] = [
      degradedTextComponent(
        'connector-version-warning',
        `> ⚠ Schéma connecteur non reconnu (\`${r.schemaVersion}\`, attendu \`${CONNECTOR_DYNAMIC_RESULT_V1}\`). Le rendu ci-dessous est en mode dégradé.`
      ),
      ...collectComponents(r),
    ]
    return {
      id: options.id ?? `connector-degraded-${r.connectorId}`,
      components: components.map(withPosition),
      grid: { ...DEFAULT_GRID },
    }
  }

  // ── Tier 1 : valid v1 ─────────────────────────────────────
  const r = strict.data
  const components = collectComponents(r, options.actionsTitle).map(withPosition)
  return {
    id: options.id ?? layoutId(r.connectorId, r.queryHash ?? r.toolName),
    components,
    grid: { ...DEFAULT_GRID },
  }
}

/**
 * Flattens `primary` + `supplemental` + `actions` into a component list.
 * Shared by the valid and degraded-but-usable paths.
 */
function collectComponents(
  r: {
    primary: Record<string, unknown>
    supplemental?: Record<string, unknown>[]
    actions?: unknown[]
  },
  actionsTitle?: string
): UIComponent[] {
  const components: UIComponent[] = []

  if (isLayoutShape(r.primary)) {
    const inner = (r.primary as { components?: UIComponent[] }).components ?? []
    components.push(...inner)
  } else {
    components.push(r.primary as unknown as UIComponent)
  }

  if (r.supplemental) {
    components.push(...(r.supplemental as unknown as UIComponent[]))
  }

  if (Array.isArray(r.actions) && r.actions.length > 0) {
    components.push(
      connectorActionsToActionGroup(r.actions as ConnectorAction[], {
        id: 'connector-actions',
        title: actionsTitle,
      })
    )
  }

  return components
}

function layoutId(connectorId: string, suffix: string): string {
  return `connector-${connectorId}-${suffix}`
}
