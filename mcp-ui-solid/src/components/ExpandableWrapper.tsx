/**
 * ExpandableWrapper - Generic expand/fullscreen wrapper for components
 * v2.2.0: Reusable wrapper that adds expand button + fullscreen modal
 *
 * Uses DOM reparenting to avoid rendering children twice — critical for
 * imperative components like ChartJS that bind instances to DOM nodes.
 */

import { Component, Show, createSignal, createEffect, onCleanup, JSX, createContext, useContext, Accessor } from 'solid-js'
import { Portal } from 'solid-js/web'
import { bindPortalTheme } from '../utils/theme'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'

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
  /**
   * Visibility behavior of the inline expand button (v6.3.0 — axe 4 deposium handoff).
   *   - `'hover'` (default) : opacity 0, fades to 0.7 on parent group hover.
   *     Backwards-compatible — pre-v6.3.0 behavior.
   *   - `'always-visible'` : opacity 0.6 permanent, 1 on hover. Use this when
   *     the inline button needs to be discoverable without hovering — esp.
   *     on touch surfaces and consumer themes where the hover-only pattern
   *     hides the affordance.
   */
  toolbarVariant?: 'hover' | 'always-visible'
  /**
   * Called with the expanded state on mount and whenever it changes (v6.19.0).
   * Needed by renderers that render their own `<ExpandableWrapper>`: their
   * `useExpanded()` call sits ABOVE the wrapper's context provider and would
   * only ever see an outer wrapper.
   */
  onExpandedChange?: (expanded: boolean) => void
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
  const strings = useMCPUIStrings()
  let dialogRef: HTMLDivElement | undefined
  let contentRef: HTMLDivElement | undefined
  let inlineSlotRef: HTMLDivElement | undefined
  let modalSlotRef: HTMLDivElement | undefined

  const handleOpen = () => setIsExpanded(true)
  const handleClose = () => setIsExpanded(false)

  // Report the state to the owner (see `onExpandedChange` docs).
  createEffect(() => {
    props.onExpandedChange?.(isExpanded())
  })

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

  /**
   * Did the gesture that produced the current click START on the backdrop?
   *
   * `null` means no pointer press was seen — a synthetic or programmatic
   * click, which stays allowed so keyboard and test-driven closes keep working.
   */
  let pressedOnBackdrop: boolean | null = null

  const handleBackdropPointerDown = (e: PointerEvent) => {
    pressedOnBackdrop = e.target === e.currentTarget
  }

  /**
   * Closing on a backdrop click is only safe when the gesture also BEGAN there.
   *
   * When a press and its release have different targets the browser dispatches
   * `click` on their nearest common ancestor — here the backdrop. So a drag
   * that starts on the content and releases over the 16px margin around the
   * panel (panning a zoomed chart, selecting text in a table) would otherwise
   * land on this handler with `e.target === e.currentTarget` and tear the modal
   * down mid-gesture.
   */
  const handleBackdropClick = (e: MouseEvent) => {
    const startedOnBackdrop = pressedOnBackdrop
    pressedOnBackdrop = null
    if (startedOnBackdrop === false) return
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
    <div class="mcp-ui-root relative group">
      {/* Inline slot — content lives here when not expanded */}
      <div ref={inlineSlotRef}>
        <div ref={contentRef}>
          <ExpandedContext.Provider value={isExpanded}>
            {props.children}
          </ExpandedContext.Provider>
        </div>
      </div>

      {/* Expand button — visibility per `toolbarVariant` (default 'hover') */}
      <button
        type="button"
        onClick={handleOpen}
        class={`absolute top-2 right-2 z-10 ${
          props.toolbarVariant === 'always-visible'
            ? 'opacity-60 hover:opacity-100'
            : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
        } p-1.5 bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))] border border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-600,#4b5563))] rounded-full hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] transition-all shadow-[var(--mcp-ui-shadow,var(--shadow-sm))]`}
        title={strings.expand}
        aria-label={strings.expand}
        data-mcp-ui-action="expand"
      >
        <svg class="w-3.5 h-3.5 text-[color:var(--mcp-ui-fg-muted,var(--color-gray-500,#6b7280))] dark:text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
      </button>

      {/* Fullscreen modal via Portal */}
      <Show when={isExpanded()}>
        <Portal>
          <div
            class="fixed inset-0 z-50 flex flex-col bg-[color:var(--mcp-ui-overlay,color-mix(in_oklab,var(--color-black,#000)_50%,transparent))] backdrop-blur-sm"
            style={{ animation: 'expandable-fade-in 0.15s ease-out' }}
            onClick={handleBackdropClick}
            onPointerDown={handleBackdropPointerDown}
            role="dialog"
            data-mcp-ui-portal="dialog"
            aria-modal="true"
            aria-label={props.title || strings.expandedView}
            tabIndex={-1}
            ref={(element) => {
              dialogRef = element
              bindPortalTheme(element, () => inlineSlotRef)
            }}
          >
            {/* Modal panel */}
            <div
              class="relative flex flex-col m-4 flex-1 bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))] rounded-lg shadow-[var(--mcp-ui-shadow,var(--shadow-xl))] overflow-hidden"
              style={{ animation: 'expandable-scale-in 0.15s ease-out' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="flex items-center justify-between px-4 py-3 border-b border-[color:var(--mcp-ui-border,var(--color-gray-200,#e5e7eb))] dark:border-[color:var(--mcp-ui-border,var(--color-gray-700,#374151))] flex-shrink-0">
                <h2 class="text-lg font-semibold text-[color:var(--mcp-ui-fg,var(--color-gray-900,#111827))] dark:text-[color:var(--mcp-ui-fg,var(--color-white,#fff))] truncate">
                  {props.title || strings.expandedView}
                </h2>
                <div class="flex items-center gap-2">
                  {/* Copy button */}
                  <Show when={props.copyData}>
                    <button
                      type="button"
                      onClick={handleCopy}
                      class="p-1.5 text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))] hover:text-[color:var(--mcp-ui-fg-muted,var(--color-gray-600,#4b5563))] dark:hover:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] rounded-full hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] transition-colors"
                      title={props.copyLabel || strings.copyToClipboard}
                      aria-label={props.copyLabel || strings.copyToClipboard}
                      data-mcp-ui-action="copy"
                    >
                      <Show
                        when={!copied()}
                        fallback={
                          <svg class="w-5 h-5 text-[color:var(--mcp-ui-success,var(--color-green-500))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    type="button"
                    onClick={handleClose}
                    class="p-1.5 text-[color:var(--mcp-ui-fg-subtle,var(--color-gray-400,#9ca3af))] hover:text-[color:var(--mcp-ui-fg-muted,var(--color-gray-600,#4b5563))] dark:hover:text-[color:var(--mcp-ui-fg,var(--color-gray-300,#d1d5db))] rounded-full hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-100,#f3f4f6))] dark:hover:bg-[color:var(--mcp-ui-surface-hover,var(--color-gray-700,#374151))] transition-colors"
                    aria-label={strings.closeExpandedView}
                    data-mcp-ui-action="close"
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
