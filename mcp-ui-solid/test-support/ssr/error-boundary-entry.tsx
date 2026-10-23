import { renderToString } from '@solidjs/web'
import { GenerativeUIErrorBoundary } from '../../src/components/GenerativeUIErrorBoundary'
import type { RendererError } from '../../src/types'

// Outside src/: this is a real SSR compilation fixture, not a public export.
export function renderBoundaryToString() {
  const errors: RendererError[] = []
  let fallbackCalls = 0
  const ThrowingChild = () => { throw new Error('<unsafe-error>') }
  const html = renderToString(() => (
    <GenerativeUIErrorBoundary
      componentId="ssr-generic-boundary"
      componentType="text"
      onError={error => { errors.push(error) }}
      fallback={error => {
        fallbackCalls++
        return <p data-error-fallback>{error.message}</p>
      }}
    >
      <ThrowingChild />
    </GenerativeUIErrorBoundary>
  ), { renderId: 'ssr-generic-boundary' })
  return { html, errors, fallbackCalls }
}
