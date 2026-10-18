/** Real server entry; kept outside the published src tree like table-entry.tsx. */
import { createResource, Suspense } from 'solid-js'
import { isServer, renderToStringAsync } from 'solid-js/web'

export interface SerializationPayload {
  labels: Map<string, string>
  created: Date
  bytes: Uint8Array
  ready: Promise<string>
}

function ResourceView(props: { payload: SerializationPayload }) {
  const [resource] = createResource(() => Promise.resolve(props.payload))

  return (
    <Suspense fallback={<p>Loading serialization fixture</p>}>
      <p data-security-serialization>
        {resource()?.labels.get('status')}|{resource()?.created.toISOString()}|
        {resource()?.bytes.join(',')}
      </p>
    </Suspense>
  )
}

export async function renderSerializedResource(payload: SerializationPayload) {
  return {
    isServer,
    html: await renderToStringAsync(() => <ResourceView payload={payload} />, {
      renderId: 'security-serialization-',
    }),
  }
}
