/**
 * `createPanZoom` — the maths and the gesture state machine (v6.22.0).
 *
 * The assertion this file exists for is the anchoring one: after a wheel
 * zoom, the pixel that was under the cursor is still under the cursor. Every
 * other behaviour here (clamping, the snap back to `min`, the drag flag the
 * lightbox reads to keep a drag from closing it) is cheap to get wrong in a
 * way only a user would notice, so it is pinned too.
 */

import { describe, it, expect, vi } from 'vitest'
import { createEffect, createRoot, createSignal, type Setter } from 'solid-js'
import {
  clampScale,
  contentPointAt,
  createPanZoom,
  viewportPointOf,
  zoomAtAnchor,
  type PanZoomController,
  type PanZoomPoint,
  type PanZoomState,
} from './pan-zoom'

// ─── Fakes ──────────────────────────────────────────────────────────────

/**
 * An element that reports the rect a browser would report for
 * `transform: translate(x, y) scale(s)` with `transform-origin: 0 0`, i.e.
 * left = untransformed origin + translation, width = natural width × scale.
 * The controller recovers the untransformed origin from it, so a static stub
 * would make a sequence of zooms silently drift.
 */
const transformedElement = (
  origin: PanZoomPoint,
  size: { width: number; height: number },
  read: () => PanZoomState
) =>
  ({
    getBoundingClientRect: () => {
      const state = read()
      return {
        left: origin.x + state.x,
        top: origin.y + state.y,
        width: size.width * state.scale,
        height: size.height * state.scale,
      } as DOMRect
    },
  }) as unknown as HTMLElement

const wheel = (init: {
  deltaY: number
  deltaMode?: number
  clientX?: number
  clientY?: number
}) => {
  const event = {
    deltaY: init.deltaY,
    deltaMode: init.deltaMode ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    preventDefault: vi.fn(),
  }
  return { event: event as unknown as WheelEvent, preventDefault: event.preventDefault }
}

const pointer = (init: {
  clientX: number
  clientY: number
  pointerId?: number
  /** `'mouse'` unless said otherwise — a finger gets a looser drag budget. */
  pointerType?: string
  currentTarget?: unknown
}) =>
  ({
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'mouse',
    clientX: init.clientX,
    clientY: init.clientY,
    currentTarget: init.currentTarget ?? null,
    preventDefault: vi.fn(),
  }) as unknown as PointerEvent

/** Runs `body` inside a root and disposes it, mirroring a component lifetime. */
const withRoot = <T,>(body: (dispose: () => void) => T): T =>
  createRoot((dispose) => {
    const result = body(dispose)
    dispose()
    return result
  })

// ─── Pure maths ─────────────────────────────────────────────────────────

describe('contentPointAt / viewportPointOf', () => {
  const states: PanZoomState[] = [
    { scale: 1, x: 0, y: 0 },
    { scale: 2.5, x: -120, y: 40 },
    { scale: 0.5, x: 33.3, y: -7.75 },
  ]

  it.each(states)('round-trips a point through %o', (state) => {
    const viewport = { x: 137, y: -42 }
    const content = contentPointAt(state, viewport)
    expect(viewportPointOf(state, content).x).toBeCloseTo(viewport.x, 10)
    expect(viewportPointOf(state, content).y).toBeCloseTo(viewport.y, 10)
  })

  it('maps the content origin to the translation itself', () => {
    expect(viewportPointOf({ scale: 3, x: 12, y: -5 }, { x: 0, y: 0 })).toEqual({ x: 12, y: -5 })
  })
})

