/** Shared DOM-only ownership for overlays mounted in the same document. */
const scrollLocks = new WeakMap<Document, { count: number; overflow: string; priority: string }>()

/** Each overlay releases only its own lease; the last restores host styling. */
export function lockOverlayScroll(document: Document): () => void {
  let state = scrollLocks.get(document)
  if (!state) {
    state = { count: 0, overflow: document.body.style.overflow,
      priority: document.body.style.getPropertyPriority('overflow') }
    scrollLocks.set(document, state)
    document.body.style.overflow = 'hidden'
  }
  state.count++
  let released = false
  return () => {
    if (released) return
    released = true
    state.count--
    if (state.count !== 0) return
    if (state.overflow) document.body.style.setProperty('overflow', state.overflow, state.priority)
    else document.body.style.removeProperty('overflow')
    scrollLocks.delete(document)
  }
}

/** A cancellable DOM focus lifecycle, with no Solid owner or primitive. */
export function focusOverlay(dialog: HTMLElement, opener = dialog.ownerDocument.activeElement as HTMLElement | null): () => void {
  const document = dialog.ownerDocument
  const timer = setTimeout(() => {
    if (dialog.isConnected) dialog.focus({ preventScroll: true })
  }, 10)
  return () => {
    clearTimeout(timer)
    // Do not steal focus from a second still-open overlay or a host field.
    const active = document.activeElement
    if (opener?.isConnected && opener !== document.body && typeof opener.focus === 'function' &&
      (active === document.body || active === dialog || dialog.contains(active))) {
      opener.focus({ preventScroll: true })
    }
  }
}
