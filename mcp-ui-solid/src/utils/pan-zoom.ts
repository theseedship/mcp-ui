/**
 * `createPanZoom` — cursor-anchored zoom + drag-pan for one CSS-transformed
 * element. Dependency-free, SSR-safe.
 *
 * @since v6.22.0
 *
 * ## Why a primitive and not a library
 *
 * The surfaces that need this (the image lightbox, the expanded modal) already
 * own their viewport and their own event wiring; what they lack is the small
 * amount of arithmetic that keeps the point under the cursor *under the
 * cursor* while the scale changes. A pan/zoom library would bring its own
 * DOM ownership, its own listeners and its own lifecycle into a tree where
 * `ExpandableWrapper` physically reparents nodes between an inline slot and a
 * modal slot — so this module owns numbers only, never nodes: it holds a
 * scale + a translation and hands them back as one `transform` string. It
 * attaches no listener of its own; the caller binds the handlers in JSX,
 * which is what makes it survive a reparent.
 *
 * ## The contract with the DOM
 *
 * The element that carries the `transform` MUST also carry
 * `transform-origin: 0 0` — {@link PanZoomController.contentStyle} sets both,
 * and the anchoring maths assumes it. With that origin, `translate(t) scale(s)`
 * maps a point `p` of the element's own (untransformed) coordinate space to
 * `t + s·p`, measured from the element's untransformed top-left corner. The
 * two spaces this module talks about are therefore:
 *
 * - a **content point** — px from that corner, in the element's own
 *   untransformed space. It names a pixel of the image/chart/graph itself and
 *   does not move when the user zooms.
 * - a **viewport point** — px from that same corner, in the *parent's*
 *   unscaled space. `event.clientX - originX` is one. It names a place on
 *   screen and does not move when the user zooms.
 *
 * Zooming "at the cursor" is then one line: take the content point currently
 * under a viewport point, and choose the translation that puts it back under
 * the same viewport point at the new scale ({@link zoomAtAnchor}).
 *
 * ## Gestures
 *
 * One pointer drags (only while zoomed — at the fitted size there is nothing
 * to move); two pointers pinch. The pinch is served here rather than left to
 * the browser because the surface must set `touch-action: none` for the
 * one-finger drag to work at all: a UA that is allowed to claim the contact
 * for its own visual-viewport zoom would claim it for scrolling too. Taking
 * `none` therefore obliges this module to give the second finger back, which
 * it does through the same anchored maths — the content point under the
 * contacts' midpoint stays under that midpoint, so a pinch zooms and pans in
 * one motion.
 *
 * ## Gesture lifetime
 *
 * Nothing here listens on `window` or `document`, so a gesture's lifetime is
 * the SURFACE's, not the controller's. A surface that can disappear mid-drag —
 * a lightbox whose `<Show>` unmounts while a button is still held — takes the
 * `pointerup` with it, and the gesture would otherwise never end. Two things
 * close that hole: the caller calls {@link PanZoomController.cancelGesture}
 * when its surface goes away, and the handlers themselves drop a gesture whose
 * surface has left the document. `onCleanup` only covers the narrower case
 * where the whole component is disposed.
 *
 * ## SSR
 *
 * Creating the controller touches no browser global — it only creates signals.
 * Every DOM read (`getBoundingClientRect`, pointer capture) happens inside an
 * event handler, i.e. never on the server and never during render, so SSR
 * markup and the hydrated markup agree: both start at `min` scale, no offset.
 */

import { createSignal, onCleanup, untrack, type Accessor, type JSX } from 'solid-js'

/** A point in one of the two spaces described above. Plain data, no units. */
export interface PanZoomPoint {
  x: number
  y: number
}

/**
 * The whole state of a pan/zoom surface: a scale, and a translation in the
 * parent's unscaled pixels (the translation is NOT multiplied by the scale —
 * in `translate(t) scale(s)` the translate is applied to the unscaled
 * coordinate system, which is why a drag adds screen pixels to it directly).
 */
export interface PanZoomState {
  scale: number
  x: number
  y: number
}

