# Recipe — Pseudo-elicit → spec elicit adapter

> **Audience** : consumer chat apps that talk to an MCP server still emitting
> a *legacy* "pseudo-elicit" payload inline with `tools/call` results, but
> wanting to use mcp-ui's spec-correct `<ChatPrompt>` / `<ElicitationForm>`
> (MCP 2025-06-18).
>
> **Where this code lives** : in YOUR consumer app, not in mcp-ui. mcp-ui
> stays tool- and server-agnostic by design — it ships the spec helper
> (`elicitationToPromptConfig`, `<ElicitationForm>`) but does NOT bake in
> any vendor-specific wire shape.

## Why this exists

The MCP spec 2025-06-18 defines elicitation as a server→client JSON-RPC
*request* (`elicitation/create`) carrying `{ message, requestedSchema }`,
with `requestedSchema` shaped as a JSON Schema object.

Some servers ship a different convention — they return an `elicitation`
**object inline** in the result of a `tools/call`, with a flat `fields[]`
array instead of a JSON Schema. Example (deposium_MCPs as of 2026-04) :

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "elicitation": {
      "type": "form",
      "title": "Required Parameters Missing",
      "description": "Please provide the following required parameters:",
      "fields": [
        { "name": "tenant_id", "type": "string", "label": "Tenant ID", "required": true, "default": "<uuid>" },
        { "name": "space_id",  "type": "string", "label": "Space ID",  "required": true, "default": "default" }
      ]
    }
  }
}
```

Until that server migrates to spec elicitation, the chat app can adapt the
shape on the fly, then drive `<ElicitationForm>` (or
`elicitationToPromptConfig`) as if everything were spec.

## The adapter (drop-in TypeScript)

```ts
import type { ElicitationEvent, ElicitationPropertySchema } from '@seed-ship/mcp-ui-solid'

interface PseudoElicit {
  type: 'form'
  title: string
  description?: string
  fields: Array<{
    name: string
    type: 'string' | 'number' | 'boolean'
    label?: string
    description?: string
    required?: boolean
    default?: unknown
    enum?: Array<string | number>
  }>
}

/**
 * Convert a pseudo-elicit payload (legacy inline form spec) to a spec-shaped
 * MCP `ElicitationEvent`. Returns `null` if the input does not look like a
 * pseudo-elicit — the caller can then handle the tools/call result normally.
 */
export function pseudoElicitToSpec(toolResult: unknown): ElicitationEvent | null {
  const pseudo = (toolResult as { elicitation?: PseudoElicit })?.elicitation
  if (!pseudo || pseudo.type !== 'form' || !Array.isArray(pseudo.fields)) {
    return null
  }

  const properties: Record<string, ElicitationPropertySchema> = {}
  const required: string[] = []

  for (const field of pseudo.fields) {
    const schema: ElicitationPropertySchema = {
      type: mapType(field.type),
      ...(field.label !== undefined && { title: field.label }),
      ...(field.description !== undefined && { description: field.description }),
      ...(field.default !== undefined && { default: field.default }),
      ...(field.enum && { enum: field.enum }),
    }
    properties[field.name] = schema
    if (field.required) required.push(field.name)
  }

  return {
    message: [pseudo.title, pseudo.description].filter(Boolean).join(' — '),
    requestedSchema: {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    },
  }
}

function mapType(t: string): ElicitationPropertySchema['type'] {
  if (t === 'number' || t === 'boolean') return t
  return 'string' // safe fallback for unknown legacy types
}
```

## Wiring it into the chat app

```ts
import { bus } from './your-bus-instance'
import { ElicitationForm } from '@seed-ship/mcp-ui-solid'
import { pseudoElicitToSpec } from './adapters/pseudo-elicit'

async function callTool(name: string, args: Record<string, unknown>) {
  const response = await mcpClient.callTool(name, args)

  // 1. Check for pseudo-elicit BEFORE treating result as a normal tool output.
  const elicit = pseudoElicitToSpec(response.result)
  if (elicit) {
    showElicitationDialog(elicit, async (content) => {
      // 2. Re-invoke the tool with the collected args merged in.
      return callTool(name, { ...args, ...content })
    })
    return
  }

  // 3. Normal tool output path.
  handleToolResult(response.result)
}

function showElicitationDialog(
  event: ElicitationEvent,
  onAccept: (content: Record<string, unknown>) => Promise<void>
) {
  // Mount <ElicitationForm> in your modal layer, or pipe through the bus :
  bus.events.emit('onElicitation', { streamKey: 'main', elicitation: event })
}
```

If you also want `<ElicitationForm>` to render directly :

```tsx
<Show when={pendingElicit()}>
  <ElicitationForm
    event={pendingElicit()!}
    onAccept={async (content) => {
      setPendingElicit(null)
      await retryToolCall(content)
    }}
    onCancel={() => setPendingElicit(null)}
  />
</Show>
```

## Going both ways (spec + pseudo)

Once your server migrates to real `elicitation/create` (server→client
JSON-RPC request over a bidirectional transport), keep the adapter
in place — it's harmless on a normal `tools/call` result (returns
`null`) and lets you support both wire shapes for the duration of the
rollout.

For the spec path, your transport adapter handles the JSON-RPC request
directly and emits the same `onElicitation` event with a payload that
already matches `ElicitationEvent` — no adapter call needed.

## Reference

- MCP spec : https://spec.modelcontextprotocol.io/specification/2025-06-18/client/elicitation/
- mcp-ui types : `ElicitationEvent`, `ElicitationRequestedSchema`, `ElicitationPropertySchema` (all exported from `@seed-ship/mcp-ui-solid`)
- mcp-ui helpers : `elicitationToPromptConfig` (services/chat-bus), `<ElicitationForm>` (components)
