/**
 * Tests for ComponentRegistry — all 19 component types registered
 */

import { describe, it, expect } from 'vitest'
import {
  validateAgainstRegistry,
  getComponentEntry,
  ComponentRegistry,
  MapRegistry,
} from './component-registry'
import type { ComponentType } from '../types'
import { ComponentTypeSchema, MapComponentParamsSchema } from '@seed-ship/mcp-ui-spec'

interface RegistrySchemaNode {
  type?: string
  enum?: string[]
  oneOf?: RegistrySchemaNode[]
  anyOf?: RegistrySchemaNode[]
  properties?: Record<string, RegistrySchemaNode>
  required?: string[]
  items?: RegistrySchemaNode | RegistrySchemaNode[]
  additionalItems?: boolean
  minItems?: number
  maxItems?: number
  minLength?: number
}

/** All 20 component types in the registry */
const ALL_TYPES: ComponentType[] = [
  'chart', 'table', 'metric', 'text', 'grid',
  'action', 'footer', 'carousel', 'artifact',
  'code', 'map', 'graph', 'form', 'modal', 'action-group',
  'image-gallery', 'video', 'iframe', 'image', 'link',
]

// Schema component types that are intentionally NOT standalone registry
// entries. `composite` is a layout container rendered inline by
// UIResourceRenderer (like a bare layout), not a leaf component with its own
// params schema / examples.
const REGISTRY_EXCEPTIONS = new Set<string>(['composite'])

describe('registry ↔ schema parity (P1.5)', () => {
  it('every schema component type has a registry entry (except documented containers)', () => {
    const missing = (ComponentTypeSchema.options as readonly string[]).filter(
      (t) => !REGISTRY_EXCEPTIONS.has(t) && !ComponentRegistry.has(t as ComponentType)
    )
    expect(missing).toEqual([])
  })

  it('every registry type is a valid schema component type', () => {
    const schemaTypes = new Set<string>(ComponentTypeSchema.options)
    const extra = Array.from(ComponentRegistry.keys()).filter((t) => !schemaTypes.has(t))
    expect(extra).toEqual([])
  })

  it('graph is registered (regression for P1.5)', () => {
    expect(ComponentRegistry.has('graph')).toBe(true)
    expect(getComponentEntry('graph')?.type).toBe('graph')
  })
})