describe('zoomAtAnchor — the anchored point never moves', () => {
  const cases: Array<{ state: PanZoomState; next: number; anchor: PanZoomPoint }> = [
    { state: { scale: 1, x: 0, y: 0 }, next: 2, anchor: { x: 300, y: 200 } },
    { state: { scale: 1, x: 0, y: 0 }, next: 8, anchor: { x: 0, y: 0 } },
    { state: { scale: 2, x: -150, y: -90 }, next: 4, anchor: { x: 17, y: 421 } },
    { state: { scale: 4, x: -640, y: 220 }, next: 1.3, anchor: { x: -55, y: -12 } },
    { state: { scale: 3.7, x: 12.5, y: -8.25 }, next: 3.70001, anchor: { x: 640, y: 360 } },
  ]

  it.each(cases)('scale $state.scale → $next around $anchor', ({ state, next, anchor }) => {
    // The pixel of the content that the anchor is pointing at, before.
    const content = contentPointAt(state, anchor)
    const zoomed = zoomAtAnchor(state, next, anchor)
    // …is still projected onto the anchor, after.
    const after = viewportPointOf(zoomed, content)
    expect(after.x).toBeCloseTo(anchor.x, 9)
    expect(after.y).toBeCloseTo(anchor.y, 9)
    expect(zoomed.scale).toBe(next)
  })

  it('is the identity when the scale does not change', () => {
    const state = { scale: 2.25, x: -40, y: 18 }
    const zoomed = zoomAtAnchor(state, 2.25, { x: 90, y: 90 })
    expect(zoomed.x).toBeCloseTo(state.x, 10)
    expect(zoomed.y).toBeCloseTo(state.y, 10)
  })

  it('keeps every other content point on the same side of the anchor', () => {
    // A sanity check that the transform is a zoom and not a mirror: distances
    // from the anchor grow by exactly the scale ratio.
    const state = { scale: 1, x: 0, y: 0 }
    const anchor = { x: 200, y: 100 }
    const zoomed = zoomAtAnchor(state, 3, anchor)
    const before = viewportPointOf(state, { x: 250, y: 100 })
    const after = viewportPointOf(zoomed, { x: 250, y: 100 })
    expect(after.x - anchor.x).toBeCloseTo((before.x - anchor.x) * 3, 9)
  })
})

describe('clampScale', () => {
  it('clamps to both bounds', () => {
    expect(clampScale(0.2, 1, 8)).toBe(1)
    expect(clampScale(99, 1, 8)).toBe(8)
    expect(clampScale(3, 1, 8)).toBe(3)
  })

  it('resolves NaN to the minimum and infinities to the nearer bound', () => {
    expect(clampScale(Number.NaN, 1, 8)).toBe(1)
    expect(clampScale(Number.POSITIVE_INFINITY, 1, 8)).toBe(8)
    expect(clampScale(Number.NEGATIVE_INFINITY, 1, 8)).toBe(1)
  })
})

// ─── Controller — scale ─────────────────────────────────────────────────

describe('createPanZoom — initial state', () => {
  it('starts at min scale, no offset, not zoomed', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      expect(panZoom.scale()).toBe(1)
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
      expect(panZoom.state()).toEqual({ scale: 1, x: 0, y: 0 })
      expect(panZoom.isZoomed()).toBe(false)
      expect(panZoom.isPanning()).toBe(false)
      expect(panZoom.wasDragged()).toBe(false)
      expect(panZoom.percent()).toBe(100)
      expect(panZoom.min).toBe(1)
      expect(panZoom.max).toBe(8)
      expect(panZoom.transform()).toBe('translate(0px, 0px) scale(1)')
      expect(panZoom.cursor()).toBe('auto')
    })
  })

  it('honours custom bounds and never lets max fall under min', () => {
    withRoot(() => {
      expect(createPanZoom({ min: 0.5, max: 3 }).min).toBe(0.5)
      expect(createPanZoom({ min: 2, max: 1 }).max).toBe(2)
    })
  })
})

describe('createPanZoom — zoomBy / zoomTo / reset', () => {
  it('multiplies the scale and clamps at both ends', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      expect(panZoom.scale()).toBe(2)
      expect(panZoom.percent()).toBe(200)
      expect(panZoom.isZoomed()).toBe(true)
      panZoom.zoomBy(100)
      expect(panZoom.scale()).toBe(8)
      panZoom.zoomBy(0.001)
      expect(panZoom.scale()).toBe(1)
    })
  })

  it('ignores a factor that is not a positive number', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(0)
      panZoom.zoomBy(-2)
      panZoom.zoomBy(Number.NaN)
      expect(panZoom.scale()).toBe(1)
    })
  })

  it('zooms about the content origin when no element can be measured', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(4)
      expect(panZoom.state()).toEqual({ scale: 4, x: 0, y: 0 })
    })
  })

  it('zooms about the element centre from a toolbar button', () => {
    withRoot(() => {
      let state: PanZoomState = { scale: 1, x: 0, y: 0 }
      const element = transformedElement({ x: 100, y: 50 }, { width: 400, height: 300 }, () => state)
      const panZoom = createPanZoom({ target: () => element })
      state = panZoom.state()
      // The centre of the element's own box before the zoom…
      const centre = viewportPointOf(state, { x: 200, y: 150 })
      panZoom.zoomBy(2)
      // …is still where it was.
      const after = viewportPointOf(panZoom.state(), { x: 200, y: 150 })
      expect(after.x).toBeCloseTo(centre.x, 9)
      expect(after.y).toBeCloseTo(centre.y, 9)
    })
  })

  it('snaps the offset back to zero when the scale returns to min', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomTo(4, { x: 500, y: 300 })
      expect(panZoom.offset()).not.toEqual({ x: 0, y: 0 })
      panZoom.zoomTo(0.25, { x: 500, y: 300 })
      expect(panZoom.state()).toEqual({ scale: 1, x: 0, y: 0 })
      expect(panZoom.isZoomed()).toBe(false)
    })
  })

  it('reset() returns to min scale and zero offset', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomTo(5, { x: 120, y: 90 })
      panZoom.reset()
      expect(panZoom.state()).toEqual({ scale: 1, x: 0, y: 0 })
      expect(panZoom.transform()).toBe('translate(0px, 0px) scale(1)')
    })
  })

  it('does nothing when the target scale is the current one', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomTo(8, { x: 10, y: 10 })
      const settled = panZoom.state()
      panZoom.zoomTo(12, { x: 999, y: 999 })
      expect(panZoom.state()).toEqual(settled)
    })
  })
})

