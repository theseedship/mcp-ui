/**
 * MapRenderer - Interactive map Component
 * Sprint 6: Markers + clustering
 * v3.1.0: GeoJSON, choropleth, popups, multi-layer, PMTiles
 */

import { Component, createEffect, onCleanup, createSignal, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { UIComponent, MapComponentParams, MapClusterOptions, MapGeoJSONStyle, MapPopupConfig, MapLayer, MapPMTilesConfig } from '../types'
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper'

// Lazy load leaflet (it doesn't support SSR well)
let L: any = null
// Track if marker cluster CSS has been loaded
let clusterCssLoaded = false

export interface MapRendererProps {
    /**
     * UIComponent containing map params
     */
    component?: UIComponent

    /**
     * Direct map params
     */
    params?: MapComponentParams
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Resolve choropleth color for a feature based on property value and scale stops.
 */
function getChoroplethColor(
    value: unknown,
    scale: Array<[number, string]>,
    fallback: string
): string {
    if (value == null || typeof value !== 'number' || !isFinite(value)) return fallback

    // Scale is sorted ascending: [[0, '#eff3ff'], [100, '#084594']]
    if (scale.length === 0) return fallback
    if (value <= scale[0][0]) return scale[0][1]
    if (value >= scale[scale.length - 1][0]) return scale[scale.length - 1][1]

    // Find surrounding stops and interpolate (use upper bracket color)
    for (let i = 1; i < scale.length; i++) {
        if (value <= scale[i][0]) return scale[i][1]
    }
    return scale[scale.length - 1][1]
}

/**
 * Build a Leaflet style function from MapGeoJSONStyle config.
 */
function buildStyleFn(style: MapGeoJSONStyle | undefined): (feature: any) => Record<string, unknown> {
    if (!style) {
        return () => ({
            fillColor: '#3388ff',
            fillOpacity: 0.6,
            color: '#333',
            weight: 1,
            opacity: 1,
        })
    }

    return (feature: any) => {
        let fillColor = style.fillColor || '#3388ff'

        // Choropleth: override fillColor based on feature property
        if (style.choroplethField && style.choroplethScale && feature?.properties) {
            const val = feature.properties[style.choroplethField]
            fillColor = getChoroplethColor(val, style.choroplethScale, style.choroplethFallback || '#ccc')
        }

        return {
            fillColor,
            fillOpacity: style.fillOpacity ?? 0.6,
            color: style.strokeColor || '#333',
            weight: style.strokeWeight ?? 1,
            opacity: style.strokeOpacity ?? 1,
        }
    }
}

/**
 * Build popup HTML from a feature's properties using popup config.
 */
function buildPopupContent(feature: any, popup: MapPopupConfig | undefined): string | null {
    if (!popup || !feature?.properties) return null
    const props = feature.properties

    // Custom template
    if (popup.template) {
        return popup.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            const val = props[key]
            return val != null ? String(val) : ''
        })
    }

    // Auto-generated popup
    const parts: string[] = []

    if (popup.titleField && props[popup.titleField] != null) {
        parts.push(`<strong>${escapeHtml(String(props[popup.titleField]))}</strong>`)
    }

    const fields = popup.fields || Object.keys(props).slice(0, 8)
    for (const key of fields) {
        if (key === popup.titleField) continue
        const val = props[key]
        if (val == null) continue
        const formatted = typeof val === 'number' ? val.toLocaleString('fr-FR') : String(val)
        parts.push(`<span style="color:#666;font-size:11px">${escapeHtml(key)}</span>: ${escapeHtml(formatted)}`)
    }

    return parts.join('<br/>')
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * Add a GeoJSON layer to the map with style and popup support.
 * Returns the layer for bounds calculation.
 */
function addGeoJSONLayer(
    mapInst: any,
    leaflet: any,
    geojson: unknown,
    style?: MapGeoJSONStyle,
    popup?: MapPopupConfig
): any {
    const styleFn = buildStyleFn(style)

    const layer = leaflet.geoJSON(geojson, {
        style: styleFn,
        pointToLayer: (feature: any, latlng: any) => {
            // Render points as circle markers for consistency
            const s = styleFn(feature)
            return leaflet.circleMarker(latlng, {
                radius: 6,
                fillColor: s.fillColor,
                fillOpacity: s.fillOpacity,
                color: s.color,
                weight: s.weight,
                opacity: s.opacity,
            })
        },
        onEachFeature: (feature: any, featureLayer: any) => {
            const html = buildPopupContent(feature, popup)
            if (html) {
                featureLayer.bindPopup(html, { maxWidth: 300 })
            }
        },
    })

    layer.addTo(mapInst)
    return layer
}

// ─── Component ──────────────────────────────────────────────

/**
 * Build a GeoJSON FeatureCollection from the map's `markers` (and any
 * inlined GeoJSON layers, when present). Used by the "Copy data" button
 * shipped via `<ExpandableWrapper>` (v6.2.0). Best-effort — clusters,
 * tile layers, and choropleth-only data don't get round-tripped.
 */
function mapToGeoJSON(p: MapComponentParams | undefined): string {
    if (!p) return '{"type":"FeatureCollection","features":[]}'
    const features: any[] = []
    for (const marker of p.markers ?? []) {
        const pos: any = marker.position as any
        // Accept both [lat, lng] tuple and {lat, lng} object shapes (v5.0.2 spec)
        const lat = Array.isArray(pos) ? pos[0] : pos?.lat
        const lng = Array.isArray(pos) ? pos[1] : pos?.lng
        if (typeof lat !== 'number' || typeof lng !== 'number') continue
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                ...(marker.tooltip ? { tooltip: marker.tooltip } : {}),
                ...(marker.popup ? { popup: marker.popup } : {}),
            },
        })
    }
    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
}

