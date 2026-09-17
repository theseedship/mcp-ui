/**
 * IframeFallbackLink — the way out of a silently blocked embed.
 *
 * @since v6.21.0
 *
 * An iframe refused by `Cross-Origin-Embedder-Policy` fires no event the
 * parent page can observe (`onerror` does not fire for a rejected
 * cross-origin document), so the user is left with a blank frame and no
 * explanation. This link, rendered under the frame, always works.
 *
 * Visibility follows `MCPUIConfig.iframeFallbackLink`; `'auto'` (the default)
 * shows it only on a cross-origin-isolated page. The URL goes through
 * `safeUrl` — an unsafe one renders nothing at all.
 */

import { createMemo, Show, type JSX } from 'solid-js'
import { safeUrl } from '../utils/safe-url'
import { useMCPUIStrings } from '../context/MCPUIStringsContext'
import { useMCPUIConfig } from '../context/MCPUIConfigContext'
import {
  createCrossOriginIsolated,
  shouldShowIframeFallbackLink,
} from '../utils/iframe-coep'

export interface IframeFallbackLinkProps {
  /** The embedded URL. Bound to `href` only when `safeUrl` accepts it. */
  url: string
  /** Extra classes on the wrapping `<div>`. */
  class?: string
}

export function IframeFallbackLink(props: IframeFallbackLinkProps): JSX.Element {
  const strings = useMCPUIStrings()
  const config = useMCPUIConfig()
  const crossOriginIsolated = createCrossOriginIsolated()

  const href = createMemo(() => safeUrl(props.url))
  const visible = createMemo(
    () => !!href() && shouldShowIframeFallbackLink(config, crossOriginIsolated())
  )

  return (
    <Show when={visible()}>
      <div class={`px-4 py-2 text-right ${props.class || ''}`}>
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          data-mcp-ui-action="open-external"
          class="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
        >
          {strings.iframeOpenInNewTab}
        </a>
      </div>
    </Show>
  )
}