// ─── Controller — wheel ─────────────────────────────────────────────────

describe('createPanZoom — wheel zoom', () => {
  it('zooms in on a negative delta, out on a positive one, and takes the event', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      const zoomIn = wheel({ deltaY: -100 })
      panZoom.onWheel(zoomIn.event)
      expect(zoomIn.preventDefault).toHaveBeenCalled()
      expect(panZoom.scale()).toBeGreaterThan(1)

      const zoomed = panZoom.scale()
      const zoomOut = wheel({ deltaY: 50 })
      panZoom.onWheel(zoomOut.event)
      expect(panZoom.scale()).toBeLessThan(zoomed)
    })
  })

  it('is symmetric — a notch back undoes a notch forward', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.onWheel(wheel({ deltaY: -100 }).event)
      panZoom.onWheel(wheel({ deltaY: -100 }).event)
      const twoNotches = panZoom.scale()
      panZoom.onWheel(wheel({ deltaY: 100 }).event)
      expect(panZoom.scale()).toBeCloseTo(twoNotches / Math.exp(100 * 0.0015), 9)
    })
  })

  it('normalises deltaMode — one line notch moves less than one page notch', () => {
    const scaleAfter = (deltaMode: number) =>
      withRoot(() => {
        const panZoom = createPanZoom()
        panZoom.onWheel(wheel({ deltaY: -1, deltaMode }).event)
        return panZoom.scale()
      })
    expect(scaleAfter(0)).toBeLessThan(scaleAfter(1))
    expect(scaleAfter(1)).toBeLessThan(scaleAfter(2))
  })

  it('ignores a zero delta', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.onWheel(wheel({ deltaY: 0 }).event)
      expect(panZoom.scale()).toBe(1)
    })
  })

  it('does not zoom when min and max are the same', () => {
    withRoot(() => {
      const panZoom = createPanZoom({ min: 1, max: 1 })
      const event = wheel({ deltaY: -400 })
      panZoom.onWheel(event.event)
      expect(panZoom.scale()).toBe(1)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  it('keeps the pixel under the cursor under the cursor, over a whole gesture', () => {
    withRoot(() => {
      const origin = { x: 100, y: 50 }
      let state: PanZoomState = { scale: 1, x: 0, y: 0 }
      const element = transformedElement(origin, { width: 400, height: 300 }, () => state)
      const panZoom = createPanZoom({ target: () => element })
      state = panZoom.state()

      // The cursor sits still, 220px right and 130px down from the element's
      // untransformed top-left corner — a viewport point, by definition.
      const cursor = { clientX: origin.x + 220, clientY: origin.y + 130 }
      const anchor = { x: 220, y: 130 }
      const pixel = contentPointAt(panZoom.state(), anchor)

      for (const deltaY of [-100, -100, -240, 100, -60, 100, 100]) {
        panZoom.onWheel(wheel({ deltaY, ...cursor }).event)
        state = panZoom.state()
        if (!panZoom.isZoomed()) continue // the snap back to min is not an anchored zoom
        const shown = viewportPointOf(state, pixel)
        expect(shown.x).toBeCloseTo(anchor.x, 6)
        expect(shown.y).toBeCloseTo(anchor.y, 6)
      }
      expect(panZoom.isZoomed()).toBe(true)
    })
  })

  it('anchors on the handler\'s own element when no target is given', () => {
    withRoot(() => {
      let state: PanZoomState = { scale: 1, x: 0, y: 0 }
      const element = transformedElement({ x: 0, y: 0 }, { width: 200, height: 200 }, () => state)
      const panZoom = createPanZoom()
      const event = wheel({ deltaY: -100, clientX: 200, clientY: 0 })
      ;(event.event as unknown as { currentTarget: unknown }).currentTarget = element
      panZoom.onWheel(event.event)
      state = panZoom.state()
      // Zooming in around the right edge pushes the content left.
      expect(state.scale).toBeGreaterThan(1)
      expect(state.x).toBeLessThan(0)
      expect(viewportPointOf(state, contentPointAt({ scale: 1, x: 0, y: 0 }, { x: 200, y: 0 })).x).toBeCloseTo(200, 6)
    })
  })
})

// ─── Controller — drag pan ──────────────────────────────────────────────

/** Drives one full pointer gesture through the controller. */
const drag = (
  panZoom: PanZoomController,
  from: PanZoomPoint,
  to: PanZoomPoint,
  currentTarget?: unknown
) => {
  panZoom.onPointerDown(pointer({ clientX: from.x, clientY: from.y, currentTarget }))
  panZoom.onPointerMove(pointer({ clientX: to.x, clientY: to.y, currentTarget }))
  panZoom.onPointerUp(pointer({ clientX: to.x, clientY: to.y, currentTarget }))
}

describe('createPanZoom — drag pan', () => {
  it('does not pan while the surface is at min scale', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      expect(panZoom.isPanning()).toBe(false)
      panZoom.onPointerMove(pointer({ clientX: 200, clientY: 200 }))
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
      expect(panZoom.cursor()).toBe('auto')
    })
  })

  it('still flags a drag across an unzoomed surface', () => {
    withRoot(() => {
      // The lightbox backdrop closes on click; a drag that merely ended there
      // must not, whether or not the image happened to be zoomed.
      const panZoom = createPanZoom()
      drag(panZoom, { x: 0, y: 0 }, { x: 200, y: 200 })
      expect(panZoom.wasDragged()).toBe(true)
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
    })
  })

  it('leaves an unzoomed pointerdown alone — no capture, no preventDefault', () => {
    withRoot(() => {
      const element = { setPointerCapture: vi.fn() }
      const panZoom = createPanZoom()
      const event = pointer({ clientX: 0, clientY: 0, currentTarget: element })
      panZoom.onPointerDown(event)
      expect(element.setPointerCapture).not.toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  it('adds the pointer travel to the offset once zoomed', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(3)
      const before = panZoom.offset()
      panZoom.onPointerDown(pointer({ clientX: 100, clientY: 100 }))
      expect(panZoom.isPanning()).toBe(true)
      expect(panZoom.cursor()).toBe('grabbing')
      panZoom.onPointerMove(pointer({ clientX: 140, clientY: 70 }))
      expect(panZoom.offset()).toEqual({ x: before.x + 40, y: before.y - 30 })
      panZoom.onPointerUp(pointer({ clientX: 140, clientY: 70 }))
      expect(panZoom.isPanning()).toBe(false)
      expect(panZoom.cursor()).toBe('grab')
    })
  })

  it('does not accumulate across moves — the offset is always start + travel', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      panZoom.onPointerMove(pointer({ clientX: 10, clientY: 10 }))
      panZoom.onPointerMove(pointer({ clientX: 30, clientY: 5 }))
      expect(panZoom.offset()).toEqual({ x: 30, y: 5 })
    })
  })

  it('ignores a second pointer mid-gesture', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0, pointerId: 1 }))
      panZoom.onPointerMove(pointer({ clientX: 500, clientY: 500, pointerId: 2 }))
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
      panZoom.onPointerUp(pointer({ clientX: 0, clientY: 0, pointerId: 2 }))
      expect(panZoom.isPanning()).toBe(true)
    })
  })

  it('flags a real drag and keeps the flag until the next pointerdown', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      drag(panZoom, { x: 0, y: 0 }, { x: 80, y: 0 })
      // The click that follows the drag must be ignorable by the backdrop.
      expect(panZoom.wasDragged()).toBe(true)
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      expect(panZoom.wasDragged()).toBe(false)
    })
  })

  it('does not flag a click that only jitters', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      drag(panZoom, { x: 0, y: 0 }, { x: 1, y: 1 })
      expect(panZoom.wasDragged()).toBe(false)
    })
  })

  it('clears the flag on a pointerdown that cannot pan', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      drag(panZoom, { x: 0, y: 0 }, { x: 80, y: 0 })
      panZoom.reset()
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      expect(panZoom.wasDragged()).toBe(false)
    })
  })

  it('ends the gesture on pointercancel', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      panZoom.onPointerCancel(pointer({ clientX: 0, clientY: 0 }))
      expect(panZoom.isPanning()).toBe(false)
      panZoom.onPointerMove(pointer({ clientX: 300, clientY: 0 }))
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
    })
  })
})

