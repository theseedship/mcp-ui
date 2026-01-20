/**
 * GridRenderer - CSS Grid layout component for nested layouts
 * Phase 5.0: Quick Wins - Enables template builder layouts
 * Updated: Uses RenderContext to avoid circular dependencies
 */

import { Component, For, createMemo } from 'solid-js'
import type { UIComponent, GridPosition } from '../types'
import { useRenderContext } from './RenderContext'

/**
 * Parameters for GridRenderer component
 */
export interface GridComponentParams {
  /**
   * Number of columns (default: 12)
   */
  columns?: number

  /**
   * Gap between grid items (default: '1rem')
   */
  gap?: string

  /**
   * Minimum row height (optional)
   */
  minRowHeight?: string

  /**
   * CSS Grid template areas for named regions
   * Example: [['header', 'header'], ['sidebar', 'main'], ['footer', 'footer']]
   */
  areas?: string[][]

  /**
   * Child components to render within the grid
   */
  children: UIComponent[]
}

export interface GridRendererProps {
  /**
   * Grid component with params
   */
  component: UIComponent

  /**
   * Error callback
   */
  onError?: (error: any) => void
}

/**
 * Convert grid position to CSS style string
 */
function getGridItemStyle(position: GridPosition | undefined, _areas?: string[][]): string {
  // Default to full width if no position specified
  if (!position) {
    return 'grid-column: 1 / -1; grid-row: auto'
  }

  const { colStart, colSpan, rowStart, rowSpan = 1 } = position

  // If using named areas and component has area name, use grid-area
  // Otherwise use explicit grid-column/grid-row
  let style = `grid-column: ${colStart} / span ${colSpan}`

  if (rowStart) {
    style += `; grid-row: ${rowStart} / span ${rowSpan}`
  } else {
    style += '; grid-row: auto'
  }

  return style
}

/**
 * Build CSS grid-template-areas string from areas array
 */
function buildGridTemplateAreas(areas: string[][]): string {
  return areas.map((row) => `"${row.join(' ')}"`).join(' ')
}

/**
 * GridRenderer Component
 * Renders a CSS Grid container with nested UIComponents
 */
export const GridRenderer: Component<GridRendererProps> = (props) => {
  // Use render context to avoid circular dependency
  const { renderComponent } = useRenderContext()

  // Extract params with defaults
  const params = createMemo(() => {
    const p = props.component.params as GridComponentParams
    return {
      columns: p.columns ?? 12,
      gap: p.gap ?? '1rem',
      minRowHeight: p.minRowHeight,
      areas: p.areas,
      children: p.children ?? [],
    }
  })

  // Build grid container style
  const gridContainerStyle = createMemo(() => {
    const p = params()
    let style = `display: grid; grid-template-columns: repeat(${p.columns}, 1fr); gap: ${p.gap}`

    if (p.minRowHeight) {
      style += `; grid-auto-rows: minmax(${p.minRowHeight}, auto)`
    }

    if (p.areas && p.areas.length > 0) {
      style += `; grid-template-areas: ${buildGridTemplateAreas(p.areas)}`
    }

    return style
  })

  return (
    <div
      class="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      data-component-type="grid"
      data-component-id={props.component.id}
    >
      <div class="p-4 h-full" style={gridContainerStyle()}>
        <For each={params().children}>
          {(child) => (
            <div
              style={getGridItemStyle(child.position, params().areas)}
              class="min-w-0 h-full"
            >
              {/* Use RenderContext for recursive rendering (avoids circular dependency) */}
              {renderComponent(child, props.onError)}
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

export default GridRenderer
