/**
 * COEP `credentialless` on the library's iframes (v6.21.0).
 *
 * A host serving `Cross-Origin-Embedder-Policy: credentialless` makes the
 * browser refuse every cross-origin iframe whose own document sends no COEP
 * header. The boolean HTML attribute `credentialless` lifts that, at the cost
 * of the embedded document losing its own cookies — so the library puts it on
 * untrusted hosts only (they already ran cookie-less: no `allow-same-origin`
 * in their sandbox) and never on `TRUSTED_IFRAME_DOMAINS`.
 *
 * Every assertion below checks attribute PRESENCE, never its value: a
 * `credentialless="false"` would still switch the mode on.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { UIResourceRenderer } from './UIResourceRenderer'
import { VideoRenderer } from './VideoRenderer'
import { IframeFallbackLink } from './IframeFallbackLink'
import {
  DEFAULT_MCPUI_CONFIG,
  MCPUIConfigProvider,
  type MCPUIConfig,
} from '../context/MCPUIConfigContext'
import { MCPUIStringsProvider } from '../context/MCPUIStringsContext'
import { isTrustedIframeDomain } from '../services/validation'
import { shouldSetCredentialless, shouldShowIframeFallbackLink } from '../utils/iframe-coep'
import type { UIComponent } from '../types'

afterEach(() => cleanup())

// ─── helpers ────────────────────────────────────────────────────────────

function iframeComponent(url: string): UIComponent {
  return {
    id: 'iframe-1',
    type: 'iframe',
    params: { url, title: 'Embed' },
    position: { colStart: 1, colSpan: 12 },
  } as UIComponent
}

/** Renders `ui` under an optional `<MCPUIConfigProvider>`. */
function renderWithConfig(config: Partial<MCPUIConfig> | undefined, ui: () => JSX.Element) {
  if (!config) return render(ui)
  return render(() => <MCPUIConfigProvider config={config}>{ui()}</MCPUIConfigProvider>)
}

function theIframe(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector('iframe')
  expect(frame, 'expected an iframe in the rendered output').toBeTruthy()
  return frame as HTMLIFrameElement
}

/** Stubs `window.crossOriginIsolated`; returns the restore function. */
function stubCrossOriginIsolated(value: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'crossOriginIsolated')
  Object.defineProperty(window, 'crossOriginIsolated', { value, configurable: true })
  return () => {
    if (original) Object.defineProperty(window, 'crossOriginIsolated', original)
    else delete (window as unknown as Record<string, unknown>).crossOriginIsolated
  }
}

const FALLBACK_LINK = 'a[data-mcp-ui-action="open-external"]'

// ─── isTrustedIframeDomain ──────────────────────────────────────────────

describe('isTrustedIframeDomain', () => {
  it('matches a trusted host exactly', () => {
    expect(isTrustedIframeDomain('https://docs.google.com/document/d/x')).toBe(true)
  })

  it('matches a subdomain of a trusted host', () => {
    expect(isTrustedIframeDomain('https://team.notion.so/page')).toBe(true)
  })

  it('rejects an untrusted host', () => {
    expect(isTrustedIframeDomain('https://www.youtube.com/embed/x')).toBe(false)
  })

  it('rejects a host that merely ends with a trusted name without a dot', () => {
    expect(isTrustedIframeDomain('https://evilnotion.so/page')).toBe(false)
  })

  it('rejects an invalid URL', () => {
    expect(isTrustedIframeDomain('not a url')).toBe(false)
    expect(isTrustedIframeDomain('')).toBe(false)
  })

  it('honours customTrustedDomains, defaults included', () => {
    const options = { customTrustedDomains: ['example.com'] }
    expect(isTrustedIframeDomain('https://example.com/a', options)).toBe(true)
    expect(isTrustedIframeDomain('https://embed.example.com/a', options)).toBe(true)
    // the built-in list still applies
    expect(isTrustedIframeDomain('https://docs.google.com/a', options)).toBe(true)
    expect(isTrustedIframeDomain('https://www.youtube.com/a', options)).toBe(false)
  })
})

// ─── IframeRenderer ─────────────────────────────────────────────────────

