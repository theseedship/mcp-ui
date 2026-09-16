import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext'
import type { UIComponent } from '../types'

afterEach(cleanup)

function pagedTableComponent(rowCount: number): UIComponent {
  return {
    id: 'paged-table-a11y', type: 'table', position: { colStart: 1, colSpan: 12 },
    params: {
      columns: [{ key: 'name', label: 'Name' }],
      rows: Array.from({ length: rowCount }, (_, i) => ({ name: `row-${i}` })),
      chatPageSize: 10,
    },
  }
}

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

describe('table pagination accessibility', () => {
  it('gives the prev/next buttons accessible names and hides the glyph from assistive tech', () => {
    const { container } = render(() => <UIResourceRenderer content={pagedTableComponent(30)} />)
    const buttons = Array.from(container.querySelectorAll('button[aria-label]')).filter((btn) =>
      ['Previous page', 'Next page'].includes(btn.getAttribute('aria-label') ?? '')
    )
    expect(buttons).toHaveLength(2)
    const prevBtn = container.querySelector('button[aria-label="Previous page"]')!
    const nextBtn = container.querySelector('button[aria-label="Next page"]')!
    expect(prevBtn.getAttribute('type')).toBe('button')
    expect(nextBtn.getAttribute('type')).toBe('button')
    expect(prevBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('◀')
    expect(nextBtn.querySelector('span[aria-hidden="true"]')?.textContent).toBe('▶')
  })

  it('marks the "page X / Y" indicator as a live region', () => {
    const { container } = render(() => <UIResourceRenderer content={pagedTableComponent(30)} />)
    const liveRegion = Array.from(container.querySelectorAll('[aria-live="polite"]')).find((el) =>
      /\d+ \/ \d+/.test(el.textContent ?? '')
    )
    expect(liveRegion).toBeTruthy()
  })

  it('honors provider overrides for the pagination accessible names', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ paginationPrevious: 'Page précédente', paginationNext: 'Page suivante' }}>
        <UIResourceRenderer content={pagedTableComponent(30)} />
      </MCPUIStringsProvider>
    ))
    expect(container.querySelector('button[aria-label="Page précédente"]')).toBeTruthy()
    expect(container.querySelector('button[aria-label="Page suivante"]')).toBeTruthy()
  })

  // Note: the fullscreen-only page-size <select> (gated on `isExpanded()` from
  // `useExpanded()`) could not be reached here — clicking the expand button
  // opens the modal (confirmed via `role="dialog"`), but `TableRenderer`'s own
  // `isExpanded` accessor stays permanently false because it's read via
  // `useExpanded()` at the top of `TableRenderer`, outside the component
  // ownership subtree that `ExpandableWrapper`'s `<ExpandedContext.Provider>`
  // establishes around its (lazily-evaluated) `children` — a pre-existing gap
  // unrelated to this change. The `aria-label={strings.paginationPageSize}`
  // on the `<select>` itself is covered by direct source inspection instead.
})
