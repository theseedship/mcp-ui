import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, flush, Show } from 'solid-js'
import { ExpandableWrapper } from './ExpandableWrapper'
import { ModalRenderer } from './ModalRenderer'
import { LightboxOverlay } from './LightboxOverlay'
import { lockOverlayScroll } from '../utils/overlay-lifecycle'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup()
  document.body.style.removeProperty('overflow')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('overlay focus and document-scoped scroll leases', () => {
  it('restores the real expand trigger after two Escape cycles without replacing content', () => {
    const view = render(() => <ExpandableWrapper title="Focus fixture"><button data-persistent>Persistent content</button></ExpandableWrapper>)
    const opener = view.getByLabelText('Expand')
    const child = view.container.querySelector('[data-persistent]')!
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout')
    for (let cycle = 0; cycle < 2; cycle++) {
      opener.focus()
      flush(() => fireEvent.click(opener))
      vi.advanceTimersByTime(10)
      const dialog = screen.getByRole('dialog')
      expect(document.activeElement).toBe(dialog)
      expect(dialog.querySelector('[data-persistent]')).toBe(child)
      ;(child as HTMLElement).focus()
      flush(() => fireEvent.keyDown(document, { key: 'Escape' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(opener)
      expect(view.container.querySelector('[data-persistent]')).toBe(child)
    }
    // Focus also schedules jsdom's own document tasks. Account for the two
    // 10ms focus timers we own, rather than asserting on every host timer.
    const focusTimers = timers.mock.results.filter((_, index) => timers.mock.calls[index]?.[1] === 10)
    expect(focusTimers).toHaveLength(2)
    for (const timer of focusTimers) expect(clearTimer).toHaveBeenCalledWith(timer.value)
  })

  it('restores a modal opener on both controlled close and Escape', () => {
    const [open, setOpen] = createSignal(false)
    const view = render(() => <>
      <button onClick={() => setOpen(true)}>Open focus modal</button>
      <ModalRenderer isOpen={open()} onClose={() => setOpen(false)} params={{ title: 'Focus modal' }}>Content</ModalRenderer>
    </>)
    const opener = view.getByText('Open focus modal')
    for (const close of ['controlled', 'escape']) {
      opener.focus()
      flush(() => fireEvent.click(opener))
      vi.advanceTimersByTime(10)
      expect(document.activeElement).toBe(screen.getByRole('dialog'))
      if (close === 'controlled') flush(() => setOpen(false))
      else flush(() => fireEvent.keyDown(document, { key: 'Escape' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(opener)
    }
  })

  it.each(['modal-first', 'expanded-first'] as const)('keeps body locked until all three overlay owners release: %s', (order) => {
    document.body.style.setProperty('overflow', 'scroll', 'important')
    // jsdom may expose no priority for this shorthand; restore exactly the
    // value the host DOM exposes rather than claiming browser CSS parity.
    const originalPriority = document.body.style.getPropertyPriority('overflow')
    const [modalMounted, setModalMounted] = createSignal(true)
    const [expandedMounted, setExpandedMounted] = createSignal(true)
    const [lightboxMounted, setLightboxMounted] = createSignal(true)
    const view = render(() => <>
      <Show when={modalMounted()}><ModalRenderer isOpen={true} params={{ title: 'Concurrent modal' }}>Modal</ModalRenderer></Show>
      <Show when={expandedMounted()}><ExpandableWrapper title="Concurrent expanded">Expanded</ExpandableWrapper></Show>
      <Show when={lightboxMounted()}><LightboxOverlay selectedIndex={0} images={[{ url: 'data:image/png;base64,AA==', alt: 'Fixture' }]}
        onClose={() => setLightboxMounted(false)} onNavigate={() => {}} /></Show>
    </>)
    flush(() => fireEvent.click(view.getByLabelText('Expand')))
    expect(document.body.style.overflow).toBe('hidden')
    if (order === 'modal-first') flush(() => setModalMounted(false))
    else flush(() => setExpandedMounted(false))
    expect(document.body.style.overflow).toBe('hidden')
    flush(() => setLightboxMounted(false))
    expect(document.body.style.overflow).toBe('hidden')
    if (order === 'modal-first') flush(() => setExpandedMounted(false))
    else flush(() => setModalMounted(false))
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.getPropertyPriority('overflow')).toBe(originalPriority)
  })

  it('cancels pending modal and expanded focus timers during immediate unmount', () => {
    for (const kind of ['modal', 'expanded']) {
      const view = kind === 'modal'
        ? render(() => <ModalRenderer isOpen={true}>Modal</ModalRenderer>)
        : render(() => <ExpandableWrapper>Expanded</ExpandableWrapper>)
      if (kind === 'expanded') flush(() => fireEvent.click(view.getByLabelText('Expand')))
      const dialog = screen.getByRole('dialog')
      const focus = vi.spyOn(dialog, 'focus')
      view.unmount()
      vi.advanceTimersByTime(20)
      expect(focus).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
      expect(document.body.style.overflow).toBe('')
    }
  })

  it('keeps leases independent per document and makes release idempotent', () => {
    const other = document.implementation.createHTMLDocument('Other overlay host')
    document.body.style.overflow = 'auto'
    other.body.style.overflow = 'scroll'
    const first = lockOverlayScroll(document)
    const second = lockOverlayScroll(document)
    const separate = lockOverlayScroll(other)
    first()
    first()
    expect(document.body.style.overflow).toBe('hidden')
    separate()
    expect(other.body.style.overflow).toBe('scroll')
    expect(document.body.style.overflow).toBe('hidden')
    second()
    expect(document.body.style.overflow).toBe('auto')
  })
})