describe('IframeRenderer — credentialless', () => {
  it('sets the attribute on an untrusted host, exactly once', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
    ))
    const frame = theIframe(container)
    expect(frame.hasAttribute('credentialless')).toBe(true)
    expect(frame.outerHTML.match(/credentialless/g)?.length).toBe(1)
  })

  it('omits the attribute entirely on a trusted host', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={iframeComponent('https://docs.google.com/document/d/x')} />
    ))
    const frame = theIframe(container)
    expect(frame.hasAttribute('credentialless')).toBe(false)
    expect(frame.outerHTML).not.toContain('credentialless')
  })

  it("iframeCredentialless: 'always' sets it on a trusted host too", () => {
    const { container } = renderWithConfig({ iframeCredentialless: 'always' }, () => (
      <UIResourceRenderer content={iframeComponent('https://docs.google.com/document/d/x')} />
    ))
    expect(theIframe(container).hasAttribute('credentialless')).toBe(true)
  })

  it("iframeCredentialless: 'never' omits it on an untrusted host", () => {
    const { container } = renderWithConfig({ iframeCredentialless: 'never' }, () => (
      <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
    ))
    expect(theIframe(container).hasAttribute('credentialless')).toBe(false)
  })

  it('an unparsable URL is not trusted, so it would get the attribute', () => {
    // Asserted on the helper, not through `<UIResourceRenderer>`: an
    // off-whitelist URL never reaches `IframeRenderer` — `validateComponent`
    // replaces the slot with the validation error card first.
    expect(shouldSetCredentialless('not a url', DEFAULT_MCPUI_CONFIG)).toBe(true)
  })

  it('customTrustedIframeDomains reaches BOTH the attribute and the sandbox', () => {
    // `openstreetmap.org` is in DEFAULT_IFRAME_DOMAINS (so it renders) and is
    // NOT in TRUSTED_IFRAME_DOMAINS (so the config is what makes it trusted).
    const { container } = renderWithConfig(
      { customTrustedIframeDomains: ['openstreetmap.org'] },
      () => (
        <UIResourceRenderer
          content={iframeComponent('https://www.openstreetmap.org/export/embed.html')}
        />
      )
    )
    const frame = theIframe(container)
    expect(frame.hasAttribute('credentialless')).toBe(false)
    // The gap this release closes: `getIframeSandbox` used to be called
    // without options, so a host's custom trusted domains never reached it.
    expect(frame.getAttribute('sandbox')).toContain('allow-same-origin')
  })

  it('leaves the sandbox restrictive for a host the config does not trust', () => {
    const { container } = render(() => (
      <UIResourceRenderer
        content={iframeComponent('https://www.openstreetmap.org/export/embed.html')}
      />
    ))
    const frame = theIframe(container)
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
    expect(frame.hasAttribute('credentialless')).toBe(true)
  })
})

// ─── VideoRenderer ──────────────────────────────────────────────────────

describe('VideoRenderer — credentialless', () => {
  it('sets the attribute on the YouTube embed', () => {
    const { container } = render(() => (
      <VideoRenderer params={{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }} />
    ))
    const frame = theIframe(container)
    expect(frame.getAttribute('src')).toContain('youtube-nocookie.com/embed/')
    expect(frame.hasAttribute('credentialless')).toBe(true)
  })

  it("iframeCredentialless: 'never' omits it on the YouTube embed", () => {
    const { container } = renderWithConfig({ iframeCredentialless: 'never' }, () => (
      <VideoRenderer params={{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }} />
    ))
    expect(theIframe(container).hasAttribute('credentialless')).toBe(false)
  })
})

// ─── Fallback link ──────────────────────────────────────────────────────

