/**
 * v6.4.0 — Portal-mounted dropdown for table + graph Export menus.
 *
 * Coverage targets :
 *   1. Menu mounts via <Portal> on document.body (not in trigger's parent)
 *   2. Menu position is computed from the trigger's getBoundingClientRect
 *   3. Click outside the menu closes it
 *   4. Escape key closes it
 *   5. Click on the trigger itself does not close (parent owns toggle)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { PortalDropdownMenu } from './PortalDropdownMenu'

describe('PortalDropdownMenu (v6.4.0)', () => {
  beforeEach(() => {
    cleanup()
  })

  function harness(initiallyOpen = true) {
    const [open, setOpen] = createSignal(initiallyOpen)
    let triggerRef: HTMLButtonElement | undefined
    const result = render(() => (
      <div id="harness-root">
        <button ref={triggerRef} onClick={() => setOpen((v) => !v)}>
          Open
        </button>
        <PortalDropdownMenu
          open={open()}
          onClose={() => setOpen(false)}
          trigger={triggerRef}
          width={144}
        >
          <button data-testid="menu-item">Item 1</button>
        </PortalDropdownMenu>
      </div>
    ))
    return { ...result, getOpen: open, setOpen, getTrigger: () => triggerRef }
  }

  it('mounts the menu on document.body, NOT inside the trigger parent', () => {
    const { container } = harness(true)
    // Menu should NOT be inside the harness root (it's portaled to body)
    const harnessRoot = container.querySelector('#harness-root')
    expect(harnessRoot).toBeTruthy()
    expect(harnessRoot!.querySelector('[data-testid="menu-item"]')).toBeNull()
    // But it IS in document.body
    const menuItem = document.body.querySelector('[data-testid="menu-item"]')
    expect(menuItem).toBeTruthy()
  })

  it('does not render the menu when open=false', () => {
    harness(false)
    expect(document.body.querySelector('[data-testid="menu-item"]')).toBeNull()
  })

  it('positions the menu using the trigger getBoundingClientRect (right-aligned, 4px below)', () => {
    // Stub the trigger rect so we get deterministic coords in jsdom
    const fakeRect = {
      top: 100, bottom: 130, left: 200, right: 350,
      width: 150, height: 30, x: 200, y: 100, toJSON: () => ({}),
    } as DOMRect
    // Patch getBoundingClientRect on HTMLElement.prototype just for this test
    const orig = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => fakeRect)
    try {
      harness(true)
      const menu = document.body.querySelector('[role="menu"]') as HTMLElement
      expect(menu).toBeTruthy()
      // Position: top = bottom + 4 = 134, left = right - width = 350 - 144 = 206
      expect(menu.style.top).toBe('134px')
      expect(menu.style.left).toBe('206px')
      expect(menu.style.position).toBe('fixed')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig
    }
  })

  it('closes on outside click (mousedown on document.body outside menu)', () => {
    const { getOpen } = harness(true)
    expect(getOpen()).toBe(true)
    // Click on a brand-new element appended to body, outside the menu
    const stranger = document.createElement('div')
    document.body.appendChild(stranger)
    fireEvent.mouseDown(stranger)
    expect(getOpen()).toBe(false)
    document.body.removeChild(stranger)
  })

  it('closes on Escape', () => {
    const { getOpen } = harness(true)
    expect(getOpen()).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(getOpen()).toBe(false)
  })

  it('does not close when mousedown lands on the trigger (parent owns toggle)', () => {
    const { getOpen, getTrigger } = harness(true)
    expect(getOpen()).toBe(true)
    fireEvent.mouseDown(getTrigger()!)
    // Menu should still be open — trigger toggle is parent's responsibility
    expect(getOpen()).toBe(true)
  })

  it('does not close when mousedown lands inside the menu', () => {
    const { getOpen } = harness(true)
    const item = document.body.querySelector('[data-testid="menu-item"]') as HTMLElement
    fireEvent.mouseDown(item)
    expect(getOpen()).toBe(true)
  })
})