export interface PanZoomOptions {
  /** Lowest scale, and the scale `reset()` returns to. Default `1`. */
  min?: number
  /** Highest scale. Default `8`. */
  max?: number
  /**
   * Wheel sensitivity. One wheel event multiplies the scale by
   * `exp(-deltaY * step)`, so the zoom is exponential (every notch is the same
   * *ratio*, whatever the current scale) and symmetric (a notch back undoes a
   * notch forward exactly). Default `0.0015` — one 100px notch is ≈ ±16%.
   */
  step?: number
  /**
   * The element that carries the transform, when the handlers are bound
   * somewhere else — typically a fullscreen backdrop wrapping the `<img>`.
   * Without it the handlers use their own `currentTarget`, which is then
   * assumed to be the transformed element.
   *
   * An accessor, not an element: the ref is still `undefined` when the
   * controller is created.
   */
  target?: () => HTMLElement | null | undefined
}

/** Cursor for the surface the handlers are bound to. */
export type PanZoomCursor = 'auto' | 'grab' | 'grabbing'

export interface PanZoomController {
  /** Current scale, clamped to `[min, max]`. Starts at `min`. */
  scale: Accessor<number>
  /** Current translation, in the parent's unscaled pixels. Starts at `{0, 0}`. */
  offset: Accessor<PanZoomPoint>
  /** `{ scale, x, y }` in one read — the shape the pure helpers take. */
  state: Accessor<PanZoomState>
  /** Value for CSS `transform`: `translate(Xpx, Ypx) scale(S)`. */
  transform: Accessor<string>
  /**
   * Style for the TRANSFORMED element: the transform, the `0 0` origin the
   * maths depends on, and `will-change` while a gesture is worth promoting.
   */
  contentStyle: Accessor<JSX.CSSProperties>
  /**
   * Style for the element the handlers are bound to: the grab cursor, and
   * `touch-action: none`.
   *
   * `none` is not about page scrolling — the surfaces that use this own their
   * viewport and have already locked the document. It is about the contact
   * itself: anything other than `none` lets the UA claim a touch for its own
   * pan or pinch and send `pointercancel` instead of the move stream, which
   * would leave one-finger panning dead. The price is that the browser's own
   * pinch-zoom is off, which is why {@link PanZoomController.onPointerDown}
   * implements the two-finger gesture rather than leaving it to the platform.
   */
  surfaceStyle: Accessor<JSX.CSSProperties>
  /** `'grabbing'` mid-drag, `'grab'` while pannable, `'auto'` otherwise. */
  cursor: Accessor<PanZoomCursor>
  /** `scale() > min` — the surface is showing something other than its reset state. */
  isZoomed: Accessor<boolean>
  /** A drag is in progress right now. */
  isPanning: Accessor<boolean>
  /**
   * The pointer travelled since the last `pointerdown` — a drag, not a click.
   * Set whether or not the surface could actually pan, and stays true until
   * the next `pointerdown`, so a `click` handler that fires after a drag —
   * the lightbox backdrop's "click to close", typically — can bail out on it.
   */
  wasDragged: Accessor<boolean>
  /** `scale()` as a whole percentage, for `strings.zoomLevel`. */
  percent: Accessor<number>
  /** The configured bounds, so callers can disable a button at the limit. */
  min: number
  max: number
  /**
   * Multiplies the scale by `factor` (`> 1` zooms in), clamped to the bounds.
   * Without an anchor the element's own centre stays put, which is what a
   * toolbar button should do.
   */
  zoomBy: (factor: number, anchor?: PanZoomPoint) => void
  /** Same, with an absolute target scale. */
  zoomTo: (scale: number, anchor?: PanZoomPoint) => void
  /** Back to `min` scale and no offset. */
  reset: () => void
  /**
   * Drops every gesture in flight — the drag, the pinch, the contacts they are
   * made of — and releases any pointer capture, WITHOUT touching the transform.
   *
   * Call it when the surface the handlers are bound to goes away while a
   * pointer may still be down: `<Show>` disposing a portal, a modal closing on
   * Escape mid-drag. The `pointerup` that would normally end the gesture is
   * delivered to the element under the pointer, so once the surface is
   * detached it never arrives — {@link PanZoomController.isPanning} would stay
   * `true` for good, the cursor would stay `grabbing`, and the next press
   * would be read as the second finger of a pinch with a phantom first one.
   */
  cancelGesture: () => void
  /** Cursor-anchored wheel zoom. Calls `preventDefault()` — bind it only on a surface that owns its viewport. */
  onWheel: (event: WheelEvent) => void
  /**
   * Starts a drag-pan (if the surface is zoomed), or — on the second
   * simultaneous contact — a pinch, which zooms whatever the current scale.
   */
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerCancel: (event: PointerEvent) => void
}