describe('createPanZoom — pointer capture', () => {
  const captureStub = () => {
    const captured = new Set<number>()
    const element = {
      setPointerCapture: vi.fn((id: number) => captured.add(id)),
      releasePointerCapture: vi.fn((id: number) => captured.delete(id)),
      hasPointerCapture: vi.fn((id: number) => captured.has(id)),
    }
    return { element, captured }
  }

  it('captures on pointerdown and releases on pointerup', () => {
    withRoot(() => {
      const { element, captured } = captureStub()
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      drag(panZoom, { x: 0, y: 0 }, { x: 40, y: 0 }, element)
      expect(element.setPointerCapture).toHaveBeenCalledWith(1)
      expect(element.releasePointerCapture).toHaveBeenCalledWith(1)
      expect(captured.size).toBe(0)
    })
  })

  it('releases a capture still held when the component goes away', () => {
    const { element, captured } = captureStub()
    createRoot((dispose) => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 0, clientY: 0, currentTarget: element }))
      expect(captured.has(1)).toBe(true)
      dispose()
    })
    expect(captured.size).toBe(0)
  })

  it('pans even when the environment refuses the capture', () => {
    withRoot(() => {
      const element = {
        setPointerCapture: () => {
          throw new Error('NotFoundError')
        },
      }
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      drag(panZoom, { x: 0, y: 0 }, { x: 25, y: 15 }, element)
      expect(panZoom.offset()).toEqual({ x: 25, y: 15 })
    })
  })
})

