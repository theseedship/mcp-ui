/**
 * Tests for the degraded-fallback projections (P2.5).
 */

import { describe, it, expect } from 'vitest';
import {
  graphToDegradedTable,
  mapToDegradedTable,
  chartToDegradedTable,
} from './degraded-projections';

describe('graphToDegradedTable', () => {
  it('projects edges to a Source/Target/Label table when edges exist', () => {
    const t = graphToDegradedTable({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b', label: 'rel', weight: 3 }],
    });
    expect(t.columns).toEqual(['Source', 'Target', 'Label']);
    expect(t.rows).toEqual([['a', 'b', '3 · rel']]);
  });

  it('falls back to a node list when there are no edges', () => {
    const t = graphToDegradedTable({ nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b' }] });
    expect(t.columns).toEqual(['Node', 'Label']);
    expect(t.rows).toEqual([
      ['a', 'Alpha'],
      ['b', 'b'],
    ]);
  });

  it('handles empty graph without throwing', () => {
    const t = graphToDegradedTable({});
    expect(t.rows).toEqual([]);
  });
});

describe('mapToDegradedTable', () => {
  it('projects markers (tuple and object positions)', () => {
    const t = mapToDegradedTable({
      markers: [
        { position: [48.85, 2.35], tooltip: 'Paris' },
        { position: { lat: 45.76, lng: 4.84 }, popup: 'Lyon' },
      ],
    });
    expect(t.columns).toEqual(['Type', 'Lat', 'Lng', 'Info']);
    expect(t.rows[0]).toEqual(['marker', '48.85', '2.35', 'Paris']);
    expect(t.rows[1]).toEqual(['marker', '45.76', '4.84', 'Lyon']);
  });

  it('projects GeoJSON features with a representative coord + props summary', () => {
    const t = mapToDegradedTable({
      geojson: {
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
                  [2.3, 48.8],
                ],
              ],
            },
            properties: { name: 'Zone A', value: 42 },
          },
        ],
      },
    });
    expect(t.rows[0][0]).toBe('Polygon');
    expect(t.rows[0][1]).toBe('48.8'); // lat
    expect(t.rows[0][2]).toBe('2.3'); // lng
    expect(t.rows[0][3]).toContain('name=Zone A');
  });

  it('handles a map with neither markers nor geojson', () => {
    expect(mapToDegradedTable({}).rows).toEqual([]);
  });
});

describe('chartToDegradedTable', () => {
  it('projects labels × datasets into a series table', () => {
    const t = chartToDegradedTable({
      data: {
        labels: ['Q1', 'Q2'],
        datasets: [
          { label: 'Revenue', data: [100, 150] },
          { label: 'Cost', data: [40, 60] },
        ],
      },
    });
    expect(t.columns).toEqual(['', 'Revenue', 'Cost']);
    expect(t.rows).toEqual([
      ['Q1', '100', '40'],
      ['Q2', '150', '60'],
    ]);
  });

  it('names unlabeled datasets and stringifies point data', () => {
    const t = chartToDegradedTable({
      data: { datasets: [{ data: [{ x: 1, y: 2 }] }] },
    });
    expect(t.columns).toEqual(['', 'Series 1']);
    expect(t.rows[0][1]).toBe('{"x":1,"y":2}');
  });

  it('handles a chart with no data without throwing', () => {
    expect(chartToDegradedTable({}).rows).toEqual([]);
  });
});
