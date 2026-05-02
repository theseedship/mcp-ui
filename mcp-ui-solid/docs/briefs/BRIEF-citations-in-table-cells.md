# Brief — Citation chips inside `TableRenderer` cells

> **Status** : drafted 2026-05-02. Validated end-to-end via a server-side
> bridge in deposium_MCPs (commit `7df433ae`). Brief proposes lifting the
> chip-rendering responsibility into `mcp-ui-solid` so consumers stop
> mirroring chip HTML byte-for-byte.
>
> **Audience** : `@seed-ship/mcp-ui-solid` maintainer.
>
> **Effort** : ~half a day (helper + one renderCellValue branch + tests).
> Backward compatible (opt-in via new `params.citationMap`).

---

## 1. The user-facing problem

A table emitted via `ui_layout` `type: 'table'` with cells like
`"[1] ; [4] ; [6]"` (LLM citation markers) renders the markers as
**plain text** inside the MCP-UI grid. The host app (e.g. Solid chat
UI) has its own `transformCitationReferences` pipeline that turns
`[📄 CITATION N]` markers into clickable chips, but that pipeline
runs on `marked.parse(content)` HTML — it never reaches cells inside
`TableRenderer`, because `renderCellValue` operates on cell strings
independently.

Concretely (from a deposium chat answer with citations) :

```
| Rang | Entité            | …  | Citations            |
| ---- | ----------------- | -- | -------------------- |
| 1    | MSP               | …  | [1] ; [4] ; [6]      |  ← plain text, not clickable
| 2    | Milieu Consulting | …  | [3] ; [4] ; [8]      |
```

The host app's user clicks the citation expecting the source-doc
panel to open ; nothing happens. Same answer rendered as inline
markdown table (no `ui_layout`) DOES produce clickable chips because
the host `transformCitationReferences` walks `<td>` content of the
`marked.parse` output. So we have a feature gap : MCP-UI styling
(search inside, sort, export) costs us clickable citations.

## 2. What already works in MCP-UI v5.6.0

`renderCellValue` in `UIResourceRenderer.tsx` (L290 → L366) already
detects HTML in cell values and pipes through `DOMPurify.sanitize`
with this whitelist (L350-352) :

```ts
ALLOWED_TAGS: ['a', 'strong', 'em', 'b', 'i', 'code', 'span', 'br',
               'button', 'svg', 'path'],
ALLOWED_ATTR: ['href', 'target', 'rel', 'class',
               'data-citation-page', 'data-citation-source',
               'data-citation-doc', 'data-citation-verified',
               'title', 'fill', 'stroke', 'viewBox',
               'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'd'],
ADD_ATTR: ['target', 'rel'],
```

Critically, `data-citation-page`, `data-citation-doc`, and
`data-citation-verified` are explicitly allowed. So if a cell value is
already valid chip HTML — `<span class="citation-ref"><button
data-citation-page="5" data-citation-doc="…">…</button></span>` —
it survives DOMPurify and renders as a clickable chip in the cell.

The host's click handler typically uses event delegation
(`target.closest('[data-citation-page]')`), so clicks inside MCP-UI
cells route to the same citation panel as inline markdown chips.
Confirmed working in deposium 2026-05-02.

## 3. The current bridge (what to replace)

deposium_MCPs (commit `7df433ae`) added two server-side helpers :

- `renderCitationChipHTML(pageNum, fileName, verified)` — emits the
  exact chip HTML shape that Solid `createCitationButton`
  produces, with the same Tailwind classes + the 3 `data-citation-*`
  attributes.
- `replaceCitationsInCellHTML(cellText, citationMap)` — walks a cell
  string, normalizes bare `[N]` / `Citation [N]` to canonical
  `[📄 CITATION N]`, then replaces each marker with chip HTML.

Used in `rag.ts` at the point where markdown tables are extracted from
the LLM answer and emitted as `ui_layout` table components.

**Why this is fragile and should move upstream** :

