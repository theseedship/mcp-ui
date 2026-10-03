/** `chartToDegradedTable` — missing cells and the unit (v6.24.0). */

import { describe, expect, it } from 'vitest';
import {
  DEGRADED_PROJECTION_LABELS,
  chartToDegradedTable,
  graphToDegradedTable,
  mapToDegradedTable,
} from './degraded-projections';

describe('chartToDegradedTable missing', () => {
  it('flags a missing primitive entry (null, undefined), keeping its (empty) cell and its row', () => {
    const t = chartToDegradedTable({
      data: {
        labels: ['A', 'B', 'C'],
        datasets: [
          { label: 'S', data: [1, null, 0] },
          { label: 'T', data: [undefined, 2, null] },
        ],
      },
    });
    expect(t.columns).toEqual(['', 'S', 'T']);
    expect(t.rows).toEqual([
      ['A', '1', ''],
      ['B', '', '2'],
      ['C', '0', ''],
    ]);
    expect(t.missing).toEqual([
      [false, false, true],
      [false, true, false],
      [false, false, true],
    ]);
  });

  it('does not flag a slot past the end of a shorter dataset, nor any slot of an empty one', () => {
    const t = chartToDegradedTable({
      data: {
        labels: ['A', 'B', 'C'],
        datasets: [
          { label: 'S', data: [1, null, 0] },
          { label: 'T', data: [undefined, 2] }, // one entry short: row C has no entry
          { label: 'U', data: [] }, // no entry at all
        ],
      },
    });
    // The cells stay empty exactly as before 6.24.0 ...
    expect(t.rows).toEqual([
      ['A', '1', '', ''],
      ['B', '', '2', ''],
      ['C', '0', '', ''],
    ]);
    // ... and only the real entries (S[1], T[0]) are flagged.
    expect(t.missing).toEqual([
      [false, false, true, false],
      [false, true, false, false],
      [false, false, false, false],
    ]);
  });

  it('does not flag a point object: it keeps its JSON text', () => {
    const t = chartToDegradedTable({
      data: { labels: ['A'], datasets: [{ label: 'P', data: [{ x: 1, y: null }] }] },
    });
    expect(t.rows).toEqual([['A', '{"x":1,"y":null}']]);
    expect(t.missing).toEqual([[false, false]]);
  });

  it('has nothing missing in a complete chart, and an empty matrix for no data', () => {
    const t = chartToDegradedTable({ data: { labels: ['A'], datasets: [{ label: 'S', data: [1] }] } });
    expect(t.missing).toEqual([[false, false]]);
    expect(chartToDegradedTable({}).missing).toEqual([]);
  });
});

describe('chartToDegradedTable unit', () => {
  const params = { data: { labels: ['A'], datasets: [{ label: 'S', data: [1] }, { data: [2] }] } };

  it('exposes the withUnit label with its English default', () => {
    expect(DEGRADED_PROJECTION_LABELS.withUnit).toBe('{label} ({unit})');
  });

  it('leaves the headers alone without a unit', () => {
    expect(chartToDegradedTable(params).columns).toEqual(['', 'S', 'Series 2']);
  });

  it('applies the unit to the dataset columns only', () => {
    expect(chartToDegradedTable({ ...params, unit: 'kg' }).columns).toEqual(['', 'S (kg)', 'Series 2 (kg)']);
  });

  it('takes a localized template', () => {
    expect(
      chartToDegradedTable({ ...params, unit: 'kg' }, { withUnit: '{label} en {unit}', series: 'Série {n}' })
        .columns
    ).toEqual(['', 'S en kg', 'Série 2 en kg']);
  });
});

describe('graph and map degraded tables are unchanged', () => {
  it('return no missing matrix', () => {
    expect(graphToDegradedTable({ nodes: [{ id: 'a' }] })).toEqual({
      columns: ['Node', 'Label'],
      rows: [['a', 'a']],
    });
    expect(mapToDegradedTable({ markers: [{ position: [1, 2] }] })).not.toHaveProperty('missing');
  });
});
