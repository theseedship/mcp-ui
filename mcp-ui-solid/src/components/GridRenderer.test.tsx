/**
 * GridRenderer accessibility — S2 (a11y of the two most-used containers).
 *
 * Coverage:
 *   1. Outer container exposes role="group" with a label
 *   2. Falls back to MCPUIStrings.gridRegion when no title/label is present
 *   3. A title carried on the params object wins over the default
 *   4. MCPUIStringsProvider override of `gridRegion` is honored
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { GridRenderer } from './GridRenderer'
import { RenderProvider } from './RenderContext'
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext'
import type { UIComponent } from '../types'

afterEach(cleanup)

function gridComponent(id: string, extraParams: Record<string, unknown> = {}): UIComponent {
  return {
    id,
    type: 'grid',
    position: { colStart: 1, colSpan: 12 },
    params: { columns: 2, children: [], ...extraParams },
  } as UIComponent
}

describe('GridRenderer accessibility', () => {
  it('exposes role="group" and falls back to the localized default label', () => {
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('plain-grid')} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('role')).toBe('group')
    expect(grid.getAttribute('aria-label')).toBe('Layout grid')
  })

  it('prefers a title carried on the grid params over the default label', () => {
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('titled-grid', { title: 'Sales overview' })} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Sales overview')
  })

  it('honors an MCPUIStringsProvider override of gridRegion', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ gridRegion: 'Grille de mise en page' }}>
        <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
          <GridRenderer component={gridComponent('localized-grid')} />
        </RenderProvider>
      </MCPUIStringsProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Grille de mise en page')
  })
})
