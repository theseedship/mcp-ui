/**
 * Tests for P0 fix: validateComponent() default case leniency
 *
 * Ensures unregistered component types pass through validateComponent()
 * without UNKNOWN_COMPONENT_TYPE errors.
 */

import { describe, it, expect } from 'vitest'
import { validateComponent } from './validation'
import type { UIComponent, ComponentType } from '../types'

/** Helper to create a minimal valid UIComponent for testing */
function makeComponent(type: ComponentType, params: Record<string, any> = {}): UIComponent {
  return {
    id: `test-${type}`,
    type,
    position: { colStart: 1, colSpan: 12 },
    params: params as any,
  }
}

/** Types that have explicit validation cases in validateComponent */
const VALIDATED_TYPES: ComponentType[] = [
  'chart', 'table', 'metric', 'text', 'iframe', 'image', 'link', 'action',
]

/** Types that hit the default case (no specific validation) */
const PASSTHROUGH_TYPES: ComponentType[] = [
  'code', 'map', 'form', 'modal', 'action-group',
  'image-gallery', 'video', 'grid', 'carousel',
  'artifact', 'footer',
]

describe('validateComponent', () => {
  describe('passthrough types (no specific validation case)', () => {
    it.each(PASSTHROUGH_TYPES)('"%s" does NOT produce UNKNOWN_COMPONENT_TYPE error', (type) => {
      const component = makeComponent(type)
      const result = validateComponent(component)

      const unknownTypeError = result.errors?.find(
        (e) => e.code === 'UNKNOWN_COMPONENT_TYPE'
      )
      expect(unknownTypeError).toBeUndefined()
    })
  })

  describe('validated types still work', () => {
    it('validates a valid chart component', () => {
      const component = makeComponent('chart', {
        chartType: 'bar',
        data: { labels: ['A'], datasets: [{ data: [1] }] },
      })
      const result = validateComponent(component)
      expect(result.valid).toBe(true)
    })

    it('validates a valid table component', () => {
      const component = makeComponent('table', {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ name: 'test' }],
      })
      const result = validateComponent(component)
      expect(result.valid).toBe(true)
    })

    it('validates a valid text component', () => {
      const component = makeComponent('text', {
        content: 'Hello world',
      })
      const result = validateComponent(component)
      expect(result.valid).toBe(true)
    })

    it('validates a valid metric component', () => {
      const component = makeComponent('metric', {
        value: 42,
        title: 'Count',
      })
      const result = validateComponent(component)
      expect(result.valid).toBe(true)
    })
  })

  describe('regression: code type renders without validation error', () => {
    it('type "code" passes validation', () => {
      const component = makeComponent('code', {
        code: 'console.log("hello")',
        language: 'typescript',
      })
      const result = validateComponent(component)
      const unknownTypeError = result.errors?.find(
        (e) => e.code === 'UNKNOWN_COMPONENT_TYPE'
      )
      expect(unknownTypeError).toBeUndefined()
    })

    it('type "map" passes validation', () => {
      const component = makeComponent('map', {
        center: { lat: 48.8566, lng: 2.3522 },
        zoom: 13,
      })
      const result = validateComponent(component)
      const unknownTypeError = result.errors?.find(
        (e) => e.code === 'UNKNOWN_COMPONENT_TYPE'
      )
      expect(unknownTypeError).toBeUndefined()
    })
  })

  describe('truly unknown types are rejected', () => {
    it('rejects a typo like "chrt" with UNKNOWN_COMPONENT_TYPE', () => {
      const component = makeComponent('chrt' as any)
      const result = validateComponent(component)
      const unknownTypeError = result.errors?.find(
        (e) => e.code === 'UNKNOWN_COMPONENT_TYPE'
      )
      expect(unknownTypeError).toBeDefined()
      expect(result.valid).toBe(false)
    })

    it('rejects garbage type "foobar"', () => {
      const component = makeComponent('foobar' as any)
      const result = validateComponent(component)
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')).toBe(true)
    })

    it('rejects empty string type', () => {
      const component = makeComponent('' as any)
      const result = validateComponent(component)
      expect(result.valid).toBe(false)
    })
  })
})
