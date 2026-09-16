/**
 * `<SafeHtml>` (S1) — the single innerHTML sink.
 *
 * Covers the mount render, attribute forwarding, reactivity, and the
 * hydration fix-up (`_applySafeHtml`) that repairs the DOM when Solid's
 * `setProperty(node, 'innerHTML', …)` was skipped while hydrating.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { SafeHtml, _applySafeHtml } from './SafeHtml'

afterEach(() => cleanup())

describe('_applySafeHtml — hydration fix-up', () => {
  it('patches an element whose DOM content is stale', () => {
    // Stands in for a hydrated node: the server emitted escaped plain text,
    // the client now holds the rich sanitized version.
    const el = document.createElement('div')
    el.innerHTML = 'stale &amp; escaped'

    const patched = _applySafeHtml(el, '<b>rich</b> &amp; escaped')

    expect(patched).toBe(true)
    expect(el.querySelector('b')?.textContent).toBe('rich')
  })

  it('is a no-op when the DOM already matches', () => {
    const el = document.createElement('div')
    el.innerHTML = '<b>same</b>'
    const before = el.firstChild

    expect(_applySafeHtml(el, '<b>same</b>')).toBe(false)
    // Same node identity — nothing was torn down and rebuilt.
    expect(el.firstChild).toBe(before)
  })

  it('treats a nullish value as empty', () => {
    const el = document.createElement('div')
    el.innerHTML = '<b>x</b>'
    expect(_applySafeHtml(el, undefined as unknown as string)).toBe(true)
    expect(el.innerHTML).toBe('')
  })

  it('tolerates a missing ref', () => {
    expect(_applySafeHtml(undefined, '<b>x</b>')).toBe(false)
  })
})

describe('<SafeHtml>', () => {
  it('renders html() on mount', () => {
    const { container } = render(() => <SafeHtml html={() => '<b>hello</b>'} />)
    expect(container.querySelector('b')?.textContent).toBe('hello')
  })

  it('forwards class and data-* attributes', () => {
    const { container } = render(() => (
      <SafeHtml class="prose prose-sm" data-testid="sink" html={() => '<p>x</p>'} />
    ))
    const el = container.querySelector('[data-testid="sink"]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toBe('prose prose-sm')
    expect(el.querySelector('p')?.textContent).toBe('x')
  })

  it('updates when the accessor changes', () => {
    const [html, setHtml] = createSignal('<b>one</b>')
    const { container } = render(() => <SafeHtml html={html} />)
    expect(container.querySelector('b')?.textContent).toBe('one')

    setHtml('<i>two</i>')
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('i')?.textContent).toBe('two')
  })

  it('renders empty html without throwing', () => {
    const { container } = render(() => <SafeHtml html={() => ''} />)
    expect(container.firstElementChild?.innerHTML).toBe('')
  })
})
