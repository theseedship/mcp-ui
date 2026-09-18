/**
 * LightboxOverlay — zoom & pan (v6.22.0).
 *
 * The overlay is the one surface in the library that owns the whole viewport,
 * so it is also the one where the wheel is allowed to zoom instead of scroll.
 * What this file pins down is the seam between that new gesture layer and the
 * navigation that was already there: the backdrop still closes on a click but
 * must not close at the end of a drag, the arrows still navigate but must not
 * pull the picture out of a hand that is panning it, and every image opens at
 * 100% however the previous one was left.
 *
 * The overlay renders through a `<Portal>`, so everything is queried from
 * `document`, not from the render container.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSignal } from 'solid-js'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { LightboxOverlay } from './LightboxOverlay'
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext'
import type { GalleryImage } from '../types'

const images: GalleryImage[] = [
  { url: 'https://example.com/1.jpg', alt: 'One' },
  { url: 'https://example.com/2.jpg', alt: 'Two' },
  { url: 'https://example.com/3.jpg', alt: 'Three' },
]

// ─── Queries ────────────────────────────────────────────────────────────

const backdrop = () => document.querySelector('[role="dialog"]') as HTMLElement
const image = () => document.querySelector('[role="dialog"] img') as HTMLImageElement
const labelled = (label: string) =>
  document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | null

/** The scale currently applied to the image, read back off the transform. */
const scale = () => {
  const match = /scale\(([-\d.e+]+)\)/.exec(image().style.transform)
  return match ? Number(match[1]) : NaN
}

/** The translation currently applied to the image. */
const translation = () => {
  const match = /translate\(([-\d.e+]+)px,\s*([-\d.e+]+)px\)/.exec(image().style.transform)
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN }
}

// ─── Gestures ───────────────────────────────────────────────────────────

/** One wheel notch on the backdrop. Negative `deltaY` zooms in. */
const wheel = (deltaY: number, at: { x: number; y: number } = { x: 400, y: 300 }) =>
  fireEvent.wheel(backdrop(), { deltaY, clientX: at.x, clientY: at.y })

/** A full press → move → release, as a browser would deliver it. */
const drag = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  target: HTMLElement = backdrop()
) => {
  fireEvent.pointerDown(target, { clientX: from.x, clientY: from.y, pointerId: 7 })
  fireEvent.pointerMove(target, { clientX: to.x, clientY: to.y, pointerId: 7 })
  fireEvent.pointerUp(target, { clientX: to.x, clientY: to.y, pointerId: 7 })
}

/** Zooms in far enough for panning to be allowed. */
const zoomIn = () => fireEvent.click(labelled('Zoom in') as HTMLElement)

