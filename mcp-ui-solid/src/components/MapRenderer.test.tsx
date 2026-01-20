/**
 * MapRenderer Tests
 * Sprint 6 Refinement
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
    attribution: vi.fn(() => ({ addTo: vi.fn() }))
}

const featureGroupMock = {
    getBounds: vi.fn(() => ({ pad: vi.fn() }))
}

vi.mock('leaflet', () => ({
    default: {
        map: vi.fn(() => mapMock),
        tileLayer: vi.fn(() => tileLayerMock),
        marker: vi.fn(() => markerMock),
        featureGroup: vi.fn(() => featureGroupMock),
        control: controlMock,
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

    it('renders with new marker format', () => {
        // This test mostly verifies type check and structural validity since actual logic is mocked
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
})
