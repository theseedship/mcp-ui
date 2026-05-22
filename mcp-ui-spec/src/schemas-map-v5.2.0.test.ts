/**
 * Tests for the v5.2.0 `map` contract alignment.
 *
 * `@seed-ship/mcp-ui-solid`'s <MapRenderer> has supported GeoJSON, choropleth,
 * popups, named layers, clustering and PMTiles since its v3.1.0, but
 * `MapComponentParamsSchema` only validated `markers` — so a host emitting
 * `type:'map'` with `params.geojson` had those fields silently stripped.
 *
 * These tests lock the widened map contract: a FeatureCollection (Polygon,
 * MultiPolygon, …) is now a first-class, validated part of the schema, while
 * markers-only maps stay accepted unchanged.
 */

import { describe, it, expect } from 'vitest';
import { MapComponentParamsSchema, GeoJSONSchema, GeoJSONFeatureCollectionSchema } from './schemas';

// ── Fixtures ────────────────────────────────────────────────────────────────

const polygonFC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2.3, 48.8],
            [2.4, 48.8],
            [2.4, 48.9],
            [2.3, 48.9],
            [2.3, 48.8],
          ],
        ],
      },
      properties: { name: 'Zone A', value: 42 },
    },
  ],
};

const multiPolygonFC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [2.3, 48.8],
              [2.4, 48.8],
              [2.4, 48.9],
              [2.3, 48.8],
            ],
          ],
          [
            [
              [3.0, 49.0],
              [3.1, 49.0],
              [3.1, 49.1],
              [3.0, 49.0],
            ],
          ],
        ],
      },
      properties: null,
    },
  ],
};

const pointFC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
      properties: { label: 'Paris' },
    },
    {
      // 3D position [lng, lat, elevation] must stay valid (RFC 7946 §3.1.1).
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [6.8652, 45.8326, 4808] },
      properties: { label: 'Mont Blanc' },
    },
  ],
};

// ── GeoJSON schema ──────────────────────────────────────────────────────────

describe('GeoJSONSchema (v5.2.0)', () => {
  it('accepts a Polygon FeatureCollection', () => {
    expect(GeoJSONSchema.safeParse(polygonFC).success).toBe(true);
  });

  it('accepts a MultiPolygon FeatureCollection', () => {
    expect(GeoJSONSchema.safeParse(multiPolygonFC).success).toBe(true);
  });

  it('accepts a Point FeatureCollection, including 3D positions', () => {
    expect(GeoJSONSchema.safeParse(pointFC).success).toBe(true);
  });

  it('accepts an empty FeatureCollection', () => {
    expect(
      GeoJSONFeatureCollectionSchema.safeParse({ type: 'FeatureCollection', features: [] }).success
    ).toBe(true);
  });

  it('accepts a bare Feature and a bare Geometry (Leaflet L.geoJSON parity)', () => {
    expect(GeoJSONSchema.safeParse(polygonFC.features[0]).success).toBe(true);
    expect(GeoJSONSchema.safeParse({ type: 'Point', coordinates: [2.35, 48.85] }).success).toBe(
      true
    );
  });

  it('rejects an obviously-wrong top-level type', () => {
    expect(GeoJSONSchema.safeParse({ type: 'NotGeoJSON', features: [] }).success).toBe(false);
  });

  it('rejects a feature with a non-numeric coordinate', () => {
    expect(
      GeoJSONSchema.safeParse({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: ['nope', 48.8] },
            properties: {},
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects a feature whose type is not "Feature"', () => {
    expect(
      GeoJSONFeatureCollectionSchema.safeParse({
        type: 'FeatureCollection',
        features: [{ type: 'Polygon', coordinates: [] }],
      }).success
    ).toBe(false);
  });
});

// ── MapComponentParamsSchema ────────────────────────────────────────────────

describe('MapComponentParamsSchema map contract (v5.2.0)', () => {
  it('still accepts a markers-only map (backward compat)', () => {
    expect(
      MapComponentParamsSchema.safeParse({
        center: [48.8566, 2.3522],
        zoom: 12,
        markers: [{ position: [48.8566, 2.3522], tooltip: 'Paris' }],
        fitBounds: true,
      }).success
    ).toBe(true);
  });

  it('accepts a map with a Polygon GeoJSON FeatureCollection', () => {
    const result = MapComponentParamsSchema.safeParse({
      geojson: polygonFC,
      fitBounds: true,
    });
    expect(result.success).toBe(true);
    // The geojson field must now be preserved, not stripped.
    if (result.success) expect(result.data.geojson).toBeDefined();
  });

  it('accepts a map with a MultiPolygon GeoJSON FeatureCollection', () => {
    expect(MapComponentParamsSchema.safeParse({ geojson: multiPolygonFC }).success).toBe(true);
  });

  it('accepts geojsonStyle with choropleth config', () => {
    expect(
      MapComponentParamsSchema.safeParse({
        geojson: polygonFC,
        geojsonStyle: {
          choroplethField: 'value',
          choroplethScale: [
            [0, '#eff3ff'],
            [100, '#084594'],
          ],
          choroplethFallback: '#ccc',
        },
        popup: { titleField: 'name', fields: ['value'] },
      }).success
    ).toBe(true);
  });

  it('accepts named layers with per-layer geojson + style', () => {
    expect(
      MapComponentParamsSchema.safeParse({
        layers: [
          { name: 'Communes', geojson: polygonFC, visible: true },
          { name: 'Points', geojson: pointFC, style: { fillColor: '#f00' } },
        ],
      }).success
    ).toBe(true);
  });

  it('accepts clustering as a boolean and as an options object', () => {
    expect(MapComponentParamsSchema.safeParse({ clustering: true }).success).toBe(true);
    expect(
      MapComponentParamsSchema.safeParse({
        clustering: { maxClusterRadius: 60, spiderfyOnMaxZoom: false },
      }).success
    ).toBe(true);
  });

  it('accepts a pmtiles vector-tile source', () => {
    expect(
      MapComponentParamsSchema.safeParse({
        pmtiles: {
          url: 'https://cdn.example.com/parcels.pmtiles',
          paintRules: [{ dataLayer: 'parcels', symbolizer: 'polygon', color: '#3388ff' }],
        },
      }).success
    ).toBe(true);
  });

  it('rejects a map whose geojson has an invalid type', () => {
    expect(
      MapComponentParamsSchema.safeParse({ geojson: { type: 'Banana', features: [] } }).success
    ).toBe(false);
  });

  it('rejects a layer missing its name', () => {
    expect(
      MapComponentParamsSchema.safeParse({
        layers: [{ geojson: polygonFC } as unknown as { name: string; geojson: unknown }],
      }).success
    ).toBe(false);
  });
});
