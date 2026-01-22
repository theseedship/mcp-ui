/**
 * useResize Hook
 * Handles resizing of grid components by dragging edges
 *
 * Sprint Drag-Drop Feature
 */

import { createSignal, Accessor, onCleanup } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { GridPosition, ResizeConstraints } from '../types'

/**
 * Resize edge types
 */
export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom'

/**
 * Options for the useResize hook
 */
export interface UseResizeOptions {
  /**
   * Component ID being resized
   */
  componentId: string

  /**
   * Current grid position accessor
   */
  currentPosition: Accessor<GridPosition>

  /**
   * Callback when resize is complete
   */
  onResize: (newPosition: GridPosition) => void

  /**
   * Callback during resize (for preview)
   */
  onResizePreview?: (previewPosition: GridPosition) => void

  /**
   * Resize constraints
   */
  constraints?: ResizeConstraints

  /**
   * Grid container element for calculating column widths
   */
  gridContainer?: Accessor<HTMLElement | null>

  /**
   * Number of columns in the grid (default: 12)
   */
  gridColumns?: number

  /**
   * Whether resize is enabled
   */
  enabled?: boolean
}

/**
 * Return type for the useResize hook
 */
export interface UseResizeReturn {
  /**
   * Whether a resize is in progress
   */
  isResizing: Accessor<boolean>

  /**
   * Current resize edge
   */
  resizeEdge: Accessor<ResizeEdge | null>

  /**
   * Preview position during resize
   */
  previewPosition: Accessor<GridPosition | null>

  /**
   * Start resize operation
   */
  handleResizeStart: (e: PointerEvent, edge: ResizeEdge) => void

  /**
   * Get resize handle props for an edge
   */
  getResizeHandleProps: (edge: ResizeEdge) => ResizeHandleProps
}

/**
 * Props for resize handles
 */
export interface ResizeHandleProps {
  onPointerDown: (e: PointerEvent) => void
  style: Record<string, string>
  'data-resize-edge': ResizeEdge
}

/**
 * Apply constraints to a position
 */
function applyConstraints(
  position: GridPosition,
  constraints: ResizeConstraints,
  gridColumns: number
): GridPosition {
  let { colStart, colSpan, rowStart, rowSpan } = position

  // Apply column constraints
  const minColSpan = constraints.minColSpan ?? 1
  const maxColSpan = constraints.maxColSpan ?? gridColumns

  colSpan = Math.max(minColSpan, Math.min(maxColSpan, colSpan))

  // Ensure colStart + colSpan doesn't exceed grid
  if (colStart + colSpan - 1 > gridColumns) {
    colStart = gridColumns - colSpan + 1
  }
  colStart = Math.max(1, colStart)

  // Apply row constraints
  if (rowSpan !== undefined) {
    const minRowSpan = constraints.minRowSpan ?? 1
    const maxRowSpan = constraints.maxRowSpan ?? 99
    rowSpan = Math.max(minRowSpan, Math.min(maxRowSpan, rowSpan))
  }

  if (rowStart !== undefined) {
    rowStart = Math.max(1, rowStart)
  }

  return { colStart, colSpan, rowStart, rowSpan }
}

/**
 * Hook for handling resize of grid components
 */
