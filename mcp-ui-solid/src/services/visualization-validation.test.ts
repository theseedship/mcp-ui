import { describe, expect, it } from 'vitest'
import { validateComponent } from './validation'
import type { UIComponent } from '../types'

describe('visualization rendering boundary', () => {
  for (const key of ['pageSize', 'chatPageSize', 'initialPage']) {
    it.each([-1, 1.5, NaN, Infinity, '10'])(`rejects invalid ${key}: %s`, value => {
      const component = {
        id: 'table-bounds', type: 'table', position: { colStart: 1, colSpan: 12 },
        params: { columns: [{ key: 'name', label: 'Name' }], rows: [], [key]: value },
      } as UIComponent
      const result = validateComponent(component)
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ path: `params.${key}` }))
    })
  }
  it.each([-1, NaN, Infinity, '3', null])('rejects invalid bubble radius: %s', r => {
    const component = {
      id: 'bubble-bounds', type: 'chart', position: { colStart: 1, colSpan: 12 },
      params: { type: 'bubble', data: { datasets: [{ label: 'Bubbles', data: [{ x: 1, y: 2, r }] }] } },
    } as unknown as UIComponent
    expect(validateComponent(component).valid).toBe(false)
  })
  it.each([undefined, 0, 4])('accepts optional/nonnegative bubble radius: %s', r => {
    const component: UIComponent = {
      id: 'bubble-valid', type: 'chart', position: { colStart: 1, colSpan: 12 },
      params: { type: 'bubble', data: { datasets: [{ label: 'Bubbles', data: [{ x: 1, y: 2, r }] }] } },
    }
    expect(validateComponent(component).valid).toBe(true)
  })
})
