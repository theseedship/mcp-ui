/**
 * DraggableGridItem Component
 * Wrapper for grid items that enables drag-and-drop reordering and resizing
 *
 * Sprint Drag-Drop Feature
 */

import { Component, JSX, Show, createMemo, mergeProps } from 'solid-js'
import type { GridPosition, ResizeConstraints } from '../types'
import { ResizeHandle } from './ResizeHandle'

/**
 * Props for DraggableGridItem
 */
export interface DraggableGridItemProps {
  /**
   * Component ID
   */
  id: string

  /**
   * Grid position
   */
  position: GridPosition

  /**
   * Whether dragging is enabled
   */
  draggable?: boolean

  /**
   * Whether resizing is enabled
   */
  resizable?: boolean

  /**
   * Resize constraints
   */
  constraints?: ResizeConstraints

  /**
   * Whether this item is currently being dragged
   */
  isDragging?: boolean

  /**
   * Whether this item is a drop target
   */
  isDropTarget?: boolean

  /**
   * Preview position during resize
   */
  previewPosition?: GridPosition | null

  /**
   * Drag props from useDragDrop
   */
  dragProps?: {
    draggable: boolean
    onDragStart: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragEnter: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
    onDragEnd: (e: DragEvent) => void
  }

  /**
   * Callback when resize starts
   */
  onResizeStart?: (edge: 'left' | 'right' | 'top' | 'bottom', event: PointerEvent) => void

  /**
   * Callback for resize preview
   */
  onResizePreview?: (position: GridPosition) => void

  /**
   * Callback when resize completes
   */
  onResize?: (position: GridPosition) => void

  /**
   * Whether resize is in progress
   */
  isResizing?: boolean

  /**
   * Show grid overlay during drag/resize
   */
  showGridOverlay?: boolean

  /**
   * Custom CSS class
   */
  class?: string

  /**
   * Custom styles
   */
  style?: JSX.CSSProperties

  /**
   * Children to render
   */
  children?: JSX.Element
}

/**
 * Generate CSS Grid style string from position
 */
function getGridStyle(position: GridPosition): JSX.CSSProperties {
  return {
    'grid-column': `${position.colStart} / span ${position.colSpan}`,
    'grid-row': position.rowStart
      ? `${position.rowStart} / span ${position.rowSpan || 1}`
      : undefined
  }
}

/**
 * DraggableGridItem Component
 */
export const DraggableGridItem: Component<DraggableGridItemProps> = (props) => {
  const merged = mergeProps(
    {
      draggable: false,
      resizable: false,
      isDragging: false,
      isDropTarget: false,
      isResizing: false,
      showGridOverlay: false
    },
    props
  )

  // Use preview position during resize if available
  const effectivePosition = createMemo(() =>
    merged.previewPosition || props.position
  )

  // Compute grid style
  const gridStyle = createMemo(() => getGridStyle(effectivePosition()))

  // Compute combined style
  const combinedStyle = createMemo((): JSX.CSSProperties => {
    const base: JSX.CSSProperties = {
      ...gridStyle(),
      position: 'relative',
      transition: merged.isResizing ? 'none' : 'all 200ms ease-out'
    }

    // Add drag/drop visual feedback
    if (merged.isDragging) {
      base.opacity = '0.5'
      base.transform = 'scale(1.02)'
      base['z-index'] = '100'
    }

    if (merged.isDropTarget && !merged.isDragging) {
      base['box-shadow'] = '0 0 0 2px #3b82f6'
      base['border-radius'] = '4px'
    }

    if (merged.isResizing) {
      base['z-index'] = '100'
    }

    // Merge with custom styles
    if (props.style) {
      Object.assign(base, props.style)
    }

    return base
  })

  // Build class names
  const classNames = createMemo(() => {
    const classes = ['mcp-draggable-grid-item']

    if (merged.draggable) classes.push('mcp-draggable')
    if (merged.resizable) classes.push('mcp-resizable')
    if (merged.isDragging) classes.push('mcp-dragging')
    if (merged.isDropTarget) classes.push('mcp-drop-target')
    if (merged.isResizing) classes.push('mcp-resizing')
    if (props.class) classes.push(props.class)

    return classes.join(' ')
  })

  // Handle resize start
  const handleResizeStart = (edge: 'left' | 'right' | 'top' | 'bottom', event: PointerEvent) => {
    props.onResizeStart?.(edge, event)
  }

  return (
    <div
      class={classNames()}
      style={combinedStyle()}
      data-component-id={props.id}
      {...(merged.draggable && props.dragProps ? props.dragProps : {})}
    >
      {/* Drag handle indicator */}
      <Show when={merged.draggable && !merged.isResizing}>
        <div
          class="mcp-drag-handle"
          style={{
            position: 'absolute',
            top: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '40px',
            height: '4px',
            'background-color': 'rgba(0, 0, 0, 0.2)',
            'border-radius': '2px',
            cursor: 'grab',
            opacity: '0',
            transition: 'opacity 150ms ease',
            'z-index': '5'
          }}
        />
      </Show>

      {/* Resize handles */}
      <Show when={merged.resizable && !merged.isDragging}>
        <ResizeHandle
          edge="left"
          onResizeStart={handleResizeStart}
          disabled={merged.constraints?.lockHorizontal}
        />
        <ResizeHandle
          edge="right"
          onResizeStart={handleResizeStart}
          disabled={merged.constraints?.lockHorizontal}
        />
        <ResizeHandle
          edge="top"
          onResizeStart={handleResizeStart}
          disabled={merged.constraints?.lockVertical}
        />
        <ResizeHandle
          edge="bottom"
          onResizeStart={handleResizeStart}
          disabled={merged.constraints?.lockVertical}
        />
      </Show>

      {/* Drop indicator line */}
      <Show when={merged.isDropTarget && !merged.isDragging}>
        <div
          class="mcp-drop-indicator"
          style={{
            position: 'absolute',
            top: '-2px',
            left: '0',
            right: '0',
            height: '4px',
            'background-color': '#3b82f6',
            'border-radius': '2px',
            'z-index': '20'
          }}
        />
      </Show>

      {/* Content */}
      <div class="mcp-grid-item-content" style={{ position: 'relative', 'z-index': '1' }}>
        {props.children}
      </div>
    </div>
  )
}

export default DraggableGridItem
