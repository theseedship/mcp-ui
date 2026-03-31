/**
 * Tests for ComponentRegistry — all 19 component types registered
 */

import { describe, it, expect } from 'vitest'
import { validateAgainstRegistry, getComponentEntry, ComponentRegistry } from './component-registry'
import type { ComponentType } from '../types'

/** All 19 component types in the registry */
const ALL_TYPES: ComponentType[] = [
  'chart', 'table', 'metric', 'text', 'grid',
  'action', 'footer', 'carousel', 'artifact',
  'code', 'map', 'form', 'modal', 'action-group',
  'image-gallery', 'video', 'iframe', 'image', 'link',
]

describe('ComponentRegistry', () => {
  describe('registry completeness', () => {
    it('has exactly 19 registered types', () => {
      expect(ComponentRegistry.size).toBe(19)
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
