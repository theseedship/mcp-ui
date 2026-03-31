/**
 * Tests for P0 fix: ComponentRegistry validation leniency
 *
 * Ensures unregistered component types (code, map, form, modal, etc.)
 * pass validation with warnings instead of failing with errors.
 */

import { describe, it, expect } from 'vitest'
import { validateAgainstRegistry, getComponentEntry, ComponentRegistry } from './component-registry'
import type { ComponentType } from '../types'

/** The 9 types currently registered in ComponentRegistry */
const REGISTERED_TYPES: ComponentType[] = [
  'chart', 'table', 'metric', 'text', 'grid',
  'action', 'footer', 'carousel', 'artifact',
]

/** The 9 types with renderers but NO registry entry */
const UNREGISTERED_TYPES: ComponentType[] = [
  'code', 'map', 'form', 'modal', 'action-group',
  'image-gallery', 'video', 'iframe', 'image', 'link',
]

describe('validateAgainstRegistry', () => {
  describe('registered types', () => {
    it.each(REGISTERED_TYPES)('validates "%s" with valid: true when params are correct', (type) => {
      const entry = getComponentEntry(type)
      expect(entry).toBeDefined()

      // Build minimal valid params from required fields
      const params: Record<string, any> = {}
      const required = entry!.schema.required || []
      for (const key of required) {
        params[key] = 'test-value'
      }

      const result = validateAgainstRegistry(type, params)
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
      expect(result.warnings).toBeUndefined()
    })

    it.each(REGISTERED_TYPES)('rejects "%s" when required fields are missing', (type) => {
      const entry = getComponentEntry(type)
      const required = entry!.schema.required || []
      if (required.length === 0) return // skip types with no required fields

      const result = validateAgainstRegistry(type, {})
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
      expect(result.errors![0]).toContain('Missing required field')
    })
  })

  describe('unregistered types (have renderers, no registry entry)', () => {
    it.each(UNREGISTERED_TYPES)('passes "%s" with valid: true and a warning', (type) => {
      const result = validateAgainstRegistry(type, { anything: true })
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain(`No registry entry for type: ${type}`)
    })

    it.each(UNREGISTERED_TYPES)('getComponentEntry returns undefined for "%s"', (type) => {
      expect(getComponentEntry(type)).toBeUndefined()
    })
  })

  describe('registry consistency', () => {
    it('has exactly 9 registered types', () => {
      expect(ComponentRegistry.size).toBe(9)
    })

    it('all registered types are in REGISTERED_TYPES', () => {
      for (const [type] of ComponentRegistry) {
        expect(REGISTERED_TYPES).toContain(type)
      }
    })
  })
})