// ─── Controller — styles and reactivity ─────────────────────────────────

describe('createPanZoom — styles', () => {
  it('pins the transform-origin the maths depends on', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      expect(panZoom.contentStyle()['transform-origin']).toBe('0 0')
      expect(panZoom.contentStyle()['will-change']).toBe('auto')
      panZoom.zoomBy(2)
      expect(panZoom.contentStyle().transform).toBe('translate(0px, 0px) scale(2)')
      expect(panZoom.contentStyle()['will-change']).toBe('transform')
    })
  })

  it('offers the surface a grab cursor and no native touch gestures', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      expect(panZoom.surfaceStyle()).toEqual({ cursor: 'auto', 'touch-action': 'none' })
      panZoom.zoomBy(2)
      expect(panZoom.surfaceStyle().cursor).toBe('grab')
    })
  })
})

describe('createPanZoom — reactivity', () => {
  it('drives an effect that reads the scale', () => {
    const seen: number[] = []
    let panZoom!: PanZoomController
    const dispose = createRoot((d) => {
      panZoom = createPanZoom()
      createEffect(() => seen.push(panZoom.scale()))
      return d
    })
    expect(seen).toEqual([1])
    panZoom.zoomBy(2)
    expect(seen).toEqual([1, 2])
    dispose()
  })

  it('never subscribes a caller effect to its own zoom writes', () => {
    // The lightbox resets the zoom from an effect keyed on the shown image. If
    // the controller read its signals reactively, that effect would re-run on
    // every wheel notch and fight the user.
    let runs = 0
    let panZoom!: PanZoomController
    let setImage!: Setter<number>
    const dispose = createRoot((d) => {
      const [image, setImageIndex] = createSignal(0)
      setImage = setImageIndex
      panZoom = createPanZoom()
      createEffect(() => {
        image()
        runs++
        panZoom.zoomTo(2)
      })
      return d
    })

    expect(runs).toBe(1)
    panZoom.zoomBy(1.5)
    expect(runs).toBe(1)
    expect(panZoom.scale()).toBe(3)

    setImage(1)
    expect(runs).toBe(2)
    expect(panZoom.scale()).toBe(2)
    dispose()
  })
})

