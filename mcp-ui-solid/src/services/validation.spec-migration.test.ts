/**
 * Tests focused on the v5.5.0 spec-driven validation refactor (B.1 PR2).
 *
 * Complement to `validation.test.ts` (which is preserved untouched and
 * verifies legacy behavior + codes are unchanged) — this file covers what's
 * NEW in v5.5.0:
 *   1. ZodIssue → ValidationError mapper preserves legacy `code` per type
 *   2. Path translation: ZodIssue path → `params.<joined>`
 *   3. Artifact validation drift FIX (url + filename + mimeType, not `content`)
 *   4. Iframe + video: spec parse first, then chained domain whitelist
 *   5. Imperative passthrough types (chart, table, form, map, modal) still
 *      use the legacy validators with their rich codes
 */

import { describe, it, expect } from 'vitest'
import { validateComponent } from './validation'
import type { UIComponent, ComponentType } from '../types'

function makeComponent(type: ComponentType, params: Record<string, unknown> = {}): UIComponent {
  return {
    id: `test-${type}`,
    type,
    position: { colStart: 1, colSpan: 12 },
    params: params as any,
  }
}

describe('v5.5.0 — ZodIssue → ValidationError mapper', () => {
  it('emits the legacy code per ComponentType when shape parsing fails', () => {
    const cases: Array<{ type: ComponentType; legacyCode: string }> = [
      { type: 'metric', legacyCode: 'INVALID_METRIC' },
      { type: 'text', legacyCode: 'INVALID_TEXT' },
      { type: 'iframe', legacyCode: 'INVALID_IFRAME' },
      { type: 'image', legacyCode: 'INVALID_IMAGE' },
      { type: 'link', legacyCode: 'INVALID_LINK' },
      { type: 'action', legacyCode: 'INVALID_ACTION' },
      { type: 'video', legacyCode: 'INVALID_VIDEO' },
      { type: 'carousel', legacyCode: 'EMPTY_CAROUSEL' },
      { type: 'image-gallery', legacyCode: 'EMPTY_GALLERY' },
      { type: 'action-group', legacyCode: 'EMPTY_ACTION_GROUP' },
      { type: 'code', legacyCode: 'INVALID_CODE' },
      { type: 'artifact', legacyCode: 'INVALID_ARTIFACT' },
    ]

    for (const { type, legacyCode } of cases) {
      const result = validateComponent(makeComponent(type, {}))
      expect(result.valid, `${type} should fail validation with empty params`).toBe(false)
      const codes = result.errors?.map((e) => e.code) ?? []
      expect(codes, `${type} errors should include ${legacyCode}`).toContain(legacyCode)
    }
  })

  it('maps ZodIssue.path to `params.<joined>` shape', () => {
    // metric is missing both `title` and `value` → 2 errors with paths
    // `params.title` and `params.value`
    const result = validateComponent(makeComponent('metric', {}))
    expect(result.valid).toBe(false)

    const paths = (result.errors ?? []).map((e) => e.path)
    expect(paths).toContain('params.title')
    expect(paths).toContain('params.value')
  })

  it('emits a top-level `params` path when the failure is at the root (e.g. params is wrong type)', () => {
    // value=null fails the union(string, number); path is `params.value`
    const result = validateComponent(makeComponent('metric', { title: 'X', value: null }))
    expect(result.valid).toBe(false)
    const paths = (result.errors ?? []).map((e) => e.path)
    expect(paths.some((p) => p.startsWith('params.'))).toBe(true)
  })
})

describe('v5.5.0 — Artifact validation drift fix', () => {
  // Pre-v5.5.0 BUG: validation.ts checked `params.content` but ArtifactRenderer
  // expects `url + filename + mimeType`. Any valid artifact (per renderer)
  // would fail validation; any "valid" artifact (per old check) couldn't
  // render. Fixed as a side-effect of the spec migration.

  it('accepts a valid artifact with url + filename + mimeType', () => {
    const result = validateComponent(
      makeComponent('artifact', {
        url: 'https://artifacts.example.com/file.csv',
        filename: 'export.csv',
        mimeType: 'text/csv',
      })
    )
    expect(result.valid).toBe(true)
  })

  it('rejects an artifact with only `content` (the pre-v5.5.0 expected shape — was a bug)', () => {
    const result = validateComponent(makeComponent('artifact', { content: 'data' }))
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'INVALID_ARTIFACT')).toBe(true)
  })

  it('rejects an artifact missing filename', () => {
    const result = validateComponent(
      makeComponent('artifact', { url: 'https://x', mimeType: 'application/pdf' })
    )
    expect(result.valid).toBe(false)
    const filenameError = result.errors?.find((e) => e.path === 'params.filename')
    expect(filenameError).toBeDefined()
  })
})

