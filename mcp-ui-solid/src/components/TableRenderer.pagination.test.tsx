import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import type { UIComponent } from '../types'

afterEach(cleanup)

describe('table page bounds', () => {
  it('clamps an oversized initial page and remains navigable after data shrinks', () => {
    const [count, setCount] = createSignal(30)
    const component: UIComponent = {
      id: 'paged-table', type: 'table', position: { colStart: 1, colSpan: 12 },
      params: {
        columns: [{ key: 'name', label: 'Name' }],
        get rows() { return Array.from({ length: count() }, (_, i) => ({ name: `row-${i}` })) },
        initialPage: 99, chatPageSize: 10, className: 'custom-table',
      },
    }
    const { container, getByText } = render(() => <UIResourceRenderer content={component} />)
    expect(container.querySelector('.custom-table')).not.toBeNull()
    expect(container.querySelector('tbody')?.textContent).toContain('row-29')
    expect(getByText('3 / 3')).toBeTruthy()
    setCount(15)
    expect(container.querySelector('tbody')?.textContent).toContain('row-14')
    expect(getByText('2 / 2')).toBeTruthy()
    fireEvent.click(getByText('◀'))
    expect(getByText('1 / 2')).toBeTruthy()
    expect(container.querySelector('tbody')?.textContent).toContain('row-0')
  })
})
