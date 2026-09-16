/**
 * href / src allow-listing across renderers (v6.19.0).
 *
 * Every attribute that navigates or loads a resource goes through `safeUrl`,
 * so a producer (or an LLM) cannot smuggle a `javascript:` or `data:text/html`
 * URL into an anchor or an image.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { UIResourceRenderer } from './UIResourceRenderer'
import { FooterRenderer } from './FooterRenderer'
import { ArtifactRenderer } from './ArtifactRenderer'
import type { UIComponent, FooterComponentParams, ArtifactComponentParams } from '../types'

afterEach(() => cleanup())

const comp = (type: string, params: Record<string, unknown>) =>
  ({ id: `${type}-1`, type, position: { colStart: 1, colSpan: 12 }, params }) as unknown as UIComponent

describe('image component', () => {
  it('drops a javascript: url from both the anchor and the img', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={comp('image', { url: 'javascript:alert(1)', alt: 'x' })} />
    ))
    expect(container.querySelector('a[href]')).toBeNull()
    expect(container.querySelector('img[src]')).toBeNull()
    expect(container.innerHTML).not.toContain('javascript:')
  })

  it('keeps an https url on both the anchor and the img', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={comp('image', { url: 'https://ok.test/a.png', alt: 'x' })} />
    ))
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://ok.test/a.png')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://ok.test/a.png')
  })

  it('allows a base64 data:image src but never a data:text/html one', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const ok = render(() => <UIResourceRenderer content={comp('image', { url: png, alt: 'x' })} />)
    expect(ok.container.querySelector('img')?.getAttribute('src')).toBe(png)
    cleanup()
    const bad = render(() => (
      <UIResourceRenderer content={comp('image', { url: 'data:text/html;base64,PHNjcmlwdD4=', alt: 'x' })} />
    ))
    expect(bad.container.querySelector('img[src]')).toBeNull()
  })
})

describe('link component', () => {
  it('drops a javascript: url and keeps an https one', () => {
    const bad = render(() => (
      <UIResourceRenderer content={comp('link', { url: 'javascript:alert(1)', label: 'x' })} />
    ))
    expect(bad.container.querySelector('a[href]')).toBeNull()
    cleanup()
    const ok = render(() => (
      <UIResourceRenderer content={comp('link', { url: 'https://ok.test/doc', label: 'x' })} />
    ))
    expect(ok.container.querySelector('a')?.getAttribute('href')).toBe('https://ok.test/doc')
  })
})

describe('action component rendered as a link', () => {
  it('falls back to "#" for a javascript: url and keeps an https one', () => {
    const bad = render(() => (
      <UIResourceRenderer content={comp('action', { type: 'link', label: 'Go', url: 'javascript:alert(1)' })} />
    ))
    const a = bad.container.querySelector('a')
    expect(a?.getAttribute('href') ?? '#').toBe('#')
    expect(bad.container.innerHTML).not.toContain('javascript:')
    cleanup()
    const ok = render(() => (
      <UIResourceRenderer content={comp('action', { type: 'link', label: 'Go', url: 'https://ok.test' })} />
    ))
    expect(ok.container.querySelector('a')?.getAttribute('href')).toBe('https://ok.test')
  })
})

describe('footer and artifact renderers', () => {
  it('footer links: javascript: dropped, https kept', () => {
    const { container } = render(() => (
      <FooterRenderer
        params={{ links: [{ label: 'bad', url: 'javascript:alert(1)' }, { label: 'ok', url: 'https://ok.test' }] } as FooterComponentParams}
      />
    ))
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('javascript:alert(1)')
    expect(hrefs).toContain('https://ok.test')
  })

  it('artifact download link: javascript: dropped, https kept', () => {
    const bad = render(() => (
      <ArtifactRenderer params={{ url: 'javascript:alert(1)', filename: 'x.txt' } as ArtifactComponentParams} />
    ))
    expect(bad.container.querySelector('a[href]')).toBeNull()
    cleanup()
    const ok = render(() => (
      <ArtifactRenderer params={{ url: 'https://ok.test/x.txt', filename: 'x.txt' } as ArtifactComponentParams} />
    ))
    expect(ok.container.querySelector('a')?.getAttribute('href')).toBe('https://ok.test/x.txt')
  })
})
