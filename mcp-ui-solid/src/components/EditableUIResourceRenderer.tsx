/**
 * EditableUIResourceRenderer Component
 * Extends UIResourceRenderer with drag-and-drop reordering and resizing capabilities
 *
 * Sprint Drag-Drop Feature
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  createEffect,
  on,
  JSX
} from 'solid-js'
import type {
  UIComponent,
  UILayout,
  RendererError,
  GridPosition,
  DragDropConfig
} from '../types'
import { useDragDrop } from '../hooks/useDragDrop'
import { useResize, ResizeEdge } from '../hooks/useResize'
import { DraggableGridItem } from './DraggableGridItem'
import { UIResourceRenderer } from './UIResourceRenderer'

/**
 * Props for EditableUIResourceRenderer
 */
export interface EditableUIResourceRendererProps {
  /**
   * Layout to render (must be UILayout, not single component)
   */
  layout: UILayout

  /**
   * Drag-drop configuration
   */
  dragDrop?: DragDropConfig

  /**
   * Error callback
   */
  onError?: (error: RendererError) => void

  /**
   * Callback when layout changes (reorder or resize)
   */
  onLayoutChange?: (layout: UILayout) => void

  /**
   * Custom CSS class
   */
  class?: string

  /**
   * Show grid overlay during editing
   */
  showGridOverlay?: boolean
}

/**
 * Grid overlay component for visual feedback
 */
const GridOverlay: Component<{ columns: number; visible: boolean }> = (props) => {
  return (
    <Show when={props.visible}>
      <div
        class="mcp-grid-overlay"
        style={{
          position: 'absolute',
          inset: '0',
          display: 'grid',
          'grid-template-columns': `repeat(${props.columns}, 1fr)`,
          gap: '1rem',
          padding: '0',
          'pointer-events': 'none',
          'z-index': '0'
        }}
      >
        <For each={Array(props.columns).fill(0)}>
          {() => (
            <div
              class="mcp-grid-overlay-column"
              style={{
                'background-color': 'rgba(59, 130, 246, 0.05)',
                border: '1px dashed rgba(59, 130, 246, 0.2)',
                'border-radius': '4px'
              }}
            />
          )}
        </For>
      </div>
    </Show>
  )
}

/**
 * EditableUIResourceRenderer Component
 */
export const EditableUIResourceRenderer: Component<EditableUIResourceRendererProps> = (props) => {
  // Internal state for components (allows editing)
  const [components, setComponents] = createSignal<UIComponent[]>(props.layout.components)
  const [activeResizeId, setActiveResizeId] = createSignal<string | null>(null)
  const [previewPositions, setPreviewPositions] = createSignal<Map<string, GridPosition>>(new Map())
  const [gridContainerRef, setGridContainerRef] = createSignal<HTMLElement | null>(null)

  // Sync with external layout changes
  createEffect(on(() => props.layout.components, (newComponents) => {
    setComponents(newComponents)
  }))

  // Drag-drop configuration
  const dragDropConfig = createMemo(() => ({
    enabled: props.dragDrop?.enabled ?? false,
    reorder: props.dragDrop?.reorder ?? true,
    resize: props.dragDrop?.resize ?? true,
    constraints: props.dragDrop?.constraints ?? {},
    showGridLines: props.dragDrop?.showGridLines ?? true,
    animationDuration: props.dragDrop?.animationDuration ?? 200
  }))

  // Handle reorder from drag-drop
  const handleReorder = (newComponents: UIComponent[]) => {
    setComponents(newComponents)

    const newLayout: UILayout = {
      ...props.layout,
      components: newComponents
    }

    props.dragDrop?.onReorder?.(newComponents)
    props.dragDrop?.onChange?.(newLayout)
    props.onLayoutChange?.(newLayout)
  }

  // Handle resize completion
  const handleResize = (componentId: string, newPosition: GridPosition) => {
    const updatedComponents = components().map(c =>
      c.id === componentId ? { ...c, position: newPosition } : c
    )

    setComponents(updatedComponents)
    setActiveResizeId(null)
    setPreviewPositions(new Map())

    const newLayout: UILayout = {
      ...props.layout,
      components: updatedComponents
    }

    props.dragDrop?.onResize?.(componentId, newPosition)
    props.dragDrop?.onChange?.(newLayout)
    props.onLayoutChange?.(newLayout)
  }

  // Handle resize preview
  const handleResizePreview = (componentId: string, previewPosition: GridPosition) => {
    setPreviewPositions(prev => {
      const next = new Map(prev)
      next.set(componentId, previewPosition)
      return next
    })
  }

  // Initialize drag-drop hook
  const dragDrop = useDragDrop({
    components,
    onReorder: handleReorder,
    enabled: dragDropConfig().enabled && dragDropConfig().reorder
  })

  // Grid container style
  const gridContainerStyle = createMemo((): JSX.CSSProperties => ({
    display: 'grid',
    'grid-template-columns': `repeat(${props.layout.grid.columns}, 1fr)`,
    gap: props.layout.grid.gap,
    position: 'relative'
  }))

  // Check if we should show grid overlay
  const showOverlay = createMemo(() =>
    dragDropConfig().showGridLines && (dragDrop.isDragging() || activeResizeId() !== null)
  )

  // Get effective position for a component (preview if resizing, otherwise actual)
  const getEffectivePosition = (component: UIComponent): GridPosition => {
    const preview = previewPositions().get(component.id)
    return preview || component.position
  }

  // If drag-drop is not enabled, just render the standard UIResourceRenderer
  if (!props.dragDrop?.enabled) {
    return (
      <UIResourceRenderer
        content={props.layout}
        onError={props.onError}
        class={props.class}
      />
    )
  }

  return (
    <div class={`w-full editable-ui-renderer ${props.class || ''}`}>
      <div
        ref={setGridContainerRef}
        class="grid relative"
        style={gridContainerStyle()}
        data-grid-container
      >
        {/* Grid overlay */}
        <GridOverlay
          columns={props.layout.grid.columns}
          visible={showOverlay()}
        />

        {/* Render components with drag-drop wrappers */}
        <For each={components()}>
          {(component) => {
            // Create resize hook for each component
            const resize = useResize({
              componentId: component.id,
              currentPosition: () => component.position,
              onResize: (pos) => handleResize(component.id, pos),
              onResizePreview: (pos) => handleResizePreview(component.id, pos),
              constraints: dragDropConfig().constraints,
              gridContainer: gridContainerRef,
              gridColumns: props.layout.grid.columns,
              enabled: dragDropConfig().enabled && dragDropConfig().resize
            })

            const effectivePosition = () => getEffectivePosition(component)

            return (
              <DraggableGridItem
                id={component.id}
                position={effectivePosition()}
                draggable={dragDropConfig().enabled && dragDropConfig().reorder}
                resizable={dragDropConfig().enabled && dragDropConfig().resize}
                constraints={dragDropConfig().constraints}
                isDragging={dragDrop.isComponentDragging(component.id)}
                isDropTarget={dragDrop.isDropTarget(component.id)}
                isResizing={activeResizeId() === component.id}
                previewPosition={previewPositions().get(component.id) || null}
                dragProps={dragDrop.getDragProps(component.id)}
                onResizeStart={(edge, event) => {
                  setActiveResizeId(component.id)
                  resize.handleResizeStart(event, edge as ResizeEdge)
                }}
              >
                {/* Render component using UIResourceRenderer for single component */}
                <UIResourceRenderer
                  content={component}
                  onError={props.onError}
                />
              </DraggableGridItem>
            )
          }}
        </For>
      </div>
    </div>
  )
}

export default EditableUIResourceRenderer
