/** QuickchartRegistry ↔ Zod parity for missing values and `unit` (v6.24.0). */

import { describe, expect, it } from 'vitest';
import { ChartComponentParamsSchema } from '@seed-ship/mcp-ui-spec';
import { QuickchartRegistry } from './component-registry';

const properties = QuickchartRegistry.schema.properties as Record<string, any>;
const dataset = properties.data.properties.datasets.items;

describe('QuickchartRegistry missing values and unit', () => {
  it('lets a number item and a point y be null', () => {
    expect(dataset.properties.data.anyOf[0].items).toEqual({ type: ['number', 'null'] });
    const point = dataset.properties.data.anyOf[1].items;
    expect(point.properties.y).toEqual({ type: ['number', 'null'] });
    expect(point.required).toEqual(['x', 'y']);
    expect(point.properties.x).toEqual({ oneOf: [{ type: 'string' }, { type: 'number' }] });
  });

  it('advertises unit like the Zod schema bounds it', () => {
    expect(properties.unit).toMatchObject({ type: 'string', minLength: 1, maxLength: 32 });
    const base = { type: 'bar', data: { labels: ['a'], datasets: [{ label: 'S', data: [1] }] } };
    expect(ChartComponentParamsSchema.safeParse({ ...base, unit: '°C' }).success).toBe(true);
    expect(ChartComponentParamsSchema.safeParse({ ...base, unit: '' }).success).toBe(false);
    expect(ChartComponentParamsSchema.safeParse({ ...base, unit: 'x'.repeat(33) }).success).toBe(false);
  });

  it('is accepted by the spec for the shapes the registry advertises', () => {
    expect(
      ChartComponentParamsSchema.safeParse({
        type: 'line',
        data: { labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, null] }] },
      }).success
    ).toBe(true);
    expect(
      ChartComponentParamsSchema.safeParse({
        type: 'scatter',
        data: { labels: [], datasets: [{ label: 'P', data: [{ x: 1, y: null }] }] },
      }).success
    ).toBe(true);
  });

  it('keeps the registry examples valid', () => {
    for (const example of QuickchartRegistry.examples ?? []) {
      expect(ChartComponentParamsSchema.safeParse((example.component as any).params).success).toBe(true);
    }
  });
});
