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

  it('treats a blank title as absent and falls back to the localized default', () => {
    // `??` only skips null/undefined, so `title: ''` used to win the chain and
    // leave the grid with an empty accessible name.
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('blank-title-grid', { title: '' })} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Layout grid')
  })

  it('treats a whitespace-only title as absent', () => {
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('blank-title-grid-2', { title: '   ' })} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Layout grid')
  })

  it('falls through a blank title to a non-blank params.label', () => {
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('label-grid', { title: '', label: 'Revenue block' })} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Revenue block')
  })

  it('uses params.label when there is no title at all', () => {
    const { container } = render(() => (
      <RenderProvider renderComponent={(component) => <span>{component.id}</span>}>
        <GridRenderer component={gridComponent('label-only-grid', { label: 'Revenue block' })} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Revenue block')
  })

  it('prefers a component-level title over params.title', () => {
    const component = {
      ...gridComponent('component-title-grid', { title: 'From params' }),
      title: 'From component',
    } as UIComponent
    const { container } = render(() => (
      <RenderProvider renderComponent={(c) => <span>{c.id}</span>}>
        <GridRenderer component={component} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('From component')
  })

  it('falls through a blank component-level title to params.title', () => {
    const component = {
      ...gridComponent('blank-component-title-grid', { title: 'From params' }),
      title: '  ',
    } as UIComponent
    const { container } = render(() => (
      <RenderProvider renderComponent={(c) => <span>{c.id}</span>}>
        <GridRenderer component={component} />
      </RenderProvider>
    ))
    const grid = container.querySelector('[data-component-type="grid"]')!
    expect(grid.getAttribute('aria-label')).toBe('From params')
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