export function useResize(options: UseResizeOptions): UseResizeReturn {
  const {
    currentPosition,
    onResize,
    onResizePreview,
    constraints = {},
    gridContainer,
    gridColumns = 12,
    enabled = true
  } = options

  const [isResizing, setIsResizing] = createSignal(false)
  const [resizeEdge, setResizeEdge] = createSignal<ResizeEdge | null>(null)
  const [previewPosition, setPreviewPosition] = createSignal<GridPosition | null>(null)
  const [startPosition, setStartPosition] = createSignal<GridPosition | null>(null)
  const [startPointer, setStartPointer] = createSignal<{ x: number; y: number } | null>(null)

  // Skip on server
  if (isServer) {
    return {
      isResizing: () => false,
      resizeEdge: () => null,
      previewPosition: () => null,
      handleResizeStart: () => {},
      getResizeHandleProps: () => ({
        onPointerDown: () => {},
        style: {},
        'data-resize-edge': 'right' as ResizeEdge
      })
    }
  }

  /**
   * Handle pointer move during resize
   */
  const handlePointerMove = (e: PointerEvent) => {
    if (!isResizing() || !startPosition() || !startPointer()) return

    const edge = resizeEdge()
    if (!edge) return

    // Get container for measurements
    const container = gridContainer?.() || document.querySelector('[data-grid-container]')
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const currentPos = startPosition()!
    const start = startPointer()!

    let newPosition: GridPosition = { ...currentPos }

    // Calculate delta in columns
    const deltaX = e.clientX - start.x
    const columnWidth = containerRect.width / gridColumns
    const columnDelta = Math.round(deltaX / columnWidth)

    if (constraints.lockHorizontal && (edge === 'left' || edge === 'right')) {
      // Horizontal resize is locked
    } else {
      switch (edge) {
        case 'right': {
          // Increase/decrease colSpan from the right
          const newColSpan = currentPos.colSpan + columnDelta
          newPosition.colSpan = Math.max(1, Math.min(gridColumns - currentPos.colStart + 1, newColSpan))
          break
        }
        case 'left': {
          // Increase/decrease from left (changes both colStart and colSpan)
          const newColStart = currentPos.colStart + columnDelta
          const newColSpan = currentPos.colSpan - columnDelta
          if (newColStart >= 1 && newColSpan >= 1) {
            newPosition.colStart = newColStart
            newPosition.colSpan = newColSpan
          }
          break
        }
        case 'top':
        case 'bottom': {
          // Row resizing - calculate based on Y movement
          if (!constraints.lockVertical) {
            const rowHeight = 100 // Approximate row height
            const deltaY = e.clientY - start.y
            const rowDelta = Math.round(deltaY / rowHeight)

            if (edge === 'bottom') {
              const currentRowSpan = currentPos.rowSpan || 1
              const newRowSpan = currentRowSpan + rowDelta
              newPosition.rowSpan = Math.max(1, newRowSpan)
            } else if (edge === 'top') {
              const currentRowStart = currentPos.rowStart || 1
              const currentRowSpan = currentPos.rowSpan || 1
              const newRowStart = currentRowStart + rowDelta
              const newRowSpan = currentRowSpan - rowDelta
              if (newRowStart >= 1 && newRowSpan >= 1) {
                newPosition.rowStart = newRowStart
                newPosition.rowSpan = newRowSpan
              }
            }
          }
          break
        }
      }
    }

    // Apply constraints
    newPosition = applyConstraints(newPosition, constraints, gridColumns)

    setPreviewPosition(newPosition)
    onResizePreview?.(newPosition)
  }

  /**
   * Handle pointer up to finish resize
   */
  const handlePointerUp = (_e: PointerEvent) => {
    if (!isResizing()) return

    const preview = previewPosition()
    if (preview) {
      onResize(preview)
    }

    // Cleanup
    setIsResizing(false)
    setResizeEdge(null)
    setPreviewPosition(null)
    setStartPosition(null)
    setStartPointer(null)

    // Remove listeners
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  /**
   * Start resize operation
   */
  const handleResizeStart = (e: PointerEvent, edge: ResizeEdge) => {
    if (!enabled) return

    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    setResizeEdge(edge)
    setStartPosition(currentPosition())
    setStartPointer({ x: e.clientX, y: e.clientY })
    setPreviewPosition(currentPosition())

    // Set cursor
    const cursors: Record<ResizeEdge, string> = {
      left: 'ew-resize',
      right: 'ew-resize',
      top: 'ns-resize',
      bottom: 'ns-resize'
    }
    document.body.style.cursor = cursors[edge]
    document.body.style.userSelect = 'none'

    // Add document listeners
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  /**
   * Get resize handle props for an edge
   */
  const getResizeHandleProps = (edge: ResizeEdge): ResizeHandleProps => {
    const baseStyle: Record<string, string> = {
      position: 'absolute',
      zIndex: '10'
    }

    const edgeStyles: Record<ResizeEdge, Record<string, string>> = {
      left: {
        ...baseStyle,
        left: '-4px',
        top: '0',
        width: '8px',
        height: '100%',
        cursor: 'ew-resize'
      },
      right: {
        ...baseStyle,
        right: '-4px',
        top: '0',
        width: '8px',
        height: '100%',
        cursor: 'ew-resize'
      },
      top: {
        ...baseStyle,
        top: '-4px',
        left: '0',
        width: '100%',
        height: '8px',
        cursor: 'ns-resize'
      },
      bottom: {
        ...baseStyle,
        bottom: '-4px',
        left: '0',
        width: '100%',
        height: '8px',
        cursor: 'ns-resize'
      }
    }

    return {
      onPointerDown: (e) => handleResizeStart(e, edge),
      style: edgeStyles[edge],
      'data-resize-edge': edge
    }
  }

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  return {
    isResizing,
    resizeEdge,
    previewPosition,
    handleResizeStart,
    getResizeHandleProps
  }
}
