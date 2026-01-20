/**
 * RenderContext - Provides component rendering without circular dependencies
 *
 * This context breaks the circular dependency between:
 * - UIResourceRenderer → CarouselRenderer/GridRenderer
 * - CarouselRenderer/GridRenderer → UIResourceRenderer
 *
 * By providing the render function via context, child components can render
 * nested components without importing UIResourceRenderer directly.
 */

import { createContext, useContext, JSX } from 'solid-js'
import type { UIComponent, RendererError } from '../types'

/**
 * Render function type that renders a UIComponent
 */
export type RenderComponentFn = (
  component: UIComponent,
  onError?: (error: RendererError) => void
) => JSX.Element

/**
 * Context value for component rendering
 */
export interface RenderContextValue {
  /**
   * Renders a single UIComponent
   */
  renderComponent: RenderComponentFn
}

/**
 * Default context value (fallback when not wrapped in provider)
 */
const defaultContextValue: RenderContextValue = {
  renderComponent: (component) => (
    <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <p class="text-sm text-yellow-800 dark:text-yellow-200">
        Component "{component.type}" cannot be rendered outside of UIResourceRenderer
      </p>
    </div>
  ),
}

/**
 * Context for providing component rendering capability
 */
export const RenderContext = createContext<RenderContextValue>(defaultContextValue)

/**
 * Hook to access the render context
 * Used by CarouselRenderer and GridRenderer to render nested components
 */
export function useRenderContext(): RenderContextValue {
  return useContext(RenderContext)
}

/**
 * Provider component for render context
 */
export function RenderProvider(props: {
  renderComponent: RenderComponentFn
  children: JSX.Element
}) {
  return (
    <RenderContext.Provider value={{ renderComponent: props.renderComponent }}>
      {props.children}
    </RenderContext.Provider>
  )
}
