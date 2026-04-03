/**
 * Tests for P0 fix: validateComponent() default case leniency
 *
 * Ensures unregistered component types pass through validateComponent()
 * without UNKNOWN_COMPONENT_TYPE errors.
 */

import { describe, it, expect, vi } from 'vitest'
import { validateComponent, validateChartComponent } from './validation'
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

  describe('H2: missing component.params guard', () => {
    it('rejects component with undefined params', () => {
      const component = { id: 'test', type: 'chart' as any, position: { colStart: 1, colSpan: 12 }, params: undefined as any }
      const result = validateComponent(component)
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.code === 'MISSING_PARAMS')).toBe(true)
    })
  })
})

describe('component-specific validation', () => {
  it('rejects video without url', () => {
    const result = validateComponent(makeComponent('video'))
    expect(result.errors?.some((e) => e.code === 'INVALID_VIDEO')).toBe(true)
  })

  it('rejects carousel with empty items', () => {
    const result = validateComponent(makeComponent('carousel', { items: [] }))
    expect(result.errors?.some((e) => e.code === 'EMPTY_CAROUSEL')).toBe(true)
  })

  it('rejects image-gallery with empty images', () => {
    const result = validateComponent(makeComponent('image-gallery', { images: [] }))
    expect(result.errors?.some((e) => e.code === 'EMPTY_GALLERY')).toBe(true)
  })

  it('rejects form with empty fields', () => {
    const result = validateComponent(makeComponent('form', { fields: [] }))
    expect(result.errors?.some((e) => e.code === 'EMPTY_FORM')).toBe(true)
  })

  it('rejects action-group with empty actions', () => {
    const result = validateComponent(makeComponent('action-group', { actions: [] }))
    expect(result.errors?.some((e) => e.code === 'EMPTY_ACTION_GROUP')).toBe(true)
  })

  it('rejects code without code content', () => {
    const result = validateComponent(makeComponent('code'))
    expect(result.errors?.some((e) => e.code === 'INVALID_CODE')).toBe(true)
  })

  it('rejects map without center or markers', () => {
    const result = validateComponent(makeComponent('map'))
    expect(result.errors?.some((e) => e.code === 'INVALID_MAP')).toBe(true)
  })

  it('accepts map with markers but no center', () => {
    const result = validateComponent(makeComponent('map', { markers: [{ position: [48, 2] }] }))
    const mapError = result.errors?.find((e) => e.code === 'INVALID_MAP')
    expect(mapError).toBeUndefined()
  })

  it('accepts modal with no params beyond type', () => {
    const result = validateComponent(makeComponent('modal', { title: 'Test' }))
    expect(result.valid).toBe(true)
  })
})

describe('validateChartComponent — scatter/bubble/time-series', () => {
  it('validates scatter chart without labels', () => {
    const result = validateChartComponent({
      type: 'scatter',
      data: { datasets: [{ label: 'Test', data: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }] },
    } as any)
    expect(result.valid).toBe(true)
  })

  it('validates bubble chart without labels', () => {
    const result = validateChartComponent({
      type: 'bubble',
      data: { datasets: [{ label: 'Test', data: [{ x: 1, y: 2, r: 5 }] }] },
    } as any)
    expect(result.valid).toBe(true)
  })

  it('validates line chart with time-series object data', () => {
    const result = validateChartComponent({
      type: 'line',
      data: { datasets: [{ label: 'Prix', data: [{ x: '2024-01-01', y: 42 }, { x: '2024-02-01', y: 45 }] }] },
    } as any)
    expect(result.valid).toBe(true)
  })

  it('rejects scatter with number data instead of {x,y}', () => {
    const result = validateChartComponent({
      type: 'scatter',
      data: { datasets: [{ label: 'Test', data: [1, 2, 3] }] },
    } as any)
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'INVALID_POINT_DATA')).toBe(true)
  })

  it('rejects bar chart without labels', () => {
    const result = validateChartComponent({
      type: 'bar',
      data: { datasets: [{ label: 'Test', data: [1, 2, 3] }] },
    } as any)
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'MISSING_LABELS')).toBe(true)
  })

  it('accepts empty dataset without length mismatch', () => {
    const result = validateChartComponent({
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ label: 'Test', data: [] }] },
    } as any)
    // Empty dataset should not trigger DATA_LENGTH_MISMATCH
    const mismatch = result.errors?.find((e) => e.code === 'DATA_LENGTH_MISMATCH')
    expect(mismatch).toBeUndefined()
  })
})

describe('validateChartComponent — H1 null guards', () => {

  it('rejects chart with undefined data', () => {
    const result = validateChartComponent({ type: 'bar', data: undefined as any } as any)
    expect(result.valid).toBe(false)
    expect(result.errors?.[0].code).toBe('MISSING_DATA')
  })

  it('rejects chart with missing datasets', () => {
    const result = validateChartComponent({ type: 'bar', data: { labels: ['A'] } } as any)
    expect(result.valid).toBe(false)
    expect(result.errors?.[0].code).toBe('MISSING_DATASETS')
  })

  it('rejects chart with missing labels', () => {
    const result = validateChartComponent({ type: 'bar', data: { datasets: [{ label: 'X', data: [1] }] } } as any)
    expect(result.valid).toBe(false)
    expect(result.errors?.[0].code).toBe('MISSING_LABELS')
  })

  it('validates chart with proper data', () => {
    const result = validateChartComponent({
      type: 'bar',
      data: { labels: ['A', 'B'], datasets: [{ label: 'X', data: [1, 2] }] },
    } as any)
    expect(result.valid).toBe(true)
  })
})