describe('iframe fallback link', () => {
  it("iframeFallbackLink: 'always' renders the English default", () => {
    const { container } = renderWithConfig({ iframeFallbackLink: 'always' }, () => (
      <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
    ))
    const link = container.querySelector<HTMLAnchorElement>(FALLBACK_LINK)
    expect(link).toBeTruthy()
    expect(link!.textContent).toBe('Open in a new tab')
    expect(link!.getAttribute('href')).toBe('https://www.youtube.com/embed/x')
    expect(link!.getAttribute('target')).toBe('_blank')
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('takes its label from <MCPUIStringsProvider>', () => {
    const { container } = render(() => (
      <MCPUIStringsProvider strings={{ iframeOpenInNewTab: 'Ouvrir dans un nouvel onglet' }}>
        <MCPUIConfigProvider config={{ iframeFallbackLink: 'always' }}>
          <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
        </MCPUIConfigProvider>
      </MCPUIStringsProvider>
    ))
    expect(container.querySelector(FALLBACK_LINK)?.textContent).toBe(
      'Ouvrir dans un nouvel onglet'
    )
  })

  it("iframeFallbackLink: 'never' renders nothing", () => {
    const { container } = renderWithConfig({ iframeFallbackLink: 'never' }, () => (
      <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
    ))
    expect(container.querySelector(FALLBACK_LINK)).toBeNull()
  })

  it("'auto' hides it on a page that is not cross-origin isolated", () => {
    const restore = stubCrossOriginIsolated(false)
    try {
      const { container } = render(() => (
        <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
      ))
      expect(container.querySelector(FALLBACK_LINK)).toBeNull()
    } finally {
      restore()
    }
  })

  it("'auto' shows it on a cross-origin isolated page", () => {
    const restore = stubCrossOriginIsolated(true)
    try {
      const { container } = render(() => (
        <UIResourceRenderer content={iframeComponent('https://www.youtube.com/embed/x')} />
      ))
      expect(container.querySelector(FALLBACK_LINK)?.textContent).toBe('Open in a new tab')
    } finally {
      restore()
    }
  })

  it('points at the original video URL under a VideoRenderer embed', () => {
    const restore = stubCrossOriginIsolated(true)
    try {
      const { container } = render(() => (
        <VideoRenderer params={{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }} />
      ))
      expect(container.querySelector(FALLBACK_LINK)?.getAttribute('href')).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      )
    } finally {
      restore()
    }
  })

  it('renders nothing when safeUrl() rejects the URL', () => {
    const { container } = renderWithConfig({ iframeFallbackLink: 'always' }, () => (
      // eslint-disable-next-line no-script-url
      <IframeFallbackLink url="javascript:alert(1)" />
    ))
    expect(container.querySelector(FALLBACK_LINK)).toBeNull()
    expect(container.textContent).toBe('')
  })
})

// ─── SSR shape ──────────────────────────────────────────────────────────

/**
 * The repo has no `renderToString` harness (`src/ssr.test.tsx` is an
 * import-smoke suite), so the SSR contract is pinned on the pure decision
 * functions instead — which is where it actually lives:
 *
 * - `shouldSetCredentialless` reads only the URL and the config, so the
 *   attribute is identical on server and client;
 * - `shouldShowIframeFallbackLink` takes `crossOriginIsolated` as an
 *   argument, and `createCrossOriginIsolated()` seeds it to `false` — the
 *   server value — flipping it only in `onMount`. Server markup therefore
 *   never depends on `window.crossOriginIsolated`.
 */
describe('SSR shape', () => {
  it('the credentialless decision does not read any browser global', () => {
    const restore = stubCrossOriginIsolated(true)
    try {
      const isolated = shouldSetCredentialless(
        'https://www.youtube.com/embed/x',
        DEFAULT_MCPUI_CONFIG
      )
      restore()
      const notIsolated = shouldSetCredentialless(
        'https://www.youtube.com/embed/x',
        DEFAULT_MCPUI_CONFIG
      )
      expect(isolated).toBe(notIsolated)
      expect(isolated).toBe(true)
    } finally {
      restore()
    }
  })

  it("'auto' resolves to hidden for the server's crossOriginIsolated value", () => {
    // `false` is what `createCrossOriginIsolated()` renders with before mount,
    // i.e. what the server emits — the link is absent from SSR markup.
    expect(shouldShowIframeFallbackLink(DEFAULT_MCPUI_CONFIG, false)).toBe(false)
    expect(shouldShowIframeFallbackLink(DEFAULT_MCPUI_CONFIG, true)).toBe(true)
  })

  it("'always' / 'never' ignore crossOriginIsolated entirely", () => {
    const always = { ...DEFAULT_MCPUI_CONFIG, iframeFallbackLink: 'always' as const }
    const never = { ...DEFAULT_MCPUI_CONFIG, iframeFallbackLink: 'never' as const }
    expect(shouldShowIframeFallbackLink(always, false)).toBe(true)
    expect(shouldShowIframeFallbackLink(always, true)).toBe(true)
    expect(shouldShowIframeFallbackLink(never, false)).toBe(false)
    expect(shouldShowIframeFallbackLink(never, true)).toBe(false)
  })
})
