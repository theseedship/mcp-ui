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
 * `'auto'` (the default) says yes only when the embed has nothing to lose:
 * the host is not trusted AND the iframe already runs without cookies because
 * its `sandbox` has no `allow-same-origin` (`sandboxedWithoutSameOrigin`).
 * The video embed carries no sandbox, so in `'auto'` it keeps its provider
 * cookies and a COEP host must opt in with `'always'`.
 *
 * An unparsable URL is not trusted, so it gets the attribute.
 *
 * Takes a RESOLVED config — `MCPUIConfig`, which is what `useMCPUIConfig()`
 * and `DEFAULT_MCPUI_CONFIG` hand out, every key present. The authored view is
 * `MCPUIConfigInput`, whose fields are optional so that a new key stays
 * backward compatible; accepting one of those here would mean re-implementing
 * the defaults next to their source, and silently drifting from them.
 */
export function shouldSetCredentialless(
  url: string,
  config: MCPUIConfig,
  options: { sandboxedWithoutSameOrigin: boolean }
): boolean {
  const mode = config.iframeCredentialless
  if (mode === 'always') return true
  if (mode === 'never') return false
  if (!options.sandboxedWithoutSameOrigin) return false
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
 *
 * Takes a resolved config, for the reason given on `shouldSetCredentialless`.
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
