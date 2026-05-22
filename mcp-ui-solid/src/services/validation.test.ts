/**
 * Tests for P0 fix: validateComponent() default case leniency
 *
 * Ensures unregistered component types pass through validateComponent()
 * without UNKNOWN_COMPONENT_TYPE errors.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  validateComponent,
  validateChartComponent,
  validatePayloadSize,
  getIframeSandbox,
  validateIframeDomain,
  DEFAULT_RESOURCE_LIMITS,
} from './validation'
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
  'artifact',
]

/** Types that hit the default case (no specific validation) */
const PASSTHROUGH_TYPES: ComponentType[] = [
  'code', 'map', 'form', 'modal', 'action-group',
  'image-gallery', 'video', 'grid', 'carousel',
  'footer',
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
        type: 'bar',
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

describe('validatePayloadSize — payload size guard (v6.8.0: 50KB → 512KB)', () => {
  /**
   * Build a `map` component whose JSON payload is at least `targetBytes`,
   * by appending valid GeoJSON Point features to a FeatureCollection.
   * Deterministic — no randomness, no clock.
   */
  function mapComponentOfSize(targetBytes: number): UIComponent {
    const component = makeComponent('map', {
      center: { lat: 48.8566, lng: 2.3522 },
      zoom: 12,
      geojson: { type: 'FeatureCollection', features: [] as unknown[] },
    })
    const features = (component.params as any).geojson.features as unknown[]
    while (JSON.stringify(component).length < targetBytes) {
      // Grow in batches to keep the size loop cheap.
      for (let i = 0; i < 200; i++) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
          properties: { i: features.length },
        })
      }
    }
    return component
  }

  it('the default ceiling is 512KB', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxPayloadSize).toBe(512 * 1024)
  })

  it('accepts a map with valid GeoJSON ~350KB (rejected under the old 50KB/256KB limits)', () => {
    const component = mapComponentOfSize(350 * 1024)
    const size = JSON.stringify(component).length
    expect(size).toBeGreaterThan(256 * 1024) // exceeds the interim 256KB ceiling
    expect(size).toBeLessThan(512 * 1024) // under the NEW 512KB limit

    expect(validatePayloadSize(component).valid).toBe(true)
    // Full component validation also passes — no PAYLOAD_TOO_LARGE.
    const result = validateComponent(component)
    expect(result.errors?.some((e) => e.code === 'PAYLOAD_TOO_LARGE')).toBeFalsy()
    expect(result.valid).toBe(true)
  })

  it('still rejects a map payload over 512KB', () => {
    const component = mapComponentOfSize(600 * 1024)
    expect(JSON.stringify(component).length).toBeGreaterThan(512 * 1024)

    const sizeResult = validatePayloadSize(component)
    expect(sizeResult.valid).toBe(false)
    expect(sizeResult.errors?.[0].code).toBe('PAYLOAD_TOO_LARGE')

    expect(validateComponent(component).errors?.some((e) => e.code === 'PAYLOAD_TOO_LARGE')).toBe(
      true
    )
  })

  it('still rejects an oversized NON-map payload (guard-rail intact for every type)', () => {
    const component = makeComponent('text', { content: 'x'.repeat(600 * 1024) })
    const result = validatePayloadSize(component)
    expect(result.valid).toBe(false)
    expect(result.errors?.[0].code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('honours a caller-supplied lower limit (validation is not disabled)', () => {
    // A consumer passing stricter limits keeps full control.
    const component = mapComponentOfSize(60 * 1024)
    const strict = { ...DEFAULT_RESOURCE_LIMITS, maxPayloadSize: 50 * 1024 }
    expect(validatePayloadSize(component, strict).valid).toBe(false)
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

describe('getIframeSandbox — tiered sandbox', () => {
  it('gives full sandbox to trusted domains (Google)', () => {
    const sandbox = getIframeSandbox('https://docs.google.com/spreadsheets/d/123')
    expect(sandbox).toContain('allow-same-origin')
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-forms')
  })

  it('gives full sandbox to Deposium domains', () => {
    const sandbox = getIframeSandbox('https://deposium.com/embed/123')
    expect(sandbox).toContain('allow-same-origin')
  })

  it('gives full sandbox to payment domains (Stripe)', () => {
    const sandbox = getIframeSandbox('https://checkout.stripe.com/c/pay_123')
    expect(sandbox).toContain('allow-same-origin')
    expect(sandbox).toContain('allow-forms')
  })

  it('gives full sandbox to Polar.sh', () => {
    const sandbox = getIframeSandbox('https://polar.sh/checkout/123')
    expect(sandbox).toContain('allow-same-origin')
  })

  it('gives restrictive sandbox to untrusted whitelisted domains (quickchart)', () => {
    const sandbox = getIframeSandbox('https://quickchart.io/chart?c={}')
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-popups')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(sandbox).not.toContain('allow-forms')
  })

  it('gives restrictive sandbox to YouTube', () => {
    const sandbox = getIframeSandbox('https://www.youtube.com/embed/abc123')
    expect(sandbox).not.toContain('allow-same-origin')
  })

  it('gives restrictive sandbox to unknown domains', () => {
    const sandbox = getIframeSandbox('https://evil.example.com/page')
    expect(sandbox).not.toContain('allow-same-origin')
  })

  it('handles invalid URLs gracefully', () => {
    const sandbox = getIframeSandbox('not-a-url')
    expect(sandbox).toBe('allow-scripts allow-popups')
  })

  it('supports custom trusted domains', () => {
    const sandbox = getIframeSandbox('https://my-internal-tool.corp.com/dash', {
      customTrustedDomains: ['my-internal-tool.corp.com'],
    })
    expect(sandbox).toContain('allow-same-origin')
  })
})

describe('validateIframeDomain — security regression (v5.5.1)', () => {
  // Pre-v5.5.1 bug: the predicate was
  //   `domain === allowed || domain.endsWith(`.${allowed}`) || allowed === 'localhost'`
  // The third clause `allowed === 'localhost'` was checking the WHITELIST
  // ENTRY (not the domain) — once 'localhost' appeared in DEFAULT_IFRAME_DOMAINS,
  // every URL was accepted. These tests lock the fixed behavior in place.

  it('REJECTS a non-whitelisted external domain (this used to silently pass)', () => {
    const result = validateIframeDomain('https://evil.example.com/x')
    expect(result.valid).toBe(false)
    expect(result.errors?.[0]?.code).toBe('DOMAIN_NOT_WHITELISTED')
  })

  it('REJECTS a typo-squat that is NOT a subdomain of any whitelisted entry', () => {
    // youtube-evil.com is not youtube.com nor a subdomain of it
    const result = validateIframeDomain('https://youtube-evil.com/embed/x')
    expect(result.valid).toBe(false)
    expect(result.errors?.[0]?.code).toBe('DOMAIN_NOT_WHITELISTED')
  })

  it('still accepts a whitelisted domain (quickchart.io)', () => {
    expect(validateIframeDomain('https://quickchart.io/chart?c={}').valid).toBe(true)
  })

  it('still accepts subdomains of whitelisted entries (player.vimeo.com)', () => {
    expect(validateIframeDomain('https://player.vimeo.com/video/123').valid).toBe(true)
  })

  it('still accepts localhost (dev convenience)', () => {
    expect(validateIframeDomain('http://localhost:3000/x').valid).toBe(true)
  })

  it('still accepts 127.0.0.1 (loopback equivalent of localhost)', () => {
    expect(validateIframeDomain('http://127.0.0.1:8080/x').valid).toBe(true)
  })

  it('respects allow-all policy bypass', () => {
    expect(validateIframeDomain('https://anything.com', { policy: 'allow-all' }).valid).toBe(true)
  })

  it('extend policy adds custom domains', () => {
    const result = validateIframeDomain('https://my-internal-tool.corp.com/x', {
      policy: 'extend',
      customDomains: ['my-internal-tool.corp.com'],
    })
    expect(result.valid).toBe(true)
  })
})
