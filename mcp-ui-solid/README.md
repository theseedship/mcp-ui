# @seed-ship/mcp-ui-solid

SolidJS components + chat toolkit for MCP-generated UI. Part of the [MCP UI ecosystem](https://github.com/theseedship/mcp-ui).

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v6.19.1

- `FeedbackInline`'s thumb buttons now take their `aria-label` from
  `MCPUIStrings.feedbackUseful` / `feedbackNotUseful` (they were hardcoded
  English while the tooltips were already localized). Defaults: `"Useful"` /
  `"Not useful"`. Target them via `data-feedback-inline-rating`, not the text.

## What's New in v6.19.0 — sanitization, a11y and packaging

- **`sanitizeHtml()` is now the single sanitizer for every sink that carries
  untrusted markup** — `text`, table cells, and `ui://` resources.
  `TextRenderer`'s non-markdown branch previously bound `params.content`
  straight to `innerHTML`; both of its branches (markdown and non-markdown)
  now go through `sanitizeHtml()`. On the server (or wherever DOMPurify
  cannot run) the sink emits `escapeHtml()`'d text — for `text` components
  specifically, the **escaped markdown source**, not escaped `marked`
  output — so block structure (tables, lists, headings) is not present on
  first paint; `<SafeHtml>`'s `onMount` upgrades it to sanitized rich HTML on
  the client, and the region reflows at that point. See **SSR Compatibility**
  below for the full contract. The `code` component's own `<code innerHTML>`
  sink is a separate, documented exception: it binds highlight.js output or
  `escapeHtml()`'d source directly in `CodeBlockRenderer`, not through
  `sanitizeHtml()`.
- **New `safeUrl()` guard** on every `href`/`src` binding — the `text` component's image-markdown branch, the `image`, `link`, `artifact`, `action` and `footer` renderers, the gallery and the lightbox —
  (`[![alt](img)](link) *credit*`): `javascript:`, `vbscript:`,
  `data:text/html`, `data:image/svg+xml`, `file:`, `blob:`, `about:`, `ftp:`
  and unparseable/control-character URLs are rejected; relative URLs and
  `http:`/`https:`/`mailto:`/`tel:` (plus `data:image/{png,jpeg,jpg,gif,webp}`
  for the image itself) are allowed. An unsafe link renders the image with no
  `<a>` wrapper; an unsafe image URL falls back to the normal sanitized
  markdown path.
- **`code` component:** the no-highlight.js fallback now escapes `&` (it
  previously escaped only `<`/`>`), so source containing `&lt;script&gt;`
  can no longer render as a literal tag. `renderCellValue`'s last-resort JSON
  fallback for object-shaped cell values is now `escapeHtml()`'d too (a plain
  debug object now comes back as e.g. `{&quot;a&quot;:1}`).
- **Table-cell and `ui://` resource sanitize profiles hardened.**
  `cellLink` now forbids `style`/`form`/`textarea`/`select`/`iframe`/
  `object`/`embed` and the `style` attribute; `resource` (previously bare
  DOMPurify defaults) forbids `style`/`form`/`input`/`textarea`/`select`/
  `button`/`iframe`/`object`/`embed` and the `style`/`formaction`/`form`
  attributes — closing a link-label stylesheet-injection path and a
  phishing-form path in `ui://` `rawHtml` content, while headings, tables,
  lists, links, images and class attributes still survive. `prose` (the
  `text` component's profile) still forbids `iframe` by design — embed via
  the `iframe` **component type**, which goes through `getIframeSandbox()` /
  `validateComponent()`.
- **`highlightQuery()` is now DOM-based**, walking text nodes in a detached
  template instead of doing a string splice, so a search match can no longer
  be marked inside an HTML entity (`&amp;`) or an attribute value
  (`title="foo"`). Same signature and `<mark>` wrapper as before.
- **Accessible table pagination and grid regions:** prev/next buttons and the
  fullscreen page-size selector carry `aria-label`s (localizable via
  `MCPUIStringsProvider`) and stable `data-mcp-ui-action="page-prev" |
  "page-next" | "page-size"` hooks, the page indicator is a live region, and
  `GridRenderer`'s container is a labeled `role="group"` (a blank or
  whitespace-only `title` is now treated as absent and falls back to
  `params.label` / the localized default).
- **Stable portal and action hooks:** `data-mcp-ui-portal="menu"` / `"dialog"`
  on the dropdown and fullscreen-modal portal roots, and
  `data-mcp-ui-action="expand" | "copy" | "close"` (or the toolbar icon name)
  on the chrome buttons — for host CSS/tests that must not depend on `role`
  selectors or on `aria-label` text, which is localizable and no longer
  hardcoded English (`"Expand to fullscreen"` → `MCPUIStrings.expand`).
  `ExpandableWrapper`'s expand/copy/close buttons now all carry
  `type="button"` (so mounting inside a host `<form>` can't trigger a
  submit) and, since they previously had only a `title`, now also carry an
  `aria-label` — host CSS using a `button[aria-label]` selector as a proxy
  will start matching them.
- **New `@seed-ship/mcp-ui-solid/adapters/presentation` subpath** — the pure
  `createComparisonLayout` / `createGeographyLayout` / `createEvidenceLayout`
  helpers, built dependency-free (no `solid-js`, `zod` or spec import in the
  output) so a plain-Node MCP server can use them. See **Server-side
  producers** below.
