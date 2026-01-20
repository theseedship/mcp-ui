/**
 * MapRenderer - Interactive map Component
 * Sprint 6: Code & Maps
 * Sprint Ultimate U.2: Marker Clustering Support
 */

import { Component, createEffect, onCleanup, createSignal, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { UIComponent, MapComponentParams, MapClusterOptions } from '../types'

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

export const MapRenderer: Component<MapRendererProps> = (props) => {
    let mapContainer: HTMLDivElement | undefined
    let mapInstance: any = null
    const [isLeafletLoaded, setIsLeafletLoaded] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)

    const params = () => props.params || (props.component?.params as MapComponentParams)

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

        // Update markers and view - Sprint Ultimate U.2: Clustering support
        if (mapInstance && L) {
            const p = params()

            // Clear existing layers (markers and cluster groups)
            mapInstance.eachLayer((layer: any) => {
                if (layer instanceof L.Marker || layer._group || layer._featureGroup) {
                    mapInstance.removeLayer(layer)
                }
            })

            const markers: any[] = []
            const shouldCluster = p?.clustering && p?.markers && p.markers.length > 0

            if (shouldCluster) {
                // Sprint Ultimate U.2: Use marker clustering
                try {
                    // Lazy load markercluster plugin
                    // Import markercluster plugin for side-effects (registers with Leaflet)
                    await import('leaflet.markercluster')

                    // Load cluster CSS if not already loaded
                    if (!clusterCssLoaded) {
                        await import('leaflet.markercluster/dist/MarkerCluster.css')
                        await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
                        clusterCssLoaded = true
                    }

                    // Get cluster options
                    const clusterOpts: MapClusterOptions = typeof p.clustering === 'object' ? p.clustering : {}

                    // Create cluster group with options
                    const clusterGroup = (L as any).markerClusterGroup({
                        maxClusterRadius: clusterOpts.maxClusterRadius ?? 80,
                        spiderfyOnMaxZoom: clusterOpts.spiderfyOnMaxZoom ?? true,
                        showCoverageOnHover: clusterOpts.showCoverageOnHover ?? true,
                        disableClusteringAtZoom: clusterOpts.disableClusteringAtZoom,
                        animate: clusterOpts.animateAddingMarkers ?? true
                    })

                    // Add markers to cluster group
                    p?.markers?.forEach(marker => {
                        const m = L.marker(marker.position)
                        if (marker.tooltip) {
                            m.bindTooltip(marker.tooltip)
                        }
                        if (marker.popup) {
                            m.bindPopup(marker.popup)
                        }
                        clusterGroup.addLayer(m)
                        markers.push(m)
                    })

                    mapInstance.addLayer(clusterGroup)
                } catch (e) {
                    console.warn('Failed to load leaflet.markercluster, falling back to regular markers', e)
                    // Fallback to regular markers
                    p?.markers?.forEach(marker => {
                        const m = L.marker(marker.position).addTo(mapInstance)
                        if (marker.tooltip) {
                            m.bindTooltip(marker.tooltip)
                        }
                        if (marker.popup) {
                            m.bindPopup(marker.popup)
                        }
                        markers.push(m)
                    })
                }
            } else {
                // Standard marker rendering (no clustering)
                p?.markers?.forEach(marker => {
                    const m = L.marker(marker.position).addTo(mapInstance)
                    if (marker.tooltip) {
                        m.bindTooltip(marker.tooltip)
                    }
                    if (marker.popup) {
                        m.bindPopup(marker.popup)
                    }
                    markers.push(m)
                })
            }

            // Handle fitBounds
            if (p?.fitBounds && markers.length > 0) {
                const group = L.featureGroup(markers)
                mapInstance.fitBounds(group.getBounds().pad(0.1))
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
        <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Show when={error()}>
                <div class="p-4 text-red-500 bg-red-50 dark:bg-red-900/20 text-center">
                    {error()}
                </div>
            </Show>
            <Show when={!error()}>
                <div
                    ref={mapContainer}
                    style={{ height: params()?.height || '400px', width: '100%', "z-index": 0 }}
                    class="relative z-0"
                />
            </Show>
        </div>
    )
}
