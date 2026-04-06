/**
 * MapRenderer Tests
 * Sprint 6 + v3.1.0: GeoJSON, choropleth, popups
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@solidjs/testing-library'
import { MapRenderer } from './MapRenderer'
import type { MapComponentParams } from '../types'

// Mock Leaflet
const setViewMock = vi.fn()
const addLayerMock = vi.fn()
const removeLayerMock = vi.fn()
const bindTooltipMock = vi.fn()
const bindPopupMock = vi.fn()
const removeMock = vi.fn()
const fitBoundsMock = vi.fn()

const mapMock = {
    setView: setViewMock.mockReturnThis(),
    eachLayer: vi.fn(),
    removeLayer: removeLayerMock,
    remove: removeMock,
    getZoom: vi.fn(() => 13),
    fitBounds: fitBoundsMock.mockReturnThis(),
    addLayer: addLayerMock,
}

const markerMock = {
    addTo: addLayerMock.mockReturnThis(),
    bindTooltip: bindTooltipMock.mockReturnThis(),
    bindPopup: bindPopupMock.mockReturnThis(),
}

const tileLayerMock = {
    addTo: addLayerMock.mockReturnThis(),
}

const controlMock = {
    attribution: vi.fn(() => ({ addTo: vi.fn() })),
    layers: vi.fn(() => ({ addTo: vi.fn() }))
}

const featureGroupMock = {
    getBounds: vi.fn(() => ({ pad: vi.fn(), isValid: vi.fn(() => true) }))
}

const geoJSONMock = {
    addTo: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({ pad: vi.fn(), isValid: vi.fn(() => true) })),
}

const circleMarkerMock = {
    bindPopup: vi.fn().mockReturnThis(),
}

vi.mock('leaflet', () => ({
    default: {
        map: vi.fn(() => mapMock),
        tileLayer: vi.fn(() => tileLayerMock),
        marker: vi.fn(() => markerMock),
        featureGroup: vi.fn(() => featureGroupMock),
        control: controlMock,
        geoJSON: vi.fn(() => geoJSONMock),
        circleMarker: vi.fn(() => circleMarkerMock),
        GeoJSON: class {},
        CircleMarker: class {},
        Marker: class {},
        Icon: {
            Default: {
                prototype: { _getIconUrl: vi.fn() },
                mergeOptions: vi.fn(),
            }
        }
    }
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

describe('MapRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mapMock.setView.mockClear()
    })

    const defaultParams: MapComponentParams = {
        center: [51.505, -0.09],
        zoom: 13,
        markers: [
            { position: [51.5, -0.09], tooltip: 'Marker 1' }
        ]
    }

    it('renders map container', () => {
        const { container } = render(() => <MapRenderer params={defaultParams} />)
        const mapDiv = container.querySelector('div[style*="height: 400px"]')
        expect(mapDiv).toBeTruthy()
    })

    it('renders with marker format', () => {
        const { container } = render(() => <MapRenderer params={{
            markers: [{ position: [10, 20], tooltip: 'Hello', popup: 'World' }]
        }} />)
        expect(container).toBeTruthy()
    })

    it('renders with fitBounds', () => {
        const { container } = render(() => <MapRenderer params={{
            markers: [{ position: [10, 20] }],
            fitBounds: true
        }} />)
        expect(container).toBeTruthy()
    })

    // ─── GeoJSON tests (v3.1.0) ────────────────────────

    const SAMPLE_GEOJSON = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[[2.3, 48.8], [2.4, 48.8], [2.4, 48.9], [2.3, 48.9], [2.3, 48.8]]] },
                properties: { name: 'Zone A', prix_m2: 3500 }
            },
            {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[[2.4, 48.8], [2.5, 48.8], [2.5, 48.9], [2.4, 48.9], [2.4, 48.8]]] },
                properties: { name: 'Zone B', prix_m2: 4200 }
            }
        ]
    }

    it('renders with GeoJSON data', () => {
        const { container } = render(() => <MapRenderer params={{
            geojson: SAMPLE_GEOJSON,
            fitBounds: true,
        }} />)
        expect(container).toBeTruthy()
    })

    it('renders with GeoJSON + popup config', () => {
        const { container } = render(() => <MapRenderer params={{
            geojson: SAMPLE_GEOJSON,
            popup: { titleField: 'name', fields: ['prix_m2'] },
        }} />)
        expect(container).toBeTruthy()
    })

    it('renders with choropleth style', () => {
        const { container } = render(() => <MapRenderer params={{
            geojson: SAMPLE_GEOJSON,
            geojsonStyle: {
                choroplethField: 'prix_m2',
                choroplethScale: [[2000, '#eff3ff'], [3000, '#6baed6'], [5000, '#084594']],
                fillOpacity: 0.7,
            },
        }} />)
        expect(container).toBeTruthy()
    })

    it('renders with multiple named layers', () => {
        const { container } = render(() => <MapRenderer params={{
            layers: [
                { name: 'Zones', geojson: SAMPLE_GEOJSON, visible: true },
                { name: 'Points', geojson: { type: 'FeatureCollection', features: [] }, visible: false },
            ],
        }} />)
        expect(container).toBeTruthy()
    })

    it('renders with custom height', () => {
        const { container } = render(() => <MapRenderer params={{
            geojson: SAMPLE_GEOJSON,
            height: '600px',
        }} />)
        const mapDiv = container.querySelector('div[style*="height: 600px"]')
        expect(mapDiv).toBeTruthy()
    })

    it('renders with className', () => {
        const { container } = render(() => <MapRenderer params={{
            geojson: SAMPLE_GEOJSON,
            className: 'custom-map',
        }} />)
        const wrapper = container.querySelector('.custom-map')
        expect(wrapper).toBeTruthy()
    })
})