- **Much smaller npm package:** the published tarball shrank from 39.8 MB /
  5428 files (`6.18.0`) to 5.6 MB unpacked / 671 files (1.3 MB packed).
  `dist/` no longer accidentally bundles the whole dependency tree, a
  declaration-barrel bug that silently typed `UIResourceRenderer`,
  `StreamingUIRenderer` and other root-level symbols as `any` for consumers
  is fixed, and `solid-js` is a **required** peer again (`^1.9.0` — pnpm/npm
  7+ auto-install it, so a Node-only consumer of `./validation` or
  `./adapters/presentation` just carries an unused `solid-js`; neither
  subpath's built output actually imports it).

See [`CHANGELOG.md`](./CHANGELOG.md) for the full list, including exactly
what the `prose` sanitize profile keeps and strips.

## What's New in v6.18.0 — presentation foundations

- **Three composition helpers** in `@seed-ship/mcp-ui-solid/adapters`:
  `createComparisonLayout`, `createGeographyLayout`, `createEvidenceLayout`.
  They arrange supplied components without fetching, aggregating or inventing
  data. Component IDs, source links and citation maps are preserved.
- **Container-responsive grids**: read-only layouts and nested grids stack in
  source order below 640px of container width, including narrow desktop chat
  panels. Desktop positions return when space is available. Editable drag/resize
  mode keeps its explicit grid coordinates.
- **Native chart/data switch**: Chart.js charts expose an accessible Data view,
  even when rendering succeeds, including point coordinates and bubble radii.
  New chrome strings can be overridden with `MCPUIStringsProvider`.
- **Catalogue parity**: eight chart kinds, table search/paging controls, and
  schema-supported graph layouts. QuickChart remains a host-only opt-in;
  time axes require a compatible date adapter registered by the host.

```tsx
import { UIResourceRenderer } from '@seed-ship/mcp-ui-solid'
import { createComparisonLayout } from '@seed-ship/mcp-ui-solid/adapters'

const layout = createComparisonLayout({
  id: 'sales-comparison',
  chart: {
    id: 'sales-chart', type: 'chart',
    params: {
      type: 'bar', title: 'Sales (EUR)',
      data: { labels: ['Lyon', 'Nantes'], datasets: [{ label: 'Sales (EUR)', data: [120, 80] }] },
    },
  },
  table: {
    id: 'sales-table', type: 'table',
    params: {
      columns: [{ key: 'city', label: 'Territory' }, { key: 'sales', label: 'Sales (EUR)' }],
      rows: [{ city: 'Lyon', sales: 120 }, { city: 'Nantes', sales: 80 }],
    },
  },
})

const Comparison = () => <UIResourceRenderer content={layout} />
```

These helpers are explicitly selected by the caller. They do not consume
`renderHints` automatically, link selections between views, persist preferences,
or verify factual claims. See the [MCPs / SolidStart handoff](./docs/briefs/VISUALIZATION-FOUNDATION-2026-09-14.md).

## What's New in v6.17.0

- **Map type parity** — `center` and marker `position` now use the spec's
  exported `LatLngPoint` type, accepting both `[lat, lng]` tuples and
  `{ lat, lng }` objects.
- **Complete map registry contract** — LLM-facing metadata now covers GeoJSON,
  named layers, clustering, PMTiles and every display option accepted by the
  runtime schema. MCP UI renders coordinates; it does not geocode place names.
- **Trusted GeoJSON popup templates** — the host-only `allowHtmlPopups` opt-in
  is forwarded to GeoJSON layers. The default remains safe: template markup is
  ignored and all feature values are HTML-escaped.

## What's New in v6.6.0

Sprint OpenData / macros — `docs/briefs/ROADMAP-opendata-macro-mcpui.md`.

- **`StreamingUIRenderer` renders with full fidelity** — each streamed
  component is now delegated to the real `<UIResourceRenderer>`. A streamed
  `table` / `chart` / `map` renders exactly like a static one (no more
  simplified type-label placeholder). New `toolbarVariant` prop forwarded
  to streamed components.
- **`<MCPUIStringsProvider>`** — opt-in i18n for the library's own *chrome*
  strings (expand tooltip, feedback acks…). English defaults; override
  partially. Payload *content* is untouched — it stays the producer's job.

  ```tsx
  import { MCPUIStringsProvider } from '@seed-ship/mcp-ui-solid'
  <MCPUIStringsProvider strings={{ expand: 'Agrandir' }}><App /></MCPUIStringsProvider>
  ```
- **`<PresentationFeedback>`** — a feedback widget for how a result was
  *presented* (layout / readability), distinct from `FeedbackInline`
  (response quality). Emits a `ConnectorRenderFeedback` payload; stateless
  (the host persists + re-renders).
- **`@seed-ship/mcp-ui-solid/adapters`** — new opt-in subpath.
  `connectorResultToUILayout()` assembles a `ConnectorDynamicResultV1` into
  a `UILayout`; `connectorActionsToActionGroup()` wraps connector actions.
  Pure functions; an unknown `schemaVersion` degrades gracefully, never
  throws.

  ```ts
  import { connectorResultToUILayout } from '@seed-ship/mcp-ui-solid/adapters'
  const layout = connectorResultToUILayout(connectorResult)
  ```

> **Note** — `FeedbackInline`'s acknowledgement defaults changed from
> French to English (`'Thanks!'`, `"Noted — we'll improve"`). Wrap your app
> in `<MCPUIStringsProvider>` with French strings, or pass `positiveAck` /
> `negativeAck`, to restore French.

## What's New in v5.2.0 (`mcp-ui-solid` only)

- **`createChatPromptController()`** primitive — closes the v5.1.0 boilerplate. Owns resolver closure + `AbortSignal` wiring + re-entrance. Consumers write `bus.commands.handle('showChatPrompt', ctrl.handle)` + `<Show when={ctrl.activePrompt()}>{cfg => <ChatPrompt ... />}</Show>`. `PromptReplacedError` exported for `instanceof` checks.
- **`createScratchpadStore()`** factory + `ScratchpadStoreProvider` + `ScratchpadStoreContext` — isolated scratchpad state per subtree. `useScratchpadState()` now context-aware with module-singleton fallback (zero-breaking for v4.x).
- **`<FeedbackInline>`** — per-message thumbs up/down, non-blocking. Complements `ChatPrompt` (modal) and `ScratchpadPanel` feedback section (panel-side).
- **`onElicitation` event + `elicitationToPromptConfig()` helper** — MCP `elicitation/create` (spec 2025-06-18) mapped to `ChatPromptConfig`. Smart mapping : single boolean → confirm, single enum ≤4 → choice, everything else → form with per-property field inference.
- **29 new tests** (438 → 467). Scope doc : `docs/2026/r&d/mcpui-v5.2.0-scope.md` in the Deposium project.

## What's New in v5.1.0 (`mcp-ui-solid` only)

- **`optionRenderer` render prop** on `ChoicePromptConfig` — take full control of option bodies (confidence badges, rich layouts). mcp-ui still wraps the returned JSX in its own `<button>` with `onClick` + focus handling. See `optionRenderer (v5.1.0)` tests in `ChatPrompt.test.tsx` for usage.
- **Generic `ChoicePromptConfig<TMeta>`** — `ChoiceOption<TMeta>` flows through so your renderer closures get strongly-typed `option.metadata` without casting. Default `TMeta = Record<string, unknown>` keeps the non-generic shape valid for existing callers.
- **`buttonClass?` + `containerClass?`** escape hatches on `ChoicePromptConfig` — Tailwind class extensions that append to mcp-ui's defaults for light cosmetic tweaks without writing a full renderer.
- **`type="button"` on option buttons** — prevents accidental form submission when a `ChatPrompt` is nested inside an HTML `<form>`.
- **`ChatPrompt` + `showChatPrompt` JSDoc rewritten** — explicitly states the consumer contract : no default handler, Promise wiring is host-side, `AbortSignal` rejects with `DOMException('AbortError')` per Web Platform convention, re-entrance policy is host-enforced. Now available as a one-call primitive via `createChatPromptController()` in v5.2.0.

## What's New in v5.0.0

Synchronized major release — `@seed-ship/mcp-ui-solid`, `@seed-ship/mcp-ui-spec`, and `@seed-ship/mcp-ui-cli` all move to 5.0.0.

**Sprint 52 multi-agent primitives** (new)
- `ChoicePromptConfig.options[].metadata?` — opaque metadata preserved through the `showChatPrompt` roundtrip (confidence, source tags, etc.).
- `clarificationToPromptConfig()` — universal `ClarificationEvent → ChatPromptConfig` bridge. Legacy runtime `file_id` auto-migrated into `metadata.file_id`.
- `createMockChatBus()` — new `src/testing/` entry point with FIFO prompt responses and spy hooks. Test agent flows without rendering any UI.

**Breaking**
- `ClarificationEvent.options[].file_id` removed from the TypeScript type (was deprecated in v4.3.9). Runtime fallback still works via `clarificationToPromptConfig()`.
- `ChatPromptConfig.type = 'select'` / `SelectPromptConfig` removed (dead code — never had a rendering branch).

Everything rolled up from the 4.x series is documented in the previous section below.

## What's New in v4.3

- **Prefilled Forms** — Fields render with pre-populated values + source indicators (detected/inferred/default/user)
- **`prefillMode: "resolve"`** — Autocomplete fields accept display names ("Paris"), resolve to codes ("75056") client-side
- **Smart tag display** — Select/autocomplete show labels not codes for prefilled values
- **Prefill summary** — "N champs pré-remplis sur M" shown when fields are prefilled
- **Auto-submit toast** — Compact summary with countdown when ALL fields are prefilled
- **`valueFormat` validation** — Regex-based format validation on form values (e.g. `"^\\d{5}$"` for INSEE codes)
- **Autocomplete valueField guarantee** — Always submits resolved code, never display text

### Prefilled Form Example

```tsx
// SSE payload — server sends prefill + source on each field
{
  fields: [
    {
      name: 'departement', type: 'select',
      options: [{ value: '69', label: 'Rhône' }, ...],
      prefill: '69',
      displayHint: 'Rhône — déduit de Lyon',
      source: 'inferred',
      muted: true,
    },
    {
      name: 'commune', type: 'autocomplete',
      apiUrl: 'https://geo.api.gouv.fr/communes',
      searchParam: 'nom', labelField: 'nom', valueField: 'code',
      prefill: ['Lyon'],
      prefillMode: 'resolve', // MCP-UI resolves "Lyon" → code "69123"
      source: 'detected',
      muted: true,
    },
    {
      name: 'type_bien', type: 'select',
      options: [{ value: '', label: 'Tous' }, ...],
      // No prefill — user must choose
    },
  ],
  autoSubmitDelay: 3000, // optional countdown + toast when all prefilled
}
```

## What's New in v4.0.0

- **Data Verification Layer** - Anti-hallucination: `validateAgainstSource()` detects ~90% of numerical hallucinations, zero LLM cost, <1ms
- **VerifiedText component** - Inline badges (verified/hallucinated) with highlight, strip, annotate modes
- **DataPreviewSection** - Paginated data table with CSV/JSON export, source attribution, FR locale formatting
- **GeoJSON maps** - Polygon/line/point rendering, choropleth coloring, feature popups, multi-layer support
- **PMTiles** - Vector tiles for large datasets (>5000 features) via optional `protomaps-leaflet`
- **Time-series charts** - `timeAxis` config for date-based x-axis in ChartJSRenderer
- **18 scratchpad section types** - Added verified_text, data_preview, map, chart (was 14)
- **19 component renderers** - chart, table, metric, code, map, form, modal, gallery, video, iframe + more

## Installation

```bash
pnpm add @seed-ship/mcp-ui-solid
# or
npm install @seed-ship/mcp-ui-solid
```

**Peer dependencies:** `solid-js` ^1.9.0

**Optional peer deps** (install as needed):
- `chart.js` — native chart rendering
- `leaflet` + `leaflet.markercluster` — maps
- `highlight.js` — code syntax highlighting
- `protomaps-leaflet` — PMTiles vector tiles
- `@duckdb/duckdb-wasm` — DuckDB plugin
- `@tanstack/solid-virtual` — table virtualization

### Tailwind CSS v4 consumers

This library's JSX uses Tailwind utility classes directly and ships **no
compiled stylesheet** — `dist/mcp-ui-solid.css` doesn't exist. A Tailwind v4
host must scan the package's source for classes to generate, by adding an
`@source` directive to its own CSS entry point:

```css
/* recommended when the host resolves with the `solid` export condition
   (vite-plugin-solid) — the package is then consumed from src/ */
@source "../../node_modules/@seed-ship/mcp-ui-solid/src/**/*.{ts,tsx}";

/* for hosts WITHOUT the `solid` condition (plain bundlers/SSR frameworks
   that resolve to the built output), scan dist instead */
@source "../../node_modules/@seed-ship/mcp-ui-solid/dist/**/*.js";
```

Adjust the relative path to your CSS file's location. This is a supported
integration contract, not a workaround.

With the `solid` export condition active, the package resolves to `.ts`/`.tsx`
sources rather than `dist/`. A SolidStart (or any Vite SSR) host that enables
it must also list the package in `ssr.noExternal` so the server bundle
transforms those sources instead of trying to `require()` raw JSX:

```typescript
export default defineConfig({
  vite: {
    resolve: { conditions: ['solid', 'development', 'browser'] },
    ssr: { noExternal: ['@seed-ship/mcp-ui-solid'] },
  },
})
```

## Quick Start

### Static UI Rendering

```tsx
import { UIResourceRenderer } from '@seed-ship/mcp-ui-solid'

function Dashboard() {
  const layout = {
    id: 'dashboard-1',
    type: 'composite',
    components: [
      {
        type: 'metric',
        id: 'revenue',
        title: 'Revenue',
        value: '$125,430',
        position: { colStart: 1, colSpan: 4 }
      },
      {
        type: 'chart',
        id: 'trends',
        params: { type: 'line', data: { labels: ['Q1','Q2','Q3'], datasets: [{ label: 'Sales', data: [10,20,30] }] } },
        position: { colStart: 5, colSpan: 8 }
      }
    ]
  }

  return <UIResourceRenderer content={layout} />
}
```

### Streaming UI with SSE

```tsx
import { StreamingUIRenderer } from '@seed-ship/mcp-ui-solid'

function StreamingDashboard() {
  return (
    <StreamingUIRenderer
      query="Show me quarterly revenue trends"
      spaceIds={['analytics-space']}
      onComplete={(metadata) => console.log('Complete', metadata)}
    />
  )
}
```

## Data Verification — Anti-Hallucination (v4.0.0)

### validateAgainstSource — Pure function

Detects numerical hallucinations by comparing LLM text against source data. Zero dependencies, <1ms.

```typescript
import { validateAgainstSource } from '@seed-ship/mcp-ui-solid'

const rows = [
  { type: 'Appartement', ventes: 22306, prix_m2: 3337 },
  { type: 'Maison', ventes: 2492, prix_m2: 4230 },
]

const result = validateAgainstSource(
  "On observe 22 306 ventes a 3 337 EUR/m2. En 2023, 18 245 ventes.",
  rows
)

// result.valid === false
// result.hallucinated === [{ value: 18245, closest: 22306, distance: 0.18 }]
// result.confidence === 0.67
```

Options: `tolerance` (default 1%), `ignoreColumns`, `ignorePatterns` (years, postal codes ignored by default).

### useDataValidator — Reactive hook

```tsx
import { useDataValidator } from '@seed-ship/mcp-ui-solid'

const { valid, confidence, hallucinatedCount } = useDataValidator(
  () => llmText(),
  () => sourceRows(),
  { tolerance: 0.02 }
)
```

### VerifiedText — Inline badges

```tsx
import { VerifiedText } from '@seed-ship/mcp-ui-solid'

<VerifiedText
  text={llmResponse}
  validation={validationResult}
  mode="highlight"  // or "strip" | "annotate"
  onHallucinationClick={(item) => console.log('Hallucinated:', item)}
/>
```

### DataPreviewSection — Source data table

```tsx
import { DataPreviewSection } from '@seed-ship/mcp-ui-solid'

<DataPreviewSection content={{
  columns: [
    { key: 'type', label: 'Type', type: 'string' },
    { key: 'ventes', label: 'Ventes', type: 'number' },
    { key: 'prix_m2', label: 'Prix moy. EUR/m2', type: 'number' },
  ],
  rows: sourceRows,
  source: 'data.gouv.fr - Stats DVF',
  freshness: 'Donnees 2025',
  exportable: true,
  pageSize: 25,
}} />
```

## GeoJSON Maps

Map coordinates accept either `[lat, lng]` or `{ lat, lng }`. This package does
not geocode addresses or place names; resolve them before building the map
payload. The default base tiles come from OpenStreetMap; Leaflet is the internal
rendering engine.

### GeoJSON + Choropleth + Popups

```tsx
import { MapRenderer } from '@seed-ship/mcp-ui-solid'

<MapRenderer params={{
  geojson: featureCollection,
  geojsonStyle: {
    choroplethField: 'prix_m2',
    choroplethScale: [
      [2000, '#eff3ff'],
      [3000, '#6baed6'],
      [5000, '#084594'],
    ],
    fillOpacity: 0.7,
  },
  popup: {
    titleField: 'name',
    fields: ['prix_m2', 'ventes'],
  },
  fitBounds: true,
  height: '500px',
}} />
```

### Multi-layer Maps

```tsx
<MapRenderer params={{
  layers: [
    { name: 'Parcelles', geojson: parcelles, visible: true,
      style: { choroplethField: 'prix', choroplethScale: [[100, '#fee'], [500, '#c00']] } },
    { name: 'Risques', geojson: risques, visible: false,
      style: { fillColor: 'orange', fillOpacity: 0.3 } },
  ],
  fitBounds: true,
}} />
```

### PMTiles — Large Datasets

```tsx
<MapRenderer params={{
  pmtiles: {
    url: 'https://cdn.example.com/data.pmtiles',
    paintRules: [
      { dataLayer: 'buildings', symbolizer: 'polygon', color: '#3388ff', opacity: 0.6 },
    ],
    maxZoom: 16,
  },
  center: [43.6, 3.87],
  zoom: 12,
}} />
```

Requires `protomaps-leaflet` peer dependency.

## Time-Series Charts (v4.0.0)

```tsx
<ChartJSRenderer component={{
  id: 'ndvi-timeline',
  type: 'chart',
  position: { colStart: 1, colSpan: 12 },
  params: {
    type: 'line',
    data: {
      labels: ['2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15'],
      datasets: [{
        label: 'NDVI',
        data: [0.45, 0.42, 0.55, 0.68],
        borderColor: '#10b981',
        fill: true,
        tension: 0.3,
      }],
    },
    timeAxis: {
      unit: 'month',
      tooltipFormat: 'MMM yyyy',
    },
    exportable: true,
  },
}} />
```

## Chat Bus — Agent Interactions (`@experimental`)

Bidirectional event/command system for agent-driven chat interactions. Your app keeps full control of its chat UI — the bus adds structured interactivity on top.

### Architecture

```
                    +----------------------+
                    |   AGENT LAYER        |
                    |  (your app logic)    |
                    +--+----------+-------+
              events   |          | commands
                       v          v
+--------------------------------------------------+
|   Chat Messages (your app renders these)          |
|   + UIResourceRenderer for MCP components         |
+--------------------------------------------------+
|   ChatPrompt (MCP-UI) - choice | confirm | form   |
+--------------------------------------------------+
|   Chat Input (your app controls this)             |
+--------------------------------------------------+
```

### Usage

```tsx
import { ChatBusProvider, useChatBus, ChatPrompt, createChatBus } from '@seed-ship/mcp-ui-solid'

// 1. Wrap your app
function App() {
  return (
    <ChatBusProvider>
      <ChatInterface />
      <AgentRouter />
    </ChatBusProvider>
  )
}

// 2. Bridge your SSE events to the bus
function ChatInterface() {
  const bus = useChatBus()
  const [activePrompt, setActivePrompt] = createSignal(null)

  onSSEEvent('done', (data) =>
    bus.events.emit('onStreamEnd', { streamKey: 'main', metadata: data }))

  bus.commands.handle('injectPrompt', (text) => setInputValue(text))
  bus.commands.handle('showChatPrompt', (config) => setActivePrompt(config))

  return (
    <div>
      <Messages />
      <Show when={activePrompt()}>
        <ChatPrompt config={activePrompt()!} onSubmit={handleResponse} onDismiss={() => setActivePrompt(null)} />
      </Show>
      <TextInput />
    </div>
  )
}
```

### Event Types (18) / Command Types (11)

See [Chat Bus documentation](https://github.com/theseedship/mcp-ui#chat-bus--agent-interactions-experimental) for the full event/command reference.

### Bridging external clarification events (v4.3.9)

When your MCP server emits a clarification event via SSE (e.g. a `_pause`
frame asking the user to disambiguate intent), convert it to a `ChatPrompt`
using the universal `clarificationToPromptConfig` helper — no app-specific
glue required:

```tsx
import { clarificationToPromptConfig } from '@seed-ship/mcp-ui-solid'

// In your SSE parser, when you decode a clarification frame:
bus.events.emit('onClarificationNeeded', {
  streamKey: 'main',
  clarification: {
    question: 'Which space do you mean?',
    options: [
      { value: 'sp-1', label: 'Immobilier', metadata: { confidence: 0.9 } },
      { value: 'sp-2', label: 'Santé',      metadata: { confidence: 0.6 } },
    ],
    type: 'intent_disambiguate', // opaque tag for host routing
  },
})

// Wire the event to a prompt:
bus.events.on('onClarificationNeeded', async ({ clarification }) => {
  const response = await bus.commands.exec(
    'showChatPrompt',
    clarificationToPromptConfig(clarification)
  )
  // POST response.value to your /api/agent-resume endpoint, etc.
})
```

Legacy `option.file_id` is automatically migrated into `metadata.file_id`.
Arbitrary `metadata` (confidence scores, source tags, ...) flows through
unchanged and can be rendered by a custom `ChoiceBody` wrapper.

### ChatPromptResponse — dismissed / aborted / answered

Every `ChatPrompt` exchange ends in one of three outcomes:

| Outcome | How | `response.dismissed` | Promise |
|---------|-----|----------------------|---------|
| Explicit answer | Click a choice / submit a form | `undefined` | resolves |
| Dismissed | Click the X icon, click Cancel (confirm type) | `true` | resolves |
| Aborted | Host app rejects the Promise via `AbortSignal` | *(n/a — never resolves)* | rejects with `DOMException('AbortError')` |

> **v5.2.0** — use `createChatPromptController()` (below). The manual pattern
> documented after it is kept for context and for consumers who prefer full
> control over the resolver lifecycle.

#### Recommended — `createChatPromptController()` (v5.2.0)

```tsx
import { Show } from 'solid-js'
import {
  ChatPrompt,
  useChatBus,
  createChatPromptController,
  PromptReplacedError,
} from '@seed-ship/mcp-ui-solid'

function HitlHost() {
  const bus = useChatBus()
  const ctrl = createChatPromptController()
  bus.commands.handle('showChatPrompt', ctrl.handle)

  return (
    <Show when={ctrl.activePrompt()}>
      {(cfg) => (
        <ChatPrompt
          config={cfg()}
          onSubmit={ctrl.resolveActive}
          onDismiss={ctrl.dismissActive}
        />
      )}
    </Show>
  )
}
```

Caller-side, re-entrance and abort are standard :

```ts
try {
  const response = await bus.commands.exec('showChatPrompt', config, ac.signal)
  // ...
} catch (err) {
  if (err instanceof PromptReplacedError) return           // superseded by a newer prompt
  if (err instanceof Error && err.name === 'AbortError') return  // navigation killed it
  throw err
}
```

`ctrl.abort(reason?)` is also available for programmatic cancellation
(modal close, route change, ...).

#### Manual wiring (v5.1.0 reference pattern)

Equivalent to the controller above — useful if you want full control over
the resolver closure, or if you're maintaining a v5.1.0 codebase :

```tsx
import { createSignal } from 'solid-js'
import { useChatBus } from '@seed-ship/mcp-ui-solid'
import type { ChatPromptConfig, ChatPromptResponse } from '@seed-ship/mcp-ui-solid'

function HitlHost() {
  const bus = useChatBus()
  const [activePrompt, setActivePrompt] = createSignal<ChatPromptConfig | null>(null)

  // Mutable resolver + optional abort cleanup — one prompt at a time
  let active: {
    resolve: (response: ChatPromptResponse) => void
    reject: (err: unknown) => void
    cleanupAbort?: () => void
  } | null = null

  bus.commands.handle('showChatPrompt', (config, signal) => {
    // Re-entrance: auto-reject any previous in-flight prompt
    if (active) {
      const stale = active
      active = null
      stale.reject(new Error('PromptReplaced'))
      stale.cleanupAbort?.()
    }

    // Already-aborted signal → reject synchronously, never render
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Prompt aborted', 'AbortError'))
    }

    return new Promise<ChatPromptResponse>((resolve, reject) => {
      const onAbort = () => {
        setActivePrompt(null)
        active = null
        reject(new DOMException('Prompt aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      active = {
        resolve,
        reject,
        cleanupAbort: () => signal?.removeEventListener('abort', onAbort),
      }
      setActivePrompt(config)
    })
  })

  const handleSubmit = (response: ChatPromptResponse) => {
    const a = active
    active = null
    setActivePrompt(null)
    a?.cleanupAbort?.()
    a?.resolve(response)
  }

  const handleDismiss = () => {
    const a = active
    active = null
    setActivePrompt(null)
    a?.cleanupAbort?.()
    a?.resolve({ type: 'choice', value: '', label: '', dismissed: true })
  }

  return (
    <Show when={activePrompt()}>
      <ChatPrompt config={activePrompt()!} onSubmit={handleSubmit} onDismiss={handleDismiss} />
    </Show>
  )
}
```

Consumer-side the error is standard and branch-able without any mcp-ui import:

```ts
try {
  const response = await bus.commands.exec('showChatPrompt', config, ctrl.signal)
  // ...
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') return  // navigation killed it
  throw err
}
```

v5.2.0 collapses this to a single `createChatPromptController()` call — see
above. Prefer the controller unless you have a reason to manage the
lifecycle yourself.

### correlationId — host-propagated (v4.3.9)

`ChatEventBase.correlationId` is opaque to mcp-ui. When an agent calls
`sendPrompt('...')` the returned string is a correlation ID — the host app's
SSE parser must forward this value into every subsequent event emission
(`onToken`, `onStreamEnd`, etc.) so agents can match responses back to their
original prompts. mcp-ui does not auto-propagate it across the bus.

## ScratchpadPanel — HITL/AITL Shared Workspace (`@experimental`)

A shared workspace where agent and human collaborate in real-time. 18 section types:

| Type | Renders | Use case |
|------|---------|----------|
| `data` | Key-value pairs | Dataset info |
| `filter` | Editable chips | Active filters |
| `preview` | Count + mini-table | Live result count |
| `message` | Agent bubble | Explanations |
| `action` | Buttons | Validate, refine |
| `steps` | Stepper | Guided workflow |
| `form` | FormFieldRenderer | Interactive params |
| `understanding` | Confidence badges | Agent comprehension |
| `feedback` | Thumbs up/down | User validation |
| `prompt` | Query + params | Agent interpretation |
| `stepper` | Progress stepper | Multi-turn progress |
| `error` | Error card | Error display + retry |
| `source_card` | Source info card | Data source details |
| `diff` | Before/after diff | Change preview |
| `verified_text` | Inline badges | Data verification |
| `data_preview` | Paginated table | Source data display |
| `map` | GeoJSON map | Geographic data |
| `chart` | Chart.js chart | Time-series, analytics |

### Direct store (recommended)

```tsx
import { dispatchScratchpad, useScratchpadState } from '@seed-ship/mcp-ui-solid'

// In your SSE callback — ONE LINE
onScratchpad: (data) => dispatchScratchpad(data as ScratchpadEvent)

// In your component
const { state, pinned, close } = useScratchpadState()
```

## Component Renderers (20 types)

| Type | Features |
|------|----------|
| `chart` | Bar, line, pie, doughnut, radar, scatter, bubble, polarArea. Native Chart.js with Chart/Data switch and PNG export; external QuickChart only on host opt-in. Time axes require a date adapter. |
| `table` | Sortable, pagination, virtualization (10K+), CSV/TSV/JSON export |
| `metric` | KPI cards with trends and sparklines |
| `text` | Markdown via marked.js |
| `code` | Syntax highlighting (highlight.js), line numbers, word wrap |
| `map` | OpenStreetMap base tiles via Leaflet: markers, clustering, GeoJSON, choropleth, popups, multi-layer, PMTiles |
| `graph` | Node-link relationships with optional G6; seven schema-supported layouts and layout options |
| `form` | 18 field types, conditional fields, persistence, tool call submit |
| `modal` | Portal overlay, sizes sm-full, Escape/backdrop close |
| `image-gallery` | Grid layout, lightbox, keyboard nav |
| `video` | YouTube/Vimeo/direct URL |
| `iframe` | Tiered sandbox, 80+ whitelisted domains |
| `image` | Responsive with lazy loading |
| `link` | Styled link cards |
| `action` | Tool call buttons |
| `action-group` | Grouped actions with layout options |
| `grid` | Nested CSS Grid; read-only layouts stack in narrow containers |
| `carousel` | Content carousel |
| `artifact` | File download/preview |
| `footer` | Metadata display |

## SSR Compatibility

The published `dist/` is a DOM (client) Solid build — importing it directly
on a server throws "Client-only API called on the server side." SSR is
supported when the host instead compiles the package **from `src/`** via the
`solid` export condition (`vite-plugin-solid`) and lists it in
`ssr.noExternal`, e.g. in SolidStart's `app.config.ts`:

```typescript
export default defineConfig({
  vite: {
    resolve: { conditions: ['solid', 'development', 'browser'] },
    ssr: { noExternal: ['@seed-ship/mcp-ui-solid'] },
  },
})
```

### Sanitization contract (v6.19.0)

`sanitizeHtml()` (`src/utils/sanitize-html.ts`) is the single sanitizer for
every sink that carries untrusted markup — the `text` and `table` HTML
branches and `UIResourceHtmlRenderer`'s `ui://` `rawHtml` content — with one
invariant that holds identically on server and client: **nothing
unsanitized ever reaches an `innerHTML` sink.** The `code` component's own
`<code innerHTML>` sink is a documented exception outside `sanitizeHtml()`:
it binds highlight.js output, or `escapeHtml(code)` when highlight.js fails
to load or throws.

- **Server** (or any environment where DOMPurify cannot run — `isServer`,
  `!DOMPurify.isSupported`, or `DOMPurify.sanitize` not being a function,
  which is what dompurify 3.4.x actually does with no `window`): the sink
  emits `escapeHtml(input)` and nothing else — no tag-stripping. Text that
  merely *looks* like markup is preserved as inert, visible text (e.g.
  `values < 10 and > 5` renders as `values &lt; 10 and &gt; 5`, not
  `values 5`). For `text` components specifically, the server ships the
  **escaped markdown source**, not escaped `marked` output — so block
  structure (tables, lists, headings) is absent on first paint and the
  region **reflows once the client hydrates**.
- **Client:** the real DOMPurify runs with a profile scoped to the call site
  (`prose` for text content, `cellLink` / `cellMarkdown` / `cellHtml` for
  table cells, `resource` for `ui://` content). `<SafeHtml>`'s `onMount`
  then re-applies the sanitized rich HTML if the hydrated DOM still shows
  the server's escaped text — this is what covers `solid-js/web`'s
  `setProperty(node, 'innerHTML', v)` early-return during hydration, so a
  hydrated page doesn't stay stuck showing escaped text.

Net effect: an SSR pass never leaks or executes untrusted markup, and the
client upgrades to the rich version — with a visible reflow — once mounted.

## Telemetry

Optional, fail-open event sink for component lifecycle, validation and action
events — no payload data, only metadata (type / id / componentType / timing),
so it's safe for centralized logging. `useTelemetry()` returns `null` (and
dispatch sites no-op) when no `MCPUITelemetryProvider` is mounted, so opting
in never changes behavior for apps that don't.

```tsx
import { MCPUITelemetryProvider, useTelemetry } from '@seed-ship/mcp-ui-solid'

function App() {
  return (
    <MCPUITelemetryProvider
      sink={(events) => fetch('/api/ui-telemetry', { method: 'POST', body: JSON.stringify(events) })}
      options={{ sampleRate: 1.0, bufferMs: 100, bufferMax: 50 }}
    >
      <Dashboard />
    </MCPUITelemetryProvider>
  )
}
```

Events are buffered (`bufferMs` / `bufferMax`, defaults 100ms / 50) and
flushed as a batch (always an array, even for `bufferMs: 0`); a `sink` throw
or rejected promise is caught silently and never crashes the renderer.
`createTelemetryDispatcher(sink, options)` builds the same dispatcher without
a Solid context, for tests or non-component call sites. Event types:
`component:mounted`, `component:rendered` (`durationMs`), `component:unmounted`,
`validation:failed` (`errorCount`, `firstErrorCode`), `render:error`
(`errorMessage`), `action:dispatched` (`actionName`).

## Server-side producers

`@seed-ship/mcp-ui-solid/adapters/presentation` and `@seed-ship/mcp-ui-solid/validation`
import nothing from `solid-js` — neither pulls in Solid, and
`/adapters/presentation`'s built output (ESM and CJS) contains zero
`import`/`require` statements at all. `solid-js` is a required peer
(`^1.9.0`), so pnpm (with auto-install-peers) or npm 7+ install it
automatically regardless of which subpath you use; a Node-only consumer of
these two subpaths ends up with an unused `solid-js` in `node_modules`
rather than a missing-peer warning.

CommonJS consumers on TypeScript `moduleResolution: "node"` (which ignores the
`exports` map) are covered too: every subpath is declared in `typesVersions`,
so `import type { UILayout } from '@seed-ship/mcp-ui-solid/types-only'` and
`require('@seed-ship/mcp-ui-solid/adapters/presentation')` both resolve, types
included, without `paths` aliases.

```ts
// A Node MCP server or backend service — imports nothing from solid-js
import { createComparisonLayout } from '@seed-ship/mcp-ui-solid/adapters/presentation'

const layout = createComparisonLayout({
  id: 'sales-comparison',
  chart: { id: 'sales-chart', type: 'chart', params: { /* ... */ } },
  table: { id: 'sales-table', type: 'table', params: { /* ... */ } },
})

// send `layout` to the client, which renders it with <UIResourceRenderer>
```

`./validation`'s only external import chain is `@seed-ship/mcp-ui-spec` (and
the `zod` it pulls in) — verified by inspecting `dist/validation.js` /
`dist/validation.cjs`, and asserted by a test so it stays true. Use it to
`validateComponent()` / `validateLayout()` payloads server-side before ever
handing them to a Solid renderer.