/**
 * How far a pointer must travel (px, Euclidean) before it counts as a drag
 * rather than a click — for a mouse or a pen, which land where they are aimed.
 */
const DRAG_THRESHOLD_PX = 3

/**
 * The same budget for a finger, which does not.
 *
 * The contact centroid of a tap rolls by several pixels between press and
 * lift, and the platforms allow for it: a browser lets a touch travel of the
 * order of 10px and still fires the `click`. Sharing the mouse's 3px would put
 * this module an order of magnitude under its own platform's tap tolerance —
 * an ordinary tap on the lightbox backdrop would read as a drag, the "click to
 * close" would refuse it, and the overlay would look intermittently deaf.
 */
const TOUCH_DRAG_THRESHOLD_PX = 10

/** The travel budget for the device that produced a contact. */
const dragThresholdFor = (pointerType: string): number =>
  pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX

/** `deltaMode` is in lines or pages on some browsers; normalise to pixels. */
const LINE_HEIGHT_PX = 16
const PAGE_HEIGHT_PX = 400

const DEFAULTS = { min: 1, max: 8, step: 0.0015 } as const

/**
 * Clamps a scale into `[min, max]`. `NaN` — the result of dividing by a zero
 * scale somewhere upstream — resolves to `min` rather than poisoning the
 * transform; `±Infinity` simply hits the nearer bound.
 */
export function clampScale(scale: number, min: number, max: number): number {
  if (Number.isNaN(scale)) return min
  return Math.min(max, Math.max(min, scale))
}

/**
 * The content point currently shown at `viewport` — the inverse of
 * {@link viewportPointOf}. Pure; exported for the anchoring tests.
 */
export function contentPointAt(state: PanZoomState, viewport: PanZoomPoint): PanZoomPoint {
  return {
    x: (viewport.x - state.x) / state.scale,
    y: (viewport.y - state.y) / state.scale,
  }
}

/** Where `content` currently shows up, as a viewport point. Pure. */
export function viewportPointOf(state: PanZoomState, content: PanZoomPoint): PanZoomPoint {
  return {
    x: state.x + state.scale * content.x,
    y: state.y + state.scale * content.y,
  }
}

/**
 * Changes the scale while keeping whatever is under `anchor` under `anchor`.
 *
 * This is the whole feature: `viewportPointOf(zoomAtAnchor(s, k, a), contentPointAt(s, a))`
 * is `a` again, for every scale, every offset and every anchor. Pure — no
 * clamping, no DOM; the controller clamps around it.
 */
export function zoomAtAnchor(
  state: PanZoomState,
  nextScale: number,
  anchor: PanZoomPoint
): PanZoomState {
  const content = contentPointAt(state, anchor)
  return {
    scale: nextScale,
    x: anchor.x - nextScale * content.x,
    y: anchor.y - nextScale * content.y,
  }
}

/**
 * One contact currently on the surface, in client coordinates.
 *
 * Tracked apart from {@link PanGesture} because a pinch needs TWO at once, and
 * because a gesture can end while the fingers are still down — the second
 * finger supersedes the drag the first one armed.
 */
interface PanZoomContact extends PanZoomPoint {
  /** `'mouse' | 'pen' | 'touch'`, as reported at `pointerdown`. */
  pointerType: string
  /** The element the handlers are bound to, so a detached surface is noticeable. */
  surface: Element | null
}

