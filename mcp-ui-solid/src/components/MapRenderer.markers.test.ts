/**
 * v6.11.0 — map hardening.
 *
 * Covers the marker tooltip/popup escaping wiring (audit P1.2 completion: the
 * `bindMarkerContent` helper shipped in v6.10.0 but the marker loops still
 * bound raw HTML until v6.11.0) and the `popupSafeText` contract reused by the
 * PMTiles-failure path (P1.3).
 */

import { describe, it, expect } from 'vitest'
import { bindMarkerContent, popupSafeText } from './MapRenderer'

const XSS = '<img src=x onerror=alert(1)>'

// Minimal Leaflet marker stub recording what gets bound.
function fakeMarker() {
  const calls: { tooltip?: string; popup?: string } = {}
  return {
    calls,
    bindTooltip(html: string) {
      calls.tooltip = html
      return this
    },
    bindPopup(html: string) {
      calls.popup = html
      return this
    },
  }
}

describe('bindMarkerContent (audit P1.2 wiring)', () => {
  it('escapes marker tooltip/popup by default (untrusted host)', () => {
    const m = fakeMarker()
    bindMarkerContent(m, { tooltip: XSS, popup: XSS }, false)
    expect(m.calls.tooltip).not.toContain('<img')
    expect(m.calls.tooltip).toContain('&lt;img')
    expect(m.calls.popup).not.toContain('<img')
    expect(m.calls.popup).toContain('&lt;img')
  })

  it('passes raw HTML through only when the host opts in (allowHtml=true)', () => {
    const m = fakeMarker()
    bindMarkerContent(m, { tooltip: XSS, popup: XSS }, true)
    expect(m.calls.tooltip).toBe(XSS)
    expect(m.calls.popup).toBe(XSS)
  })

  it('binds nothing when tooltip/popup are absent', () => {
    const m = fakeMarker()
    bindMarkerContent(m, {}, false)
    expect(m.calls.tooltip).toBeUndefined()
    expect(m.calls.popup).toBeUndefined()
  })
})

describe('popupSafeText', () => {
  it('escapes by default', () => {
    expect(popupSafeText(XSS)).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('is identity when the host trusts the payload', () => {
    expect(popupSafeText(XSS, true)).toBe(XSS)
  })

  it('returns undefined for missing values', () => {
    expect(popupSafeText(undefined)).toBeUndefined()
  })
})
