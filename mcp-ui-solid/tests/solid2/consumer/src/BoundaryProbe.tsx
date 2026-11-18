import { createSignal, Show } from 'solid-js'
import { isServer } from '@solidjs/web'
import { GenerativeUIErrorBoundary } from '@seed-ship/mcp-ui-solid'
import type { RendererError } from '@seed-ship/mcp-ui-solid/types'

const serverMessage = '<mcpui-fixture-ssr-error>'
const clientMessage = '<mcpui-fixture-client-error>'

function ThrowingChild(props: { message: string }): never {
  throw new Error(props.message)
}

function ServerCallbackProof(props: { errors: RendererError[] }) {
  // Run inside the fallback, after the boundary's synchronous notification.
  // Sibling JSX construction can precede lazy streaming SSR evaluation.
  if (isServer) {
    const [error] = props.errors
    const expectedMessage = import.meta.env.PROD ? 'Internal Server Error' : serverMessage
    if (props.errors.length !== 1 || error?.type !== 'render' || error?.componentId !== 'packed-ssr-boundary' ||
      error?.message !== expectedMessage || error.details?.userAgent !== 'server' || error.details?.renderDuration !== 0 ||
      error.details?.retryCount !== 0 || error.details?.viewport?.width !== 0 || error.details?.viewport?.height !== 0) {
      throw new Error('Packed boundary did not deliver one valid synchronous SSR onError callback')
    }
  }
  return <output id="boundary-ssr-callback-proof" data-result="one-valid-server-callback" hidden />
}

export function BoundaryProbe() {
  const serverErrors: RendererError[] = []
  const [triggered, setTriggered] = createSignal(false)
  const [clientErrors, setClientErrors] = createSignal<RendererError[]>([])

  return <section id="boundary-fixture">
    <GenerativeUIErrorBoundary componentId="packed-ssr-boundary" componentType="text"
      onError={error => { if (isServer) serverErrors.push(error) }}
      fallback={error => <><p id="boundary-ssr-fallback">{error.message}</p>
        <ServerCallbackProof errors={serverErrors} /></>}>
      <ThrowingChild message={serverMessage} />
    </GenerativeUIErrorBoundary>
    <button id="boundary-trigger" onClick={() => setTriggered(true)}>Trigger client render error</button>
    <Show when={triggered()}>
      <GenerativeUIErrorBoundary componentId="packed-client-boundary" componentType="text"
        onError={error => setClientErrors(previous => [...previous, error])}
        fallback={error => <p id="boundary-client-fallback">{error.message}</p>}>
        <ThrowingChild message={clientMessage} />
      </GenerativeUIErrorBoundary>
    </Show>
    <output id="boundary-client-errors" hidden>{JSON.stringify(clientErrors().map(error => ({
      type: error.type, componentId: error.componentId, message: error.message,
      retryCount: error.details?.retryCount, userAgent: error.details?.userAgent,
    })))}</output>
  </section>
}