/** The in-flight drag. `null` between gestures. */
interface PanGesture {
  pointerId: number
  /** Where the pointer went down, in client coordinates. */
  startX: number
  startY: number
  /** The offset when it went down — the drag is added to this, never accumulated. */
  origin: PanZoomPoint
  /** Was the surface zoomed when the gesture started? Only then does it pan. */
  pannable: boolean
  /** Travel this pointer needs before it stops being a click. */
  threshold: number
  /** The surface the gesture was armed on; if it leaves the DOM the gesture dies with it. */
  surface: Element | null
  /** The element that captured the pointer, so the same one releases it. */
  captured: Element | null
}

/**
 * The in-flight two-finger pinch. `null` unless exactly two contacts are down.
 *
 * Everything in it is a snapshot from the moment the pinch STARTED: each move
 * recomputes the whole state from those, never from the previous frame, so a
 * pinch that goes out and back lands exactly where it began and rounding never
 * accumulates.
 */
interface PinchGesture {
  /** The two contacts it is made of, in the order they went down. */
  a: number
  b: number
  /** Their separation at the start — the denominator of the scale ratio. */
  startDistance: number
  /** The transform at the start; the scale is multiplied out of this one. */
  startState: PanZoomState
  /**
   * The content point that was under the contacts' midpoint. Keeping THAT
   * pixel under the (moving) midpoint is what makes a pinch feel like it has
   * hold of the image: the gesture zooms and pans in a single motion.
   */
  anchorContent: PanZoomPoint
  /**
   * The transformed element's untransformed top-left corner, in client px,
   * measured once. It is invariant under the transform (this module only moves
   * content INSIDE the layout box), so re-measuring mid-pinch would feed the
   * translation already applied back into the anchor and the image would run
   * away from the fingers.
   */
  origin: PanZoomPoint
}

/**
 * Creates a pan/zoom controller. Call it in a component body (it registers an
 * `onCleanup`); bind the handlers on the surface that owns the viewport.
 *
 * @example
 * ```tsx
 * let image: HTMLImageElement | undefined
 * const panZoom = createPanZoom({ min: 1, max: 8, target: () => image })
 *
 * <div
 *   style={panZoom.surfaceStyle()}
 *   onWheel={panZoom.onWheel}
 *   onPointerDown={panZoom.onPointerDown}
 *   onPointerMove={panZoom.onPointerMove}
 *   onPointerUp={panZoom.onPointerUp}
 *   onPointerCancel={panZoom.onPointerCancel}
 *   onClick={() => { if (!panZoom.wasDragged()) close() }}
 * >
 *   <img ref={image} style={panZoom.contentStyle()} src={src} />
 * </div>
 * ```
 */