## Exports

```typescript
// Components
import {
  UIResourceRenderer, StreamingUIRenderer, GenerativeUIErrorBoundary,
  DraggableGridItem, ResizeHandle, EditableUIResourceRenderer,
  ExpandableWrapper, useExpanded, ComponentToolbar, FeedbackInline,
  PresentationFeedback, DEFAULT_PRESENTATION_FEEDBACK_LABELS,
  ChatPrompt, ElicitationForm, PortalDropdownMenu, ScratchpadPanel,
  VerifiedText, DataPreviewSection,
  AgentCard, AgentStatusBadge, SplitStepper, AgentHandoff, BriefingDiff,
  GhostText, GhostTextInput, AutocompleteDropdown, AutocompleteFormField,
  GraphRenderer, isG6Available, graphToMermaid, graphToJSON,
  renderCellValue, // v5.7.0 — citation-chip-aware table cell renderer
  MCPUIStringsProvider, useMCPUIStrings, DEFAULT_MCPUI_STRINGS, // v6.6.0 i18n chrome
} from '@seed-ship/mcp-ui-solid'

// Hooks
import {
  useStreamingUI, useAction, useToolAction,
  useConditionalField, evaluateCondition,
  useModal, useConfirmModal, useFormPersistence,
  useDragDrop, useResize, useAutocomplete,
  useDataValidator, // v3.1.0 — data verification
} from '@seed-ship/mcp-ui-solid'

// Chat Bus (@experimental)
import {
  ChatBusProvider, useChatBus,
  dispatchScratchpad, useScratchpadState,
  createScratchpadStore, ScratchpadStoreProvider,
  createChatBus, createEventEmitter, createCommandHandler,
  clarificationToPromptConfig,  // v4.3.9 — ClarificationEvent → ChatPromptConfig bridge
  elicitationToPromptConfig,    // v5.2.0 — ElicitationEvent → ChatPromptConfig bridge
  createChatPromptController, PromptReplacedError, // v5.2.0
  setServerCapabilities, useServerCapabilities, createServerCapabilitiesStore, // v5.3.0
  createMockChatBus, // v4.3.9 — testing utilities
} from '@seed-ship/mcp-ui-solid'

// Validation + Security
import {
  validateComponent, validateLayout, validateIframeDomain,
  getIframeSandbox, DEFAULT_RESOURCE_LIMITS,
  DEFAULT_IFRAME_DOMAINS, TRUSTED_IFRAME_DOMAINS,
  ComponentRegistry, mergeScratchpadSections,
  validateAgainstSource, // v4.0.0 — anti-hallucination
} from '@seed-ship/mcp-ui-solid'

// Adapters — pure layout-composition helpers (v6.18.0+). Root package does
// NOT re-export these; import from a subpath. Use '/adapters' alongside the
// connector/macro adapters, or '/adapters/presentation' for the same three
// helpers built dependency-free (no solid-js/zod/spec import in the output,
// v6.19.0 — see "Server-side producers" below). Pick one, not both.
import {
  createComparisonLayout, createGeographyLayout, createEvidenceLayout,
} from '@seed-ship/mcp-ui-solid/adapters' // or '/adapters/presentation'

// Telemetry (v5.6.0)
import {
  MCPUITelemetryProvider, useTelemetry, createTelemetryDispatcher,
} from '@seed-ship/mcp-ui-solid'

// Utils
import {
  setDebugMode, isDebugEnabled,             // v5.4.0 — runtime debug mode
  markRenderStart, markRenderEnd, PERF_PREFIX, // v5.4.0 — perf marks
  getUiResourceStableKey,                   // v6.5.0 — identity stability
  setDuplicateMountReporter,                // v6.5.0 — opt-in observability
} from '@seed-ship/mcp-ui-solid'

// Types — component/param types, chat-bus types, and everything above's
// prop/options/return types. Non-exhaustive; see src/index.ts for the
// authoritative list.
import type {
  UIComponent, UILayout, GridPosition, ComponentType, RendererError,
  ChartComponentParams, TableComponentParams, MetricComponentParams,
  TextComponentParams, ActionComponentParams, GridComponentParams,
  FormComponentParams, ModalComponentParams, ActionGroupParams,
  ImageGalleryParams, VideoComponentParams, CodeComponentParams,
  MapComponentParams, LatLngPoint, MapMarker, MapGeoJSONStyle,
  MapPopupConfig, MapLayer, MapPMTilesConfig,
  IframePolicy, ValidationOptions,
  CitationCtx, CitationEntry, DuplicateMountInfo, DuplicateMountReporter,
  MCPUIStrings, TelemetryEvent, TelemetrySink, TelemetryOptions, TelemetryDispatcher,
  DataValidation, HallucinatedNumber, DataValidationOptions,
  VerifiedTextContent, DataPreviewContent, MapSectionContent,
  ChatBus, ChatEvents, ChatCommands, ScratchpadState, ScratchpadSection,
  ScratchpadEvent, ElicitationEvent, ClarificationEvent,
  // ...and all component prop/param types (FeedbackInlineProps, AgentCardContent,
  // AutocompleteOption, UseStreamingUIOptions, ScratchpadStoreHandle, etc.)
} from '@seed-ship/mcp-ui-solid'
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@seed-ship/mcp-ui-spec`](https://www.npmjs.com/package/@seed-ship/mcp-ui-spec) | Zod schemas and JSON Schema definitions |
| [`@seed-ship/mcp-ui-cli`](https://www.npmjs.com/package/@seed-ship/mcp-ui-cli) | CLI: validate, generate-types, test-examples |

## License

MIT — **Built by [The Seed Ship](https://github.com/theseedship)**
