# @seed-ship/mcp-ui-solid

SolidJS components + chat toolkit for MCP-generated UI. Part of the [MCP UI ecosystem](https://github.com/theseedship/mcp-ui).

[![npm version](https://img.shields.io/npm/v/@seed-ship/mcp-ui-solid.svg)](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What's New in v6.21.0

- **Iframes work under `Cross-Origin-Embedder-Policy: credentialless`.** Both
  iframes the library renders — the `iframe` component and `VideoRenderer`'s
  YouTube / Vimeo embed — now carry the boolean `credentialless` attribute
  when their host is **not** in `TRUSTED_IFRAME_DOMAINS`. Trusted hosts
  deliberately do not get it (a cookie-less authenticated embed shows a login
  screen). Chrome / Edge 110+ honour the attribute; Firefox ignores it; Safari
  ignores the COEP value entirely — see
  [*Iframes under COEP*](#iframes-under-coep--mcpuiconfigprovider-v6210).
- **New `<MCPUIConfigProvider>`** (`MCPUIConfig`, `useMCPUIConfig`,
  `DEFAULT_MCPUI_CONFIG`) — host-level rendering policy:
  `iframeCredentialless`, `customTrustedIframeDomains`, `iframeFallbackLink`.
- **New `isTrustedIframeDomain()`** export (root barrel and `/validation`),
  and a new `iframeOpenInNewTab` chrome string for the "open in a new tab"
  link rendered under an embed that COEP may have blocked silently.
- **Fixed**: `IframeRenderer` called `getIframeSandbox()` without options, so
  a host's custom trusted domains never reached the sandbox.

## What's New in v6.20.0

- **Complete i18n of the library chrome.** Every user-visible chrome string —
  copy/export/download button titles, the code toolbar, prefill source
  badges, the lightbox, the modal close button, `VerifiedText`'s tooltips,
  degraded-fallback captions, status badges, form-validation messages, and
  more — now reads from `MCPUIStrings` (components, via `useMCPUIStrings()`)
  or an exported `messages`/`labels` option (runtime-free adapters, services,
  helpers), except the exclusion policy P1–P8 in
  [`CHANGELOG.md`](./CHANGELOG.md) (keyboard key caps, the OpenStreetMap
  attribution, developer/peer-dependency diagnostics, file-format acronyms
  and HTTP verbs, components with their own `labels`/`messages` prop, hook-level errors and `console.*`, and
  LLM-facing registry examples). See **Internationalization** below for the
  full key table and a French example dictionary.
- **New exported `formatMCPUIString(template, vars)` helper** for hosts that
  render their own chrome and want the same `{placeholder}` substitution
  `mcp-ui-solid` uses internally. It lives in the dependency-free
  `src/utils/format-string.ts`, so the runtime-free adapters use it too.
- **New `messages` option on `connectorResultToUILayout()`** — the connector
  adapter's own degraded-state paragraphs (unreadable payload, unrecognized
  schema version) are no longer hardcoded French; they default to English
  `DEFAULT_CONNECTOR_MESSAGES` and accept a partial override for hosts that
  render in another language. See **Server-side producers** below. The macro
  adapter gets the same treatment: `macroRunToScratchpadState()` /
  `macroInterrogationToChatPromptConfig()` take a `messages` option backed by
  `DEFAULT_MACRO_RUN_MESSAGES` (`"Agent"` / `"Progress"` / `"Result"` section
  titles, abort/failure/confirm copy) — see the injectable-wording bullet
  below.
- **Five chrome defaults changed from French to English** —
  `tableSearchPlaceholder` (`"Rechercher dans le tableau..."` →
  `"Search the table..."`), `verifiedStripLabel` (`"[non vérifié]"` →
  `"[unverified]"`), `scratchpadEdit` (`"Modifier"` → `"Edit"`),
  `citationUnresolved` (`"[réf. {id}]"` → `"[ref. {id}]"`, via the new
  `CitationCtx.unresolvedLabel`), and `formPrefilledOne` / `formPrefilledMany`
  (`"{count} champ(s) pré-rempli(s) sur {total}"` → `"{count} field(s)
  pre-filled out of {total}"`). A connector's own
  `tableParams.searchPlaceholder` still wins; otherwise restore the French
  text via `<MCPUIStringsProvider>`. See [`CHANGELOG.md`](./CHANGELOG.md) for
  the complete key list.
- **`StreamingUIRenderer` no longer shows the machine code `ssr` as its error
  heading** during server rendering; it shows `streamServerSideTitle`
  (`"Streaming unavailable"`). The hook's `StreamError.error` keeps `'ssr'`.
- **Injectable wording for the runtime-free helpers.** Modules that cannot
  read the context (they must stay free of `solid-js`) now take their English
  as a TRAILING OPTIONAL parameter with an exported default table, so every
  existing call is unchanged:
  `macroRunToScratchpadState(run, { messages })` /
  `macroInterrogationToChatPromptConfig(q, { messages })`
  (`DEFAULT_MACRO_RUN_MESSAGES`),
  `validateFieldValue(value, field, messages)` /
  `validateFormData(data, fields, messages)` (`DEFAULT_VALIDATION_MESSAGES` —
  `FormRenderer` feeds it from `MCPUIStrings`),
  `graphToDegradedTable` / `mapToDegradedTable` / `chartToDegradedTable`
  (`DEGRADED_PROJECTION_LABELS`) and `chartToDataTable`
  (`CHART_DATA_TABLE_LABELS`).
- **The chrome-strings guard is now a TypeScript-AST scanner over all of
  `src`** (`scripts/chrome-scan.ts`, not published) — it follows literals
  through `||` / `??` / ternary branches / template spans / helper returns /
  signal setters into visible attributes, JSX children and the clipboard,
  and flags French and hardcoded locales anywhere. Each exemption names an
  exclusion-policy item and is kept live by a test; a runtime
  pseudo-localization test renders the renderers with marker strings and CJK
  payloads and fails on any Latin text left in the DOM.
- **New `locale` key (default `'en-US'`)** drives every number / date
  formatting and collation call — a **default change**: these sites used
  `'fr-FR'` / `'fr'` or the runtime locale before. See
  [`locale`](#locale--number-date-and-sort-formatting-default-change-in-v6200).
- **`useStreamingUI({ messages })`** — the hook's progress and error messages
  are injectable (`DEFAULT_STREAMING_UI_MESSAGES`); `StreamingUIRenderer`
  feeds them from `MCPUIStrings` (`stream*` keys).
- `MCPUIStrings` now covers **270 keys** in total, all grouped by the
  component they belong to. See the full key reference below.

> **Not covered by `MCPUIStringsProvider`:** `PresentationFeedback` documents
> its own `labels` prop (`DEFAULT_PRESENTATION_FEEDBACK_LABELS`) and is
> localized through that prop, not through the chrome-strings context.

The handful of strings that stay hardcoded fall under an explicit exclusion
policy (P1–P8: keyboard key caps, the OpenStreetMap/ODbL attribution,
developer diagnostics naming an npm/peer dependency or a config flag,
file-format acronyms and HTTP verbs, components with their own documented `labels`/`messages` prop, hook-level
errors consumers handle, and LLM-facing example payloads) — see
[`CHANGELOG.md`](./CHANGELOG.md)'s `## [6.20.0]` entry for the full policy
text and every concrete occurrence.

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

  **Since v6.20.0** — `connectorResultToUILayout`'s two degraded-state
  paragraphs (unreadable payload, unrecognized schema version) used to be
  hardcoded French. They now default to English `ConnectorAdapterMessages`
  (`DEFAULT_CONNECTOR_MESSAGES`) and accept a partial override via the
  `messages` option, since these adapters are dependency-free and cannot
  read `<MCPUIStringsProvider>`:

  ```ts
  import { connectorResultToUILayout } from '@seed-ship/mcp-ui-solid/adapters'

  const layout = connectorResultToUILayout(connectorResult, {
    messages: {
      versionWarning:
        '> ⚠ Schéma connecteur non reconnu (`{version}`, attendu `{expected}`). Le rendu ci-dessous est en mode dégradé.',
    },
  })
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
- **DataPreviewSection** - Paginated data table with CSV/JSON export, source attribution, locale formatting (`MCPUIStrings.locale`)
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
| `iframe` | Tiered sandbox, 80+ whitelisted domains, COEP `credentialless` (v6.21.0) |
| `image` | Responsive with lazy loading |
| `link` | Styled link cards |
| `action` | Tool call buttons |
| `action-group` | Grouped actions with layout options |
| `grid` | Nested CSS Grid; read-only layouts stack in narrow containers |
| `carousel` | Content carousel |
| `artifact` | File download/preview |
| `footer` | Metadata display |

## Iframes under COEP — `MCPUIConfigProvider` (v6.21.0)

The library renders exactly two iframes: the `iframe` component
(`IframeRenderer`) and `VideoRenderer`'s YouTube / Vimeo embed. Both are
constrained by `DEFAULT_IFRAME_DOMAINS` (the allow-list) and
`getIframeSandbox()` (the tiered sandbox — `allow-same-origin allow-forms`
for `TRUSTED_IFRAME_DOMAINS`, `allow-scripts allow-popups` for everything
else).

A host that serves `Cross-Origin-Embedder-Policy: credentialless` adds a
third constraint: the browser refuses any cross-origin iframe whose own
document sends no COEP header — which is YouTube, Vimeo, Google Docs, Notion
and most of the allow-list. The frame stays blank, and the page cannot even
detect it (a refused cross-origin document fires no `error` event). The fix
is the boolean HTML attribute `<iframe credentialless>`.

By default (`'auto'`) the library sets it only where nothing is lost: the
`iframe` component pointing at a **non-trusted** host, whose sandbox already
has no `allow-same-origin` and therefore no cookies or storage. Two cases are
left alone on purpose:

- **Trusted hosts** are in that list because they need their own cookies to
  authenticate, and a cookie-less authenticated embed only renders a login
  screen — a clear block beats a broken frame.
- **The video embed** carries no sandbox, so a YouTube or Vimeo frame really
  does hold provider cookies (consent, playback state). A host under COEP
  unblocks it with `iframeCredentialless: 'always'`, accepting that trade;
  a host without COEP keeps 6.20.0 behaviour and changes nothing.

`<MCPUIConfigProvider>` is where a host overrides all of this. It is the
behavioural counterpart of `<MCPUIStringsProvider>`: context-based, entirely
optional, and `DEFAULT_MCPUI_CONFIG` applies when it is absent.

```tsx
import { MCPUIConfigProvider } from '@seed-ship/mcp-ui-solid'

<MCPUIConfigProvider
  config={{
    iframeCredentialless: 'always',            // also unblocks the video embed
    iframePolicy: 'extend',                    // accept hosts outside the allow-list
    customIframeDomains: ['embed.acme.com'],   // …these ones
    customTrustedIframeDomains: ['embed.acme.com'], // …and treat them as trusted
    iframeFallbackLink: 'auto',                // default
  }}
>
  <App />
</MCPUIConfigProvider>
```

| Option | Values | Default | What it does |
|--------|--------|---------|--------------|
| `iframeCredentialless` | `'auto'` \| `'always'` \| `'never'` | `'auto'` | `'auto'`: the attribute on the `iframe` component when its host is **not** in `TRUSTED_IFRAME_DOMAINS` (+ `customTrustedIframeDomains`) — those frames already run without cookies. The video embed is excluded, since it has none of that sandboxing. `'always'`: every iframe, video and trusted hosts included — what a COEP host wants. `'never'`: none. |
| `customTrustedIframeDomains` | `string[]` | `[]` | Hosts treated as trusted on top of `TRUSTED_IFRAME_DOMAINS`: no `credentialless`, and `allow-same-origin` in the sandbox. Subdomains of a listed host match. This only reclassifies a host the allow-list already accepts — pair it with `customIframeDomains` for anything else. |
| `iframePolicy` | `'strict'` \| `'extend'` \| `'allow-all'` | `'strict'` | How `UIResourceRenderer` validates an `iframe` component's host. `'strict'` accepts `DEFAULT_IFRAME_DOMAINS` only; a host outside it is replaced by the validation card before any renderer runs. |
| `customIframeDomains` | `string[]` | `[]` | Extra hosts the allow-list accepts when `iframePolicy` is `'extend'`. |
| `iframeFallbackLink` | `'auto'` \| `'always'` \| `'never'` | `'auto'` | Whether an "open in a new tab" link (`strings.iframeOpenInNewTab`) shows under the embed. `'auto'` shows it only when the page is cross-origin isolated. `window.crossOriginIsolated` is read **after mount**, so SSR markup and hydration match. Note that flag needs COOP `same-origin` **and** COEP: a host that sends COEP alone blocks embeds while the flag is false, so it should set `'always'`. |

The attribute is a boolean attribute: absent from the DOM when it does not
apply, never `credentialless="false"`.

Like `<MCPUIStringsProvider>`, a nested `<MCPUIConfigProvider>` merges over the
defaults, not over an outer provider: repeat the options you want to keep.

`isTrustedIframeDomain(url, { customTrustedDomains? })` is exported (root
barrel and the `/validation` subpath) if you need the same decision outside
the renderers.

### Browser support

| | header `COEP: credentialless` | attribute `<iframe credentialless>` |
| --- | --- | --- |
| Chrome / Edge | 96+ | **110+** |
| Firefox | 119+ | **not supported** |
| Safari | not supported (value ignored) | not supported |

Firefox applies the header but ignores the attribute, so third-party iframes
stay blocked there while the host sends COEP — nothing in this library can
change that, and the fallback link is what the user gets. Safari does not
know the value, treats the header as absent, and embeds simply work.

### The CSP is still yours

The allow-list is not a substitute for your Content-Security-Policy. The
browser enforces `frame-src`, which the **host** sets, and a domain missing
from it stays blocked whatever this library emits:

```
Content-Security-Policy: frame-src https://www.youtube-nocookie.com https://player.vimeo.com …
```

The comment on `DEFAULT_IFRAME_DOMAINS` in `services/validation.ts` says the
same thing: *"Must match CSP frame-src directive."*

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

## Internationalization (i18n) — `MCPUIStrings`

`<MCPUIStringsProvider>` localizes the library's own **chrome** — button
titles, `aria-label`s, placeholders, empty states. It never touches
**content** (`params.title`, table data, action labels, chat prompt copy):
that comes from the payload and is already localized by whoever produced
it. Every key is optional; an omitted key falls back to its English
`DEFAULT_MCPUI_STRINGS` value, so mounting the provider is entirely opt-in
and partial overrides are the normal case.

```tsx
import { MCPUIStringsProvider } from '@seed-ship/mcp-ui-solid'

<MCPUIStringsProvider strings={{ expand: 'Agrandir', feedbackUseful: 'Utile' }}>
  <App />
</MCPUIStringsProvider>
```

A handful of keys are templates: they carry a `{placeholder}` the renderer
fills in at call time via the exported `formatMCPUIString(template, vars)`
helper. Hosts that render their own equivalent chrome (e.g. a custom sort
header) can call the same helper to get the same substitution behavior —
an unrecognized `{placeholder}` is left verbatim rather than becoming
`undefined`:

```ts
import { formatMCPUIString } from '@seed-ship/mcp-ui-solid'

formatMCPUIString('Sort by {column}', { column: 'Revenue' }) // 'Sort by Revenue'
formatMCPUIString('Export CSV ({count} rows)', { count: 42 }) // 'Export CSV (42 rows)'
```

### Full key reference

| Key | English default | Where it appears |
|-----|------------------|-------------------|
| `expand` | `Expand` | `ExpandableWrapper` toolbar — expand-to-fullscreen button `title` |
| `expandedView` | `Expanded view` | `ExpandableWrapper` — fullscreen modal heading/`aria-label` when untitled |
| `copyToClipboard` | `Copy to clipboard` | `ExpandableWrapper` — default copy-button tooltip (overridden by a `copyLabel` prop) |
| `closeExpandedView` | `Close expanded view` | `ExpandableWrapper` — fullscreen modal close button `aria-label` |
| `feedbackUseful` | `Useful` | `FeedbackInline` — thumb-up button `title`/`aria-label` |
| `feedbackNotUseful` | `Not useful` | `FeedbackInline` — thumb-down button `title`/`aria-label` |
| `feedbackPositiveAck` | `Thanks!` | `FeedbackInline` — acknowledgement after a positive rating |
| `feedbackNegativeAck` | `Noted — we'll improve` | `FeedbackInline` — acknowledgement after a negative rating |
| `retry` | `Retry` | `StreamingUIRenderer` — retry button label |
| `ok` | `OK` | `ScratchpadPanel` — inline filter editor confirm button |
| `cancel` | `Cancel` | `ScratchpadPanel` (inline filter editor), `ChatPrompt` (`ConfirmBody`, payload `cancelLabel` still wins) — generic cancel button |
| `confirm` | `Confirm` | `ChatPrompt` (`ConfirmBody`) — generic confirm button |
| `submit` | `Submit` | `ChatPrompt` (`FormBody`), `FormRenderer`, `ScratchpadPanel` (`EmbeddedFormSection`) — generic submit button |
| `dismiss` | `Dismiss` | `ChatPrompt` — `aria-label` of the dismiss button |
| `yes` | `Yes` | `StreamingUIRenderer` (cached cell), `ScratchpadPanel` (`FeedbackSection` approve label) |
| `no` | `No` | `ScratchpadPanel` — `FeedbackSection` reject label |
| `chartView` | `Chart` | `ChartJSRenderer` — chart/data view switch, "chart" side |
| `chartDataView` | `Data` | `ChartJSRenderer` — chart/data view switch, "data" side |
| `chartViewSelector` | `Chart or data view` | `ChartJSRenderer` — view switch accessible name |
| `chartDataTable` | `Chart data` | `ChartJSRenderer` — data-table caption/accessible name |
| `chartDataSummary` | `Exact values are available in the data view.` | `ChartJSRenderer` — screen-reader description of the chart canvas |
| `chartNoData` | `No chart data` | `ChartJSRenderer` — empty state |
| `paginationPrevious` | `Previous page` | `UIResourceRenderer` (table) — pagination "previous" button accessible name |
| `paginationNext` | `Next page` | `UIResourceRenderer` (table) — pagination "next" button accessible name |
| `paginationPageSize` | `Rows per page` | `UIResourceRenderer` (table) — page-size `<select>` accessible name |
| `gridRegion` | `Layout grid` | `GridRenderer` — fallback `aria-label` for an untitled grid region |
| `autocompleteSuggestions` | `Suggestions` | `AutocompleteDropdown` — suggestions listbox `aria-label` |
| `autocompleteLoading` | `Loading...` | `AutocompleteDropdown` — fallback loading message |
| `autocompleteEmpty` | `No suggestions found` | `AutocompleteDropdown` — fallback empty state |
| `carouselTitle` | `Carousel` | `CarouselRenderer` — expandable-wrapper toolbar title |
| `carouselCopy` | `Copy items (JSON)` | `CarouselRenderer` — copy button `copyLabel` |
| `mapTitle` | `Map` | `MapRenderer` — expandable-wrapper toolbar title |
| `mapCopy` | `Copy markers as GeoJSON` | `MapRenderer` — copy button `copyLabel` |
| `chartDownloadPng` | `Download PNG` | `ChartJSRenderer` — PNG export button `title` |
| `chartDownloadPngAria` | `Download chart as PNG` | `ChartJSRenderer` — PNG export button `aria-label` |
| `chartCopy` | `Copy chart data (JSON)` | `ChartJSRenderer` — copy button `copyLabel` |
| `chartLoading` | `Loading chart...` | `ChartJSRenderer` — overlay shown while the chart library and data are loading |
| `codeSearchPlaceholder` | `Search…` | `CodeBlockRenderer` — in-code search input `placeholder` |
| `codeSearchAria` | `Search in code` | `CodeBlockRenderer` — in-code search input `aria-label` |
| `codeDownloadAria` | `Download code as file` | `CodeBlockRenderer` — download button `aria-label` |
| `codeDownload` | `Download code` | `CodeBlockRenderer` — download button `title` |
| `codeToggleWordWrap` | `Toggle word wrap` | `CodeBlockRenderer` — word-wrap toggle `aria-label` |
| `codeCopy` | `Copy code` | `CodeBlockRenderer` — copy button `title`/`aria-label` |
| `codeTitle` | `Code` | `CodeBlockRenderer` — heading and toolbar title when no filename/language is given |
| `codeWordWrapEnable` | `Enable word wrap` | `CodeBlockRenderer` — word-wrap toggle `title` while word wrap is OFF |
| `codeWordWrapDisable` | `Disable word wrap` | `CodeBlockRenderer` — word-wrap toggle `title` while word wrap is ON |
| `exportCsvRows` | `Export CSV ({count} rows)` | `DataPreviewSection` — CSV export button `title`. Template: `{count}` |
| `exportJsonRows` | `Export JSON ({count} rows)` | `DataPreviewSection` — JSON export button `title`. Template: `{count}` |
| `sortBy` | `Sort by {column}` | `DataPreviewSection` / tables — sortable column header `title`. Template: `{column}` |
| `removeItem` | `Remove {name}` | Form fields (chips/tags/filters) — removal button `aria-label`. Template: `{name}` |
| `filterPlaceholder` | `Filter...` | Form fields — multi-select options filter input `placeholder` |
| `fieldNotSupported` | `Not supported` | `FormFieldRenderer` — badge shown next to a field whose type the renderer does not support |
| `fieldNoMatches` | `No matches` | `FormFieldRenderer` (`MultiSelectField`) — empty state of the option list |
| `fieldGroupContainer` | `Group container` | `FormFieldRenderer` — fallback help text of a `fieldset` field with none |
| `fieldSelectPlaceholder` | `Select...` | `FormFieldRenderer` — fallback `placeholder` of the multi-select trigger |
| `fieldTagsPlaceholder` | `Type and press Enter...` | `FormFieldRenderer` (`TagsField`) — fallback `placeholder` of the tags input |
| `scratchpadClose` | `Close` | `ScratchpadPanel` — close button `aria-label` |
| `scratchpadPreview` | `Preview` | `ScratchpadPanel` — heading of the filter preview block |
| `scratchpadNoResults` | `No results for these filters` | `ScratchpadPanel` — empty state of the filter preview block |
| `scratchpadModifyFilters` | `Modify filters` | `ScratchpadPanel` — "refine the filters" button in the empty preview |
| `scratchpadNoFilters` | `No filters` | `ScratchpadPanel` — empty state of the active-filter chip row |
| `scratchpadEdit` | `Edit` | `ScratchpadPanel` — collapsed embedded form's "edit" button |
| `scratchpadSend` | `Send` | `ScratchpadPanel` (`FeedbackSection`) — free-text feedback "send" button |
| `scratchpadShowRaw` | `Show raw SSE payload` | `ScratchpadPanel` (`FormDebugTrace`) — debug toggle while the raw payload is hidden |
| `scratchpadHideRaw` | `Hide raw SSE payload` | `ScratchpadPanel` (`FormDebugTrace`) — debug toggle while the raw payload is shown |
| `scratchpadCommentPlaceholder` | `Add a comment...` | `ScratchpadPanel` (`FeedbackSection`) — fallback `placeholder` of the free-text feedback input |
| `scratchpadError` | `Error` | `ScratchpadPanel` (`ErrorSectionRenderer`) — fallback message of an error section with none |
| `scratchpadSource` | `Source` | `ScratchpadPanel` (`SourceCardSection`) — fallback name of a source card with none |
| `graphExport` | `Export graph` | `GraphRenderer` — export-menu trigger `title`/`aria-label` |
| `graphCopy` | `Copy graph (JSON)` | `GraphRenderer` — copy button `copyLabel` |
| `graphTitle` | `Graph` | `GraphRenderer` — expandable-wrapper toolbar title when untitled |
| `graphExportMenu` | `Export ▾` | `GraphRenderer` — visible label of the export-menu trigger button |
| `graphDownloadPng` | `Download PNG` | `GraphRenderer` — "download PNG" export-menu item label |
| `graphDownloadPngHint` | `visual snapshot` | `GraphRenderer` — hint under the "download PNG" item |
| `graphDownloadMermaid` | `Download Mermaid` | `GraphRenderer` — "download Mermaid" export-menu item label |
| `graphDownloadMermaidHint` | `markdown / GitHub` | `GraphRenderer` — hint under the "download Mermaid" item |
| `graphDownloadJson` | `Download JSON` | `GraphRenderer` — "download JSON" export-menu item label |
| `graphDownloadJsonHint` | `raw data` | `GraphRenderer` — hint under the "download JSON" item |
| `galleryCopy` | `Copy image URLs` | `ImageGalleryRenderer` — copy button `copyLabel` |
| `galleryTitle` | `Gallery` | `ImageGalleryRenderer` — expandable-wrapper toolbar title when untitled |
| `videoCopy` | `Copy video URL` | `VideoRenderer` — copy button `copyLabel` |
| `videoTitle` | `Video` | `VideoRenderer` — toolbar title and iframe `title` when untitled |
| `sourceDetected` | `Detected from message` | `FormFieldRenderer` — "detected" prefill-source badge `title` |
| `sourceInferred` | `Inferred from context` | `FormFieldRenderer` — "inferred" prefill-source badge `title` |
| `sourcePrevious` | `Previously provided` | `FormFieldRenderer` — "user"/previous prefill-source badge `title` |
| `lightboxLabel` | `Image lightbox` | `LightboxOverlay` — dialog `aria-label` |
| `lightboxClose` | `Close lightbox` | `LightboxOverlay` — close button `aria-label` |
| `lightboxPrevious` | `Previous image` | `LightboxOverlay` — previous-image button `aria-label` |
| `lightboxNext` | `Next image` | `LightboxOverlay` — next-image button `aria-label` |
| `modalClose` | `Close modal` | `ModalRenderer` — close button `aria-label` |
| `copy` | `Copy` | `UIResourceRenderer` — default generic copy-button `title`/`aria-label` |
| `copyMetric` | `Copy metric` | `UIResourceRenderer` (metric) — copy button `title` |
| `copyText` | `Copy text` | `UIResourceRenderer` (text) — copy button `title` |
| `copyErrorDetails` | `Copy error details` | `UIResourceRenderer` (error) — copy button `title` |
| `tableTitle` | `Table` | `UIResourceRenderer` (table) — expandable-wrapper toolbar title when untitled |
| `tableCopyCsv` | `Copy table (CSV)` | `UIResourceRenderer` (table) — CSV copy button `title`/`copyLabel` |
| `tableExport` | `Export table` | `UIResourceRenderer` (table) — export-menu trigger `title`/`aria-label` |
| `tableClearSearch` | `Clear search` | `UIResourceRenderer` (table) — search reset button `aria-label` |
| `tableAriaLabel` | `Data table` | `UIResourceRenderer` (table) — scroll-region fallback `aria-label` when untitled |
| `tableSearchPlaceholder` | `Search the table...` | `UIResourceRenderer` (table) — search input `placeholder`. A connector's own `tableParams.searchPlaceholder` still wins when set |
| `tableCopyTsv` | `Copy TSV` | `UIResourceRenderer` (table) — "copy as TSV" export-menu item |
| `tableDownloadCsv` | `Download CSV` | `UIResourceRenderer` (table) — "download CSV" export-menu item |
| `tableDownloadJson` | `Download JSON` | `UIResourceRenderer` (table) — "download JSON" export-menu item |
| `perPageSuffix` | `/ page` | `UIResourceRenderer` (table) — suffix after the pagination page-size selector |
| `imageAlt` | `Image` | `UIResourceRenderer` (image) — fallback `alt` text |
| `imageViewFullSize` | `View full size: {alt}` | `UIResourceRenderer` (image) — zoom-link `aria-label`. Template: `{alt}` |
| `iframeTitle` | `Embedded content` | `UIResourceRenderer` (iframe) — fallback `title` |
| `iframeOpenInNewTab` | `Open in a new tab` | `IframeRenderer` / `VideoRenderer` — label of the COEP fallback link under an embed (v6.21.0) |
| `linkLabel` | `Link` | `UIResourceRenderer` (link) — fallback visible label |
| `linkOpensInNewTab` | `{label}: {description} (opens in new tab)` | `UIResourceRenderer` (link) — `aria-label`. Template: `{label}`, `{description}` |
| `validationWarning` | `Component validation warning` | `UIResourceRenderer` — inline component-validation warning chip `aria-label` |
| `resourceTitle` | `Resource` | `UIResourceRenderer` — fallback heading for an HTML resource with no title or URI |
| `chartError` | `Chart Error` | `UIResourceRenderer` (`ChartRenderer`) — heading of the chart renderer's error overlay |
| `validationError` | `Validation Error` | `UIResourceRenderer` — heading of the blocking component-validation error card |
| `validationUnknownError` | `Unknown validation error` | `UIResourceRenderer` — fallback detail of a validation error carrying no message |
| `errorUnknown` | `Unknown error` | `UIResourceRenderer` (`ErrorCardRenderer`) — fallback message inside the error card's copyable text |
| `errorUnknownToolName` | `Unknown` | `UIResourceRenderer` (`ErrorCardRenderer`) — fallback tool name in the error card heading |
| `errorToolExecution` | `An error occurred during tool execution` | `UIResourceRenderer` (`ErrorCardRenderer`) — fallback body of an error card carrying no message |
| `verifiedTitle` | `Verified against source data` | `VerifiedText` — `title` of a verified segment |
| `verifiedAria` | `verified` | `VerifiedText` — verified marker glyph `aria-label` |
| `unverifiedAria` | `unverified` | `VerifiedText` — unverified marker glyph `aria-label` |
| `verifiedNotFound` | `Not found in source data` | `VerifiedText` — `title` when there is no closest match |
| `verifiedNotFoundClosest` | `Not found in source data. Closest: {closest} ({pct}% off)` | `VerifiedText` — `title` when there is a closest match. Template: `{closest}`, `{pct}` |
| `verifiedStripLabel` | `[unverified]` | `VerifiedText` — placeholder shown in `mode="strip"` |
| `verifiedConfidence` | `{pct}% verified` | `ScratchpadPanel` (`ActionSection`), `VerifiedText` — confidence summary of a validated answer. Template: `{pct}` |
| `verifiedUnverifiedCount` | `({count} unverified)` | `ScratchpadPanel` (`ActionSection`), `VerifiedText` — count of unverified numbers next to the confidence summary. Template: `{count}` |
| `promptLoadingPreview` | `Loading preview...` | `ChatPrompt` (`FormBody`) — placeholder shown while the form's live preview is loading |
| `promptConfirmed` | `Confirmed` | `ChatPrompt` — submitted label of a confirmed `confirm` prompt (no `confirmLabel`) |
| `promptCancelled` | `Cancelled` | `ChatPrompt` — submitted label of a cancelled `confirm` prompt (no `cancelLabel`) |
| `promptFormSubmitted` | `Form submitted` | `ChatPrompt` — submitted label of a `form` prompt whose fields are all empty |
| `formSubmissionFailed` | `Submission failed` | `FormRenderer` — fallback error when the submit action fails without a message |
| `formSubmitCountdown` | `{label} in {seconds}s...` | `FormRenderer` — auto-submit countdown notice. Template: `{label}`, `{seconds}` |
| `actionGroupLabel` | `Action group` | `ActionGroupRenderer` — fallback `aria-label` of an action group without one |
| `artifactDescription` | `Generated artifact` | `ArtifactRenderer` — fallback description of an artifact card without one |
| `degradedCaption` | `Showing the underlying data — the interactive view is unavailable.` | `DegradedFallback` — fallback caption of the degraded-renderer notice |
| `metaProvider` | `Provider` | `StreamingUIRenderer` — metadata panel provider cell label |
| `metaModel` | `Model` | `StreamingUIRenderer` — metadata panel model cell label |
| `metaExecutionTime` | `Execution Time` | `StreamingUIRenderer` — metadata panel execution-time cell label |
| `metaCost` | `Cost` | `StreamingUIRenderer` — metadata panel cost cell label |
| `metaTtfb` | `TTFB` | `StreamingUIRenderer` — metadata panel time-to-first-byte cell label |
| `metaCached` | `Cached` | `StreamingUIRenderer` — metadata panel cache-hit cell label |
| `download` | `Download` | `ArtifactRenderer` — download link label |
| `unknown` | `unknown` | `GenerativeUIErrorBoundary` — fallback for a missing component type/id |
| `citationUnresolved` | `[ref. {id}]` | `UIResourceRenderer` (table) — placeholder kept for a citation marker no `citationMap` resolves (empty map only). Template: `{id}` |
| `invalidComponent` | `Invalid {type}` | `UIResourceRenderer` — `errorMode: 'inline-warn'` validation chip text. Template: `{type}` |
| `toolErrorTitle` | `Tool Error: {tool}` | `UIResourceRenderer` — tool-error card heading. Template: `{tool}` (falls back to `errorUnknownToolName`) |
| `errorTypeLabel` | `Type: {type}` | `UIResourceRenderer` — tool-error card error-type line. Template: `{type}` |
| `errorSuggestions` | `Suggestions:` | `UIResourceRenderer` — heading above the tool-error suggestion list |
| `chartInvalidData` | `Invalid chart data: missing data.datasets` | `UIResourceRenderer` (`ChartRenderer`) — shown when the payload has no `data.datasets` |
| `unsupportedComponentType` | `Unsupported component type:` | `UIResourceRenderer` — prefix of the unsupported-component notice (the type follows in a `<code>`) |
| `previewPrev` | `Prev` | `DataPreviewSection` — previous-page button visible label |
| `previewNext` | `Next` | `DataPreviewSection` — next-page button visible label |
| `previewPageIndicator` | `Page {page} / {total}` | `DataPreviewSection` — page indicator between the two buttons. Template: `{page}`, `{total}` |
| `fieldResolving` | `Resolving...` | `FormFieldRenderer` — inline notice while an entity reference is being resolved |
| `formPrefilledOne` | `{count} field pre-filled out of {total}` | `FormRenderer`, `ScratchpadPanel` — prefill summary, single field. Template: `{count}` (always 1), `{total}` |
| `formPrefilledMany` | `{count} fields pre-filled out of {total}` | `FormRenderer`, `ScratchpadPanel` — prefill summary, several fields. Template: `{count}`, `{total}` |
| `formSubmitting` | `Submitting...` | `FormRenderer` — busy label of the submit button while submitting |
| `formReset` | `Reset` | `FormRenderer` — reset button label |
| `errorBoundaryTitle` | `Component Failed to Render` | `GenerativeUIErrorBoundary` — default fallback heading |
| `errorBoundaryMeta` | `Type: {type} \| ID: {id}...` | `GenerativeUIErrorBoundary` — default fallback metadata line. Template: `{type}`, `{id}` (both fall back to `unknown`) |
| `errorBoundaryRetry` | `Retry Rendering` | `GenerativeUIErrorBoundary` — default fallback retry button label |
| `scratchpadSearch` | `Search` | `ScratchpadPanel` — `waiting_human` search button label |
| `scratchpadNextStep` | `Next` | `ScratchpadPanel` (`EnrichedStepsSection`) — advance-to-next-step button label |
| `scratchpadPlan` | `Plan:` | `ScratchpadPanel` (`PromptSection`) — label preceding the interrogation plan summary |
| `scratchpadModify` | `Modify` | `ScratchpadPanel` (`PromptSection`) — "modify this prompt" button label |
| `scratchpadDetails` | `Details` | `ScratchpadPanel` (`ErrorSectionRenderer`) — "show details" toggle label |
| `scratchpadItems` | `items` | `ScratchpadPanel` (`ActionSection`) — unit suffix after the item count |
| `videoUnsupported` | `Your browser does not support the video tag.` | `VideoRenderer` — fallback text of a `<video>` element the browser cannot play |
| `previewShowingRange` | `Showing {start}–{end} of {total}` | `DataPreviewSection` — paginated page-info line (template) |
| `previewRowsOne` | `{count} row` | `DataPreviewSection` — unpaginated row count, singular (template) |
| `previewRowsMany` | `{count} rows` | `DataPreviewSection` — unpaginated row count, plural (template) |
| `previewTotalSuffix` | ` ({total} total)` | `DataPreviewSection` — suffix when the payload declares more rows than sent (template) |
| `statusLoading` | `Loading...` | `ScratchpadPanel` — status badge, `loading` |
| `statusActionAvailable` | `Action available` | `ScratchpadPanel` — status badge, `ready` |
| `statusYourTurn` | `Your turn` | `ScratchpadPanel` — status badge, `waiting_human` |
| `statusProcessing` | `Processing...` | `ScratchpadPanel` — status badge, `processing` |
| `statusComplete` | `Complete` | `ScratchpadPanel` — status badge, `complete` (the `error` badge reuses `scratchpadError`) |
| `agentStatusIdle` | `Idle` | `AgentCard` / `AgentStatusBadge` — status label |
| `agentStatusRunning` | `Running` | `AgentCard` / `AgentStatusBadge` — status label |
| `agentStatusWaiting` | `Waiting` | `AgentCard` / `AgentStatusBadge` — status label |
| `agentStatusDone` | `Done` | `AgentCard` / `AgentStatusBadge` — status label |
| `agentStatusError` | `Error` | `AgentCard` / `AgentStatusBadge` — status label |
| `handoffItems` | `{count} items` | `AgentHandoff` — fallback summary (template); `content.summary` wins |
| `degradedMoreRows` | `+{count} more rows not shown.` | `DegradedFallback` — truncation notice (template) |
| `chartDegradedCaption` | `Showing the chart data as a table — the interactive chart is unavailable.` | `ChartJSRenderer` — degraded table caption |
| `chartRenderFailed` | `Chart rendering failed: {error}` | `ChartJSRenderer` — degraded table notice (template) |
| `chartRenderError` | `Chart rendering failed` | `ChartJSRenderer` — fallback reason when the render throws without a message |
| `chartQuickchartCaption` | `Showing the chart data as a table.` | `UIResourceRenderer` — degraded table caption when chart.js is missing |
| `graphDegradedCaption` | `Showing the graph data as a table — the interactive view is unavailable.` | `GraphRenderer` — degraded table caption |
| `graphRenderFailed` | `Graph rendering failed: {error}` | `GraphRenderer` — degraded table notice (template) |
| `graphRenderError` | `Failed to render graph` | `GraphRenderer` — fallback reason when the G6 render throws without a message |
| `graphPngUnsupported` | `PNG export not supported in current renderer mode` | `GraphRenderer` — PNG export error |
| `graphPngExportFailed` | `PNG export failed` | `GraphRenderer` — PNG export error without a message |
| `mapDegradedCaption` | `Showing the map data as a coordinate table — the interactive map is unavailable.` | `MapRenderer` — degraded table caption |
| `mapRenderFailed` | `Map rendering failed: {error}` | `MapRenderer` — degraded table notice (template) |
| `mapRenderError` | `Failed to render map` | `MapRenderer` — fallback reason when the Leaflet render throws without a message |
| `mapLibraryUnavailable` | `Map library could not be loaded.` | `MapRenderer` — the Leaflet bundle failed to load |
| `degradedColType` | `Type` | Degraded map table — feature type column |
| `degradedColLat` | `Lat` | Degraded map table — latitude column |
| `degradedColLng` | `Lng` | Degraded map table — longitude column |
| `degradedColInfo` | `Info` | Degraded map table — property summary column |
| `degradedColSource` | `Source` | Degraded graph table — edge source column |
| `degradedColTarget` | `Target` | Degraded graph table — edge target column |
| `degradedColNode` | `Node` | Degraded graph table — node id column |
| `degradedColLabel` | `Label` | Degraded graph / chart tables — label column |
| `degradedSeries` | `Series {n}` | Degraded chart table — unlabelled dataset name (template) |
| `chartTableSeries` | `Series` | `ChartJSRenderer` accessible data table — series column |
| `chartTablePoint` | `Point` | `ChartJSRenderer` accessible data table — point-index column |
| `autocompleteHintNavigate` | ` to navigate, ` | `AutocompleteDropdown` — hint prose between the arrow and Enter key caps |
| `autocompleteHintSelect` | ` to select, ` | `AutocompleteDropdown` — hint prose between the Enter and Esc key caps |
| `autocompleteHintDismiss` | ` to dismiss` | `AutocompleteDropdown` — hint prose after the Esc key cap |
| `autocompleteTabToAccept` | `Tab to accept` | `AutocompleteFormField` — ghost-text hint |
| `fieldAddMorePlaceholder` | `Add more...` | `FormFieldRenderer` — multi-value entity picker placeholder |
| `galleryViewImage` | `View image {index}` | `ImageGalleryRenderer` — thumbnail button `aria-label` (template); `image.alt` wins |
| `galleryImageAlt` | `Image {index}` | `ImageGalleryRenderer` — image `alt` (template); `image.alt` wins |
| `imageAltFallback` | `image` | `UIResourceRenderer` — noun substituted into `imageViewFullSize` when the image has no `alt` |
| `chartVisualizationAlt` | `Chart visualization` | `UIResourceRenderer` — chart image `alt`/`aria-label` with no payload title |
| `chartWithTitleAlt` | `Chart: {title}` | `UIResourceRenderer` — chart image `alt`/`aria-label` with a title (template) |
| `chartLoadFailed` | `Failed to load chart` | `UIResourceRenderer` — the chart image failed to load |
| `paginationAllRows` | `All` | `UIResourceRenderer` — page-size option that disables pagination |
| `fieldRequired` | `{field} is required` | Form validation (template) |
| `fieldMustBeChecked` | `{field} must be checked` | Form validation (template) |
| `fieldMinLength` | `Minimum {min} characters required` | Form validation (template) |
| `fieldMaxLength` | `Maximum {max} characters allowed` | Form validation (template) |
| `fieldInvalidPattern` | `Invalid format` | Form validation — value does not match `field.pattern` |
| `fieldInvalidEmail` | `Invalid email address` | Form validation |
| `fieldInvalidNumber` | `Must be a valid number` | Form validation |
| `fieldMinValue` | `Minimum value is {min}` | Form validation (template) |
| `fieldMaxValue` | `Maximum value is {max}` | Form validation (template) |
| `fieldMinDate` | `Date must be after {min}` | Form validation (template) |
| `fieldMaxDate` | `Date must be before {max}` | Form validation (template) |
| `fieldInvalidOption` | `Please select a valid option` | Form validation |
| `fieldInvalidFormat` | `Invalid format (expected: {format})` | Form validation (template); `field.valueFormatHint` wins |
| `locale` | `en-US` | BCP-47 tag for number / date formatting and collation in chrome and table cells (see below) |
| `briefingAdded` | `+{count} added` | `BriefingDiff` — stats summary (template) |
| `briefingRemoved` | `{count} removed` | `BriefingDiff` — stats summary (template) |
| `briefingChanged` | `{count} changed` | `BriefingDiff` — stats summary (template) |
| `footerSources` | `{count} sources` | `FooterRenderer` — source count (template) |
| `degradedMarker` | `marker` | Degraded map table — `Type` cell of a marker row |
| `degradedFeature` | `feature` | Degraded map table — `Type` cell of a GeoJSON feature without a geometry type |
| `fieldUnknownType` | `Unknown field type: {type}` | `FormFieldRenderer` — warning under a field of unknown type (template) |
| `fieldSelectedCount` | `{count} selected` | `FormFieldRenderer` — multiselect trigger with selections (template) |
| `scratchpadErrorCode` | `Code: {code}` | `ScratchpadPanel` — error state code line (template) |
| `scratchpadResultCount` | `{count} results` | `ScratchpadPanel` — data-source card row count (template) |
| `tableVirtualizedRows` | `(virtualized: {count} rows)` | `UIResourceRenderer` — table title suffix while virtualized (template) |
| `tableSearchResultsOne` | `{count} result on {total}` | `UIResourceRenderer` — search result count, singular (template) |
| `tableSearchResultsMany` | `{count} results on {total}` | `UIResourceRenderer` — search result count, plural (template) |
| `tableServerPageRange` | `Showing {start} - {end} of {total}` | `UIResourceRenderer` — server-side pagination range (template) |
| `errorCopyText` | `Error in {tool}: {message}` | `UIResourceRenderer` — text the tool-error card's Copy button puts on the clipboard (template) |
| `errorUnknownTool` | `unknown tool` | `UIResourceRenderer` — tool name in `errorCopyText` when the error has none |
| `streamInitializing` | `Initializing...` | `StreamingUIRenderer` — progress message before the stream starts |
| `streamConnecting` | `Connecting to server...` | `StreamingUIRenderer` — progress message while connecting |
| `streamLoadingComponent` | `Loading {type} component...` | `StreamingUIRenderer` — progress message per streamed component (template) |
| `streamDashboardLoaded` | `Dashboard loaded` | `StreamingUIRenderer` — progress message on completion |
| `streamErrorProgress` | `Error: {message}` | `StreamingUIRenderer` — progress message after an error (template) |
| `streamConnectionFailed` | `Stream connection failed` | `StreamingUIRenderer` — error title when the connection fails |
| `streamRequestFailed` | `Stream request failed` | `StreamingUIRenderer` — error message for a non-OK response without a message |
| `streamEmptyResponse` | `Response body is null` | `StreamingUIRenderer` — error message for a response without a body |
| `streamServerSide` | `Streaming UI cannot start on server-side` | `StreamingUIRenderer` — error message when started during SSR |
| `streamUnknownError` | `Unknown error` | `StreamingUIRenderer` — error message when the failure has none |
| `streamServerSideTitle` | `Streaming unavailable` | `StreamingUIRenderer` — error heading when streaming was started during SSR (replaces the machine code `ssr`) |
| `graphUnavailable` | `Graph rendering unavailable` | `GraphRenderer` — heading when the `@antv/g6` peer is missing |
| `mapPmtilesUnavailable` | `PMTiles layer unavailable — the optional "protomaps-leaflet" peer dependency failed to load or render.` | `MapRenderer` — banner when the PMTiles overlay fails |
| `mapBaseMapStillShown` | `The base map is still shown.` | `MapRenderer` — sentence after the PMTiles banner |
| `chartJsUnavailable` | `Chart.js is not available. Install chart.js peer dependency.` | `UIResourceRenderer` chart — error when `renderer: 'native'` is forced without chart.js |
| `chartIframeUnavailable` | `Interactive chart unavailable — install the chart.js peer dependency, or set allowQuickchartFallback to use the external quickchart.io renderer.` | `UIResourceRenderer` chart — degraded-table message when chart.js is missing and quickchart is not allowed |
| `previewInvalidContent` | `[DataPreviewSection] Invalid content format` | `DataPreviewSection` — fallback when the content is not `{ columns, rows }` |
| `citationViewSource` | `View source - {label}` | `UIResourceRenderer` table — default citation chip tooltip (template; via `CitationCtx.viewSourceLabel`) |
| `sizeBytes` | `{size} B` | `ArtifactRenderer` — file size below 1 KB (template) |
| `sizeKilobytes` | `{size} KB` | `ArtifactRenderer` — file size in kilobytes (template) |
| `sizeMegabytes` | `{size} MB` | `ArtifactRenderer` — file size in megabytes (template) |

### `locale` — number, date and sort formatting (default change in v6.20.0)

`strings.locale` (default `'en-US'`) is passed to every `toLocaleString` /
`toLocaleDateString` / `localeCompare` the library calls itself: table sorting
and the client-side range count in `UIResourceRenderer`, the tool-error card
timestamp, `DataPreviewSection` number / currency / date cells, sorting and
page-info counts, `ScratchpadPanel` preview / data-source counts, and
`MapRenderer` auto-generated popups. Before v6.20.0 these sites hardcoded
`'fr-FR'` / `'fr'` or used the runtime's implicit locale (which could differ
between SSR and hydration). To keep French formatting:
`<MCPUIStringsProvider strings={{ locale: 'fr-FR' }}>`.

**SSR determinism.** `strings.locale` always resolves to an explicit BCP-47
tag — `'en-US'` unless a provider overrides it — never to the server's or the
browser's ambient locale. That is what makes it safe to call in SSR
components: the same tag renders the same formatted string on the server and
after hydration, so there is no server/client markup mismatch. Relying on the
runtime's implicit locale (an argument-less `toLocaleString()`) is exactly
the pre-v6.20.0 behavior this key replaces, and it did not have that
guarantee. An invalid tag in the provider resolves to `'en-US'` instead of
making `Intl` throw (`resolveMCPUILocale()` exposes the same check).

The locale does not fix the time zone. Date-only `DataPreviewSection` cells
are formatted in UTC so every viewer sees the same calendar date. Date-time
cells and the tool-error card timestamp are formatted only after mount, in the
viewer's time zone: server markup shows the raw date-time value.

`useStreamingUI()` called directly (without `StreamingUIRenderer`) takes the
same messages as a `messages` option (`DEFAULT_STREAMING_UI_MESSAGES`).

### `tableSearchPlaceholder`, `verifiedStripLabel`, `scratchpadEdit`, `citationUnresolved` and `formPrefilledOne`/`formPrefilledMany` changed from French to English

As of v6.20.0 these five defaults are English, matching every other key. If
you relied on the previous French defaults with no provider mounted,
restore them explicitly:

```tsx
<MCPUIStringsProvider
  strings={{
    tableSearchPlaceholder: 'Rechercher dans le tableau...',
    verifiedStripLabel: '[non vérifié]',
    scratchpadEdit: 'Modifier',
    citationUnresolved: '[réf. {id}]',
    formPrefilledOne: '{count} champ pré-rempli sur {total}',
    formPrefilledMany: '{count} champs pré-remplis sur {total}',
  }}
>
  <App />
</MCPUIStringsProvider>
```

### French example dictionary

A complete override covering every key above:

```tsx
import { MCPUIStringsProvider } from '@seed-ship/mcp-ui-solid'
import type { MCPUIStrings } from '@seed-ship/mcp-ui-solid'

const fr: MCPUIStrings = {
  expand: 'Agrandir',
  expandedView: 'Vue agrandie',
  copyToClipboard: 'Copier dans le presse-papiers',
  closeExpandedView: 'Fermer la vue agrandie',
  feedbackUseful: 'Utile',
  feedbackNotUseful: 'Pas utile',
  feedbackPositiveAck: 'Merci !',
  feedbackNegativeAck: "Noté — on va s'améliorer",
  retry: 'Réessayer',
  ok: 'OK',
  cancel: 'Annuler',
  confirm: 'Confirmer',
  submit: 'Envoyer',
  dismiss: 'Fermer',
  yes: 'Oui',
  no: 'Non',
  chartView: 'Graphique',
  chartDataView: 'Données',
  chartViewSelector: 'Vue graphique ou données',
  chartDataTable: 'Données du graphique',
  chartDataSummary: 'Les valeurs exactes sont disponibles dans la vue données.',
  chartNoData: 'Aucune donnée de graphique',
  paginationPrevious: 'Page précédente',
  paginationNext: 'Page suivante',
  paginationPageSize: 'Lignes par page',
  gridRegion: 'Grille de mise en page',
  autocompleteSuggestions: 'Suggestions',
  autocompleteLoading: 'Chargement...',
  autocompleteEmpty: 'Aucune suggestion trouvée',
  carouselTitle: 'Carrousel',
  carouselCopy: 'Copier les éléments (JSON)',
  mapTitle: 'Carte',
  mapCopy: 'Copier les repères en GeoJSON',
  chartDownloadPng: 'Télécharger en PNG',
  chartDownloadPngAria: 'Télécharger le graphique en PNG',
  chartCopy: 'Copier les données du graphique (JSON)',
  chartLoading: 'Chargement du graphique...',
  codeSearchPlaceholder: 'Rechercher…',
  codeSearchAria: 'Rechercher dans le code',
  codeDownloadAria: 'Télécharger le code en fichier',
  codeDownload: 'Télécharger le code',
  codeToggleWordWrap: 'Activer/désactiver le retour à la ligne',
  codeCopy: 'Copier le code',
  codeTitle: 'Code',
  codeWordWrapEnable: 'Activer le retour à la ligne',
  codeWordWrapDisable: 'Désactiver le retour à la ligne',
  exportCsvRows: 'Exporter en CSV ({count} lignes)',
  exportJsonRows: 'Exporter en JSON ({count} lignes)',
  sortBy: 'Trier par {column}',
  removeItem: 'Supprimer {name}',
  filterPlaceholder: 'Filtrer...',
  fieldNotSupported: 'Non pris en charge',
  fieldNoMatches: 'Aucun résultat',
  fieldGroupContainer: 'Conteneur de groupe',
  fieldSelectPlaceholder: 'Sélectionner...',
  fieldTagsPlaceholder: 'Saisir puis appuyer sur Entrée...',
  scratchpadClose: 'Fermer',
  scratchpadPreview: 'Aperçu',
  scratchpadNoResults: 'Aucun résultat pour ces filtres',
  scratchpadModifyFilters: 'Modifier les filtres',
  scratchpadNoFilters: 'Aucun filtre',
  scratchpadEdit: 'Modifier',
  scratchpadSend: 'Envoyer',
  scratchpadShowRaw: 'Afficher la charge SSE brute',
  scratchpadHideRaw: 'Masquer la charge SSE brute',
  scratchpadCommentPlaceholder: 'Ajouter un commentaire...',
  scratchpadError: 'Erreur',
  scratchpadSource: 'Source',
  graphExport: 'Exporter le graphe',
  graphCopy: 'Copier le graphe (JSON)',
  graphTitle: 'Graphe',
  graphExportMenu: 'Exporter ▾',
  graphDownloadPng: 'Télécharger en PNG',
  graphDownloadPngHint: 'instantané visuel',
  graphDownloadMermaid: 'Télécharger en Mermaid',
  graphDownloadMermaidHint: 'markdown / GitHub',
  graphDownloadJson: 'Télécharger en JSON',
  graphDownloadJsonHint: 'données brutes',
  galleryCopy: 'Copier les URL des images',
  galleryTitle: 'Galerie',
  videoCopy: "Copier l'URL de la vidéo",
  videoTitle: 'Vidéo',
  sourceDetected: 'Détecté depuis le message',
  sourceInferred: 'Déduit du contexte',
  sourcePrevious: 'Fourni précédemment',
  lightboxLabel: "Visionneuse d'image",
  lightboxClose: 'Fermer la visionneuse',
  lightboxPrevious: 'Image précédente',
  lightboxNext: 'Image suivante',
  modalClose: 'Fermer la fenêtre modale',
  copy: 'Copier',
  copyMetric: 'Copier la métrique',
  copyText: 'Copier le texte',
  copyErrorDetails: "Copier les détails de l'erreur",
  tableTitle: 'Tableau',
  tableCopyCsv: 'Copier le tableau (CSV)',
  tableExport: 'Exporter le tableau',
  tableClearSearch: 'Effacer la recherche',
  tableAriaLabel: 'Tableau de données',
  tableSearchPlaceholder: 'Rechercher dans le tableau...',
  tableCopyTsv: 'Copier en TSV',
  tableDownloadCsv: 'Télécharger en CSV',
  tableDownloadJson: 'Télécharger en JSON',
  perPageSuffix: '/ page',
  imageAlt: 'Image',
  imageViewFullSize: 'Voir en taille réelle : {alt}',
  iframeTitle: 'Contenu intégré',
  iframeOpenInNewTab: 'Ouvrir dans un nouvel onglet',
  linkLabel: 'Lien',
  linkOpensInNewTab: '{label} : {description} (ouvre un nouvel onglet)',
  validationWarning: 'Avertissement de validation du composant',
  resourceTitle: 'Ressource',
  chartError: 'Erreur du graphique',
  validationError: 'Erreur de validation',
  validationUnknownError: 'Erreur de validation inconnue',
  errorUnknown: 'Erreur inconnue',
  errorUnknownToolName: 'Inconnu',
  errorToolExecution: "Une erreur s'est produite lors de l'exécution de l'outil",
  verifiedTitle: 'Vérifié par rapport aux données source',
  verifiedAria: 'vérifié',
  unverifiedAria: 'non vérifié',
  verifiedNotFound: 'Introuvable dans les données source',
  verifiedNotFoundClosest: "Introuvable dans les données source. Le plus proche : {closest} ({pct} % d'écart)",
  verifiedStripLabel: '[non vérifié]',
  verifiedConfidence: '{pct}% vérifié',
  verifiedUnverifiedCount: '({count} non vérifié)',
  promptLoadingPreview: "Chargement de l'aperçu...",
  promptConfirmed: 'Confirmé',
  promptCancelled: 'Annulé',
  promptFormSubmitted: 'Formulaire envoyé',
  formSubmissionFailed: 'Envoi échoué',
  formSubmitCountdown: '{label} dans {seconds}s...',
  actionGroupLabel: "Groupe d'actions",
  artifactDescription: 'Artefact généré',
  degradedCaption: "Affichage des données sous-jacentes — la vue interactive n'est pas disponible.",
  metaProvider: 'Fournisseur',
  metaModel: 'Modèle',
  metaExecutionTime: "Temps d'exécution",
  metaCost: 'Coût',
  metaTtfb: 'TTFB',
  metaCached: 'En cache',
  download: 'Télécharger',
  unknown: 'inconnu',
  citationUnresolved: '[réf. {id}]',
  invalidComponent: '{type} invalide',
  toolErrorTitle: 'Erreur outil : {tool}',
  errorTypeLabel: 'Type : {type}',
  errorSuggestions: 'Suggestions :',
  chartInvalidData: 'Données de graphique invalides : data.datasets manquant',
  unsupportedComponentType: 'Type de composant non pris en charge :',
  previewPrev: 'Préc.',
  previewNext: 'Suiv.',
  previewPageIndicator: 'Page {page} / {total}',
  fieldResolving: 'Résolution...',
  formPrefilledOne: '{count} champ pré-rempli sur {total}',
  formPrefilledMany: '{count} champs pré-remplis sur {total}',
  formSubmitting: 'Envoi...',
  formReset: 'Réinitialiser',
  errorBoundaryTitle: "Le composant n'a pas pu être rendu",
  errorBoundaryMeta: 'Type : {type} | ID : {id}...',
  errorBoundaryRetry: 'Réessayer le rendu',
  scratchpadSearch: 'Rechercher',
  scratchpadNextStep: 'Suivant',
  scratchpadPlan: 'Plan :',
  scratchpadModify: 'Modifier',
  scratchpadDetails: 'Détails',
  scratchpadItems: 'éléments',
  videoUnsupported: 'Votre navigateur ne prend pas en charge la balise vidéo.',
  previewShowingRange: 'Affichage de {start}–{end} sur {total}',
  previewRowsOne: '{count} ligne',
  previewRowsMany: '{count} lignes',
  previewTotalSuffix: ' ({total} au total)',
  statusLoading: 'Chargement...',
  statusActionAvailable: 'Action disponible',
  statusYourTurn: 'À vous',
  statusProcessing: 'Traitement...',
  statusComplete: 'Terminé',
  agentStatusIdle: 'Inactif',
  agentStatusRunning: 'En cours',
  agentStatusWaiting: 'En attente',
  agentStatusDone: 'Terminé',
  agentStatusError: 'Erreur',
  handoffItems: '{count} éléments',
  degradedMoreRows: '+{count} lignes supplémentaires non affichées.',
  chartDegradedCaption:
    "Affichage des données du graphique sous forme de tableau — le graphique interactif n'est pas disponible.",
  chartRenderFailed: 'Échec du rendu du graphique : {error}',
  chartRenderError: 'Échec du rendu du graphique',
  chartQuickchartCaption: 'Affichage des données du graphique sous forme de tableau.',
  graphDegradedCaption:
    "Affichage des données du graphe sous forme de tableau — la vue interactive n'est pas disponible.",
  graphRenderFailed: 'Échec du rendu du graphe : {error}',
  graphRenderError: 'Échec du rendu du graphe',
  graphPngUnsupported: "Export PNG non pris en charge dans ce mode de rendu",
  graphPngExportFailed: 'Échec de l’export PNG',
  mapDegradedCaption:
    "Affichage des données de la carte sous forme de tableau de coordonnées — la carte interactive n'est pas disponible.",
  mapRenderFailed: 'Échec du rendu de la carte : {error}',
  mapRenderError: 'Échec du rendu de la carte',
  mapLibraryUnavailable: 'Impossible de charger la bibliothèque de cartographie.',
  degradedColType: 'Type',
  degradedColLat: 'Lat',
  degradedColLng: 'Long',
  degradedColInfo: 'Infos',
  degradedColSource: 'Source',
  degradedColTarget: 'Cible',
  degradedColNode: 'Nœud',
  degradedColLabel: 'Libellé',
  degradedSeries: 'Série {n}',
  chartTableSeries: 'Série',
  chartTablePoint: 'Point',
  autocompleteHintNavigate: ' pour naviguer, ',
  autocompleteHintSelect: ' pour sélectionner, ',
  autocompleteHintDismiss: ' pour fermer',
  autocompleteTabToAccept: 'Tab pour accepter',
  fieldAddMorePlaceholder: 'Ajouter...',
  galleryViewImage: "Voir l'image {index}",
  galleryImageAlt: 'Image {index}',
  imageAltFallback: 'image',
  chartVisualizationAlt: 'Visualisation du graphique',
  chartWithTitleAlt: 'Graphique : {title}',
  chartLoadFailed: 'Échec du chargement du graphique',
  paginationAllRows: 'Toutes',
  fieldRequired: '{field} est requis',
  fieldMustBeChecked: '{field} doit être coché',
  fieldMinLength: '{min} caractères minimum requis',
  fieldMaxLength: '{max} caractères maximum autorisés',
  fieldInvalidPattern: 'Format invalide',
  fieldInvalidEmail: 'Adresse e-mail invalide',
  fieldInvalidNumber: 'Doit être un nombre valide',
  fieldMinValue: 'La valeur minimale est {min}',
  fieldMaxValue: 'La valeur maximale est {max}',
  fieldMinDate: 'La date doit être postérieure au {min}',
  fieldMaxDate: 'La date doit être antérieure au {max}',
  fieldInvalidOption: 'Veuillez sélectionner une option valide',
  fieldInvalidFormat: 'Format invalide (attendu : {format})',
  locale: 'fr-FR',
  briefingAdded: '+{count} ajouté(s)',
  briefingRemoved: '{count} supprimé(s)',
  briefingChanged: '{count} modifié(s)',
  footerSources: '{count} sources',
  degradedMarker: 'repère',
  degradedFeature: 'entité',
  fieldUnknownType: 'Type de champ inconnu : {type}',
  fieldSelectedCount: '{count} sélectionné(s)',
  scratchpadErrorCode: 'Code : {code}',
  scratchpadResultCount: '{count} résultats',
  tableVirtualizedRows: '(virtualisé : {count} lignes)',
  tableSearchResultsOne: '{count} résultat sur {total}',
  tableSearchResultsMany: '{count} résultats sur {total}',
  tableServerPageRange: 'Lignes {start} à {end} sur {total}',
  errorCopyText: 'Erreur dans {tool} : {message}',
  errorUnknownTool: 'outil inconnu',
  streamInitializing: 'Initialisation...',
  streamConnecting: 'Connexion au serveur...',
  streamLoadingComponent: 'Chargement du composant {type}...',
  streamDashboardLoaded: 'Tableau de bord chargé',
  streamErrorProgress: 'Erreur : {message}',
  streamConnectionFailed: 'Échec de la connexion au flux',
  streamRequestFailed: 'Échec de la requête de flux',
  streamEmptyResponse: 'Réponse vide',
  streamServerSide: 'Le streaming ne peut pas démarrer côté serveur',
  streamUnknownError: 'Erreur inconnue',
  streamServerSideTitle: 'Streaming indisponible',
  graphUnavailable: 'Rendu du graphe indisponible',
  mapPmtilesUnavailable:
    "Couche PMTiles indisponible — la dépendance optionnelle « protomaps-leaflet » n'a pas pu être chargée ou rendue.",
  mapBaseMapStillShown: 'Le fond de carte reste affiché.',
  chartJsUnavailable: "Chart.js n'est pas disponible. Installez la dépendance chart.js.",
  chartIframeUnavailable:
    'Graphique interactif indisponible — installez la dépendance chart.js, ou activez allowQuickchartFallback pour utiliser le rendu externe quickchart.io.',
  previewInvalidContent: 'Format de contenu invalide',
  citationViewSource: 'Voir la source - {label}',
  sizeBytes: '{size} o',
  sizeKilobytes: '{size} Ko',
  sizeMegabytes: '{size} Mo',
}

<MCPUIStringsProvider strings={fr}><App /></MCPUIStringsProvider>
```

### Exclusion policy

A handful of strings stay hardcoded on purpose — P1–P8, with every concrete
occurrence, live in [`CHANGELOG.md`](./CHANGELOG.md)'s `## [6.20.0]` entry.
In short:

| # | What stays hardcoded | Why |
|---|---|---|
| P1 | Keyboard key caps inside `<kbd>` (`Enter`, `Esc`) | The physical key reads the same in any language |
| P2 | The OpenStreetMap / ODbL tile attribution | Exact wording required by the license; override via `params.attribution` |
| P3 | Developer diagnostics naming an npm/peer package or a config flag, bracketed `[Component] …` messages, debug-only panels, developer-misuse errors, and the structural `ValidationError.message` of `services/validation.ts` | Addressed to a developer or to the payload producer, not to the end user |
| P4 | Machine tokens: file-format acronyms, HTTP verbs, unit symbols, ISO currency codes, chart point property names (`x`/`y`/`r`) | Not prose — still overridable where a `labels` parameter exists |
| P5 | Pure module functions with a documented render override | No occurrence remains — the citation chip tooltip is now `citationViewSource` |
| P6 | `PresentationFeedback`'s labels | The component documents its own `labels` prop instead |
| P7 | Hook-level errors returned to the consumer, `onError` payloads, `console`/logger/telemetry strings | The library itself never renders these |
| P8 | `services/component-registry.ts` and `plugins/` system prompts | LLM-facing schema/example text — translating it would teach the model non-English payloads |

### Options — runtime-free adapters, services and hooks

These modules cannot rely on `MCPUIStringsProvider`: the adapters, services
and helpers are runtime-free (no `solid-js` import), and `useStreamingUI` is a
hook a host may call outside any provider. So each takes its own English wording as a trailing optional parameter with an
exported default table:

| Module | Function(s) | Option | Default table | Keys |
|---|---|---|---|---|
| `adapters/connector.ts` (`/adapters`) | `connectorResultToUILayout` | `options.messages?: Partial<ConnectorAdapterMessages>` | `DEFAULT_CONNECTOR_MESSAGES` | `degradedNotice`, `degradedVersionSuffix`, `versionWarning` |
| `adapters/macro-run.ts` (`/adapters`) | `macroRunToScratchpadState`, `macroInterrogationToChatPromptConfig` | `options.messages?: Partial<MacroRunAdapterMessages>` | `DEFAULT_MACRO_RUN_MESSAGES` | `agentSectionTitle`, `progressSectionTitle`, `resultSectionTitle`, `runAborted`, `runFailed`, `confirmDefault` |
| `services/validation.ts` (root, `/validation`) | `validateFieldValue`, `validateFormData` | `messages?: Partial<FormValidationMessages>` | `DEFAULT_VALIDATION_MESSAGES` | `required`, `mustBeChecked`, `minLength`, `maxLength`, `invalidPattern`, `invalidEmail`, `invalidNumber`, `minValue`, `maxValue`, `minDate`, `maxDate`, `invalidOption`, `invalidFormat` |
| `utils/degraded-projections.ts` (root) | `graphToDegradedTable`, `mapToDegradedTable`, `chartToDegradedTable` | `labels?: Partial<DegradedProjectionLabels>` | `DEGRADED_PROJECTION_LABELS` | `source`, `target`, `label`, `node`, `type`, `lat`, `lng`, `info`, `marker`, `feature`, `series` |
| `components/chart-data-table.ts` (root) | `chartToDataTable` | `labels?: Partial<ChartDataTableLabels>` | `CHART_DATA_TABLE_LABELS` | `series`, `point`, `label`, `seriesName`, `x`, `y`, `r` |
| `hooks/useStreamingUI.ts` (root, `/hooks`) | `useStreamingUI` | `options.messages?: Partial<StreamingUIMessages>` | `DEFAULT_STREAMING_UI_MESSAGES` | `initializing`, `connecting`, `loadingComponent`, `dashboardLoaded`, `errorProgress`, `connectionFailed`, `requestFailed`, `emptyResponse`, `serverSide`, `unknownError` |

Every option is a trailing OPTIONAL parameter, so existing calls keep
type-checking and behaving identically. `StreamingUIRenderer` and
`FormRenderer` feed their module's table from `useMCPUIStrings()`
automatically — a host only calls these functions with an explicit
`messages`/`labels` override when it uses the adapter or helper directly,
outside a component that already wires it up.

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
  MCPUIConfigProvider, useMCPUIConfig, DEFAULT_MCPUI_CONFIG, // v6.21.0 host policy
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
  getIframeSandbox, isTrustedIframeDomain, // v6.21.0 — trusted-host test
  DEFAULT_RESOURCE_LIMITS,
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
  MCPUIStrings, MCPUIConfig, // v6.21.0
  TelemetryEvent, TelemetrySink, TelemetryOptions, TelemetryDispatcher,
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