describe('MapRegistry ↔ map spec parity (UI-MAP-0a)', () => {
  const properties = MapRegistry.schema.properties as Record<string, RegistrySchemaNode>
  const center = properties.center as { oneOf: unknown[] }
  const markers = properties.markers as {
    items: {
      properties: Record<string, unknown> & { position: { oneOf: unknown[] } }
    }
  }
  const markerProperties = markers.items.properties

  it('advertises every root field accepted by MapComponentParamsSchema', () => {
    expect(Object.keys(properties).sort()).toEqual(Object.keys(MapComponentParamsSchema.shape).sort())
  })

  it('uses the canonical marker names and keeps host trust out of the payload', () => {
    expect(markerProperties).toHaveProperty('tooltip')
    expect(markerProperties).not.toHaveProperty('title')
    expect(properties).not.toHaveProperty('allowHtmlPopups')
  })

  it('advertises both tuple and object LatLng forms', () => {
    expect(center.oneOf).toHaveLength(2)
    expect(markerProperties.position.oneOf).toHaveLength(2)
  })

  it('advertises only the GeoJSON root shapes accepted by the runtime spec', () => {
    const branches = properties.geojson.oneOf ?? []
    const branchesByType = Object.fromEntries(
      branches.map((branch) => {
        const types = branch.properties?.type.enum ?? []
        return [types.length === 1 ? types[0] : 'Geometry', branch]
      })
    ) as Record<string, RegistrySchemaNode>

    expect(Object.keys(branchesByType).sort()).toEqual(['Feature', 'FeatureCollection', 'Geometry'])
    expect(branchesByType.FeatureCollection.required).toEqual(['type', 'features'])
    expect(branchesByType.Feature.required).toEqual(['type', 'geometry'])
    expect(branchesByType.Geometry.required).toEqual(['type'])
    expect(branchesByType.Geometry.properties?.type.enum).toEqual([
      'Point',
      'MultiPoint',
      'LineString',
      'MultiLineString',
      'Polygon',
      'MultiPolygon',
      'GeometryCollection',
    ])
    expect(branchesByType.Geometry.properties?.coordinates.anyOf).toHaveLength(4)
  })

  it('preserves choropleth tuple order and rejects empty layer names in the advertised schema', () => {
    const scale = properties.geojsonStyle.properties?.choroplethScale
    const tuple = scale?.items as RegistrySchemaNode
    const tupleItems = tuple.items as RegistrySchemaNode[]
    const layer = properties.layers.items as RegistrySchemaNode

    expect(tupleItems).toEqual([{ type: 'number' }, { type: 'string' }])
    expect(tuple.additionalItems).toBe(false)
    expect(tuple.minItems).toBe(2)
    expect(tuple.maxItems).toBe(2)
    expect(tuple).not.toHaveProperty('prefixItems')
    expect(layer.properties?.name.minLength).toBe(1)
  })

  it.each([
    ['empty GeoJSON objects', { geojson: {} }],
    ['reversed choropleth tuples', { geojsonStyle: { choroplethScale: [['red', 0]] } }],
    [
      'empty layer names',
      {
        layers: [
          {
            name: '',
            geojson: { type: 'FeatureCollection', features: [] },
          },
        ],
      },
    ],
  ])('keeps runtime rejection coverage for %s', (_label, params) => {
    expect(MapComponentParamsSchema.safeParse(params).success).toBe(false)
  })
})

describe('ComponentRegistry', () => {
  describe('registry completeness', () => {
    it('has exactly 20 registered types', () => {
      expect(ComponentRegistry.size).toBe(20)
    })

    it.each(ALL_TYPES)('has registry entry for "%s"', (type) => {
      const entry = getComponentEntry(type)
      expect(entry).toBeDefined()
      expect(entry!.type).toBe(type)
      expect(entry!.name).toBeTruthy()
      expect(entry!.description).toBeTruthy()
      expect(entry!.schema).toBeDefined()
      expect(entry!.examples).toBeDefined()
    })
  })

  describe('validateAgainstRegistry', () => {
    it.each(ALL_TYPES)('validates "%s" with valid: true when params satisfy required fields', (type) => {
      const entry = getComponentEntry(type)!
      const params: Record<string, any> = {}
      const required = entry.schema.required || []
      for (const key of required) {
        params[key] = 'test-value'
      }

      const result = validateAgainstRegistry(type, params)
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it.each(
      ALL_TYPES.filter((type) => {
        const entry = getComponentEntry(type)
        return entry && (entry.schema.required || []).length > 0
      })
    )('rejects "%s" when required fields are missing', (type) => {
      const result = validateAgainstRegistry(type, {})
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Missing required field')
    })
  })

  /** Types that have examples defined */
  const TYPES_WITH_EXAMPLES = ALL_TYPES.filter((type) => {
    const entry = getComponentEntry(type)
    return entry && entry.examples.length > 0
  })

  describe('example components', () => {
    it.each(TYPES_WITH_EXAMPLES)('"%s" examples have valid structure', (type) => {
      const entry = getComponentEntry(type)!
      for (const example of entry.examples) {
        expect(example.query).toBeTruthy()
        expect(example.component).toBeDefined()
        expect(example.component.id).toBeTruthy()
        expect(example.component.type).toBe(type)
        expect(example.component.position).toBeDefined()
        expect(example.component.params).toBeDefined()
      }
    })
  })

  describe('warns for truly unknown types', () => {
    it('returns warning for unknown type "foobar"', () => {
      const result = validateAgainstRegistry('foobar' as ComponentType, {})
      expect(result.valid).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('No registry entry for type: foobar')
    })
  })
})
