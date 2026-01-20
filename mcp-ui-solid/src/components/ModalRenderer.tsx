/**
 * ModalRenderer - Dialog overlay component
 * Sprint 3: UX Improvements
 */

import { Component, Show, createSignal, createEffect, onCleanup, JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { UIComponent, ModalComponentParams } from '../types'

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
  const [isVisible, setIsVisible] = createSignal(false)

  const params = () => props.params || (props.component?.params as ModalComponentParams) || {}

  // Sync with external isOpen prop
  createEffect(() => {
    if (props.isOpen !== undefined) {
      setIsVisible(props.isOpen)
    }
  })

  // Handle escape key
  createEffect(() => {
    if (!isVisible()) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && params()?.closeOnEscape !== false) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    onCleanup(() => document.removeEventListener('keydown', handleEscape))
  })

  // Prevent body scroll when modal is open
  createEffect(() => {
    if (isVisible()) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    onCleanup(() => {
      document.body.style.overflow = ''
    })
  })

  // Focus trap - focus the modal when it opens
  createEffect(() => {
    if (isVisible()) {
      // Small delay to ensure the modal is rendered
      setTimeout(() => {
        const modal = document.querySelector('[role="dialog"]')
        if (modal instanceof HTMLElement) {
          modal.focus()
        }
      }, 10)
    }
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
    <Show when={isVisible()}>
      <Portal>
        {/* Backdrop */}
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ animation: 'modal-fade-in 0.15s ease-out' }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={params()?.title ? 'modal-title' : undefined}
          tabIndex={-1}
        >
          {/* Modal container */}
          <div
            class={`relative w-full ${sizeClass()} bg-white dark:bg-gray-800 rounded-lg shadow-xl`}
            style={{ animation: 'modal-scale-in 0.15s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <Show when={params()?.title || params()?.showClose !== false}>
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <Show when={params()?.title}>
                  <h2
                    id="modal-title"
                    class="text-lg font-semibold text-gray-900 dark:text-white"
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
                    class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close modal"
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
  )
}
