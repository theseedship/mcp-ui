/**
 * Opt-in, pure presentation recipes for existing MCP-UI components.
 *
 * These helpers arrange caller-supplied components only. They never fetch,
 * aggregate, sort, infer confidence, or manufacture sources: data, params,
 * citations and component metadata remain the caller's responsibility.
 */

import type {
  ChartComponentParams,
  GridPosition,
  MapComponentParams,
  MetricComponentParams,
  TableComponentParams,
  TextComponentParams,
  UIComponent,
  UILayout,
} from '../types'
import type { LinkComponentParams } from '@seed-ship/mcp-ui-spec'

type PresentationType = 'chart' | 'table' | 'map' | 'metric' | 'text' | 'link'

/** A recipe owns the eventual grid position, so caller positions are optional. */
export type PresentationComponent<T extends PresentationType, Params> = Omit<
  UIComponent,
  'type' | 'params' | 'position'
> & {
  type: T
  params: Params
  position?: GridPosition
}

export type ChartComponent = PresentationComponent<'chart', ChartComponentParams>
export type TableComponent = PresentationComponent<'table', TableComponentParams>
export type MapComponent = PresentationComponent<'map', MapComponentParams>
export type MetricComponent = PresentationComponent<'metric', MetricComponentParams>
export type TextComponent = PresentationComponent<'text', TextComponentParams>
export type LinkComponent = PresentationComponent<'link', LinkComponentParams>

export interface ComparisonLayoutInput {
  /** Stable layout id; lower-case letters, digits and hyphens only. */
  id: string
  chart: ChartComponent
  table: TableComponent
  metrics?: MetricComponent[]
  summary?: TextComponent
  metadata?: UILayout['metadata']
}

export interface GeographyLayoutInput {
  /** Stable layout id; lower-case letters, digits and hyphens only. */
  id: string
  map: MapComponent
  table: TableComponent
  metrics?: MetricComponent[]
  summary?: TextComponent
  metadata?: UILayout['metadata']
}

export interface EvidenceLayoutInput {
  /** Stable layout id; lower-case letters, digits and hyphens only. */
  id: string
  summary: TextComponent
  table: TableComponent
  sources?: LinkComponent[]
  metadata?: UILayout['metadata']
}

const ID_PATTERN = /^[a-z0-9-]+$/
const DEFAULT_GRID = { columns: 12, gap: '1rem' } as const

/**
 * Presents a comparison in reading order: optional context and KPIs, then a
 * chart beside the complete table. The supplied rows and chart series keep
 * their original order.
 */
export function createComparisonLayout(input: ComparisonLayoutInput): UILayout {
  assertRecipeId(input.id)
  const inputComponents: Array<PresentationComponent<PresentationType, unknown>> = [
    input.chart, input.table, ...(input.metrics ?? []),
  ]
  if (input.summary) inputComponents.push(input.summary)
  assertUniqueComponentIds(inputComponents)
  assertType(input.chart, 'chart', 'chart')
  assertType(input.table, 'table', 'table')
  input.metrics?.forEach((metric, index) => assertType(metric, 'metric', `metrics[${index}]`))
  if (input.summary) assertType(input.summary, 'text', 'summary')

  let row = 1
  const components: UIComponent[] = []
  if (input.summary) {
    components.push(copyForLayout(input.summary, fullWidth(row++)))
  }
  components.push(...placeMetrics(input.metrics ?? [], row))
  row += metricRows(input.metrics?.length ?? 0)
  components.push(
    copyForLayout(input.chart, { colStart: 1, colSpan: 7, rowStart: row }),
    copyForLayout(input.table, { colStart: 8, colSpan: 5, rowStart: row })
  )
  return makeLayout(input.id, components, input.metadata)
}

/**
 * Pairs a geographic overview with the corresponding inspectable table.
 * Map and table data are passed through unchanged, including GeoJSON and
 * citation maps.
 */