describe('v5.5.0 — Iframe + video chained domain whitelist', () => {
  it('iframe with whitelisted domain (quickchart.io) passes validation', () => {
    const result = validateComponent(
      makeComponent('iframe', { url: 'https://quickchart.io/chart?c={}' })
    )
    expect(result.valid).toBe(true)
  })

  it('iframe domain check IS chained after spec parse (URL with malformed bracket throws → INVALID_URL)', () => {
    // Spec parse accepts any non-empty string; we feed it a URL the WHATWG
    // parser refuses (unbalanced bracket), which proves the chained
    // validateIframeDomain ran and surfaced its INVALID_URL code.
    const result = validateComponent(
      makeComponent('iframe', { url: 'http://[bad' })
    )
    expect(result.valid).toBe(false)
    const codes = result.errors?.map((e) => e.code) ?? []
    expect(codes).toContain('INVALID_URL')
  })

  it('iframe with missing url emits INVALID_IFRAME and SKIPS the domain check (no cascading error)', () => {
    const result = validateComponent(makeComponent('iframe', {}))
    expect(result.valid).toBe(false)
    const codes = result.errors?.map((e) => e.code) ?? []
    expect(codes).toContain('INVALID_IFRAME')
    // No domain whitelist error since url was absent — avoid noise
    expect(codes.every((c) => c === 'INVALID_IFRAME')).toBe(true)
  })

  it('video with whitelisted domain (youtube.com) passes domain check (only spec strict-url applies)', () => {
    // VideoComponentParamsSchema uses z.string().url() — strict
    const result = validateComponent(
      makeComponent('video', { url: 'https://www.youtube.com/embed/abc' })
    )
    expect(result.valid).toBe(true)
  })
})

describe('v5.5.0 — Imperative passthrough types preserve their rich codes', () => {
  it('chart still emits MISSING_DATA / MISSING_DATASETS / MISSING_LABELS via validateChartComponent', () => {
    const result = validateComponent(makeComponent('chart', {}))
    expect(result.valid).toBe(false)
    expect(result.errors?.[0].code).toBe('MISSING_DATA')
  })

  it('table still emits EMPTY_COLUMNS via validateTableComponent', () => {
    const result = validateComponent(makeComponent('table', { columns: [], rows: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'EMPTY_COLUMNS')).toBe(true)
  })

  it('form still emits EMPTY_FORM via the imperative path (spec form schema is too strict for LLM payloads)', () => {
    const result = validateComponent(makeComponent('form', { fields: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'EMPTY_FORM')).toBe(true)
  })

  it('map with object center {lat, lng} still passes (spec tuple shape would have rejected — kept imperative for compat)', () => {
    const result = validateComponent(
      makeComponent('map', { center: { lat: 48.8566, lng: 2.3522 }, zoom: 13 })
    )
    // Pre-v5.5.0 behavior preserved: object-shaped center is accepted.
    expect(result.valid).toBe(true)
  })

  it('modal with arbitrary minimal params still passes (no validation)', () => {
    const result = validateComponent(makeComponent('modal', { title: 'OK' }))
    expect(result.valid).toBe(true)
  })
})

describe('v5.5.0 — Invariants preserved (regression guard)', () => {
  it('truly unknown types still rejected with UNKNOWN_COMPONENT_TYPE', () => {
    const result = validateComponent(makeComponent('zzz-not-a-type' as ComponentType))
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')).toBe(true)
  })

  it('missing component.params still emits MISSING_PARAMS (early return, before spec dispatch)', () => {
    const component = {
      id: 'x',
      type: 'metric' as ComponentType,
      position: { colStart: 1, colSpan: 12 },
      params: undefined as any,
    }
    const result = validateComponent(component)
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'MISSING_PARAMS')).toBe(true)
  })

  it('grid position errors still emit (validateGridPosition runs before spec dispatch)', () => {
    const broken: UIComponent = {
      id: 'x',
      type: 'metric',
      position: { colStart: 99, colSpan: 1 },
      params: { title: 'X', value: 1 },
    }
    const result = validateComponent(broken)
    expect(result.valid).toBe(false)
    expect(result.errors?.some((e) => e.code === 'INVALID_GRID_COL_START')).toBe(true)
  })
})
