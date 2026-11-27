/** Real server entry; kept outside the published src tree like table-entry.tsx. */
import { createMemo, Loading } from 'solid-js'
import { isServer, renderToStream } from "@solidjs/web";

export interface SerializationPayload {
  labels: Map<string, string>
  created: Date
  bytes: Uint8Array
  ready: Promise<string>
}

function ResourceView(props: { payload: SerializationPayload }) {
  const resource = createMemo(() => Promise.resolve(props.payload))

  return (
    <Loading fallback={<p>Loading serialization fixture</p>}>
      <p data-security-serialization>
        {resource()?.labels.get('status')}|{resource()?.created.toISOString()}|
        {resource()?.bytes.join(',')}
      </p>
    </Loading>
  )
}

export async function renderSerializedResource(payload: SerializationPayload) {
  return {
    isServer,
    html: await renderToStream(() => <ResourceView payload={payload} />, {
      renderId: 'security-serialization-',
    }),
  }
}
