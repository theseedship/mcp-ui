# Recipe — Wire `<FeedbackInline>` to a feedback HTTP endpoint

> **Audience** : consumer apps that ship `<FeedbackInline>` (per-message
> thumbs-up/down) and want to persist ratings to a backend.
>
> mcp-ui's `<FeedbackInline>` is intentionally endpoint-agnostic — it
> calls `onSubmit(rating, context)` and the consumer owns the HTTP / store
> wiring. This recipe shows the most common pattern, using the Deposium
> `POST /api/feedback` endpoint as a concrete example.

## What `<FeedbackInline>` gives you

```tsx
<FeedbackInline
  messageHash={msg.hash}
  context={{ intent: msg.intent, confidenceBand: msg.band }}
  onSubmit={(rating, context) => persistFeedback(rating, context)}
/>
```

The component :
- Renders two buttons (positive / negative).
- Flips to "submitted" optimistically on click — UI does NOT revert on network error (best-effort design).
- Calls `onSubmit('positive' | 'negative', context?)` exactly once.

`rating` already matches the shape Deposium expects. Mapping is direct.

## Endpoint reference (Deposium)

`POST /api/feedback` — no auth required, behind the chat-stream / standard
middleware chain.

### Request body

```ts
interface FeedbackRequest {
  message_hash: string                           // REQUIRED — message ID being rated
  rating: 'positive' | 'negative' | 'partial'
  confidence_band?: 'high' | 'medium' | 'low'    // optional, free-form string
  intent?: string                                // optional, e.g. 'search_query'
  space_ids?: string[] | string | null
  comment?: string
  tenant_id?: string
}
```

### Response

| Status | Body |
|---|---|
| 200    | `{ ok: true, id: 'fb_<timestamp>_<rand4>' }` |
| 400    | `{ error: 'rating must be one of: positive, negative, partial' }` |

### Side effects (worth knowing)

- `INSERT` into `logs.feedback` (PostgreSQL) — drives dashboard analytics.
- `'positive' | 'negative'` ratings also update
  `logs.intent_classifications.feedback_success`. `'partial'` does **not**
  propagate (intentional — neither true nor false).

## Wiring (the recipe)

```tsx
import { FeedbackInline, type FeedbackInlineContext } from '@seed-ship/mcp-ui-solid'

function persistFeedback(
  messageHash: string,
  rating: 'positive' | 'negative',
  ctx?: FeedbackInlineContext
): Promise<void> {
  return fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_hash: messageHash,
      rating, // 'positive' | 'negative' — matches endpoint as-is
      ...(ctx?.intent && { intent: ctx.intent }),
      ...(ctx?.confidenceBand && { confidence_band: ctx.confidenceBand }),
      ...(ctx?.tenantId && { tenant_id: ctx.tenantId }),
      ...(ctx?.spaceIds && { space_ids: ctx.spaceIds }),
      ...(ctx?.comment && { comment: ctx.comment }),
    }),
  }).then(async (res) => {
    if (!res.ok) {
      console.warn('[feedback] persist failed', res.status, await res.text())
    }
  }).catch((err) => {
    // Silent failure — UI is already in the optimistic "submitted" state.
    console.warn('[feedback] network error', err)
  })
}

function MessageRow(props: { msg: ChatMessage }) {
  return (
    <div class="message-row">
      <p>{props.msg.text}</p>
      <FeedbackInline
        messageHash={props.msg.hash}
        context={{
          intent: props.msg.intent,
          confidenceBand: props.msg.confidenceBand,
        }}
        onSubmit={(rating, ctx) => persistFeedback(props.msg.hash, rating, ctx)}
      />
    </div>
  )
}
```

## Variations

### "Partial" rating

`<FeedbackInline>` emits only `'positive'` / `'negative'`. If you need a
third state (`'partial'`), build a separate UI (e.g. a star rating or a
3-button row) and call the endpoint directly with `rating: 'partial'`.

### Free-text comment

Add a textarea below `<FeedbackInline>` that opens after the rating click.
Send a follow-up `POST /api/feedback` with the same `message_hash` and a
`comment` field — the endpoint accepts multiple records per message.

### Optimistic vs strict semantics

Default behavior is best-effort (UI never reverts). If you need stricter
semantics — offline retry queue, edit-rating UX — wrap `<FeedbackInline>`
in your own component and own the state externally instead of relying on
the component's internal flip.

## Where this code lives

In your consumer app. mcp-ui ships `<FeedbackInline>` and the `onSubmit`
contract; the HTTP wiring (URL, auth, retry policy, schema mapping) is
the consumer's responsibility by design — same pattern as
`pseudo-elicit-spec-adapter`.

## Reference

- mcp-ui component : `<FeedbackInline>` (exported from `@seed-ship/mcp-ui-solid`)
- mcp-ui types : `FeedbackInlineProps`, `FeedbackInlineContext`
- Deposium endpoint : `POST /api/feedback` — see deposium_MCPs `src/routes/feedback.ts`
