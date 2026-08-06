import { describe, expect, it } from 'vitest'
import type { LatLngPoint as SpecLatLngPoint } from '@seed-ship/mcp-ui-spec'
import type { LatLngPoint, MapComponentParams, MapMarker } from './index'

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _latLngParity: Equal<LatLngPoint, SpecLatLngPoint> = true
void _latLngParity

describe('public map types (UI-MAP-0a)', () => {
  it('accepts both tuple and object LatLng forms', () => {
    const tuple: LatLngPoint = [48.8566, 2.3522]
    const object: LatLngPoint = { lat: 51.5074, lng: -0.1278 }
    const marker: MapMarker = { position: object, tooltip: 'London' }
    const params: MapComponentParams = { center: object, markers: [marker] }

    expect(tuple).toEqual([48.8566, 2.3522])
    expect(params.center).toEqual(object)
    expect(params.markers?.[0].position).toEqual(object)
  })
})
