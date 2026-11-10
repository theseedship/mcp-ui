import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapRenderer } from './MapRenderer'

const state = vi.hoisted(() => ({
  defaultValue: undefined as unknown,
  overlayAdd: vi.fn(),
  layer: vi.fn(),
  remove: vi.fn(),
  tiles: vi.fn(),
}))
vi.mock('protomaps-leaflet', () => ({
  get default() { return state.defaultValue },
  leafletLayer: state.layer,
}))
vi.mock('leaflet', () => ({ default: {
  map: () => ({ setView() { return this }, getZoom: () => 13, eachLayer() {}, remove: state.remove }),
  tileLayer: () => ({ addTo: state.tiles }),
  Icon: { Default: { prototype: {}, mergeOptions() {} } },
  Marker: class {}, GeoJSON: class {}, CircleMarker: class {},
} }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

beforeEach(() => {
  vi.clearAllMocks()
  state.defaultValue = undefined
  state.layer.mockReturnValue({ addTo: state.overlayAdd })
})
afterEach(cleanup)

const params = { center: [48.85, 2.35] as [number, number], attribution: '',
  pmtiles: { url: 'https://synthetic.invalid/fixture.pmtiles' } }

describe('PMTiles module API loading only — no tiles/network/engine qualification', () => {
  it('accepts the ESM namespace and forwards the unchanged overlay URL to its API stub', async () => {
    render(() => <MapRenderer params={params} />)
    await waitFor(() => expect(state.overlayAdd).toHaveBeenCalledTimes(1))
    expect(state.layer).toHaveBeenCalledWith(expect.objectContaining({ url: params.pmtiles.url }))
    expect(state.tiles).toHaveBeenCalledTimes(1)
  })

  it('accepts a standard CommonJS default namespace', async () => {
    state.defaultValue = { leafletLayer: state.layer }
    render(() => <MapRenderer params={params} />)
    await waitFor(() => expect(state.overlayAdd).toHaveBeenCalledTimes(1))
  })

  it('keeps the base map and shows a notice for an empty optional-peer stub', async () => {
    state.defaultValue = {}
    const { container, unmount } = render(() => <MapRenderer params={params} />)
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('PMTiles'))
    expect(state.layer).not.toHaveBeenCalled()
    expect(state.overlayAdd).not.toHaveBeenCalled()
    expect(state.tiles).toHaveBeenCalledTimes(1)
    expect(state.remove).not.toHaveBeenCalled()
    unmount()
    expect(state.remove).toHaveBeenCalledTimes(1)
  })
})
