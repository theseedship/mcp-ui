/**
 * The shared missing-value rules (v6.24.0). Every view — table cells, chart
 * data views, degraded tables, chart validation, the chart renderer — reads
 * these, so they are pinned once here.
 */

import { describe, expect, it } from 'vitest'
import { renderCellValue } from '../components/UIResourceRenderer'
import {
  MISSING_VALUE_MARKER,
  isMissingCellValue,
  isMissingChartValue,
  stripUndefinedDebris,
  summarizeChartMissing,
} from './missing-value'

describe('isMissingCellValue', () => {
  it.each([null, undefined, '', '   ', 'undefined', 'UNDEFINED', 'undefined – undefined', '-', ' - ', '  -  '])(
    'treats %j as missing',
    (value) => {
      expect(isMissingCellValue(value)).toBe(true)
    }
  )

  it.each([0, false, '0', 'NaN', 'X – undefined', 'n/a', {}, { name: 'Lyon' }, []])(
    'treats %j as present',
    (value) => {
      expect(isMissingCellValue(value)).toBe(false)
    }
  )

  it('agrees with renderCellValue: every value it calls missing renders as the marker', () => {
    for (const value of [null, undefined, '', '  ', 'undefined', 'undefined – undefined', '-']) {
      expect(renderCellValue(value)).toBe(MISSING_VALUE_MARKER)
    }
  })

  // The table gates every cell on isMissingCellValue and falls back to
  // renderCellValue, so the two must never drift: a cell DISPLAYS as the
  // marker (renderCellValue's output, trimmed — surrounding whitespace in a
  // table cell is not rendered) exactly when isMissingCellValue says so. Each
  // row pins both the expected classification (so the test cannot pass
  // vacuously) and the parity.
  const PARITY: Array<[unknown, boolean]> = [
    // missing: nothing, blanks, the word, backend debris with nothing left, the marker itself
    [null, true],
    [undefined, true],
    ['', true],
    ['   ', true],
    ['undefined', true],
    ['Undefined - ', true],
    ['undefined – undefined', true],
    ['-', true],
    // the marker padded with whitespace: renderCellValue hands it back as is
    // (' - '), which still displays as the bare marker
    [' - ', true],
    ['  -  ', true],
    // present: debris around real text, look-alike dashes, numbers and words
    ['x - undefined', false],
    ['undefined – X', false],
    ['Paris - undefined', false],
    ['–', false],
    ['0', false],
    ['NaN', false],
    ['-5', false],
    ['n/a', false],
    [0, false],
    [false, false],
  ]

  it.each(PARITY)('renders %j as the marker only when it is missing (%j)', (value, missing) => {
    expect(isMissingCellValue(value)).toBe(missing)
    expect(String(renderCellValue(value)).trim() === MISSING_VALUE_MARKER).toBe(missing)
  })
})

describe('stripUndefinedDebris', () => {
  // Extracted from renderCellValue, whose two inline regexes it replaced: the
  // output must stay exactly what the cells showed before.
  it.each([
    ['Paris - undefined', 'Paris'],
    ['Paris – undefined', 'Paris'],
    ['Paris-undefined', 'Paris'],
    ['Paris - undefined  ', 'Paris'],
    ['undefined - Paris', 'Paris'],
    ['undefined – Paris', 'Paris'],
    ['UNDEFINED - Paris', 'Paris'],
    ['Undefined - ', ''],
    ['undefined – undefined', 'undefined'],
    ['a - undefined - undefined', 'a - undefined'],
    ['undefined', 'undefined'],
    ['x - undefinedly', 'x - undefinedly'],
    ['Paris', 'Paris'],
    ['', ''],
  ])('%j -> %j', (input, output) => {
    expect(stripUndefinedDebris(input)).toBe(output)
  })

  it('is what renderCellValue shows for a cell with debris around real text', () => {
    expect(renderCellValue('Paris - undefined')).toBe('Paris')
    expect(renderCellValue('Paris – undefined')).toBe('Paris')
    expect(renderCellValue('undefined – Paris')).toBe('Paris')
    expect(renderCellValue('a - undefined - undefined')).toBe('a - undefined')
  })
})

describe('isMissingChartValue', () => {
  it.each([null, undefined, Number.NaN, Infinity, -Infinity, { x: 1, y: null }, { x: 1 }])(
    'treats %j as missing',
    (value) => {
      expect(isMissingChartValue(value)).toBe(true)
    }
  )

  it.each([0, -3.5, { x: 1, y: 0 }, { x: '2026-10-04', y: 12 }])('treats %j as observed', (value) => {
    expect(isMissingChartValue(value)).toBe(false)
  })
})

describe('summarizeChartMissing', () => {
  it('reports nothing for a complete chart', () => {
    expect(
      summarizeChartMissing({ data: { datasets: [{ data: [1, 0, 3] }, { data: [{ x: 1, y: 2 }] }] } })
    ).toEqual({ hasMissing: false, fullyMissing: [false, false], partiallyMissing: [false, false], allMissing: false })
  })

  it('separates a series with a hole from a series whose every entry is missing, and ignores a series with no entry', () => {
    // Only ENTRIES count: `data: []` is neither fully nor partially missing.
    expect(
      summarizeChartMissing({ data: { datasets: [{ data: [1, null, 3] }, { data: [null, null, null] }, { data: [] }] } })
    ).toEqual({
      hasMissing: true,
      fullyMissing: [false, true, false],
      partiallyMissing: [true, false, false],
      allMissing: false,
    })
  })

  it('flags a chart with nothing to plot, an empty series counting as neither missing nor observed', () => {
    expect(summarizeChartMissing({ data: { datasets: [{ data: [null] }, { data: [] }] } })).toEqual({
      hasMissing: true,
      fullyMissing: [true, false],
      partiallyMissing: [false, false],
      allMissing: true,
    })
  })

  it('does not call a chart whose only dataset has no entry missing (the 6.23.0 behaviour)', () => {
    const none = { hasMissing: false, allMissing: false }
    expect(summarizeChartMissing({ data: { datasets: [{ data: [] }] } })).toEqual({
      ...none,
      fullyMissing: [false],
      partiallyMissing: [false],
    })
    // Same for a dataset that has no `data` array at all, and for no dataset.
    expect(summarizeChartMissing({ data: { datasets: [{}] } })).toEqual({
      ...none,
      fullyMissing: [false],
      partiallyMissing: [false],
    })
    expect(summarizeChartMissing({ data: { datasets: [] } })).toEqual({
      ...none,
      fullyMissing: [],
      partiallyMissing: [],
    })
  })

  it('an empty series next to an observed one changes nothing', () => {
    expect(summarizeChartMissing({ data: { datasets: [{ data: [1, 2] }, { data: [] }] } })).toEqual({
      hasMissing: false,
      fullyMissing: [false, false],
      partiallyMissing: [false, false],
      allMissing: false,
    })
  })

  it('never throws on a malformed payload', () => {
    for (const params of [null, undefined, {}, { data: {} }, { data: { datasets: 'x' } }, { data: { datasets: [null, { data: 'x' }] } }]) {
      expect(() => summarizeChartMissing(params as never)).not.toThrow()
    }
    expect(summarizeChartMissing(null).allMissing).toBe(false)
  })
})
