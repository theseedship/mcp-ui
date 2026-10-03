/**
 * v5.7.0 — explicit missing values and a unit in the chart contract.
 *
 * `null` is a value that exists in the series' grid but was not observed: a
 * forecast with no wind figure on one day, a place whose rain total cannot be
 * computed. Before 5.7.0 the only ways to send it were `0` (a lie) or a
 * shorter array (which breaks the label ↔ value alignment).
 */

import { describe, it, expect } from 'vitest'
import { ChartComponentParamsSchema, ChartDatasetSchema } from './schemas'

const LABELS = ['2026-10-04', '2026-10-05', '2026-10-06']

function line(data: unknown, extra: Record<string, unknown> = {}) {
  return {
    type: 'line',
    data: { labels: LABELS, datasets: [{ label: 'Lyon', data }] },
    ...extra,
  }
}

describe('ChartDatasetSchema — missing values (v5.7.0)', () => {
  it('accepts null between numbers, and keeps it in place', () => {
    const parsed = ChartDatasetSchema.parse({ label: 'Lyon', data: [12, null, 7.5] })
    expect(parsed.data).toEqual([12, null, 7.5])
  })

  it('accepts a series whose every value is missing', () => {
    expect(ChartDatasetSchema.safeParse({ label: 'Brest', data: [null, null, null] }).success).toBe(true)
  })

  it('accepts a point whose y is missing', () => {
    const parsed = ChartDatasetSchema.parse({
      label: 'Lyon',
      data: [
        { x: '2026-10-04', y: 3 },
        { x: '2026-10-05', y: null },
      ],
    })
    expect(parsed.data).toEqual([
      { x: '2026-10-04', y: 3 },
      { x: '2026-10-05', y: null },
    ])
  })

  it('rejects a null standing for a whole point', () => {
    expect(
      ChartDatasetSchema.safeParse({ label: 'Lyon', data: [{ x: 1, y: 2 }, null] }).success
    ).toBe(false)
  })

  it('rejects a point whose x is missing', () => {
    expect(ChartDatasetSchema.safeParse({ label: 'Lyon', data: [{ x: null, y: 2 }] }).success).toBe(
      false
    )
  })

  it.each([['12'], [NaN], [undefined], [true]])('still rejects a non-number value: %s', (value) => {
    expect(ChartDatasetSchema.safeParse({ label: 'Lyon', data: [1, value, 3] }).success).toBe(false)
  })
})

describe('ChartComponentParamsSchema — unit (v5.7.0)', () => {
  it('accepts a unit and a payload carrying missing values', () => {
    const result = ChartComponentParamsSchema.safeParse(line([12, null, 7.5], { unit: 'km/h' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.unit).toBe('km/h')
  })

  it('leaves unit optional', () => {
    expect(ChartComponentParamsSchema.safeParse(line([1, 2, 3])).success).toBe(true)
  })

  it.each([[''], ['x'.repeat(33)], [12]])('rejects an empty, overlong or non-string unit: %s', (unit) => {
    expect(ChartComponentParamsSchema.safeParse(line([1, 2, 3], { unit })).success).toBe(false)
  })
})
