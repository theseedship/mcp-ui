/**
 * ModalRenderer - Dialog overlay component
 * Sprint 3: UX Improvements
 */

import { Component, Show, createSignal, createEffect } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { bindPortalTheme } from '../utils/theme'
import { focusOverlay, lockOverlayScroll } from '../utils/overlay-lifecycle'
import type { UIComponent, ModalComponentParams } from '../types'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'

export interface ModalRendererProps {
  /**
   * UIComponent with modal params (for declarative use)
   */
  component?: UIComponent

  /**
   * Direct modal params (alternative to component)
   */
  params?: ModalComponentParams

  /**
   * External open state control
   */
  isOpen?: boolean

  /**
   * Callback when modal is closed
   */
  onClose?: () => void

  /**
   * Modal content (preferred for programmatic use)
   */
  children?: JSX.Element
}

/**
 * Modal/Dialog overlay component with Portal rendering
 *
 * @example Programmatic usage
 * ```tsx
 * function MyComponent() {
 *   const { isOpen, open, close } = useModal()
 *
 *   return (
 *     <>
 *       <button onClick={open}>Open Modal</button>
 *       <ModalRenderer
 *         isOpen={isOpen()}
 *         onClose={close}
 *         params={{ title: 'My Modal', size: 'md' }}
 *       >
 *         <p>Modal content here</p>
 *       </ModalRenderer>
 *     </>
 *   )
 * }
 * ```
 *
 * @example Declarative usage
 * ```tsx
 * const modalComponent: UIComponent = {
 *   id: 'details-modal',
 *   type: 'modal',
 *   position: { colStart: 1, colSpan: 12 },
 *   params: {
 *     title: 'User Details',
 *     size: 'lg',
 *   },
 * }
 * <ModalRenderer component={modalComponent} isOpen={true} onClose={close} />
 * ```
 */
export const ModalRenderer: Component<ModalRendererProps> = (props) => {
  const strings = useMCPUIStrings()
  const [isVisible, setIsVisible] = createSignal(false)
  let themeAnchor: HTMLSpanElement | undefined
  let dialogRef: HTMLDivElement | undefined
  bindPortalTheme(() => dialogRef, () => themeAnchor, isVisible)

  const params = () => props.params || (props.component?.params as ModalComponentParams) || {}

  // Sync with external isOpen prop
  createEffect(() => props.isOpen, (open) => {
    if (open !== undefined) {
      setIsVisible(open)
    }
  })

  // Handle escape key
  createEffect(isVisible, (visible) => {
    if (!visible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && params()?.closeOnEscape !== false) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  })

  // Prevent body scroll when modal is open
  createEffect(isVisible, (visible) => {
    if (!visible || !dialogRef) return
    return lockOverlayScroll(dialogRef.ownerDocument)
  })

  // Focus trap - focus the modal when it opens
  createEffect(isVisible, (visible) => {
    if (visible && dialogRef) return focusOverlay(dialogRef)
  })

  const handleClose = () => {
    setIsVisible(false)
    props.onClose?.()
  }

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && params()?.closeOnBackdrop !== false) {
      handleClose()
    }
  }

  const sizeClass = () => {
    switch (params()?.size) {
      case 'sm':
        return 'max-w-md'
      case 'lg':
        return 'max-w-4xl'
      case 'xl':
        return 'max-w-6xl'
      case 'full':
        return 'max-w-full mx-4'
      default: // md
        return 'max-w-2xl'
    }
  }

  return (
    <>
    <span hidden aria-hidden="true" ref={themeAnchor} />
    <Show when={isVisible()}>
      <Portal>
        {/* Backdrop */}
        <div
          ref={(element) => {
            dialogRef = element
          }}
          class="mcp-ui-root fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--mcp-ui-overlay,color-mix(in_oklab,var(--color-black,#000)_50%,transparent))] backdrop-blur-sm"
          style={{ animation: 'modal-fade-in 0.15s ease-out' }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={params()?.title ? 'modal-title' : undefined}
          tabindex={-1}
        >
          {/* Modal container */}
          <div
            class={`relative w-full ${sizeClass()} bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))] rounded-lg shadow-[var(--mcp-ui-shadow,var(--shadow-xl))]`}
            style={{ animation: 'modal-scale-in 0.15s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <Show when={params()?.title || params()?.showClose !== false}>
              <div class="flex items-center justify-between p-4 border-b border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-700,#374151))]">
                <Show when={params()?.title}>
                  <h2
                    id="modal-title"
                    class="text-lg font-semibold text-[color:var(--mcp-ui-fg,var(--color-gray-900,#111827))] dark:text-[color:var(--mcp-ui-fg,var(--color-white,#fff))]"
                  >
                    {params()!.title}
                  </h2>
                </Show>
                <Show when={!params()?.title}>
                  <div />
                </Show>
                <Show when={params()?.showClose !== false}>
                  <button
                    onClick={handleClose}
                    class="p-1 text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))] hover:text-[color:var(--mcp-ui-fg-muted,var(--color-gray-600,#4b5563))] dark:hover:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] rounded-full hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] transition-colors"
                    aria-label={strings.modalClose}
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </Show>
              </div>
            </Show>

            {/* Content */}
            <div
              class="p-4"
              style={params()?.maxHeight ? { 'max-height': params()!.maxHeight, 'overflow-y': 'auto' } : {}}
            >
              {props.children}
            </div>
          </div>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes modal-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modal-scale-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </Portal>
    </Show>
    </>
  )
}
