/**
 * Chart validation of explicit missing values (v6.24.0).
 *
 * `validateComponent` is the gate a host runs before rendering (Deposium's
 * chat drops a component it rejects), so a `null` refused here is a chart the
 * user never sees. These tests pin which charts may carry one.
 */

import { describe, it, expect } from 'vitest'
import { validateChartComponent, validateComponent } from './validation'
import type { ChartComponentParams, UIComponent } from '../types'

const LABELS = ['2026-10-04', '2026-10-05', '2026-10-06']

function chart(
  type: ChartComponentParams['type'],
  data: ChartComponentParams['data']['datasets'][number]['data'],
  labels: string[] = LABELS
): ChartComponentParams {
  return { type, data: { labels, datasets: [{ label: 'Lyon', data }] } }
}

function codes(params: ChartComponentParams) {
  return (validateChartComponent(params).errors ?? []).map((error) => error.code)
}

describe('validateChartComponent — missing values', () => {
  it.each(['line', 'bar', 'radar'] as const)('accepts null in a %s chart', (type) => {
    expect(validateChartComponent(chart(type, [12, null, 7.5])).valid).toBe(true)
  })

  it('accepts a series whose every value is missing', () => {
    expect(validateChartComponent(chart('bar', [null, null, null])).valid).toBe(true)
  })

  it('accepts a point whose y is missing, on line, scatter and bubble charts', () => {
    const points = [
      { x: '2026-10-04', y: 3 },
      { x: '2026-10-05', y: null },
    ]
    expect(validateChartComponent(chart('line', points)).valid).toBe(true)
    expect(validateChartComponent(chart('scatter', points)).valid).toBe(true)
    expect(
      validateChartComponent(
        chart('bubble', [
          { x: 1, y: null, r: 4 },
          { x: 2, y: 5, r: 3 },
        ])
      ).valid
    ).toBe(true)
  })

  it.each(['pie', 'doughnut', 'polarArea'] as const)(
    'refuses null in a %s chart, which would draw it as a zero share',
    (type) => {
      const result = validateChartComponent(chart(type, [12, null, 7.5]))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'MISSING_VALUE_UNSUPPORTED',
          path: 'params.data.datasets[0].data[1]',
        }),
      ])
    }
  )

  it.each(['pie', 'doughnut', 'polarArea'] as const)(
    'refuses a point whose y is null in a %s chart, like a bare null',
    (type) => {
      const result = validateChartComponent(chart(type, [{ x: 'a', y: null }]))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'MISSING_VALUE_UNSUPPORTED',
          path: 'params.data.datasets[0].data[0]',
        }),
      ])
    }
  )

  it.each(['pie', 'doughnut', 'polarArea'] as const)(
    'accepts a %s chart whose points all have a y',
    (type) => {
      expect(validateChartComponent(chart(type, [{ x: 'a', y: 3 }])).valid).toBe(true)
    }
  )

  it('still refuses a value that is neither a finite number nor null', () => {
    expect(codes(chart('line', [1, 'x' as unknown as number, 3]))).toEqual(['INVALID_DATA_TYPE'])
    expect(codes(chart('line', [1, Number.NaN, 3]))).toEqual(['INVALID_DATA_TYPE'])
    expect(codes(chart('line', [1, undefined as unknown as number, 3]))).toEqual([
      'INVALID_DATA_TYPE',
    ])
  })

  it('still refuses a point without x, and a null standing for a whole point', () => {
    expect(codes(chart('scatter', [{ x: null as unknown as number, y: 1 }]))).toEqual([
      'INVALID_POINT_DATA',
    ])
    expect(
      codes(chart('scatter', [{ x: 1, y: 1 }, null as unknown as { x: number; y: number }]))
    ).toEqual(['INVALID_POINT_DATA'])
  })

  it('counts a missing value as an entry: a series one value short is still a mismatch', () => {
    expect(codes(chart('line', [1, null]))).toEqual(['DATA_LENGTH_MISMATCH'])
  })

  describe('unit', () => {
    const withUnit = (unit: unknown): ChartComponentParams =>
      ({ ...chart('bar', [1, 2, 3]), unit }) as ChartComponentParams

    it('accepts a short unit', () => {
      const result = validateChartComponent(withUnit('mm'))
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('accepts a chart without a unit', () => {
      expect(validateChartComponent(chart('bar', [1, 2, 3])).valid).toBe(true)
    })

    it('tolerates an empty unit: the renderer treats it as no unit', () => {
      expect(validateChartComponent(withUnit('')).valid).toBe(true)
    })

    it('accepts a unit of exactly 32 characters', () => {
      expect(validateChartComponent(withUnit('x'.repeat(32))).valid).toBe(true)
    })

    it('refuses a unit of 33 characters, at params.unit', () => {
      const result = validateChartComponent(withUnit('x'.repeat(33)))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({ path: 'params.unit', code: 'INVALID_UNIT' }),
      ])
    })

    it.each([
      ['a number', 5],
      ['null', null],
      ['a boolean', true],
      ['an object', { symbol: 'mm' }],
      ['an array', ['mm']],
    ])('refuses a unit that is %s, at params.unit', (_kind, unit) => {
      const result = validateChartComponent(withUnit(unit))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({ path: 'params.unit', code: 'INVALID_UNIT' }),
      ])
    })

    it('reports a bad unit next to a data error instead of hiding one behind the other', () => {
      const result = validateChartComponent({
        ...chart('pie', [12, null, 7.5]),
        unit: 'x'.repeat(33),
      })
      expect(result.valid).toBe(false)
      expect((result.errors ?? []).map((error) => error.code).sort()).toEqual([
        'INVALID_UNIT',
        'MISSING_VALUE_UNSUPPORTED',
      ])
    })

    it('refuses a component with a bad unit through validateComponent', () => {
      const component: UIComponent = {
        id: 'rain',
        type: 'chart',
        position: { colStart: 1, colSpan: 12 },
        params: withUnit('x'.repeat(33)),
      }
      const result = validateComponent(component)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual([
        expect.objectContaining({ path: 'params.unit', code: 'INVALID_UNIT' }),
      ])
    })
  })

  it('lets a full chart component with missing values through validateComponent', () => {
    const component: UIComponent = {
      id: 'wind',
      type: 'chart',
      position: { colStart: 1, colSpan: 12 },
      params: {
        ...chart('line', [18, null, 31]),
        unit: 'km/h',
      },
    }
    expect(validateComponent(component)).toEqual(expect.objectContaining({ valid: true }))
  })
})