1. **Byte-coupling** — the chip shape (CSS classes, attribute names,
   SVG markup) lives twice : in `mcp-ui-solid`'s consumer (Solid host
   `createCitationButton`) AND mirrored in deposium_MCPs. A change in
   one site breaks visual consistency.
2. **Per-consumer reinvention** — every MCP server that wants
   clickable cells will write the same mirror. Most won't.
3. **Sanitization risk** — server emits raw HTML. If a future
   deposium_MCPs change forgets DOMPurify-allowed shape, cells break
   silently.
4. **citationMap leakage** — server has the map already (it sent it
   via SSE `citation_map`), but bridge consumers must thread the same
   map through to every helper call. mcp-ui-solid could just take it
   as a `params.citationMap` once.

## 4. Proposed API

### 4.1 New `params.citationMap` (opt-in)

`UIComponent` `type: 'table'` accepts an optional `citationMap` :

```ts
type TableParams = {
  // existing :
  title?: string
  columns: Array<{ key: string; label: string; sortable?: boolean; … }>
  rows: Array<Record<string, unknown>>
  exportable?: boolean | { formats?: ('csv' | 'tsv' | 'json')[]; filename?: string }
  searchable?: boolean | 'auto'
  virtualize?: { enabled: boolean; rowHeight?: number; … }
  pageSize?: number
  // NEW :
  citationMap?: Record<number, {
    page: number | string
    file?: string
    file_id?: number | string
  }>
}
```

When `citationMap` is provided, `renderCellValue` runs an additional
transform on cell strings : matching `[📄 CITATION N]` (and bare
`[N]`, `Citation [N]`) markers are replaced with chip HTML before the
existing DOMPurify pass.

### 4.2 Chip HTML shape

The chip shape is intentionally identical to what consumers commonly
ship for inline markdown chips, so a single CSS class graph styles
both. Default chip :

```html
<span class="citation-ref inline-flex items-center gap-0.5 align-middle">
  <span class="text-gray-500">[Doc - 5]</span>
  <button class="inline-flex items-center ml-0.5 px-1 py-0.5 text-xs
                 bg-gray-800 hover:bg-gray-700 border border-gray-600
                 hover:border-teal-500 rounded cursor-pointer
                 transition-colors align-middle"
          data-citation-page="5"
          data-citation-doc="<URI-encoded fileName>"
          data-citation-verified="true"
          title="View source - Doc - 5">
    <svg class="w-3 h-3" …>…</svg>
  </button>
</span>
```

Open question : should mcp-ui-solid ship its own neutral chip class
graph (e.g. `mcp-ui-citation-chip`), or deliberately match the
deposium-style classes ? See §7.

### 4.3 Optional override : `params.citationRender`

For consumers that need a different chip shape (different button
text, different URL scheme, web-citation vs doc-citation), accept
an optional render function :

```ts
type TableParams = {
  // …
  citationMap?: Record<number, { page; file?; file_id? }>
  citationRender?: (
    id: number,
    mapping: { page; file?; file_id? } | undefined
  ) => string  // returns sanitized HTML string
}
```

When both are provided, `citationRender` wins. The default render
(used when only `citationMap` is set) is the chip shape in §4.2.

This keeps the common case zero-config (just pass `citationMap`)
while letting heavy users opt out of the default shape.

## 5. Implementation sketch

In `UIResourceRenderer.tsx`, extend `renderCellValue` with an
optional `citationCtx` arg :

