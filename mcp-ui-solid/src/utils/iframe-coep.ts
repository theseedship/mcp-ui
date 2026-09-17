/**
 * COEP helpers for the two iframes the library renders
 * (`IframeRenderer` in `UIResourceRenderer.tsx`, and the YouTube / Vimeo
 * embed in `VideoRenderer.tsx`).
 *
 * @since v6.21.0
 *
 * A host that serves `Cross-Origin-Embedder-Policy: credentialless` makes the
 * browser refuse any cross-origin iframe whose own document sends no COEP
 * header. The HTML attribute `credentialless` on the `<iframe>` lifts that,
 * at the price of the embedded document losing access to the cookies and
 * storage of its own origin — see `MCPUIConfigContext` for the policy.
 */

import { createSignal, onMount, type Accessor } from 'solid-js'
import { isTrustedIframeDomain } from '../services/validation'
import type { MCPUIConfig } from '../context/MCPUIConfigContext'

/**
 * Does this iframe get the boolean `credentialless` attribute?
 *
 * `'auto'` (the default) says yes for every host that is not trusted — those
 * already run without cookies, since their sandbox has no `allow-same-origin`.
 * An unparsable URL is not trusted, so it gets the attribute.
 */
export function shouldSetCredentialless(url: string, config: MCPUIConfig): boolean {
  const mode = config.iframeCredentialless
  if (mode === 'always') return true
  if (mode === 'never') return false
  return !isTrustedIframeDomain(url, {
    customTrustedDomains: config.customTrustedIframeDomains,
  })
}

/**
 * `window.crossOriginIsolated`, read **after mount** into a signal.
 *
 * Reading it during render would make the server emit markup the client
 * cannot reproduce; the signal starts at `false` (the SSR value) and flips
 * once mounted, so hydration always matches.
 */
export function createCrossOriginIsolated(): Accessor<boolean> {
  const [isolated, setIsolated] = createSignal(false)
  onMount(() => {
    setIsolated(typeof window !== 'undefined' && window.crossOriginIsolated === true)
  })
  return isolated
}

/**
 * Does the "open in a new tab" link show under an embed?
 *
 * `'auto'` shows it only on a cross-origin-isolated page — exactly where COEP
 * can block the frame, and where the blocking is silent (a refused
 * cross-origin document fires no `error` event the parent can observe).
 */
export function shouldShowIframeFallbackLink(
  config: MCPUIConfig,
  crossOriginIsolated: boolean
): boolean {
  const mode = config.iframeFallbackLink
  if (mode === 'always') return true
  if (mode === 'never') return false
  return crossOriginIsolated
}
