/**
 * `chartToDataTable` — the `missing` matrix and the unit headers (v6.24.0).
 * `rows` must stay exactly what it was: `''` in a missing cell.
 */

import { describe, expect, it } from 'vitest';
import { CHART_DATA_TABLE_LABELS, chartToDataTable } from './chart-data-table';

describe('chartToDataTable missing matrix', () => {
  it('flags only the value cells whose source is missing, and keeps rows unchanged', () => {
    const t = chartToDataTable({
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [
          { label: 'North', data: [1, null, 3] },
          { label: 'South', data: [undefined, 5, Number.NaN] },
        ],
      },
    });
    expect(t.columns).toEqual(['Label', 'North', 'South']);
    expect(t.rows).toEqual([
      ['Jan', 1, ''],
      ['Feb', '', 5],
      ['Mar', 3, Number.NaN], // rows stay exactly as before; `missing` carries the news
    ]);
    expect(t.missing).toEqual([
      [false, false, true],
      [false, true, false],
      [false, false, true],
    ]);
  });

  it('does not flag the slots past the end of a short dataset: they have no entry, the cell stays empty', () => {
    const t = chartToDataTable({
      type: 'bar',
      data: { labels: ['a', 'b', 'c'], datasets: [{ label: 'S', data: [1] }] },
    });
    expect(t.rows).toEqual([['a', 1], ['b', ''], ['c', '']]);
    expect(t.missing).toEqual([[false, false], [false, false], [false, false]]);
  });

  it('does not flag any slot of an empty dataset, next to one that has entries', () => {
    const t = chartToDataTable({
      type: 'line',
      data: {
        labels: ['a', 'b'],
        datasets: [{ label: 'Tax', data: [] }, { label: 'S', data: [1, null] }],
      },
    });
    expect(t.rows).toEqual([['a', '', 1], ['b', '', '']]);
    expect(t.missing).toEqual([[false, false, false], [false, false, true]]);
  });

  it('flags an explicit null of a short dataset, but not the slots after it, and never the label column', () => {
    const t = chartToDataTable({
      type: 'bar',
      data: { labels: ['a', 'b', 'c'], datasets: [{ label: 'S', data: [1, null] }] },
    });
    expect(t.rows).toEqual([['a', 1], ['b', ''], ['c', '']]);
    expect(t.missing).toEqual([[false, false], [false, true], [false, false]]);
  });

  it('has the shape of rows, with nothing missing for a complete chart', () => {
    const t = chartToDataTable({
      type: 'bar',
      data: { labels: ['a', 'b'], datasets: [{ data: [1, 2] }, { data: [0, 0] }] },
    });
    expect(t.missing).toEqual([[false, false, false], [false, false, false]]);
    expect(t.missing.map((r) => r.length)).toEqual(t.rows.map((r) => r.length));
  });

  it('never calls a zero missing', () => {
    const t = chartToDataTable({ type: 'bar', data: { labels: ['a'], datasets: [{ data: [0] }] } });
    expect(t.missing).toEqual([[false, false]]);
  });

  it('flags only the y cell of a point whose y is null (scatter)', () => {
    const t = chartToDataTable({
      type: 'scatter',
      data: { datasets: [{ label: 'P', data: [{ x: 1, y: null }, { x: 2, y: 4 }] }] },
    });
    expect(t.columns).toEqual(['Series', 'Point', 'x', 'y']);
    expect(t.rows).toEqual([['P', 1, 1, ''], ['P', 2, 2, 4]]);
    expect(t.missing).toEqual([[false, false, false, true], [false, false, false, false]]);
  });

  it('keeps x and r cells unflagged in a bubble table, and honours the label column', () => {
    const t = chartToDataTable({
      type: 'bubble',
      data: { labels: ['A', 'B'], datasets: [{ label: 'P', data: [{ x: 1, y: null, r: 5 }, { x: 2, y: 3, r: 6 }] }] },
    });
    expect(t.columns).toEqual(['Series', 'Point', 'Label', 'x', 'y', 'r']);
    expect(t.missing).toEqual([
      [false, false, false, false, true, false],
      [false, false, false, false, false, false],
    ]);
  });

  it('flags a bare missing entry of a dataset that mixes points and primitives', () => {
    const t = chartToDataTable({
      type: 'line',
      data: { datasets: [{ label: 'M', data: [{ x: 1, y: 2 }, null] }] },
    });
    expect(t.rows).toEqual([['M', 1, 1, 2], ['M', 2, '', '']]);
    expect(t.missing).toEqual([[false, false, false, false], [false, false, false, true]]);
  });
});

describe('chartToDataTable unit', () => {
  const data = { labels: ['a'], datasets: [{ label: 'Temp', data: [1] }, { data: [2] }] };

  it('defaults the template and leaves the headers alone without a unit', () => {
    expect(CHART_DATA_TABLE_LABELS.withUnit).toBe('{label} ({unit})');
    expect(chartToDataTable({ type: 'bar', data }).columns).toEqual(['Label', 'Temp', 'Series 2']);
  });

  it('applies the unit to every dataset column, not to the label column', () => {
    expect(chartToDataTable({ type: 'bar', unit: '°C', data }).columns).toEqual([
      'Label',
      'Temp (°C)',
      'Series 2 (°C)',
    ]);
  });

  it('applies the unit to the y column of the per-point table only', () => {
    const t = chartToDataTable({
      type: 'bubble',
      unit: 'km',
      data: { datasets: [{ data: [{ x: 1, y: 2, r: 3 }] }] },
    });
    expect(t.columns).toEqual(['Series', 'Point', 'x', 'y (km)', 'r']);
  });

  it('takes the template from the labels', () => {
    expect(
      chartToDataTable({ type: 'bar', unit: 'kg', data }, { withUnit: '{label} / {unit}' }).columns
    ).toEqual(['Label', 'Temp / kg', 'Series 2 / kg']);
  });

  it('ignores an empty unit', () => {
    expect(chartToDataTable({ type: 'bar', unit: '', data }).columns).toEqual(['Label', 'Temp', 'Series 2']);
  });
});