// ─── Controller — the click / drag threshold ────────────────────────────

describe('createPanZoom — telling a tap from a drag', () => {
  /** Press, wobble by `(dx, dy)`, release: a tap that did not quite hold still. */
  const wobble = (panZoom: PanZoomController, dx: number, dy: number, pointerType: string) => {
    panZoom.onPointerDown(pointer({ clientX: 200, clientY: 200, pointerType }))
    panZoom.onPointerMove(pointer({ clientX: 200 + dx, clientY: 200 + dy, pointerType }))
    panZoom.onPointerUp(pointer({ clientX: 200 + dx, clientY: 200 + dy, pointerType }))
  }

  it('lets a finger roll as far as the platform lets it before calling it a drag', () => {
    withRoot(() => {
      // A tap's contact centroid moves several px between press and lift, and
      // browsers allow of the order of 10px before they cancel the tap's
      // `click`. On the mouse's budget this tap would be charged as a drag and
      // the lightbox backdrop would refuse to close on it.
      const panZoom = createPanZoom()
      wobble(panZoom, 4, 4, 'touch')
      expect(panZoom.wasDragged()).toBe(false)
    })
  })

  it('still calls a real finger drag a drag', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      wobble(panZoom, 12, 0, 'touch')
      expect(panZoom.wasDragged()).toBe(true)
    })
  })

  it('holds a mouse to its own, much tighter budget', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      wobble(panZoom, 4, 4, 'mouse')
      expect(panZoom.wasDragged()).toBe(true)
    })
  })

  it('measures travel as a distance, not as a sum of the two axes', () => {
    withRoot(() => {
      // 2px on each axis is 2.83px of travel, inside the 3px budget; summing
      // the axes scores it 4 and turns a diagonal jitter into a drag.
      const panZoom = createPanZoom()
      wobble(panZoom, 2, 2, 'mouse')
      expect(panZoom.wasDragged()).toBe(false)
    })
  })
})

// ─── Controller — surfaces that disappear mid-gesture ───────────────────

describe('createPanZoom — a surface that goes away mid-gesture', () => {
  /** An element that can hold a pointer capture, and can leave the document. */
  const surfaceStub = () => {
    const captured = new Set<number>()
    return {
      isConnected: true,
      setPointerCapture: vi.fn((id: number) => captured.add(id)),
      releasePointerCapture: vi.fn((id: number) => captured.delete(id)),
      hasPointerCapture: vi.fn((id: number) => captured.has(id)),
      captured,
    }
  }

  it('cancelGesture ends the drag and hands the capture back, leaving the transform alone', () => {
    withRoot(() => {
      const element = surfaceStub()
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 100, clientY: 100, currentTarget: element }))
      expect(panZoom.isPanning()).toBe(true)

      panZoom.cancelGesture()

      expect(panZoom.isPanning()).toBe(false)
      expect(panZoom.cursor()).toBe('grab')
      expect(element.captured.size).toBe(0)
      // The zoom belongs to the user, not to the gesture that was cancelled.
      expect(panZoom.scale()).toBe(2)
    })
  })

  it('forgets the contact as well, so the next press is a press and not half a pinch', () => {
    withRoot(() => {
      const element = surfaceStub()
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 100, clientY: 100, currentTarget: element }))
      panZoom.cancelGesture()

      // A contact left behind would make this single press look like a SECOND
      // finger and start a pinch against a phantom first one.
      panZoom.onPointerDown(
        pointer({ clientX: 300, clientY: 300, pointerId: 2, currentTarget: element })
      )
      panZoom.onPointerMove(
        pointer({ clientX: 340, clientY: 300, pointerId: 2, currentTarget: element })
      )

      expect(panZoom.scale()).toBe(2)
      expect(panZoom.offset()).toEqual({ x: 40, y: 0 })
    })
  })

  it('drops the gesture by itself once its surface has left the document', () => {
    withRoot(() => {
      const element = surfaceStub()
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 100, clientY: 100, currentTarget: element }))

      // The `<Show>` around the surface disposed: the real `pointerup` is
      // delivered to whatever is underneath and never reaches these handlers.
      element.isConnected = false
      panZoom.onPointerMove(pointer({ clientX: 400, clientY: 400, currentTarget: element }))

      expect(panZoom.isPanning()).toBe(false)
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
    })
  })

  it('stops panning when the zoom is reset out from under the gesture', () => {
    withRoot(() => {
      const panZoom = createPanZoom()
      panZoom.zoomBy(2)
      panZoom.onPointerDown(pointer({ clientX: 100, clientY: 100 }))
      panZoom.onPointerMove(pointer({ clientX: 140, clientY: 100 }))
      expect(panZoom.offset()).toEqual({ x: 40, y: 0 })

      // The `0` key, or the reset button, while the button is still down.
      panZoom.reset()
      panZoom.onPointerMove(pointer({ clientX: 300, clientY: 100 }))

      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
    })
  })
})