export const MapRenderer: Component<MapRendererProps> = (props) => {
    let mapContainer: HTMLDivElement | undefined
    let mapInstance: any = null
    const [isLeafletLoaded, setIsLeafletLoaded] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)
    const isExpanded = useExpanded()

    const params = () => props.params || (props.component?.params as MapComponentParams)

    // v6.2.0 — Leaflet has to be told to re-measure when its container
    // resizes (e.g. transitioning to fullscreen via ExpandableWrapper).
    // We give the DOM a tick to settle the new dimensions, then ask
    // Leaflet to reflow tiles.
    createEffect(() => {
        const expanded = isExpanded()
        if (!mapInstance) return
        // Read the signal so the effect re-runs on toggle ; the value is
        // observed for its side effects on layout.
        void expanded
        setTimeout(() => mapInstance?.invalidateSize?.(), 100)
    })

    // Initialize Map
    createEffect(async () => {
        if (isServer) return // Don't run on server

        if (!L) {
            try {
                const module = await import('leaflet')
                L = module.default || module
                await import('leaflet/dist/leaflet.css') // Import CSS
                setIsLeafletLoaded(true)
            } catch (e) {
                console.warn('Failed to load leaflet', e)
                setError('Map library could not be loaded.')
                return
            }
        } else {
            setIsLeafletLoaded(true)
        }

        if (isLeafletLoaded() && mapContainer && !mapInstance) {
            const p = params()
            const center = p?.center || [51.505, -0.09] // Default to London
            const zoom = p?.zoom || 13

            mapInstance = L.map(mapContainer, {
                zoomControl: p?.zoomControl !== false,
                scrollWheelZoom: p?.scrollWheelZoom !== false,
                attributionControl: false
            }).setView(center, zoom)

            // Add OpenStreetMap tile layer
            const tileLayerUrl = p?.tileLayer || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            L.tileLayer(tileLayerUrl, {
                attribution: p?.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance)

            if (p?.attribution !== '') {
                L.control.attribution({ prefix: false }).addTo(mapInstance)
            }

            // Fix marker icons (Leaflet issue with bundlers)
            delete (L.Icon.Default.prototype as any)._getIconUrl
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            })
        }

        // Update markers and view
        if (mapInstance && L) {
            const p = params()
            const allBoundsLayers: any[] = []

            // Clear existing layers (markers, cluster groups, GeoJSON)
            mapInstance.eachLayer((layer: any) => {
                if (layer instanceof L.Marker || layer instanceof L.GeoJSON
                    || layer instanceof L.CircleMarker
                    || layer._group || layer._featureGroup) {
                    mapInstance.removeLayer(layer)
                }
            })

            // ─── Markers (legacy) ────────────────────────
            const markers: any[] = []
            const shouldCluster = p?.clustering && p?.markers && p.markers.length > 0

            if (shouldCluster) {
                try {
                    await import('leaflet.markercluster')
                    if (!clusterCssLoaded) {
                        await import('leaflet.markercluster/dist/MarkerCluster.css')
                        await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
                        clusterCssLoaded = true
                    }
                    const clusterOpts: MapClusterOptions = typeof p.clustering === 'object' ? p.clustering : {}
                    const clusterGroup = (L as any).markerClusterGroup({
                        maxClusterRadius: clusterOpts.maxClusterRadius ?? 80,
                        spiderfyOnMaxZoom: clusterOpts.spiderfyOnMaxZoom ?? true,
                        showCoverageOnHover: clusterOpts.showCoverageOnHover ?? true,
                        disableClusteringAtZoom: clusterOpts.disableClusteringAtZoom,
                        animate: clusterOpts.animateAddingMarkers ?? true
                    })
                    p?.markers?.forEach(marker => {
                        const m = L.marker(marker.position)
                        if (marker.tooltip) m.bindTooltip(marker.tooltip)
                        if (marker.popup) m.bindPopup(marker.popup)
                        clusterGroup.addLayer(m)
                        markers.push(m)
                    })
                    mapInstance.addLayer(clusterGroup)
                } catch {
                    p?.markers?.forEach(marker => {
                        const m = L.marker(marker.position).addTo(mapInstance)
                        if (marker.tooltip) m.bindTooltip(marker.tooltip)
                        if (marker.popup) m.bindPopup(marker.popup)
                        markers.push(m)
                    })
                }
            } else {
                p?.markers?.forEach(marker => {
                    const m = L.marker(marker.position).addTo(mapInstance)
                    if (marker.tooltip) m.bindTooltip(marker.tooltip)
                    if (marker.popup) m.bindPopup(marker.popup)
                    markers.push(m)
                })
            }

            if (markers.length > 0) {
                allBoundsLayers.push(...markers)
            }

            // ─── GeoJSON (v3.1.0) ───────────────────────
            if (p?.geojson) {
                const geoLayer = addGeoJSONLayer(mapInstance, L, p.geojson, p.geojsonStyle, p.popup)
                allBoundsLayers.push(geoLayer)
            }

            // ─── Named layers (v3.1.0) ──────────────────
            if (p?.layers && p.layers.length > 0) {
                const overlays: Record<string, any> = {}

                for (const layerDef of p.layers) {
                    const geoLayer = addGeoJSONLayer(
                        mapInstance, L,
                        layerDef.geojson,
                        layerDef.style || p?.geojsonStyle,
                        layerDef.popup || p?.popup
                    )

                    overlays[layerDef.name] = geoLayer
                    allBoundsLayers.push(geoLayer)

                    // Respect initial visibility
                    if (layerDef.visible === false) {
                        mapInstance.removeLayer(geoLayer)
                    }
                }

                // Add layer control if multiple layers
                if (Object.keys(overlays).length > 1) {
                    L.control.layers(null, overlays, { collapsed: true }).addTo(mapInstance)
                }
            }

            // ─── PMTiles (v3.1.0) ────────────────────────
            if (p?.pmtiles) {
                try {
                    // @ts-ignore — optional peer dependency, may not be installed
                    const protomaps = await import(/* @vite-ignore */ 'protomaps-leaflet')
                    const pmConfig = p.pmtiles

                    const paintRules = pmConfig.paintRules?.map(rule => ({
                        dataLayer: rule.dataLayer,
                        symbolizer: new (protomaps as any)[
                            rule.symbolizer === 'polygon' ? 'PolygonSymbolizer' :
                            rule.symbolizer === 'line' ? 'LineSymbolizer' :
                            'CircleSymbolizer'
                        ]({
                            fill: rule.color || '#3388ff',
                            stroke: rule.color || '#333',
                            width: rule.width ?? 1,
                            opacity: rule.opacity ?? 0.6,
                        }),
                    })) || []

                    const labelRules = pmConfig.labelRules?.map(rule => ({
                        dataLayer: rule.dataLayer,
                        symbolizer: new (protomaps as any).TextSymbolizer({
                            label_props: [rule.textField],
                            fontSize: rule.fontSize ?? 12,
                        }),
                    })) || []

                    const pmLayer = (protomaps as any).leafletLayer({
                        url: pmConfig.url,
                        attribution: pmConfig.attribution,
                        paintRules,
                        labelRules,
                        maxZoom: pmConfig.maxZoom,
                        minZoom: pmConfig.minZoom,
                    })

                    pmLayer.addTo(mapInstance)
                } catch (e) {
                    console.warn('[MCP-UI] Failed to load protomaps-leaflet for PMTiles:', e)
                }
            }

            // ─── Fit bounds ─────────────────────────────
            if (p?.fitBounds && allBoundsLayers.length > 0) {
                const group = L.featureGroup(allBoundsLayers)
                const bounds = group.getBounds()
                if (bounds.isValid()) {
                    mapInstance.fitBounds(bounds.pad(0.1))
                }
            } else if (p?.center) {
                mapInstance.setView(p.center, p.zoom || mapInstance.getZoom())
            }
        }
    })

    // Cleanup
    onCleanup(() => {
        if (mapInstance) {
            mapInstance.remove()
            mapInstance = null
        }
    })

    return (
        <ExpandableWrapper
            title={'Map'}
            copyData={mapToGeoJSON(params())}
            copyLabel="Copy markers as GeoJSON"
        >
            <div class={`w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${params()?.className || ''} ${
                isExpanded() ? 'flex-1 min-h-0 flex flex-col' : ''
            }`}>
                <Show when={error()}>
                    <div class="p-4 text-red-500 bg-red-50 dark:bg-red-900/20 text-center">
                        {error()}
                    </div>
                </Show>
                <Show when={!error()}>
                    <div
                        ref={mapContainer}
                        style={
                            isExpanded()
                                ? { height: '100%', width: '100%', 'z-index': 0 }
                                : { height: params()?.height || '400px', width: '100%', 'z-index': 0 }
                        }
                        class={`relative z-0 ${isExpanded() ? 'flex-1 min-h-0' : ''}`}
                    />
                </Show>
            </div>
        </ExpandableWrapper>
    )
}
