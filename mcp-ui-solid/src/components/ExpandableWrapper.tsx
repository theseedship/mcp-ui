/**
 * ExpandableWrapper - Generic expand/fullscreen wrapper for components
 * v2.2.0: Reusable wrapper that adds expand button + fullscreen modal
 *
 * Uses DOM reparenting to avoid rendering children twice — critical for
 * imperative components like ChartJS that bind instances to DOM nodes.
 */

import { Component, Show, createSignal, createEffect, onCleanup, JSX, createContext, useContext, Accessor } from 'solid-js'
import { Portal } from 'solid-js/web'

/** Context for child components to know if they're in expanded/fullscreen view */
const ExpandedContext = createContext<Accessor<boolean>>(() => false)

/** Hook for child components to read expanded state */
export const useExpanded = () => useContext(ExpandedContext)

export interface ExpandableWrapperProps {
  /** Content to render inline (and in expanded view) */
  children: JSX.Element
  /** Title shown in the expanded modal header */
  title?: string
  /** Data string for copy-to-clipboard in expanded view */
  copyData?: string
  /** Label for copy button tooltip */
  copyLabel?: string
}

/**
 * Wraps any component with an expand button (top-right corner).
 * Opens a fullscreen Portal modal. The children's DOM is physically
 * reparented into the modal (not duplicated), so imperative bindings
 * like Chart.js canvas refs stay intact.
 *
 * @example
 * <ExpandableWrapper title="Sales Data" copyData={tsvData}>
 *   <TableRenderer ... />
 * </ExpandableWrapper>
 */
export const ExpandableWrapper: Component<ExpandableWrapperProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  let dialogRef: HTMLDivElement | undefined
  let contentRef: HTMLDivElement | undefined
  let inlineSlotRef: HTMLDivElement | undefined
  let modalSlotRef: HTMLDivElement | undefined

  const handleOpen = () => setIsExpanded(true)
  const handleClose = () => setIsExpanded(false)

  // Reparent content DOM between inline and modal slots
  createEffect(() => {
    if (!contentRef) return

    if (isExpanded()) {
      // Move content into modal
      modalSlotRef?.appendChild(contentRef)
    } else {
      // Move content back to inline
      inlineSlotRef?.appendChild(contentRef)
    }
  })

  // Keyboard: Escape to close
  createEffect(() => {
    if (!isExpanded()) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown))
  })

  // Prevent body scroll when expanded
  createEffect(() => {
    if (isExpanded()) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      // Focus the dialog
      setTimeout(() => dialogRef?.focus(), 10)
      onCleanup(() => {
        document.body.style.overflow = prev
      })
    }
  })

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const handleCopy = async () => {
    if (!props.copyData) return
    try {
      await navigator.clipboard.writeText(props.copyData)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div class="relative group">
      {/* Inline slot — content lives here when not expanded */}
      <div ref={inlineSlotRef}>
        <div ref={contentRef}>
          <ExpandedContext.Provider value={isExpanded}>
            {props.children}
          </ExpandedContext.Provider>
        </div>
      </div>

      {/* Expand button — visible on hover */}
      <button
        onClick={handleOpen}
        class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-70 hover:!opacity-100 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
        title="Expand"
        aria-label="Expand to fullscreen"
      >
        <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
      </button>

      {/* Fullscreen modal via Portal */}
      <Show when={isExpanded()}>
        <Portal>
          <div
            class="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm"
            style={{ animation: 'expandable-fade-in 0.15s ease-out' }}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={props.title || 'Expanded view'}
            tabIndex={-1}
            ref={dialogRef}
          >
            {/* Modal panel */}
            <div
              class="relative flex flex-col m-4 flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
              style={{ animation: 'expandable-scale-in 0.15s ease-out' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {props.title || 'Expanded View'}
                </h2>
                <div class="flex items-center gap-2">
                  {/* Copy button */}
                  <Show when={props.copyData}>
                    <button
                      onClick={handleCopy}
                      class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={props.copyLabel || 'Copy to clipboard'}
                      aria-label={props.copyLabel || 'Copy to clipboard'}
                    >
                      <Show
                        when={!copied()}
                        fallback={
                          <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        }
                      >
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Show>
                    </button>
                  </Show>
                  {/* Close button */}
                  <button
                    onClick={handleClose}
                    class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close expanded view"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal slot — content is reparented here when expanded.
                  v6.1.0 : `flex flex-col` lets aware children opt into
                  `flex-1 min-h-0` to fill the modal vertically (chart,
                  table, map, graph). Unaware children keep working
                  thanks to `overflow-auto` (their natural height
                  scrolls if it overflows the slot). */}
              <div class="flex-1 min-h-0 overflow-auto p-4 flex flex-col" ref={modalSlotRef} />
            </div>
          </div>

          <style>{`
            @keyframes expandable-fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes expandable-scale-in {
              from { opacity: 0; transform: scale(0.97); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </Portal>
      </Show>
    </div>
  )
}