describe('LightboxOverlay', () => {
  let onClose: ReturnType<typeof vi.fn>
  let onNavigate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose = vi.fn()
    onNavigate = vi.fn()
  })

  /** Mounts the overlay on an image index the test can move. */
  const mount = (index = 1) => {
    const [selected, setSelected] = createSignal<number | null>(index)
    render(() => (
      <LightboxOverlay
        images={images}
        selectedIndex={selected()}
        onClose={onClose}
        onNavigate={onNavigate}
      />
    ))
    return setSelected
  }

  describe('transform plumbing', () => {
    it('starts unzoomed, with the origin the anchoring maths requires', () => {
      mount()

      expect(scale()).toBe(1)
      expect(translation()).toEqual({ x: 0, y: 0 })
      // `transform-origin: 0 0` is not cosmetic: `createPanZoom` computes the
      // image's untransformed corner from the rendered rect assuming it.
      expect(image().style.getPropertyValue('transform-origin').replace(/px/g, '')).toBe('0 0')
      // (`touch-action: none`, the other half of `surfaceStyle`, is dropped by
      // jsdom's CSS parser as an unknown property — it is asserted on the
      // controller itself in `utils/pan-zoom.test.ts`.)
    })

    it('leaves the fitted layout classes alone so the unzoomed frame is unchanged', () => {
      mount()

      expect(image().className).toContain('max-w-[90vw]')
      expect(image().className).toContain('object-contain')
    })
  })

  describe('wheel', () => {
    it('zooms in on a negative delta and back out on a positive one', () => {
      mount()

      wheel(-100)
      const zoomed = scale()
      expect(zoomed).toBeGreaterThan(1)

      wheel(100)
      // Exponential and symmetric: one notch back undoes one notch forward.
      expect(scale()).toBeCloseTo(1, 10)
    })

    it('swallows the wheel event so the page cannot scroll under the overlay', () => {
      mount()

      // fireEvent returns false when the handler called preventDefault().
      expect(wheel(-100)).toBe(false)
    })

    it('keeps the point under the cursor under the cursor', () => {
      mount()

      // jsdom reports a zero rect, so the image's untransformed corner is the
      // viewport origin and a client point IS its own viewport point.
      const cursor = { x: 120, y: 90 }
      wheel(-100, cursor)

      const { x, y } = translation()
      const s = scale()
      // The content point that was under the cursor, mapped forward again.
      expect(x + s * cursor.x).toBeCloseTo(cursor.x, 6)
      expect(y + s * cursor.y).toBeCloseTo(cursor.y, 6)
    })

    it('clamps at 8x however long the user keeps scrolling', () => {
      mount()

      for (let i = 0; i < 100; i++) wheel(-100)

      expect(scale()).toBe(8)
    })

    it('snaps back to a centred frame when scrolled all the way out', () => {
      mount()

      wheel(-100, { x: 120, y: 90 })
      expect(translation().x).not.toBe(0)

      for (let i = 0; i < 20; i++) wheel(100)

      expect(scale()).toBe(1)
      expect(translation()).toEqual({ x: 0, y: 0 })
    })
  })

  describe('drag to pan', () => {
    it('pans the image while zoomed', () => {
      mount()
      zoomIn()

      drag({ x: 200, y: 200 }, { x: 260, y: 170 })

      expect(translation().x).toBe(60)
      expect(translation().y).toBe(-30)
    })

    it('does not pan while the image is fitted', () => {
      mount()

      drag({ x: 200, y: 200 }, { x: 260, y: 170 })

      expect(translation()).toEqual({ x: 0, y: 0 })
    })

    it('does NOT close the overlay when the drag ends on the backdrop', () => {
      mount()
      zoomIn()

      drag({ x: 200, y: 200 }, { x: 320, y: 240 })
      // The browser fires this click on the common ancestor of the press and
      // the release — the backdrop — once the gesture is over.
      fireEvent.click(backdrop())

      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not close on a drag that started unzoomed either', () => {
      mount()

      drag({ x: 200, y: 200 }, { x: 320, y: 240 })
      fireEvent.click(backdrop())

      expect(onClose).not.toHaveBeenCalled()
    })

    it('still closes on a click that did not move', () => {
      mount()
      zoomIn()

      // A press and a release in the same place is a click, not a drag.
      fireEvent.pointerDown(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      fireEvent.pointerUp(backdrop(), { clientX: 201, clientY: 200, pointerId: 7 })
      fireEvent.click(backdrop())

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes again on the next clean click after a drag', () => {
      mount()
      zoomIn()

      drag({ x: 200, y: 200 }, { x: 320, y: 240 })
      fireEvent.click(backdrop())
      expect(onClose).not.toHaveBeenCalled()

      fireEvent.pointerDown(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      fireEvent.pointerUp(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      fireEvent.click(backdrop())

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('shows a grab cursor while pannable and a grabbing one mid-drag', () => {
      mount()
      expect(backdrop().style.cursor).toBe('auto')

      zoomIn()
      expect(backdrop().style.cursor).toBe('grab')

      fireEvent.pointerDown(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      expect(backdrop().style.cursor).toBe('grabbing')

      fireEvent.pointerUp(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      expect(backdrop().style.cursor).toBe('grab')
    })

    it('does not start a gesture when the press lands on a control', () => {
      mount()
      zoomIn()

      // Pressing "next" must not arm a pan: the pan handler would take the
      // pointer capture and preventDefault the button's focus.
      fireEvent.pointerDown(labelled('Next image') as HTMLElement, {
        clientX: 900,
        clientY: 300,
        pointerId: 7,
      })

      expect(backdrop().style.cursor).toBe('grab')
    })
  })

  describe('double click', () => {
    it('toggles between fitted and 200%', () => {
      mount()

      fireEvent.dblClick(image(), { clientX: 100, clientY: 100 })
      expect(scale()).toBe(2)

      fireEvent.dblClick(image(), { clientX: 100, clientY: 100 })
      expect(scale()).toBe(1)
      expect(translation()).toEqual({ x: 0, y: 0 })
    })

    it('zooms at the point that was double-clicked', () => {
      mount()

      const cursor = { x: 150, y: 80 }
      fireEvent.dblClick(image(), { clientX: cursor.x, clientY: cursor.y })

      const { x, y } = translation()
      expect(x + 2 * cursor.x).toBeCloseTo(cursor.x, 6)
      expect(y + 2 * cursor.y).toBeCloseTo(cursor.y, 6)
    })

    it('does not close the overlay', () => {
      mount()

      fireEvent.dblClick(image(), { clientX: 100, clientY: 100 })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('keyboard', () => {
    it('zooms in on "+" and on "="', () => {
      mount()

      fireEvent.keyDown(document, { key: '=' })
      expect(scale()).toBeCloseTo(1.5, 10)

      fireEvent.keyDown(document, { key: '+' })
      expect(scale()).toBeCloseTo(2.25, 10)
    })

    it('zooms out on "-" and resets on "0"', () => {
      mount()

      fireEvent.keyDown(document, { key: '=' })
      fireEvent.keyDown(document, { key: '-' })
      expect(scale()).toBeCloseTo(1, 10)

      fireEvent.keyDown(document, { key: '=' })
      fireEvent.keyDown(document, { key: '0' })
      expect(scale()).toBe(1)
      expect(translation()).toEqual({ x: 0, y: 0 })
    })

    it('leaves the browser its own Ctrl/Cmd page zoom', () => {
      mount()

      fireEvent.keyDown(document, { key: '=', ctrlKey: true })
      fireEvent.keyDown(document, { key: '0', metaKey: true })

      expect(scale()).toBe(1)
    })

    it('still closes on Escape and navigates on the arrows', () => {
      mount(1)

      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(onNavigate).toHaveBeenLastCalledWith(0)

      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(onNavigate).toHaveBeenLastCalledWith(2)

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('navigates while zoomed — the new image simply opens fitted', () => {
      mount(1)
      zoomIn()

      fireEvent.keyDown(document, { key: 'ArrowRight' })

      expect(onNavigate).toHaveBeenCalledWith(2)
    })

    it('ignores the arrows while a pan is in flight', () => {
      mount(1)
      zoomIn()

      fireEvent.pointerDown(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      fireEvent.pointerMove(backdrop(), { clientX: 260, clientY: 200, pointerId: 7 })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(onNavigate).not.toHaveBeenCalled()

      fireEvent.pointerUp(backdrop(), { clientX: 260, clientY: 200, pointerId: 7 })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(onNavigate).toHaveBeenCalledWith(2)
    })
  })

  describe('image change', () => {
    it('resets the zoom when the displayed image changes', () => {
      const setSelected = mount(0)

      wheel(-100, { x: 120, y: 90 })
      expect(scale()).toBeGreaterThan(1)

      setSelected(1)

      expect(scale()).toBe(1)
      expect(translation()).toEqual({ x: 0, y: 0 })
    })

    it('resets the zoom when the overlay is closed and reopened', () => {
      const setSelected = mount(0)

      wheel(-100)
      expect(scale()).toBeGreaterThan(1)

      setSelected(null)
      expect(backdrop()).toBeNull()

      setSelected(0)
      expect(scale()).toBe(1)
    })
  })

  describe('gestures that outlive the surface', () => {
    it('does not carry a half-finished pan into the next time the overlay opens', () => {
      const setSelected = mount(0)
      zoomIn()

      // Press, drag, and close with the button still down. The backdrop lives
      // inside the `<Show>`, the controller does not — and `ImageGalleryRenderer`
      // never unmounts this component — so the backdrop is detached before its
      // `pointerup`, which the browser then delivers to whatever is underneath.
      fireEvent.pointerDown(backdrop(), { clientX: 200, clientY: 200, pointerId: 7 })
      fireEvent.pointerMove(backdrop(), { clientX: 260, clientY: 220, pointerId: 7 })
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
      setSelected(null)

      setSelected(0)

      // Nothing is being held, so the surface does not claim to be.
      expect(backdrop().style.cursor).toBe('auto')
      // The arrows are not swallowed by their "not while panning" guard…
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(onNavigate).toHaveBeenCalledWith(1)
      // …and a bare move over the reopened backdrop — a mouse reuses one
      // stable pointerId — does not pan a fitted image with no button down.
      fireEvent.pointerMove(backdrop(), { clientX: 400, clientY: 400, pointerId: 7 })
      expect(translation()).toEqual({ x: 0, y: 0 })
    })
  })

  describe('touch', () => {
    /** One finger, on the y = 100 line. */
    const finger = (pointerId: number, x: number) => ({
      pointerId,
      clientX: x,
      clientY: 100,
      pointerType: 'touch',
    })

    it('zooms on a two-finger pinch — the gesture `touch-action: none` takes from the browser', () => {
      mount()

      // The backdrop suppresses the UA's own pinch so that a one-finger drag
      // can pan; the library therefore owes the touch user this gesture back.
      fireEvent.pointerDown(backdrop(), finger(1, 100))
      fireEvent.pointerDown(backdrop(), finger(2, 200))
      fireEvent.pointerMove(backdrop(), finger(2, 300))

      expect(scale()).toBeCloseTo(2, 10)

      // And a pinch is never the click that dismisses the overlay.
      fireEvent.pointerUp(backdrop(), finger(2, 300))
      fireEvent.pointerUp(backdrop(), finger(1, 100))
      fireEvent.click(backdrop())
      expect(onClose).not.toHaveBeenCalled()
    })

    it('still closes on a tap that wobbled the way a finger does', () => {
      mount()

      // 4px on each axis: well inside what a browser itself forgives before
      // it cancels a tap's `click`, and the dismiss tap has to survive it.
      fireEvent.pointerDown(backdrop(), {
        clientX: 200,
        clientY: 200,
        pointerId: 3,
        pointerType: 'touch',
      })
      fireEvent.pointerMove(backdrop(), {
        clientX: 204,
        clientY: 204,
        pointerId: 3,
        pointerType: 'touch',
      })
      fireEvent.pointerUp(backdrop(), {
        clientX: 204,
        clientY: 204,
        pointerId: 3,
        pointerType: 'touch',
      })
      fireEvent.click(backdrop())

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('keys that belong to the host page', () => {
    /**
     * A text field of the HOST, focused while the overlay is open. That is
     * reachable: the overlay traps no focus and its `<Portal>` content is
     * appended after the host, so `Tab` from the thumbnail that opened it
     * walks on into the page — a chat composer, typically.
     */
    const withHostInput = (body: (input: HTMLInputElement) => void) => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      try {
        input.focus()
        body(input)
      } finally {
        input.remove()
      }
    }

    it('leaves the characters typed into a host text field alone', () => {
      mount()
      zoomIn()
      const zoomed = scale()

      withHostInput((input) => {
        for (const key of ['-', '0', '+', '=']) {
          // `false` would mean the overlay called preventDefault() and the
          // character never reached the field — typing a date would zoom the
          // photo and leave the composer holding `226918`.
          expect(fireEvent.keyDown(input, { key })).toBe(true)
        }

        expect(scale()).toBe(zoomed)
      })
    })

    it('leaves the arrows to the caret, and keeps Escape global', () => {
      mount(1)

      withHostInput((input) => {
        fireEvent.keyDown(input, { key: 'ArrowRight' })
        expect(onNavigate).not.toHaveBeenCalled()

        // Escape produces no character, and dismissing the modal is what it
        // is for — it worked from anywhere before the zoom keys existed.
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('still honours the zoom keys everywhere else', () => {
      mount()

      fireEvent.keyDown(document.body, { key: '=' })
      expect(scale()).toBeCloseTo(1.5, 10)
    })
  })

  describe('zoom controls', () => {
    it('renders the level readout and keeps it in step', () => {
      mount()
      const readout = () => backdrop().querySelector('[aria-live="polite"]')?.textContent

      expect(readout()).toBe('Zoom 100%')

      zoomIn()
      expect(readout()).toBe('Zoom 150%')
    })

    it('disables zoom out at the fitted size and zoom in at the maximum', () => {
      mount()

      expect((labelled('Zoom out') as HTMLButtonElement).disabled).toBe(true)
      expect((labelled('Zoom in') as HTMLButtonElement).disabled).toBe(false)

      for (let i = 0; i < 100; i++) wheel(-100)

      expect((labelled('Zoom out') as HTMLButtonElement).disabled).toBe(false)
      expect((labelled('Zoom in') as HTMLButtonElement).disabled).toBe(true)
    })

    it('zooms out again through the button', () => {
      mount()

      zoomIn()
      fireEvent.click(labelled('Zoom out') as HTMLElement)

      expect(scale()).toBeCloseTo(1, 10)
    })

    it('offers the reset button only while there is something to reset', () => {
      mount()
      expect(labelled('Reset zoom')).toBeNull()

      zoomIn()
      expect(labelled('Reset zoom')).not.toBeNull()

      fireEvent.click(labelled('Reset zoom') as HTMLElement)
      expect(scale()).toBe(1)
      expect(labelled('Reset zoom')).toBeNull()
    })

    it('does not close the overlay when a control is used', () => {
      mount()

      zoomIn()
      fireEvent.click(labelled('Reset zoom') as HTMLElement)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('localizes every zoom control through the strings provider', () => {
      cleanup()
      const [selected] = createSignal<number | null>(0)
      render(() => (
        <MCPUIStringsProvider
          strings={{
            zoomIn: 'Agrandir',
            zoomOut: 'Réduire',
            zoomReset: 'Taille réelle',
            zoomLevel: 'Zoom {percent} %',
          }}
        >
          <LightboxOverlay
            images={images}
            selectedIndex={selected()}
            onClose={onClose}
            onNavigate={onNavigate}
          />
        </MCPUIStringsProvider>
      ))

      expect(labelled('Agrandir')?.title).toBe('Agrandir')
      expect(labelled('Réduire')).not.toBeNull()
      expect(backdrop().querySelector('[aria-live="polite"]')?.textContent).toBe('Zoom 100 %')

      fireEvent.click(labelled('Agrandir') as HTMLElement)
      expect(labelled('Taille réelle')).not.toBeNull()
    })
  })
})