export function createGeographyLayout(input: GeographyLayoutInput): UILayout {
  assertRecipeId(input.id)
  const inputComponents: Array<PresentationComponent<PresentationType, unknown>> = [
    input.map, input.table, ...(input.metrics ?? []),
  ]
  if (input.summary) inputComponents.push(input.summary)
  assertUniqueComponentIds(inputComponents)
  assertType(input.map, 'map', 'map')
  assertType(input.table, 'table', 'table')
  input.metrics?.forEach((metric, index) => assertType(metric, 'metric', `metrics[${index}]`))
  if (input.summary) assertType(input.summary, 'text', 'summary')

  let row = 1
  const components: UIComponent[] = []
  if (input.summary) {
    components.push(copyForLayout(input.summary, fullWidth(row++)))
  }
  components.push(...placeMetrics(input.metrics ?? [], row))
  row += metricRows(input.metrics?.length ?? 0)
  components.push(
    copyForLayout(input.map, { colStart: 1, colSpan: 8, rowStart: row }),
    copyForLayout(input.table, { colStart: 9, colSpan: 4, rowStart: row })
  )
  return makeLayout(input.id, components, input.metadata)
}

/**
 * Puts the conclusion first, evidence table second, and supplied source links
 * last. Source order is deliberately preserved: this is a presentation recipe,
 * not a confidence or provenance ranking algorithm.
 */
export function createEvidenceLayout(input: EvidenceLayoutInput): UILayout {
  assertRecipeId(input.id)
  const pieces = [input.summary, input.table, ...(input.sources ?? [])]
  assertType(input.summary, 'text', 'summary')
  assertType(input.table, 'table', 'table')
  input.sources?.forEach((source, index) => assertType(source, 'link', `sources[${index}]`))
  assertUniqueComponentIds(pieces)

  const components: UIComponent[] = [
    copyForLayout(input.summary, fullWidth(1)),
    copyForLayout(input.table, fullWidth(2)),
    ...placeSources(input.sources ?? [], 3),
  ]
  return makeLayout(input.id, components, input.metadata)
}

function makeLayout(id: string, components: UIComponent[], metadata?: UILayout['metadata']): UILayout {
  assertUniqueComponentIds(components)
  return { id, components, grid: { ...DEFAULT_GRID }, ...(metadata ? { metadata: { ...metadata } } : {}) }
}

function fullWidth(rowStart: number): GridPosition {
  return { colStart: 1, colSpan: 12, rowStart }
}

function placeMetrics(metrics: MetricComponent[], rowStart: number): UIComponent[] {
  if (metrics.length === 0) return []
  const span = metrics.length === 1 ? 12 : metrics.length === 2 ? 6 : metrics.length === 3 ? 4 : 3
  return metrics.map((metric, index) => {
    const column = (index % Math.floor(12 / span)) * span + 1
    const row = rowStart + Math.floor(index / Math.floor(12 / span))
    return copyForLayout(metric, { colStart: column, colSpan: span, rowStart: row })
  })
}

function metricRows(count: number): number {
  if (count === 0) return 0
  if (count <= 4) return 1
  return Math.ceil(count / 4)
}

function placeSources(sources: LinkComponent[], rowStart: number): UIComponent[] {
  return sources.map((source, index) => ({
    ...copyForLayout(source, {
      colStart: (index % 3) * 4 + 1,
      colSpan: 4,
      rowStart: rowStart + Math.floor(index / 3),
    }),
  }))
}

function copyForLayout(
  component: PresentationComponent<PresentationType, unknown>,
  position: GridPosition
): UIComponent {
  return {
    ...component,
    position: { ...position },
  } as UIComponent
}

function assertRecipeId(id: string): void {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error('Presentation layout id must contain only lower-case letters, digits and hyphens.')
  }
}

function assertType(component: { type: string }, expected: PresentationType, path: string): void {
  if (component?.type !== expected) {
    throw new Error(`${path} must be a ${expected} component.`)
  }
}

/** Validates source IDs recursively so nested GridRenderer children stay key-safe. */
function assertUniqueComponentIds(components: Array<UIComponent | PresentationComponent<PresentationType, unknown>>): void {
  const ids = new Set<string>()
  const visit = (component: { id: unknown; type?: unknown; params?: unknown }, path: string): void => {
    if (!component || typeof component.id !== 'string' || !ID_PATTERN.test(component.id)) {
      throw new Error(`${path} must have a stable lower-case component id.`)
    }
    if (ids.has(component.id)) throw new Error(`Duplicate component id: ${component.id}`)
    ids.add(component.id)
    if (component.type === 'grid') {
      const children = (component.params as { children?: unknown })?.children
      if (Array.isArray(children)) {
        children.forEach((child, index) => visit(child as { id: unknown; type?: unknown; params?: unknown }, `${path}.children[${index}]`))
      }
    }
  }
  components.forEach((component, index) => visit(component, `components[${index}]`))
}
