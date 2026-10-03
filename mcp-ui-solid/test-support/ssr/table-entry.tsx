/**
 * Server-side entry for src/components/TableRenderer.missing.ssr.test.ts — loaded through
 * Vite's `ssrLoadModule` so it is compiled with Solid's SSR JSX transform and
 * resolves `solid-js/web` to the server build (the vitest pipeline itself
 * compiles for the DOM, where `renderToString` is a stub).
 *
 * Lives outside `src/` because everything under `src/` except `*.test.*` is
 * published to npm (see the package `files` list).
 */
import { renderToString } from 'solid-js/web'
import { UIResourceRenderer } from '../../src/components/UIResourceRenderer'
import { MCPUIStringsProvider, type MCPUIStrings } from '../../src/context/MCPUIStringsContext'

export function renderTableToString(content: unknown, strings?: MCPUIStrings): string {
  return renderToString(() =>
    strings ? (
      <MCPUIStringsProvider strings={strings}>
        <UIResourceRenderer content={content as never} />
      </MCPUIStringsProvider>
    ) : (
      <UIResourceRenderer content={content as never} />
    ),
    // ErrorBoundary (wrapped around every component) asks for a hydration id.
    { renderId: 'ssr-test' }
  )
}