```ts
type CitationCtx = {
  map: Record<number, { page; file?; file_id? }>
  render?: (id: number, mapping: any) => string
}

function defaultCitationChip(
  pageNum: number | string,
  fileName: string,
  verified: boolean = true
): string {
  const safeDocName = encodeURIComponent(fileName || '')
  const label = fileName ? `${fileName} - ${pageNum}` : `${pageNum}`
  if (!verified) {
    return `<span class="citation-ref opacity-60">…line-through label…</span>`
  }
  return `<span class="citation-ref inline-flex …"><span>[${label}]</span><button data-citation-page="${pageNum}" data-citation-doc="${safeDocName}" data-citation-verified="true" …><svg …/></button></span>`
}

function transformCellCitations(text: string, ctx: CitationCtx): string {
  // 1. normalize bare [N], `Citation [N]`, `[CITATION N]` → `[📄 CITATION N]`
  let out = text.replace(/(?<![p.])\[(\d{1,2})\](?!\()/g, '[📄 CITATION $1]')
  out = out.replace(/\bCitations?\s*\[(\d+)\]/gi, '[📄 CITATION $1]')
  out = out.replace(/\[CITATION\s+(\d+)\]/gi, '[📄 CITATION $1]')
  // 2. replace each marker with chip HTML
  return out.replace(
    /[【[]\s*📄\s*CITATION\s*(\d+)\s*[】\]]/gi,
    (_m, idStr) => {
      const id = parseInt(idStr, 10)
      const mapping = ctx.map[id]
      if (ctx.render) return ctx.render(id, mapping)
      if (mapping) return defaultCitationChip(mapping.page, mapping.file ?? '', true)
      // unresolved : drop silently when map populated (likely hallucination),
      // else fallback placeholder
      return Object.keys(ctx.map).length > 0 ? '' : `[réf. ${id}]`
    },
  )
}

export function renderCellValue(value: any, citationCtx?: CitationCtx): string {
  // … existing body …
  // After existing string conversion + cleanup, BEFORE the markdown-link /
  // hasHtml / hasMarkdown branches, run the citation transform if ctx set :
  if (citationCtx && typeof strValue === 'string') {
    strValue = transformCellCitations(strValue, citationCtx)
  }
  // …rest unchanged (markdown link, hasHtml → DOMPurify with whitelist)…
}
```

The `TableRenderer` body (L641 + L680) passes `citationCtx` from
`tableParams` :

```ts
const citationCtx = tableParams.citationMap
  ? { map: tableParams.citationMap, render: tableParams.citationRender }
  : undefined

// later in <td>…
<div innerHTML={highlightQuery(
  renderCellValue(row[column.key], citationCtx),
  debouncedQuery(),
)} />
```

The DOMPurify pass downstream (the existing `hasHtml` branch) keeps
the chip intact because the citation attributes are already
whitelisted (§2).

## 6. Test plan

### 6.1 Unit (`tests/components/TableRenderer.citation.test.tsx`)

- `citationMap` not set → cells render plain text (regression check)
- `citationMap = {1:{page:5, file:'A.pdf'}}`, cell `"[1]"` → cell HTML
  contains `data-citation-page="5"`, `data-citation-doc="A.pdf"`, click
  on the button bubbles a delegated event with the right attributes
- Multi-citation cell `"[1] ; [2]"` → 2 chips in cell
- Unresolved id `"[99]"` with non-empty map → cell empty (silently
  dropped, mirror of typical host behavior on LLM hallucinations)