export function createPanZoom(options: PanZoomOptions = {}): PanZoomController {
  const min = options.min ?? DEFAULTS.min
  // A `max` below `min` would make every clamp pick the wrong bound; the
  // surface then simply does not zoom.
  const max = Math.max(options.max ?? DEFAULTS.max, min)
  const step = options.step ?? DEFAULTS.step

  const [scale, setScale] = createSignal(min)
  const [offset, setOffset] = createSignal<PanZoomPoint>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = createSignal(false)
  const [wasDragged, setWasDragged] = createSignal(false)

  let gesture: PanGesture | null = null
  let pinch: PinchGesture | null = null
  /** Every pointer currently down on the surface, newest last. */
  const contacts = new Map<number, PanZoomContact>()

  const state: Accessor<PanZoomState> = () => ({ scale: scale(), ...offset() })
  const isZoomed = () => scale() > min

  /**
   * Reads the state WITHOUT subscribing: these helpers run from event handlers
   * but also from a caller's `createEffect` (resetting the zoom when the
   * displayed image changes, say), and such an effect must not re-run on its
   * own writes.
   */
  const snapshot = (): PanZoomState => untrack(state)

  const apply = (next: PanZoomState) => {
    setScale(next.scale)
    setOffset({ x: next.x, y: next.y })
  }

  /** The transformed element — explicit `target`, else the handler's own target. */
  const elementFor = (event?: { currentTarget?: unknown }): HTMLElement | null => {
    const explicit = options.target?.()
    if (explicit) return explicit
    const current = event?.currentTarget
    return current && typeof (current as HTMLElement).getBoundingClientRect === 'function'
      ? (current as HTMLElement)
      : null
  }

  /**
   * Viewport point of a pointer event: its client position relative to the
   * transformed element's UNTRANSFORMED origin. That origin is not directly
   * observable — the rect already includes the transform — but with
   * `transform-origin: 0 0` the rendered left edge is exactly `origin + offset`,
   * so subtracting the current offset recovers it whatever the layout.
   */
  const anchorFromEvent = (
    event: { clientX: number; clientY: number; currentTarget?: unknown },
    current: PanZoomState
  ): PanZoomPoint | undefined => {
    const element = elementFor(event)
    if (!element) return undefined
    const rect = element.getBoundingClientRect()
    return {
      x: event.clientX - (rect.left - current.x),
      y: event.clientY - (rect.top - current.y),
    }
  }

  /**
   * The transformed element's UNTRANSFORMED top-left corner, in client px.
   *
   * Same recovery as {@link anchorFromEvent} — the rendered left edge is
   * `corner + offset` under a `0 0` origin — but expressed once, for gestures
   * that need to convert several client points against a corner measured a
   * while ago. With nothing to measure (no ref yet, no explicit `target` on a
   * surface that binds its handlers elsewhere) it degrades to the client
   * origin, which keeps the arithmetic self-consistent even if the anchor is
   * then off by the element's position.
   */
  const untransformedOrigin = (current: PanZoomState): PanZoomPoint => {
    const element = elementFor()
    if (!element) return { x: 0, y: 0 }
    const rect = element.getBoundingClientRect()
    return { x: rect.left - current.x, y: rect.top - current.y }
  }

  /**
   * Fallback anchor for the toolbar buttons: the element's own visible centre,
   * which is where a user looks. With no element to measure (SSR, no ref yet)
   * it degrades to the content's top-left corner.
   */
  const centreAnchor = (current: PanZoomState): PanZoomPoint => {
    const element = elementFor()
    if (!element) return { x: current.x, y: current.y }
    const rect = element.getBoundingClientRect()
    return { x: current.x + rect.width / 2, y: current.y + rect.height / 2 }
  }

  const zoomTo = (target: number, anchor?: PanZoomPoint) => {
    const current = snapshot()
    const next = clampScale(target, min, max)
    if (next === current.scale) return
    // At `min` nothing can be panned out of view, so the offset snaps back to
    // zero: zooming all the way out always lands on the same, centred frame
    // rather than on whatever translation the anchored maths left behind.
    if (next === min) {
      apply({ scale: min, x: 0, y: 0 })
      return
    }
    apply(zoomAtAnchor(current, next, anchor ?? centreAnchor(current)))
  }

  const zoomBy = (factor: number, anchor?: PanZoomPoint) => {
    if (!Number.isFinite(factor) || factor <= 0) return
    zoomTo(snapshot().scale * factor, anchor)
  }

  const reset = () => {
    apply({ scale: min, x: 0, y: 0 })
  }

  const onWheel = (event: WheelEvent) => {
    if (max === min) return
    // The surface owns its viewport (a fullscreen overlay, the expanded
    // modal), so the page must not scroll underneath the zoom.
    event.preventDefault()
    const delta =
      event.deltaY *
      (event.deltaMode === 1 ? LINE_HEIGHT_PX : event.deltaMode === 2 ? PAGE_HEIGHT_PX : 1)
    if (delta === 0) return
    const current = snapshot()
    zoomTo(current.scale * Math.exp(-delta * step), anchorFromEvent(event, current))
  }

  const releaseCapture = () => {
    const captured = gesture?.captured
    const pointerId = gesture?.pointerId
    if (!captured || pointerId === undefined) return
    try {
      if (captured.hasPointerCapture?.(pointerId)) captured.releasePointerCapture(pointerId)
    } catch {
      // Releasing a capture the browser already dropped (the pointer left the
      // window, the node was reparented) throws; there is nothing to do about it.
    }
  }

  const endGesture = () => {
    releaseCapture()
    gesture = null
    setIsPanning(false)
  }

  const cancelGesture = () => {
    endGesture()
    pinch = null
    contacts.clear()
  }

  /**
   * Has this surface left the document?
   *
   * Only an explicit `false` counts: `isConnected` is a boolean on a real
   * node, and `undefined` on the plain objects the unit tests hand to the
   * handlers as `currentTarget` — those must not be pruned.
   */
  const isDetached = (surface: Element | null | undefined): boolean =>
    surface?.isConnected === false

  /**
   * Forgets contacts whose surface has left the document, and drops the
   * gesture built on one.
   *
   * Run at every `pointerdown`, because a stranded contact is worse than a
   * stuck flag: it would make the next single press look like the second
   * finger of a pinch, against a phantom first finger somewhere off screen.
   */
  const pruneDetachedContacts = () => {
    for (const [pointerId, contact] of contacts) {
      if (isDetached(contact.surface)) contacts.delete(pointerId)
    }
    if (isDetached(gesture?.surface)) endGesture()
    if (pinch && (!contacts.has(pinch.a) || !contacts.has(pinch.b))) pinch = null
  }

  /** Arms a drag on `contact`, capturing the pointer when the caller asks. */
  const beginPan = (pointerId: number, contact: PanZoomContact, capture: boolean): boolean => {
    // The gesture is tracked even when nothing can be panned: `wasDragged` is
    // what a backdrop's "click to close" tests, and a drag across an
    // unzoomed surface is still a drag, not a click.
    const pannable = untrack(isZoomed)
    gesture = {
      pointerId,
      startX: contact.x,
      startY: contact.y,
      origin: untrack(offset),
      pannable,
      threshold: dragThresholdFor(contact.pointerType),
      surface: contact.surface,
      captured: null,
    }
    if (!pannable) return false
    setIsPanning(true)
    if (!capture) return true
    const element =
      contact.surface && typeof contact.surface.setPointerCapture === 'function'
        ? contact.surface
        : null
    try {
      element?.setPointerCapture(pointerId)
      gesture.captured = element
    } catch {
      // jsdom, and browsers whose pointer is already gone, throw here. The
      // gesture still works through the handlers bound on the surface.
    }
    return true
  }

  /**
   * Turns the two live contacts into a pinch, replacing whatever the first
   * finger had armed.
   *
   * Does nothing while the two contacts sit on the same pixel: there is no
   * ratio to grow from yet, and the next move tries again.
   */
  const beginPinch = () => {
    const ids = [...contacts.keys()]
    if (ids.length !== 2) return
    const first = contacts.get(ids[0])!
    const second = contacts.get(ids[1])!
    const startDistance = Math.hypot(first.x - second.x, first.y - second.y)
    if (startDistance === 0) return
    // Two fingers drive the translation together from here; the single-pointer
    // drag the first one armed would fight them for the same offset.
    endGesture()
    const startState = snapshot()
    const origin = untransformedOrigin(startState)
    const mid = { x: (first.x + second.x) / 2 - origin.x, y: (first.y + second.y) / 2 - origin.y }
    pinch = {
      a: ids[0],
      b: ids[1],
      startDistance,
      startState,
      anchorContent: contentPointAt(startState, mid),
      origin,
    }
    // Two fingers on the glass are never the click that closes a backdrop.
    setWasDragged(true)
  }

  /** Re-derives the transform from the contacts' current separation and midpoint. */
  const updatePinch = () => {
    if (!pinch) return
    const first = contacts.get(pinch.a)
    const second = contacts.get(pinch.b)
    if (!first || !second) {
      pinch = null
      return
    }
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    if (distance === 0) return
    const next = clampScale(pinch.startState.scale * (distance / pinch.startDistance), min, max)
    // Same rule as `zoomTo`: at `min` nothing can be out of view, so pinching
    // all the way out always lands on the same centred frame.
    if (next === min) {
      apply({ scale: min, x: 0, y: 0 })
      return
    }
    const mid = {
      x: (first.x + second.x) / 2 - pinch.origin.x,
      y: (first.y + second.y) / 2 - pinch.origin.y,
    }
    apply({
      scale: next,
      x: mid.x - next * pinch.anchorContent.x,
      y: mid.y - next * pinch.anchorContent.y,
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    pruneDetachedContacts()
    // Cleared once per gesture — on the FIRST contact, not on the second
    // finger of a pinch, which would tell the backdrop that the pinch it is
    // in the middle of was a click.
    if (contacts.size === 0) setWasDragged(false)
    const surface = (event.currentTarget ?? null) as Element | null
    contacts.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType || 'mouse',
      surface,
    })

    if (contacts.size === 2) {
      beginPinch()
      // The second finger must not reach the browser either: it would start a
      // native selection or image drag over a surface that is now pinching.
      event.preventDefault()
      return
    }
    if (contacts.size > 2) {
      // A third contact is not a gesture this module knows; stop rather than
      // pinch on an arbitrary pair.
      pinch = null
      endGesture()
      return
    }

    if (!beginPan(event.pointerId, contacts.get(event.pointerId)!, true)) return
    // Stops the browser's native image drag, which would otherwise swallow
    // the pointer stream mid-pan. Only while panning: an unzoomed surface
    // must keep its ordinary click/focus behaviour.
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    const contact = contacts.get(event.pointerId)
    if (contact) {
      contact.x = event.clientX
      contact.y = event.clientY
    }

    if (pinch) {
      updatePinch()
      return
    }
    // Two fingers that went down on the same pixel only become a pinch once
    // they part, which is a move, not a press.
    if (contacts.size === 2) {
      beginPinch()
      if (pinch) {
        updatePinch()
        return
      }
    }

    if (!gesture || event.pointerId !== gesture.pointerId) return
    // A surface that left the document mid-gesture can never deliver the
    // `pointerup` that would end this; drop it rather than pan towards a
    // pointer that is no longer talking to us.
    if (isDetached(gesture.surface)) {
      endGesture()
      return
    }
    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    if (Math.hypot(dx, dy) > gesture.threshold) setWasDragged(true)
    // `pannable` is the state at `pointerdown`; `isZoomed` is the state now.
    // A reset that lands mid-drag (the `0` key, the reset button) must stop
    // the pan rather than drag a fitted image around.
    if (!gesture.pannable || !untrack(isZoomed)) return
    setOffset({ x: gesture.origin.x + dx, y: gesture.origin.y + dy })
  }

  /**
   * A contact left the surface. Ends what it was driving — and, when it was
   * half of a pinch, hands the surviving finger back to the drag from its
   * CURRENT position, so the image does not freeze under a finger still on
   * the glass.
   */
  const endContact = (pointerId: number) => {
    contacts.delete(pointerId)
    if (pinch && (pinch.a === pointerId || pinch.b === pointerId)) {
      pinch = null
      const survivor = [...contacts.entries()][0]
      if (survivor) beginPan(survivor[0], survivor[1], false)
      return
    }
    if (gesture && gesture.pointerId === pointerId) endGesture()
  }

  const onPointerUp = (event: PointerEvent) => {
    endContact(event.pointerId)
  }

  const onPointerCancel = (event: PointerEvent) => {
    endContact(event.pointerId)
  }

  // No global listener is ever registered — the handlers are bound in JSX and
  // die with the element. What can outlive the component is a pointer capture
  // taken mid-drag and the gesture state behind it, so that is what cleanup
  // gives back. It only covers a disposed OWNER, though: a surface that
  // unmounts under a still-living controller is the caller's `cancelGesture`.
  onCleanup(cancelGesture)

  const cursor = (): PanZoomCursor => (isPanning() ? 'grabbing' : isZoomed() ? 'grab' : 'auto')

  const transform = () => {
    const current = state()
    return `translate(${current.x}px, ${current.y}px) scale(${current.scale})`
  }

  return {
    scale,
    offset,
    state,
    transform,
    contentStyle: () => ({
      transform: transform(),
      'transform-origin': '0 0',
      'will-change': isZoomed() || isPanning() ? 'transform' : 'auto',
    }),
    surfaceStyle: () => ({
      cursor: cursor(),
      'touch-action': 'none',
    }),
    cursor,
    isZoomed,
    isPanning,
    wasDragged,
    percent: () => Math.round(scale() * 100),
    min,
    max,
    zoomBy,
    zoomTo,
    reset,
    cancelGesture,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
