/**
 * ResizeHandle Component
 * Visual handle for resizing grid components
 *
 * Sprint Drag-Drop Feature
 */

import { Component, JSX, createMemo, mergeProps } from 'solid-js'

/**
 * Resize edge types
 */
export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom'

/**
 * Props for ResizeHandle
 */
export interface ResizeHandleProps {
  /**
   * Which edge this handle is on
   */
  edge: ResizeEdge

  /**
   * Callback when resize starts
   */
  onResizeStart?: (edge: ResizeEdge, event: PointerEvent) => void

  /**
   * Whether the handle is disabled
   */
  disabled?: boolean

  /**
   * Whether resize is active
   */
  isActive?: boolean

  /**
   * Custom class
   */
  class?: string

  /**
   * Handle size in pixels
   */
  size?: number

  /**
   * Hit area size in pixels (larger than visible size for easier grabbing)
   */
  hitAreaSize?: number
}

/**
 * Get cursor style for edge
 */
function getCursor(edge: ResizeEdge): string {
  switch (edge) {
    case 'left':
    case 'right':
      return 'ew-resize'
    case 'top':
    case 'bottom':
      return 'ns-resize'
    default:
      return 'default'
  }
}

/**
 * Get position styles for edge
 */
function getPositionStyle(
  edge: ResizeEdge,
  hitAreaSize: number
): JSX.CSSProperties {
  const halfSize = hitAreaSize / 2

  switch (edge) {
    case 'left':
      return {
        left: `-${halfSize}px`,
        top: '0',
        width: `${hitAreaSize}px`,
        height: '100%'
      }
    case 'right':
      return {
        right: `-${halfSize}px`,
        top: '0',
        width: `${hitAreaSize}px`,
        height: '100%'
      }
    case 'top':
      return {
        top: `-${halfSize}px`,
        left: '0',
        width: '100%',
        height: `${hitAreaSize}px`
      }
    case 'bottom':
      return {
        bottom: `-${halfSize}px`,
        left: '0',
        width: '100%',
        height: `${hitAreaSize}px`
      }
    default:
      return {}
  }
}

/**
 * Get visual indicator styles for edge
 */
function getIndicatorStyle(
  edge: ResizeEdge,
  size: number,
  isActive: boolean
): JSX.CSSProperties {
  const baseColor = isActive ? '#3b82f6' : '#9ca3af'

  const common: JSX.CSSProperties = {
    position: 'absolute',
    'background-color': baseColor,
    'border-radius': `${size / 2}px`,
    transition: 'background-color 150ms ease, opacity 150ms ease',
    opacity: isActive ? '1' : '0'
  }

  switch (edge) {
    case 'left':
      return {
        ...common,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${size}px`,
        height: '40px',
        'max-height': '60%'
      }
    case 'right':
      return {
        ...common,
        right: '50%',
        top: '50%',
        transform: 'translate(50%, -50%)',
        width: `${size}px`,
        height: '40px',
        'max-height': '60%'
      }
    case 'top':
      return {
        ...common,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '40px',
        'max-width': '60%',
        height: `${size}px`
      }
    case 'bottom':
      return {
        ...common,
        bottom: '50%',
        left: '50%',
        transform: 'translate(-50%, 50%)',
        width: '40px',
        'max-width': '60%',
        height: `${size}px`
      }
    default:
      return common
  }
}

/**
 * ResizeHandle Component
 */
export const ResizeHandle: Component<ResizeHandleProps> = (props) => {
  const merged = mergeProps(
    {
      disabled: false,
      isActive: false,
      size: 4,
      hitAreaSize: 12
    },
    props
  )

  const handlePointerDown = (e: PointerEvent) => {
    if (merged.disabled) return

    e.preventDefault()
    e.stopPropagation()

    props.onResizeStart?.(props.edge, e)
  }

  // Container styles
  const containerStyle = createMemo((): JSX.CSSProperties => ({
    position: 'absolute',
    'z-index': '10',
    cursor: merged.disabled ? 'default' : getCursor(props.edge),
    'user-select': 'none',
    'touch-action': 'none',
    ...getPositionStyle(props.edge, merged.hitAreaSize)
  }))

  // Indicator styles
  const indicatorStyle = createMemo(() =>
    getIndicatorStyle(props.edge, merged.size, merged.isActive)
  )

  // Class names
  const classNames = createMemo(() => {
    const classes = [
      'mcp-resize-handle',
      `mcp-resize-handle-${props.edge}`
    ]

    if (merged.disabled) classes.push('mcp-resize-handle-disabled')
    if (merged.isActive) classes.push('mcp-resize-handle-active')
    if (props.class) classes.push(props.class)

    return classes.join(' ')
  })

  return (
    <div
      class={classNames()}
      style={containerStyle()}
      onPointerDown={handlePointerDown}
      data-resize-edge={props.edge}
      role="separator"
      aria-orientation={
        props.edge === 'left' || props.edge === 'right'
          ? 'vertical'
          : 'horizontal'
      }
      aria-valuenow={undefined}
      tabIndex={merged.disabled ? -1 : 0}
      onKeyDown={(e) => {
        // Allow keyboard resizing
        if (merged.disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          // Create synthetic pointer event for keyboard activation
          const syntheticEvent = new PointerEvent('pointerdown', {
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2
          })
          props.onResizeStart?.(props.edge, syntheticEvent)
        }
      }}
    >
      {/* Visual indicator */}
      <div
        class="mcp-resize-indicator"
        style={indicatorStyle()}
      />
    </div>
  )
}

export default ResizeHandle
