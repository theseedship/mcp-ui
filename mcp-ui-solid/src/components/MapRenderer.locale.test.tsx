/**
 * MapRenderer — locale changes (v6.20.0).
 *
 * GeoJSON popups read `MCPUIStrings.locale` when they open, through a getter
 * bound with `bindPopup(fn)`. The map setup effect must NOT track the strings:
 * it is not idempotent (layer control, PMTiles layer, view reset), so a
 * provider change would stack controls and throw away the user's pan/zoom.
 *
 * Own file: this Leaflet mock records every call, and a module mock shared
 * with `MapRenderer.test.tsx` is not reliably applied to the component's
 * dynamic `import('leaflet')` there.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { MapRenderer } from './MapRenderer'
import { MCPUIStringsProvider, type MCPUIStrings } from '../context/MCPUIStringsContext'
import type { MapComponentParams } from '../types'

const leafletCalls = vi.hoisted(() => ({
  map: 0,
  layersControl: 0,
  setView: 0,
  geoJSONOptions: [] as Array<{ onEachFeature?: (feature: unknown, layer: unknown) => void }>,
}))

vi.mock('leaflet', () => {
  const bounds = () => ({ pad: () => ({}), isValid: () => true })
  const mapInstance: Record<string, unknown> = {
    eachLayer: () => {},
    removeLayer: () => {},
    remove: () => {},
    getZoom: () => 3,
    addLayer: () => {},
  }
  mapInstance.setView = () => {
    leafletCalls.setView += 1
    return mapInstance
  }
  mapInstance.fitBounds = () => mapInstance
  return {
    default: {
      map: () => {
        leafletCalls.map += 1
        return mapInstance
      },
      tileLayer: () => ({ addTo: () => ({}) }),
      marker: () => ({ addTo: () => ({}) }),
      featureGroup: () => ({ getBounds: bounds }),
      control: {
        attribution: () => ({ addTo: () => ({}) }),
        layers: () => ({
          addTo: () => {
            leafletCalls.layersControl += 1
          },
        }),
      },
      geoJSON: (_data: unknown, options: { onEachFeature?: (feature: unknown, layer: unknown) => void }) => {
        leafletCalls.geoJSONOptions.push(options)
        const layer = { addTo: () => layer, getBounds: bounds }
        return layer
      },
      circleMarker: () => ({ bindPopup: () => ({}) }),
      GeoJSON: class {},
      CircleMarker: class {},
      Marker: class {},
      Icon: { Default: { prototype: {}, mergeOptions: () => {} } },
    },
  }
})
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const COLLECTION = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.35, 48.85] },
      properties: { name: 'Zone', prix_m2: 1234.5 },
    },
  ],
}

describe('MapRenderer — locale changes (v6.20.0)', () => {
  it('popups read the current locale, and a strings change does not re-run map setup', async () => {
    const [strings, setStrings] = createSignal<Partial<MCPUIStrings>>({ locale: 'en-US' })
    const params = {
      center: [48.85, 2.35],
      zoom: 3,
      popup: { titleField: 'name', fields: ['prix_m2'] },
      layers: [
        { name: 'A', geojson: COLLECTION, visible: true },
        { name: 'B', geojson: COLLECTION, visible: true },
      ],
    } as unknown as MapComponentParams

    render(() => (
      <MCPUIStringsProvider strings={strings()}>
        <MapRenderer params={params} />
      </MCPUIStringsProvider>
    ))

    await waitFor(() => expect(leafletCalls.layersControl).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 30))
    const setup = {
      map: leafletCalls.map,
      layersControl: leafletCalls.layersControl,
      setView: leafletCalls.setView,
      geoJSON: leafletCalls.geoJSONOptions.length,
    }
    expect(setup.map).toBe(1)

    const bindPopup = vi.fn()
    leafletCalls.geoJSONOptions[0].onEachFeature?.(
      { properties: { name: 'Zone', prix_m2: 1234.5 } },
      { bindPopup }
    )
    const content = bindPopup.mock.calls[0][0] as () => string
    expect(typeof content).toBe('function')
    expect(content()).toContain('1,234.5')

    setStrings({ locale: 'de-DE' })
    await new Promise((resolve) => setTimeout(resolve, 30))
    setStrings({ locale: 'de-DE', expand: 'Vergrößern' })
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(content()).toContain('1.234,5')
    expect({
      map: leafletCalls.map,
      layersControl: leafletCalls.layersControl,
      setView: leafletCalls.setView,
      geoJSON: leafletCalls.geoJSONOptions.length,
    }).toEqual(setup)
  })
})
