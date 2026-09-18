/**
 * LightboxOverlay - Fullscreen image viewer
 * Sprint 5: Media Components
 *
 * v6.22.0 — zoom & pan. The overlay is a fullscreen `<Portal>`: it OWNS the
 * viewport, nothing scrolls behind it (the effect below locks `body`), so
 * hijacking the wheel here is legitimate in a way it would not be for a
 * component sitting inline in a chat feed. Zoom is therefore always on in the
 * lightbox and needs no host opt-in.
 */

import { Component, Show, createEffect, createMemo, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { GalleryImage } from '../types'
import { safeUrl } from '../utils/safe-url'
import { createPanZoom, type PanZoomPoint } from '../utils/pan-zoom'
import { formatMCPUIString, useMCPUIStrings } from '../context/MCPUIStringsContext'

/** Highest magnification of the lightbox — 8× the fitted size. */
const MAX_ZOOM = 8

/** Ratio one press of a zoom button (or of `+` / `-`) applies. */
const ZOOM_BUTTON_FACTOR = 1.5

/**
 * Scale a double-click jumps to. Deliberately modest: a double-click is a
 * coarse gesture, and the wheel is right there for the rest.
 */
const DOUBLE_CLICK_ZOOM = 2

export interface LightboxOverlayProps {
  /**
   * Array of images to navigate through
   */
  images: GalleryImage[]

  /**
   * Currently selected image index (null when closed)
   */
  selectedIndex: number | null

  /**
   * Callback when lightbox should close
   */
  onClose: () => void

  /**
   * Callback when navigating to a different image
   */
  onNavigate: (index: number) => void
}

export const LightboxOverlay: Component<LightboxOverlayProps> = (props) => {
  const strings = useMCPUIStrings()
  let imageRef: HTMLImageElement | undefined

  /**
   * The handlers are bound on the BACKDROP, not on the `<img>`: a pan that
   * drags the image out from under the cursor must keep receiving the pointer
   * stream, and a wheel event over the black margin around a portrait image
   * must still zoom. `target` therefore points the maths back at the image,
   * which is the element that actually carries the transform.
   */
  const panZoom = createPanZoom({ min: 1, max: MAX_ZOOM, target: () => imageRef })

  const isOpen = () => props.selectedIndex !== null
  const currentImage = () =>
    props.selectedIndex !== null ? props.images[props.selectedIndex] : null
  const canGoPrev = () => props.selectedIndex !== null && props.selectedIndex > 0
  const canGoNext = () =>
    props.selectedIndex !== null && props.selectedIndex < props.images.length - 1

  const handlePrev = () => {
    if (canGoPrev()) {
      props.onNavigate(props.selectedIndex! - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext()) {
      props.onNavigate(props.selectedIndex! + 1)
    }
  }

  /**
   * Identity of the picture on screen, as a VALUE rather than as an object
   * reference — `null` while the overlay is closed.
   *
   * The index alone does not name a picture. A host that replaces `images`
   * under a held `selectedIndex` — a gallery whose list streams in, a refilter,
   * a re-render that rebuilds the array — puts a different photo on screen
   * without the index ever moving. `url` and `srcset` are what the `<img>`
   * below actually resolves, so together with the index they are what "the
   * displayed image changed" has to mean. (`sizes` is left out on purpose: it
   * re-picks among the candidates of the SAME picture, so it changes the
   * resolution fetched, never the subject the zoom is framing.)
   *
   * A memo, and a string, so the comparison is by value: `ImageGalleryRenderer`
   * passes `params()?.images || []`, a fresh array on every parent update, and
   * re-reading that must not by itself count as a new picture — it would throw
   * away a zoom the user is in the middle of. The index stays in the key so
   * that navigating between two entries sharing a URL is still the clean slate
   * the arrows promise.
   */
  const displayedImage = createMemo(() => {
    if (props.selectedIndex === null) return null
    const image = props.images[props.selectedIndex]
    return JSON.stringify([props.selectedIndex, image?.url ?? null, image?.srcset ?? null])
  })

  /**
   * Every image opens at its fitted size. Without this the transform left over
   * from the previous picture would be applied to the next one — a 6× zoom on
   * a corner of a portrait photo, carried onto a landscape one, shows black.
   * It also settles the "arrows vs. panning" question: navigating away is
   * always a clean slate rather than a frame half-belonging to two images.
   *
   * The dependency is `displayedImage()` and not `selectedIndex`, for the same
   * reason: a swapped-out `images` array reaches the user as exactly that black
   * frame — the old picture's scale and offset applied to a new photo — with no
   * navigation to blame it on.
   *
   * `reset()` reads its state through `untrack`, so this effect subscribes to
   * that one memo and never re-runs on its own write. The scale and offset it
   * writes are absent from the memo for the same reason: panning must not
   * reset the pan.
   *
   * `cancelGesture()` comes first, and matters most on the CLOSE (`null`): the
   * pan handlers live on the backdrop, inside the `<Show>` below, but the
   * controller belongs to this component — which `ImageGalleryRenderer` mounts
   * once and never unmounts. Close the overlay with a button still held
   * (Escape mid-drag) and the backdrop is detached before its `pointerup`,
   * which is then delivered to whatever is underneath and never to these
   * handlers. Nothing else would end that gesture: `reset()` only writes the
   * transform, and `onCleanup` belongs to an owner that is still alive. The
   * overlay would reopen stuck at `cursor: grabbing`, with `isPanning()` true
   * and the arrow keys dead behind their pan guards.
   */
  createEffect(() => {
    displayedImage()
    panZoom.cancelGesture()
    panZoom.reset()
  })

  /**
   * Is the keystroke going into something the user is typing in?
   *
   * The overlay binds its shortcuts on `document`, so it hears every key in
   * the page — and it does not trap focus, so the host's own composer can keep
   * it while the lightbox is open (`Tab` from the thumbnail that opened the
   * overlay walks on into the host, since the `<Portal>` content is appended
   * after it). The zoom keys are `-`, `+`, `=` and `0`: characters. Calling
   * `preventDefault()` on them without this check silently eats them out of
   * the host's text field — typing a date would zoom the photo instead.
   *
   * `Escape` stays global, as it was before the zoom keys existed: it produces
   * no character, and dismissing the modal is what it is for.
   */
  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  }

  // Keyboard navigation
  createEffect(() => {
    if (!isOpen()) return

    const handleKeydown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + `+` / `-` / `0` is the browser's own page zoom; the overlay
      // must not swallow it.
      const isZoomChord = e.ctrlKey || e.metaKey

      // A field the user is typing in owns its keys — all of them but the one
      // that dismisses a modal.
      if (e.key !== 'Escape' && isEditableTarget(e.target)) return

      switch (e.key) {
        case 'Escape':
          props.onClose()
          break
        case 'ArrowLeft':
          // Mid-drag the arrows would move the picture the user is holding.
          if (panZoom.isPanning()) break
          handlePrev()
          break
        case 'ArrowRight':
          if (panZoom.isPanning()) break
          handleNext()
          break
        case '+':
        case '=':
          // `=` is `+` unshifted — the key people actually press.
          if (isZoomChord) break
          e.preventDefault()
          panZoom.zoomBy(ZOOM_BUTTON_FACTOR)
          break
        case '-':
          if (isZoomChord) break
          e.preventDefault()
          panZoom.zoomBy(1 / ZOOM_BUTTON_FACTOR)
          break
        case '0':
          if (isZoomChord) break
          e.preventDefault()
          panZoom.reset()
          break
      }
    }

    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
    })
  })

  /**
   * Closing on a backdrop click is the behaviour users expect — but a pan
   * releases the pointer over the backdrop as often as not, and the browser
   * then fires a `click` on the common ancestor of the press and the release.
   * `wasDragged()` is exactly that distinction: it stays true from the moment
   * the pointer travelled more than a few pixels until the next `pointerdown`,
   * so the click that closes the overlay is only ever a click that did not move.
   */
  const handleBackdropClick = () => {
    if (panZoom.wasDragged()) return
    props.onClose()
  }

  /**
   * The chrome (close, prev/next, the zoom toolbar) sits on top of the pan
   * surface. Pressing a button must not open a gesture: while zoomed
   * `onPointerDown` calls `preventDefault()`, which costs the button its focus,
   * and a hand that shakes on the way to "next" would pan the image instead.
   */
  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target
    if (target instanceof Element && target.closest('button')) return
    panZoom.onPointerDown(event)
  }

  /**
   * Viewport point of a mouse event, in the space `zoomTo` anchors on: client
   * pixels measured from the image's UNTRANSFORMED top-left corner. That corner
   * is not directly observable — `getBoundingClientRect()` already includes the
   * transform — but with `transform-origin: 0 0` the rendered left edge is
   * exactly `corner + offset`, so subtracting the current offset recovers it
   * whatever the flex centring did.
   *
   * `createPanZoom` computes the same point for the wheel but keeps it private;
   * this is the double-click's copy of it.
   */
  const anchorOf = (event: MouseEvent): PanZoomPoint | undefined => {
    if (!imageRef) return undefined
    const rect = imageRef.getBoundingClientRect()
    const offset = panZoom.offset()
    return {
      x: event.clientX - (rect.left - offset.x),
      y: event.clientY - (rect.top - offset.y),
    }
  }

  /** Double-click toggles: in at the spot that was double-clicked, or back out. */
  const handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (panZoom.isZoomed()) {
      panZoom.reset()
    } else {
      panZoom.zoomTo(DOUBLE_CLICK_ZOOM, anchorOf(event))
    }
  }

  return (
    <Show when={isOpen()}>
      <Portal>
        <div
          class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          style={panZoom.surfaceStyle()}
          onClick={handleBackdropClick}
          onWheel={panZoom.onWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={panZoom.onPointerMove}
          onPointerUp={panZoom.onPointerUp}
          onPointerCancel={panZoom.onPointerCancel}
          role="dialog"
          aria-modal="true"
          aria-label={strings.lightboxLabel}
        >
          {/* Close button */}
          <button
            class="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={props.onClose}
            aria-label={strings.lightboxClose}
          >
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Previous button */}
          <Show when={canGoPrev()}>
            <button
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              aria-label={strings.lightboxPrevious}
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </Show>

          {/* Next button */}
          <Show when={canGoNext()}>
            <button
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              aria-label={strings.lightboxNext}
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </Show>

          {/* Image — `max-w/max-h` fit it, the transform zooms it from there */}
          <img
            ref={imageRef}
            src={safeUrl(currentImage()?.url ?? '', { allowDataImage: true })}
            alt={currentImage()?.alt || ''}
            srcset={currentImage()?.srcset}
            sizes={currentImage()?.sizes}
            class="max-w-[90vw] max-h-[90vh] object-contain"
            style={panZoom.contentStyle()}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDblClick={handleDoubleClick}
          />

          {/* Caption */}
          <Show when={currentImage()?.caption}>
            <div class="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg max-w-[80vw] text-center">
              {currentImage()!.caption}
            </div>
          </Show>

          {/* Counter */}
          <div class="absolute top-4 left-4 text-white/80 bg-black/40 px-3 py-1 rounded-full text-sm">
            {(props.selectedIndex ?? 0) + 1} / {props.images.length}
          </div>

          {/* Zoom controls — the pointer-only gestures made reachable by
              keyboard and touch. The wrapper swallows the click so the
              backdrop's close handler never sees it. */}
          <div
            class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              class="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              onClick={() => panZoom.zoomBy(1 / ZOOM_BUTTON_FACTOR)}
              disabled={panZoom.scale() <= panZoom.min}
              aria-label={strings.zoomOut}
              title={strings.zoomOut}
              type="button"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6"
                />
              </svg>
            </button>

            <span
              class="text-white/80 text-xs tabular-nums text-center min-w-[4rem]"
              aria-live="polite"
            >
              {formatMCPUIString(strings.zoomLevel, { percent: panZoom.percent() })}
            </span>

            <button
              class="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              onClick={() => panZoom.zoomBy(ZOOM_BUTTON_FACTOR)}
              disabled={panZoom.scale() >= panZoom.max}
              aria-label={strings.zoomIn}
              title={strings.zoomIn}
              type="button"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                />
              </svg>
            </button>

            {/* Only while there is something to reset — at 100% it would be a
                button that does nothing. */}
            <Show when={panZoom.isZoomed()}>
              <button
                class="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                onClick={() => panZoom.reset()}
                aria-label={strings.zoomReset}
                title={strings.zoomReset}
                type="button"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16.023 9.348h4.992V4.356m0 4.992l-3.181-3.183a8.25 8.25 0 00-13.803 3.7M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7"
                  />
                </svg>
              </button>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
