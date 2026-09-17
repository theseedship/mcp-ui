/**
 * MCPUIConfigContext — host-level rendering policy for the library's iframes.
 *
 * @since v6.21.0
 *
 * ## Why
 *
 * A host that serves `Cross-Origin-Embedder-Policy: credentialless` makes the
 * browser refuse every cross-origin iframe whose own document does not send a
 * COEP header — which is YouTube, Vimeo, Google Docs, Notion and nearly all of
 * `DEFAULT_IFRAME_DOMAINS`. The escape hatch is the boolean HTML attribute
 * `credentialless` on the `<iframe>` itself: the document then loads, but
 * without access to the cookies and storage of its own origin.
 *
 * That trade-off is free for a public video or chart and fatal for an
 * authenticated embed, so the library keys it on the distinction it already
 * makes: `TRUSTED_IFRAME_DOMAINS` (the hosts that receive `allow-same-origin`
 * because they need their own cookies) do NOT get the attribute; everything
 * else does. This context lets a host override that, add its own trusted
 * hosts, and control the "open in a new tab" fallback link.
 *
 * ## Scope — policy only, NOT strings
 *
 * Text lives in `MCPUIStrings` (`MCPUIStringsContext`). This context carries
 * only behavioural switches, and like the strings context every renderer works
 * standalone: with no provider mounted, `DEFAULT_MCPUI_CONFIG` applies.
 *
 * @example
 * ```tsx
 * import { MCPUIConfigProvider } from '@seed-ship/mcp-ui-solid'
 *
 * <MCPUIConfigProvider config={{ customTrustedIframeDomains: ['embed.acme.com'] }}>
 *   <App />
 * </MCPUIConfigProvider>
 * ```
 */

import { createContext, mergeProps, useContext, type JSX } from 'solid-js'
import type { IframePolicy } from '../types'

/**
 * Host-level rendering policy. Every field has a default — a provider passes
 * a partial override.
 */
export interface MCPUIConfig {
  /**
   * When the library puts the boolean `credentialless` attribute on an
   * `<iframe>` it renders.
   *
   * - `'auto'` (default) — on every iframe whose host is NOT in
   *   `TRUSTED_IFRAME_DOMAINS` (plus `customTrustedIframeDomains`). Those
   *   hosts already ran without cookies, since their sandbox has no
   *   `allow-same-origin`; the attribute is what unblocks them under COEP.
   * - `'always'` — on every iframe, trusted hosts included. An authenticated
   *   embed will then render its login screen.
   * - `'never'` — never. The right value for a host that sends no COEP header
   *   and does not want its embeds to lose their cookies.
   *
   * Chrome/Edge 110+ honour the attribute; Firefox ignores it (iframes stay
   * blocked while the host sends COEP); Safari ignores the COEP value itself,
   * so nothing is blocked there in the first place.
   */
  iframeCredentialless: 'auto' | 'always' | 'never'

  /**
   * Extra hosts treated as trusted, on top of `TRUSTED_IFRAME_DOMAINS`:
   * no `credentialless` attribute, and `allow-same-origin` in the sandbox.
   * A subdomain of a listed host matches too.
   *
   * This only RECLASSIFIES a host the allow-list already accepts. To render an
   * iframe whose host is outside `DEFAULT_IFRAME_DOMAINS`, add it to
   * {@link MCPUIConfig.customIframeDomains} with `iframePolicy: 'extend'`.
   */
  customTrustedIframeDomains: string[]

  /**
   * How `UIResourceRenderer` validates an `iframe` component's host:
   * `'strict'` (default) accepts `DEFAULT_IFRAME_DOMAINS` only, `'extend'`
   * also accepts {@link MCPUIConfig.customIframeDomains}.
   */
  iframePolicy: IframePolicy

  /**
   * Extra hosts the allow-list accepts when `iframePolicy` is `'extend'`.
   * Without this, a component pointing at an unlisted host is replaced by the
   * validation card before any renderer runs.
   */
  customIframeDomains: string[]

  /**
   * When the library renders an "open in a new tab" link under an embed
   * (`strings.iframeOpenInNewTab`).
   *
   * A COEP-blocked iframe fires no event the parent page can observe, so
   * without this the user sees an unexplained blank frame.
   *
   * - `'auto'` (default) — only when the page is cross-origin isolated
   *   (`window.crossOriginIsolated`). That flag needs COOP `same-origin` AND
   *   COEP, so a host that sends COEP alone still blocks embeds while the
   *   flag is false: set `'always'` there. Read after mount, never during
   *   render, so SSR markup and hydration agree.
   * - `'always'` / `'never'` — unconditional.
   */
  iframeFallbackLink: 'auto' | 'always' | 'never'
}

/**
 * Defaults. Chosen so a host that sends no COEP header sees no change from
 * 6.20.0 apart from the fallback link, which `'auto'` keeps hidden there.
 */
export const DEFAULT_MCPUI_CONFIG: MCPUIConfig = {
  iframeCredentialless: 'auto',
  customTrustedIframeDomains: [],
  iframePolicy: 'strict',
  customIframeDomains: [],
  iframeFallbackLink: 'auto',
}

export const MCPUIConfigContext = createContext<MCPUIConfig>(DEFAULT_MCPUI_CONFIG)

/**
 * Reads the active host config. Returns `DEFAULT_MCPUI_CONFIG` when no
 * `<MCPUIConfigProvider>` is mounted above.
 */
export function useMCPUIConfig(): MCPUIConfig {
  return mergeProps(DEFAULT_MCPUI_CONFIG, useContext(MCPUIConfigContext))
}

export interface MCPUIConfigProviderProps {
  /**
   * Partial override of the host config. Any key left unset falls back to
   * `DEFAULT_MCPUI_CONFIG`.
   */
  config?: Partial<MCPUIConfig>
  children: JSX.Element
}

/**
 * Provides the host config to every MCP-UI renderer below it.
 * Merges the partial `config` override over the defaults.
 */
export function MCPUIConfigProvider(props: MCPUIConfigProviderProps): JSX.Element {
  // The function source keeps replacement `config` objects reactive while
  // mergeProps fills any omitted key without taking a one-time snapshot.
  const value = mergeProps(DEFAULT_MCPUI_CONFIG, () => props.config)
  return (
    <MCPUIConfigContext.Provider value={value}>
      {props.children}
    </MCPUIConfigContext.Provider>
  )
}