// ─── Controller — pinch ─────────────────────────────────────────────────

describe('createPanZoom — pinch', () => {
  /**
   * A controller pointed at an element whose untransformed corner is the
   * client origin, so a client point IS its own viewport point — the same
   * simplification jsdom's zero rect gives the lightbox tests. The rect is
   * read once, when a pinch starts and the controller is still at `min`.
   */
  const pinchable = () =>
    createPanZoom({
      target: () =>
        transformedElement({ x: 0, y: 0 }, { width: 400, height: 300 }, () => ({
          scale: 1,
          x: 0,
          y: 0,
        })),
    })

  /** One finger, at `x` on the y = 100 line. */
  const finger = (pointerId: number, x: number) =>
    pointer({ clientX: x, clientY: 100, pointerId, pointerType: 'touch' })

  /** Two fingers 100px apart, straddling x = 150. */
  const twoDown = (panZoom: PanZoomController) => {
    panZoom.onPointerDown(finger(1, 100))
    panZoom.onPointerDown(finger(2, 200))
  }

  it('zooms from the fitted size — the gesture `touch-action: none` takes from the browser', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      // 100px apart → 200px apart: twice the scale. Note nothing zoomed first;
      // a pinch is how a touch user gets INTO the zoom at all, which is why
      // it cannot be gated on `isZoomed()` the way the one-finger drag is.
      panZoom.onPointerMove(finger(2, 300))

      expect(panZoom.scale()).toBeCloseTo(2, 10)
    })
  })

  it('keeps the pixel under the fingers under the fingers', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      const content = contentPointAt({ scale: 1, x: 0, y: 0 }, { x: 150, y: 100 })

      // Spread AND slide: the midpoint moves from 150 to 200.
      panZoom.onPointerMove(finger(2, 300))

      const after = viewportPointOf(panZoom.state(), content)
      expect(after.x).toBeCloseTo(200, 6)
      expect(after.y).toBeCloseTo(100, 6)
    })
  })

  it('snaps back to the fitted frame when the fingers come together again', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      panZoom.onPointerMove(finger(2, 300))
      panZoom.onPointerMove(finger(2, 200))

      // Recomputed from the start of the pinch every move, so going out and
      // back lands exactly where it began rather than drifting.
      expect(panZoom.scale()).toBe(1)
      expect(panZoom.offset()).toEqual({ x: 0, y: 0 })
    })
  })

  it('is never the click that closes a backdrop', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)

      expect(panZoom.wasDragged()).toBe(true)
    })
  })

  it('hands the surviving finger back to the drag when the other lifts', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      panZoom.onPointerMove(finger(2, 300))
      const zoomed = panZoom.offset()

      panZoom.onPointerUp(finger(1, 100))
      expect(panZoom.isPanning()).toBe(true)

      // …and it pans from where it IS, not from where it went down, so the
      // image does not jump under a finger that never left the glass.
      panZoom.onPointerMove(finger(2, 350))
      expect(panZoom.offset()).toEqual({ x: zoomed.x + 50, y: zoomed.y })

      panZoom.onPointerUp(finger(2, 350))
      expect(panZoom.isPanning()).toBe(false)
    })
  })

  it('stops rather than pinch on an arbitrary pair when a third finger lands', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      panZoom.onPointerMove(finger(2, 300))
      const frozen = panZoom.state()

      panZoom.onPointerDown(finger(3, 500))
      panZoom.onPointerMove(finger(3, 600))

      expect(panZoom.isPanning()).toBe(false)
      expect(panZoom.state()).toEqual(frozen)
    })
  })

  it('clamps at the configured maximum', () => {
    withRoot(() => {
      const panZoom = pinchable()
      twoDown(panZoom)
      panZoom.onPointerMove(finger(2, 5000))

      expect(panZoom.scale()).toBe(8)
    })
  })
})