- Unresolved id with no map → cell has `[réf. 99]` placeholder
- `citationRender` override → wins over default shape
- `[p.5]` page-form → NOT touched (negative lookbehind)
- `[text](url)` markdown link → NOT touched (negative lookahead)
- Cell with mixed `**bold** [1]` → bold becomes `<strong>` AND chip
  rendered (both transforms compose : citation first, then existing
  marked-on-markdown branch ; the chip HTML survives marked because
  it's `<span>` content, not markdown syntax)
- DOMPurify pass preserves all 3 `data-citation-*` attributes

### 6.2 Integration

- Render a table with 10 rows, 6 columns, 5 citations per row,
  `citationMap` of 8 entries → DOM has 50 `[data-citation-page]`
  buttons, click delegation works (jsdom event simulation)
- Search input filtering by entity name does not break chip HTML
  (highlightQuery should skip `<span>`/`<button>` content — already
  handled by L283 `(<[^>]+>)|([^<]+)` pattern)
- CSV export of a table with chips → chips serialized as plain text
  fallback (e.g. `[Doc - 5]` from the visible label, NOT the raw
  `[📄 CITATION 1]` marker) — see §7 open question

## 7. Open questions

1. **Chip CSS class neutrality** — the deposium chip uses
   `bg-deposium-slate-800`, `text-deposium-teal-400` etc. (a
   custom Tailwind palette). The default chip shape proposed here uses
   generic `bg-gray-800 text-teal-400` — works in any Tailwind setup
   but won't visually match a host with a custom palette. Options :
   (a) ship neutral classes + let host override via CSS `.citation-ref`
   selector ; (b) accept a `chipClasses?: { wrapper, label, button }`
   prop on table params ; (c) use unprefixed semantic CSS variables.
   Recommendation : (a) for v1 simplicity — hosts already style
   `.citation-ref` for their own inline markdown chips, so neutral
   tailwind classes layered with host CSS gives consistent rendering
   for free.

2. **Export serialization** — when exporting a table with chips to
   CSV, the chip HTML should NOT survive (commas in HTML, opaque
   markup). Should `getTableCSV` (called by export menu) strip chips
   to their visible label `[Doc - 5]`, or to the original
   `[📄 CITATION 1]` marker, or to just the page number ? Probably
   visible label ; tests should pin one choice.

3. **Server-side normalization scope** — the `[N]` → `[📄 CITATION N]`
   normalize step uses negative lookbehind `(?<![p.])` to avoid
   `[p.5]` (page form). This duplicates host normalization (e.g.
   Solid `normalizeCitations`). Acceptable duplication or should we
   require the host to send already-canonical markers ? Recommendation
   : include the normalize step — LLMs emit bare `[N]` more often
   than `[📄 CITATION N]`, and host normalization is a markdown-pipeline
   step the table renderer doesn't share. Better DX to handle it
   inside the table.

4. **Streaming / lazy citationMap** — during streaming, the
   `citation_map` SSE event sometimes arrives AFTER token streaming
   completes. ui_layout components are typically emitted at the end,
   so by the time TableRenderer renders, citationMap should be in
   place. But for hosts that show the table during streaming
   (unlikely), reactivity through `params.citationMap` would matter.
   For v1 — params is a snapshot at render time, no special-cased
   reactivity. Hosts that need it can re-emit the ui_layout when the
   map updates.

## 8. Migration

100% backward compatible. No `citationMap` set → old behavior. Hosts
opt in by adding `citationMap: gaResult.citation_map` to their table
params. Once landed, deposium_MCPs reverts commit `7df433ae`
(removes `renderCitationChipHTML` + `replaceCitationsInCellHTML`)
and the chat handler emits the raw `[📄 CITATION N]` markers in
cells with `params.citationMap` set.

## 9. Why not just rely on host-side rendering ?

We considered : have hosts render the chip HTML themselves and pass
that as cell content. That's exactly the deposium bridge — and the
reason this brief exists. The byte-coupling and per-consumer
reinvention costs outweigh the simplicity benefit.

We also considered : `cellMode: 'markdown' | 'html' | 'plain'` with
`'markdown'` running marked.parse on cells. That solves bold/italic
but NOT citations — `marked.parse('[📄 CITATION 1]')` doesn't
produce a chip ; you'd still need a citation transform on top. So
this brief is basically that, with the citation transform first-class.

## 10. References

- `mcp-ui-solid/src/components/UIResourceRenderer.tsx` :
  - L290-366 `renderCellValue` (where the new citation branch goes)
  - L345-353 DOMPurify whitelist (already allows our attributes)
  - L372+ `TableRenderer` (where citationCtx flows from params to cells)
- `mcp-ui-solid/CHANGELOG.md` v5.6.0 — last stable shipped
- deposium_MCPs commit `7df433ae` — server-side bridge that this
  brief obsoletes
- deposium_solid `ChatInterfaceStreaming.tsx`
  - L253 `createCitationButton` — chip shape canonical
  - L291-409 `transformCitationReferences` — the host pipeline
    that this brief replicates inside MCP-UI for cell content
  - L2360 `target.closest('[data-citation-page]')` — host click
    delegation that catches both inline AND cell chips
