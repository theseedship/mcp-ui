/**
 * Tests for the v5.0.2 schema relaxations (audit §L deposium answers):
 *   1. MapComponentParamsSchema.center accepts tuple OR {lat,lng} object
 *   2. FormFieldSchema.name regex allows hyphens, dots, underscore
 *
 * Locks the new accept/reject behavior in place so future spec edits
 * can't accidentally re-tighten without breaking visible tests.
 */

import { describe, it, expect } from 'vitest'
import {
  MapComponentParamsSchema,
  MapMarkerSchema,
  LatLngPointSchema,
  FormFieldSchema,
  TableComponentParamsSchema,
} from './schemas'

describe('LatLngPoint + MapComponentParamsSchema (v5.0.2 relax)', () => {
  it('accepts tuple [lat, lng]', () => {
    expect(LatLngPointSchema.safeParse([48.8566, 2.3522]).success).toBe(true)
  })

  it('accepts object {lat, lng}', () => {
    expect(LatLngPointSchema.safeParse({ lat: 48.8566, lng: 2.3522 }).success).toBe(true)
  })

  it('rejects object with wrong key names ({latitude, longitude})', () => {
    // We intentionally do NOT accept the verbose form to keep one
    // canonical object shape (Leaflet's LatLngLiteral).
    expect(LatLngPointSchema.safeParse({ latitude: 48.8, longitude: 2.3 }).success).toBe(false)
  })

  it('rejects tuple with wrong arity', () => {
    expect(LatLngPointSchema.safeParse([48.8566]).success).toBe(false)
    expect(LatLngPointSchema.safeParse([48.8566, 2.3522, 100]).success).toBe(false)
  })

  it('rejects tuple with non-numbers', () => {
    expect(LatLngPointSchema.safeParse(['48', '2']).success).toBe(false)
  })

  it('MapComponentParamsSchema.center accepts tuple OR object', () => {
    expect(
      MapComponentParamsSchema.safeParse({ center: [48.8566, 2.3522], zoom: 13 }).success
    ).toBe(true)
    expect(
      MapComponentParamsSchema.safeParse({ center: { lat: 48.8566, lng: 2.3522 }, zoom: 13 }).success
    ).toBe(true)
  })

  it('MapMarkerSchema.position accepts tuple OR object', () => {
    expect(MapMarkerSchema.safeParse({ position: [48.8566, 2.3522] }).success).toBe(true)
    expect(
      MapMarkerSchema.safeParse({ position: { lat: 48.8566, lng: 2.3522 }, tooltip: 'X' }).success
    ).toBe(true)
  })

  it('Map params still accepts no center (markers can drive auto-center)', () => {
    expect(
      MapComponentParamsSchema.safeParse({ markers: [{ position: [48, 2] }] }).success
    ).toBe(true)
  })
})

describe('TableComponentParamsSchema.citationMap (v5.0.3)', () => {
  const baseTable = {
    columns: [{ key: 'a', label: 'A' }],
    rows: [],
  }

  it('accepts a table without citationMap (backward compat)', () => {
    expect(TableComponentParamsSchema.safeParse(baseTable).success).toBe(true)
  })

  it('accepts a table with citationMap (string keys, mixed page types)', () => {
    expect(
      TableComponentParamsSchema.safeParse({
        ...baseTable,
        citationMap: {
          '1': { page: 5, file: 'A.pdf', file_id: 42 },
          '2': { page: '12-14', file: 'B.txt' },
          '3': { page: 1 }, // file optional
        },
      }).success
    ).toBe(true)
  })

  it('rejects citationMap entry missing page', () => {
    expect(
      TableComponentParamsSchema.safeParse({
        ...baseTable,
        citationMap: { '1': { file: 'A.pdf' } as any },
      }).success
    ).toBe(false)
  })
})

describe('FormFieldSchema.name regex (v5.0.2 relax)', () => {
  function field(name: string) {
    return { name, type: 'text' as const }
  }

  it('still accepts existing snake_case names (deposium production: 19/19 conform)', () => {
    for (const name of ['annee', 'classe_dpe', 'type_etablissement', 'depth', 'period']) {
      expect(FormFieldSchema.safeParse(field(name)).success).toBe(true)
    }
  })

  it('NEW — accepts kebab-case (URL params, opendata IDs)', () => {
    for (const name of ['commune-name', 'space-id', 'tenant-id', 'first-name']) {
      expect(FormFieldSchema.safeParse(field(name)).success).toBe(true)
    }
  })

  it('NEW — accepts dot-paths (nested form fields)', () => {
    for (const name of ['address.city', 'user.email', 'meta.created_at']) {
      expect(FormFieldSchema.safeParse(field(name)).success).toBe(true)
    }
  })

  it('still rejects leading digit (CSS selector / JS access break)', () => {
    expect(FormFieldSchema.safeParse(field('2fa_code')).success).toBe(false)
    expect(FormFieldSchema.safeParse(field('1st-place')).success).toBe(false)
  })

  it('still rejects spaces, special chars, accents', () => {
    expect(FormFieldSchema.safeParse(field('first name')).success).toBe(false)
    expect(FormFieldSchema.safeParse(field('passwd!')).success).toBe(false)
    expect(FormFieldSchema.safeParse(field('café')).success).toBe(false)
    expect(FormFieldSchema.safeParse(field('foo@bar')).success).toBe(false)
  })

  it('still rejects empty name', () => {
    expect(FormFieldSchema.safeParse(field('')).success).toBe(false)
  })
})
