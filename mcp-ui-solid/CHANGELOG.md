# @seed-ship/mcp-ui-solid Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.22.1] - 2026-09-18

Fixes a typing regression 6.22.0 introduced. Runtime behaviour is identical.

### The mistake

6.22.0 made every `MCPUIConfig` field optional so that adding a policy key
would stop breaking consumers who *author* a complete config. That fixed one
direction and broke the other: `MCPUIConfig` is a published type, so anyone who
*reads* one — `const policy: IframePolicy = config.iframePolicy` — suddenly
faced `… | undefined` and stopped compiling under `strictNullChecks`. Trading
one compile break for the opposite one is not a fix.

The two demands genuinely conflict, and one name cannot serve both: an author
must be allowed to omit a key, a reader must never meet `undefined`.

### The fix — two names

- **`MCPUIConfigInput`** (new, exported): what a host writes. Every field
  optional, so a new policy key is always additive. This is what
  `MCPUIConfigProvider`'s `config` prop takes, and what
  `MCPUIConfigContext.Provider` accepts.
- **`MCPUIConfig`**: what the library hands back — `Required<MCPUIConfigInput>`,
  every key present, which is the 6.21.0 meaning restored. `useMCPUIConfig()`,
  `DEFAULT_MCPUI_CONFIG` and `MCPUIConfigContext` carry it.

`MCPUIConfigContext` keeps the resolved type on purpose: it is exported, so
`useContext(MCPUIConfigContext)` is a public read surface and typing it with the
input view would leave a direct reader on `IframePolicy | undefined` — the very
regression being undone. A host that bypasses `MCPUIConfigProvider` therefore
passes a complete value, `{ ...DEFAULT_MCPUI_CONFIG, ...mine }`; passing only
some keys is what the provider's `config` prop is for. `useMCPUIConfig()` still
merges at runtime, so an untyped host cannot break a renderer.

Derived rather than declared twice, so a key is written once and the two views
cannot drift. The guard test now pins **both** halves: every `MCPUIConfigInput`
field stays optional, and `MCPUIConfig` stays the `Required<…>` alias. Both were
verified to fail when the corresponding regression is reintroduced.

### How this got through

`pnpm typecheck` excludes `**/*.test.ts(x)`, so a type-level claim written in a
test file failed nothing — 6.22.0 shipped both a broken `MCPUIConfig` and a
fixture annotated with the wrong type, and neither `typecheck` nor `test` said a
word. `tsconfig.contracts.json` now type-checks the handful of test files whose
`satisfies` and annotations *are* the test, and `typecheck` runs it. Including
every test file instead would surface 53 unrelated errors, so that stays a
separate piece of work.

**Nothing to change in consuming code** unless you annotate a config you build:
switch those to `MCPUIConfigInput`. Reading is exactly as it was in 6.21.0.

## [6.22.0] - 2026-09-18

Wheel zoom and drag pan on the surfaces that could not be read when the content
was dense: the image lightbox, and Chart.js charts in their expanded view.

### The rule this follows

**Wheel zoom is only ever enabled on a surface that owns its viewport** — a
fullscreen overlay or the expanded modal. A component sitting inline in a
scrolling page must not swallow the wheel, or a user scrolling the page finds
themselves zooming a chart instead. That is why chart zoom defaults to the
expanded view only, and why inline zoom is opt-in.

### Added

- **`createPanZoom(options)`** (`src/utils/pan-zoom.ts`, exported from the root
  and from the `./hooks` subpath) — a dependency-free cursor-anchored zoom and
  drag-pan primitive: the point under the pointer stays under the pointer.
  Handles two-finger pinch, clamps to `min`/`max`, and exposes
  `cancelGesture()` for the case where the surface carrying the handlers is
  torn down while a pointer is still down. The pure helpers behind it
  (`clampScale`, `contentPointAt`, `viewportPointOf`, `zoomAtAnchor`) are
  exported too.
- **`LightboxOverlay` zooms.** Wheel, drag to pan, double-click to toggle,
  pinch on touch, and the keyboard shortcuts `+` / `-` / `0` alongside the
  existing Escape and arrows. Zoom controls carry a level readout, and the zoom
  resets when the displayed image changes.
- **Chart.js zoom and pan**, through `chartjs-plugin-zoom` as a new **optional**
  peer dependency. Absent, charts render exactly as before — no warning, no
  broken UI. A reset button appears in the toolbar only while the chart is
  actually zoomed. A chart's own `options.plugins.zoom` is preserved: the
  renderer's block is deep-merged into it, the caller's explicit values win
  (`limits`, wheel `speed`, a pan `modifierKey`, `mode`), and a caller's
  `onZoom` / `onPan` is *composed* with the renderer's rather than replacing
  it, so the reset control stays in sync with the viewport either way. A key
  the caller left `undefined` is read as an omission, not as an erasure. And
  `options.plugins.zoom: false` — Chart.js's documented per-chart plugin
  opt-out — beats `chartZoom`: the plugin is never downloaded and the toolbar
  offers no controls.
- **`MCPUIConfig.chartZoom`**: `'expanded'` (default), `'always'` or `'never'`.
- Four string keys: `zoomIn`, `zoomOut`, `zoomReset`, `zoomLevel`
  (`'Zoom {percent}%'`). Chrome key count 271 → 275.

### Changed

- **Every `MCPUIConfig` field is now optional**, as `MCPUIStrings` has always
  been. `MCPUIConfig` grows a key in a minor release each time the library
  gains a policy switch — `iframeFallbackLink` in 6.21.0, `chartZoom` here —
  and while the fields were required, each addition broke the build of anyone
  holding a *complete* config: a typed constant, a helper returning one, or a
  direct `<MCPUIConfigContext.Provider value={…}>`. Nothing about their
  behaviour had changed; only `tsc` failed. Adding a key is additive now.

  The completeness guarantee moved onto the values: `DEFAULT_MCPUI_CONFIG` is
  typed `Required<MCPUIConfig>` (a new key without a default is a compile error
  in the library), and `useMCPUIConfig()` returns `Required<MCPUIConfig>`, so
  every renderer still reads a fully resolved policy and never null-checks one.
  `MCPUIConfigContext` itself stays typed `MCPUIConfig`, which makes providing
  it directly *more* permissive than before. Backward compatible in both
  directions: a consumer already passing a field still type-checks.

### Fixed

- **`ExpandableWrapper` no longer closes on a drag released over its backdrop.**
  When a press and its release have different targets the browser dispatches
  `click` on their nearest common ancestor — the backdrop — so panning a zoomed
  chart, or selecting text in an expanded table, and releasing over the 16px
  margin around the panel tore the modal down mid-gesture. The close now
  requires the gesture to have *begun* on the backdrop. This was reachable
  before this release for any drag inside an expanded view; chart panning just
  made it easy to hit.

### Not affected

Maps and graphs already zoomed: `MapRenderer` enables Leaflet's
`scrollWheelZoom` and `GraphRenderer` registers G6's `zoom-canvas` /
`drag-canvas`. Iframes (including a diagram served from `mermaid.ink`) are
cross-origin documents and cannot be transformed by the host at all.

## [6.21.0] - 2026-09-17

The library's iframes now work on a host that serves
`Cross-Origin-Embedder-Policy: credentialless`.

### The problem

Under that header a browser refuses **any** cross-origin iframe whose own
document does not itself send a COEP header. That is YouTube, Vimeo, Google
Docs, Notion — nearly every entry of `DEFAULT_IFRAME_DOMAINS`. The frame stays
blank and nothing in the page can detect it: a refused cross-origin document
fires no `error` event the parent can observe. The `credentialless` *header*
only relaxes the rule for sub-resources (images, fonts, map tiles — which is
why the quickchart `<img>` fallback and the Leaflet tiles were never
affected); nested documents need the boolean HTML attribute
`<iframe credentialless>` on the tag itself.

### What the library now does

Both iframes it renders — `IframeRenderer` (the `iframe` component) and
`VideoRenderer`'s YouTube / Vimeo embed — can carry `credentialless` when their
host is **not** in `TRUSTED_IFRAME_DOMAINS`.

- **The `iframe` component on an untrusted host gets it by default.** Those
  frames already ran without cookies, since their sandbox has no
  `allow-same-origin`. The attribute costs them nothing and is exactly what
  unblocks them under COEP.
- **The video embed does NOT get it by default.** It carries no sandbox, so a
  YouTube or Vimeo frame really does hold provider cookies (consent, playback
  state, sign-in). Taking them away on every host — including the majority
  that send no COEP header — would be a silent regression, so `'auto'` leaves
  it alone and a COEP host opts in with `iframeCredentialless: 'always'`.
- **Trusted hosts deliberately do NOT get it.** `TRUSTED_IFRAME_DOMAINS`
  (Google Docs/Drive, Notion, Airtable, Figma, Linear, Stripe, Polar, HubSpot,
  Calendly, …) exists precisely because those embeds need their own cookies to
  authenticate. Loaded `credentialless` they would render a login screen — a
  visibly broken embed. Under COEP they stay blocked, which is the honest
  outcome; `iframeCredentialless: 'always'` overrides it if you disagree.

The attribute is a **boolean** attribute: it is absent from the DOM when it
does not apply, never `credentialless="false"`.

### Added

- **`<MCPUIConfigProvider>` / `useMCPUIConfig()` / `DEFAULT_MCPUI_CONFIG` /
  `MCPUIConfig`** (new `src/context/MCPUIConfigContext.tsx`, exported from the
  root barrel) — host-level rendering policy, the behavioural counterpart of
  `MCPUIStrings`. Three options:

  | option | default | meaning |
  | --- | --- | --- |
  | `iframeCredentialless` | `'auto'` | `'auto'`: attribute on the `iframe` component when its host is not trusted (those frames already run without cookies); the video embed, which has no sandbox, is left alone. `'always'`: every iframe, video and trusted hosts included. `'never'`: none. |
  | `customTrustedIframeDomains` | `[]` | extra hosts treated as trusted — no `credentialless`, and `allow-same-origin` in the sandbox. Subdomains match. Reclassification only: the allow-list must already accept the host. |
  | `iframePolicy` | `'strict'` | how an `iframe` component's host is validated; `'extend'` also accepts `customIframeDomains`. |
  | `customIframeDomains` | `[]` | extra hosts the allow-list accepts under `iframePolicy: 'extend'`. Without this, an unlisted host never reaches a renderer. |
  | `iframeFallbackLink` | `'auto'` | when the "open in a new tab" link shows under an embed. `'auto'`: only on a cross-origin-isolated page. |

  ```tsx
  import { MCPUIConfigProvider } from '@seed-ship/mcp-ui-solid'

  // A host that serves COEP: credentialless and embeds its own tool.
  <MCPUIConfigProvider
    config={{
      iframeCredentialless: 'always',
      iframePolicy: 'extend',
      customIframeDomains: ['embed.acme.com'],
      customTrustedIframeDomains: ['embed.acme.com'],
      iframeFallbackLink: 'auto',
    }}
  >
    <App />
  </MCPUIConfigProvider>

  // A host with no COEP header that does not want its embeds to lose cookies.
  <MCPUIConfigProvider config={{ iframeCredentialless: 'never' }}>
    <App />
  </MCPUIConfigProvider>
  ```

  With no provider mounted, `DEFAULT_MCPUI_CONFIG` applies — every renderer
  still works standalone.

- **`isTrustedIframeDomain(url, { customTrustedDomains? })`** — the trusted-host
  test `getIframeSandbox` already performed, extracted and exported from the
  root barrel and from the `@seed-ship/mcp-ui-solid/validation` subpath
  (`getIframeSandbox` is now exported from that subpath too). Invalid URL →
  `false`, so an unparsable URL is never trusted and does receive the
  attribute. Matching is unchanged: exact host, or a subdomain of a listed
  host.

- **`MCPUIStrings.iframeOpenInNewTab`** — optional, default
  `'Open in a new tab'`. Label of the link rendered under an embed, which is
  the only way out of a silently blocked frame. Visibility follows
  `iframeFallbackLink`; `window.crossOriginIsolated` is read **after mount**,
  never during render, so SSR markup and hydration agree. That flag requires
  COOP `same-origin` on top of COEP — a host that sends COEP alone should set
  `iframeFallbackLink: 'always'`, since its embeds are blocked while the flag
  reads false. The link is skipped
  when `safeUrl()` rejects the URL. `MCPUIStrings` now covers **271 keys**.

### Fixed

- `IframeRenderer` called `getIframeSandbox(params.url)` with no options, so a
  host's custom trusted domains never reached the sandbox. It now passes
  `{ customTrustedDomains: config.customTrustedIframeDomains }`, which is what
  makes `customTrustedIframeDomains` grant `allow-same-origin` as documented.

### Browser support

| | header `COEP: credentialless` | attribute `<iframe credentialless>` |
| --- | --- | --- |
| Chrome / Edge | 96+ | **110+** |
| Firefox | 119+ | **not supported** |
| Safari | not supported (value ignored) | not supported |

- **Chrome / Edge** — the attribute fixes the problem. This is the majority
  case.
- **Firefox** — honours the header but ignores the attribute, so third-party
  iframes stay blocked for as long as the host page sends COEP. Nothing in
  this library can change that; it is a host-side trade-off (drop COEP, or
  accept the degradation on Firefox). The fallback link is what the user gets
  there.
- **Safari** — does not know the `credentialless` value and treats the header
  as absent: no cross-origin isolation, but embeds work.

### Note for hosts

The library's allow-list is not a substitute for your CSP. The browser also
enforces `frame-src`, which the host sets — a domain missing from it stays
blocked whatever this library emits (see the comment at
`services/validation.ts` on `DEFAULT_IFRAME_DOMAINS`: "Must match CSP
frame-src directive").

### Tests

`src/components/IframeCredentialless.test.tsx` (25 tests) — the
`isTrustedIframeDomain` matching table, attribute presence/absence through
`<UIResourceRenderer>` and `<VideoRenderer>` for each `iframeCredentialless`
mode, the `customTrustedIframeDomains` → sandbox plumbing, the fallback link
under each `iframeFallbackLink` mode with `window.crossOriginIsolated`
stubbed, and the SSR-shape assertions on the pure decision helpers. Plus a new
`iframeOpenInNewTab` case in `MCPUIStringsContext.sweep.test.tsx` and the
default pinned in `mcpui-strings-defaults.test.ts`.

## [6.20.0] - 2026-09-17

Every user-visible chrome string the library itself renders — button titles,
`aria-label`s, placeholders, empty states, degraded-fallback captions, form
validation messages, and more — is now localizable: through `MCPUIStrings`
for components (`useMCPUIStrings()`), or through an exported `messages` /
`labels` option with an English default table for the runtime-free adapters,
services, helpers and hooks that cannot read Solid context. `MCPUIStrings`
now covers **270 keys** (9 required, carried over from the original v6.6.0
surface, plus 261 optional — every key added since defaults to English and
falls back cleanly when omitted). The only strings still hardcoded fall under
the explicit exclusion policy below (P1–P8). Both are enforced by an
AST-based guard test over all of `src` and a runtime pseudo-localization
render test — see **Tests**.

### Added

- **251 new optional `MCPUIStrings` keys** (the released 6.19.1 had 19),
  bringing the total to 270. Each defaults to the exact English literal it
  replaced, except the defaults listed under **Changed**. The complete list,
  with defaults and where each key is used, is the key reference table in
  the README (*Internationalization (i18n) — `MCPUIStrings`*). Selected
  groups:

  - **Generic chrome** — `download`: `"Download"` (`ArtifactRenderer`
    download link), `unknown`: `"unknown"` (`GenerativeUIErrorBoundary`
    metadata fallback)
  - **`UIResourceRenderer` table citations** — `citationUnresolved`:
    `"[ref. {id}]"` (template `{id}`; placeholder for a citation marker no
    `citationMap` resolves, empty map only — see **Changed**)
  - **`UIResourceRenderer` error / fallback chrome** — `invalidComponent`:
    `"Invalid {type}"`, `toolErrorTitle`: `"Tool Error: {tool}"`,
    `errorTypeLabel`: `"Type: {type}"`, `errorSuggestions`: `"Suggestions:"`,
    `chartInvalidData`: `"Invalid chart data: missing data.datasets"`,
    `unsupportedComponentType`: `"Unsupported component type:"`
  - **`UIResourceRenderer` table (search, pagination, tool-error clipboard)**
    — `tableVirtualizedRows`: `"(virtualized: {count} rows)"`,
    `tableSearchResultsOne` / `tableSearchResultsMany`:
    `"{count} result(s) on {total}"` (was one template with a hardcoded
    `s`), `tableServerPageRange`: `"Showing {start} - {end} of {total}"`,
    `errorCopyText`: `"Error in {tool}: {message}"` (text the tool-error
    card's Copy button puts on the clipboard), `errorUnknownTool`:
    `"unknown tool"` (tool name inside `errorCopyText` when the error has
    none)
  - **`DataPreviewSection`** — `previewPrev`: `"Prev"`, `previewNext`:
    `"Next"`, `previewPageIndicator`: `"Page {page} / {total}"`,
    `previewShowingRange`: `"Showing {start}–{end} of {total}"`,
    `previewRowsOne`: `"{count} row"`, `previewRowsMany`: `"{count} rows"`,
    `previewTotalSuffix`: `" ({total} total)"`
  - **`FormFieldRenderer`** — `fieldResolving`: `"Resolving..."`,
    `fieldAddMorePlaceholder`: `"Add more..."`, `fieldUnknownType`:
    `"Unknown field type: {type}"`, `fieldSelectedCount`: `"{count}
    selected"`
  - **`FormRenderer`** — `formPrefilledOne`: `"{count} field pre-filled out
    of {total}"`, `formPrefilledMany`: `"{count} fields pre-filled out of
    {total}"` (shared with `ScratchpadPanel`'s prefill summary — see
    **Changed**), `formSubmitting`: `"Submitting..."`, `formReset`:
    `"Reset"`
  - **`GenerativeUIErrorBoundary`** — `errorBoundaryTitle`: `"Component
    Failed to Render"`, `errorBoundaryMeta`: `"Type: {type} | ID:
    {id}..."` (both fall back to `unknown`), `errorBoundaryRetry`: `"Retry
    Rendering"`
  - **`ScratchpadPanel`** — `scratchpadSearch`: `"Search"`
    (`waiting_human` search button), `scratchpadNextStep`: `"Next"`
    (steps view advance button), `scratchpadPlan`: `"Plan:"`,
    `scratchpadModify`: `"Modify"` (prompt-section edit button),
    `scratchpadDetails`: `"Details"` (error-section toggle),
    `scratchpadItems`: `"items"` (action-section item-count suffix),
    `statusLoading` / `statusActionAvailable` / `statusYourTurn` /
    `statusProcessing` / `statusComplete` — status badge, one key per
    state (the `error` state reuses `scratchpadError`),
    `scratchpadErrorCode`: `"Code: {code}"`, `scratchpadResultCount`:
    `"{count} results"` (data-source card row count)
  - **`VideoRenderer`** — `videoUnsupported`: `"Your browser does not
    support the video tag."` (`<video>` fallback text)
  - **`AgentCard` / `AgentStatusBadge`** — `agentStatusIdle`: `"Idle"`,
    `agentStatusRunning`: `"Running"`, `agentStatusWaiting`: `"Waiting"`,
    `agentStatusDone`: `"Done"`, `agentStatusError`: `"Error"`
  - **`AgentHandoff`** — `handoffItems`: `"{count} items"` (fallback;
    `content.summary` still wins)
  - **Fallback ladder** (`DegradedFallback`, `ChartJSRenderer`,
    `GraphRenderer`, `MapRenderer`) — `degradedMoreRows`: `"+{count} more
    rows not shown."`, `chartDegradedCaption`, `chartRenderFailed`:
    `"Chart rendering failed: {error}"`, `chartRenderError`,
    `chartQuickchartCaption`, `graphDegradedCaption`, `graphRenderFailed`,
    `graphRenderError`, `graphPngUnsupported`, `graphPngExportFailed`,
    `mapLibraryUnavailable`, `mapDegradedCaption`, `mapRenderFailed`,
    `mapRenderError`
  - **Degraded / accessible table headers** — `degradedColType`,
    `degradedColLat`, `degradedColLng`, `degradedColInfo`,
    `degradedColSource`, `degradedColTarget`, `degradedColNode`,
    `degradedColLabel`, `degradedSeries`: `"Series {n}"`, `chartTableSeries`,
    `chartTablePoint`, plus `degradedMarker`: `"marker"` and
    `degradedFeature`: `"feature"` — the degraded map table's `Type` cell
    for a marker row / a GeoJSON feature without a geometry type (mirrored
    in `DEGRADED_PROJECTION_LABELS`, see below)
  - **`AutocompleteDropdown` / `AutocompleteFormField`** —
    `autocompleteHintNavigate`: `" to navigate, "`, `autocompleteHintSelect`:
    `" to select, "`, `autocompleteHintDismiss`: `" to dismiss"`,
    `autocompleteTabToAccept`: `"Tab to accept"` (the `<kbd>` key caps
    themselves stay hardcoded — P1)
  - **Images and chart fallbacks** — `galleryViewImage`: `"View image
    {index}"`, `galleryImageAlt`: `"Image {index}"` (a payload `image.alt`
    still wins for both), `imageAltFallback`: `"image"`,
    `chartVisualizationAlt`: `"Chart visualization"`, `chartWithTitleAlt`:
    `"Chart: {title}"`, `chartLoadFailed`: `"Failed to load chart"`
  - **Table pagination** — `paginationAllRows`: `"All"`
  - **Form validation** — `fieldRequired`, `fieldMustBeChecked`,
    `fieldMinLength`, `fieldMaxLength`, `fieldInvalidPattern`,
    `fieldInvalidEmail`, `fieldInvalidNumber`, `fieldMinValue`,
    `fieldMaxValue`, `fieldMinDate`, `fieldMaxDate`, `fieldInvalidOption`,
    `fieldInvalidFormat`: `"Invalid format (expected: {format})"`
    (`field.valueFormatHint` wins when set) — `FormRenderer` feeds these
    into `validateFieldValue` / `validateFormData` from `useMCPUIStrings()`
  - **`BriefingDiff`** — `briefingAdded`: `"+{count} added"`,
    `briefingRemoved`: `"{count} removed"`, `briefingChanged`: `"{count}
    changed"`
  - **`FooterRenderer`** — `footerSources`: `"{count} sources"`
  - **`StreamingUIRenderer` / `useStreamingUI`** — `streamInitializing`:
    `"Initializing..."`, `streamConnecting`: `"Connecting to server..."`,
    `streamLoadingComponent`: `"Loading {type} component..."`,
    `streamDashboardLoaded`: `"Dashboard loaded"`, `streamErrorProgress`:
    `"Error: {message}"`, `streamConnectionFailed`: `"Stream connection
    failed"`, `streamRequestFailed`: `"Stream request failed"`,
    `streamEmptyResponse`: `"Response body is null"`, `streamServerSide`:
    `"Streaming UI cannot start on server-side"`, `streamUnknownError`:
    `"Unknown error"`
  - **`locale`**: `"en-US"` — see **Changed**
  - **Unavailable and degraded states shown to end users** —
    `streamServerSideTitle`: `"Streaming unavailable"` (see **Changed**),
    `graphUnavailable`: `"Graph rendering unavailable"`,
    `mapPmtilesUnavailable`: `"PMTiles layer unavailable — the optional
    \"protomaps-leaflet\" peer dependency failed to load or render."`,
    `mapBaseMapStillShown`: `"The base map is still shown."`,
    `chartJsUnavailable`: `"Chart.js is not available. Install chart.js peer
    dependency."`, `chartIframeUnavailable`: `"Interactive chart unavailable
    — install the chart.js peer dependency, or set allowQuickchartFallback to
    use the external quickchart.io renderer."`, `previewInvalidContent`:
    `"[DataPreviewSection] Invalid content format"`. Their text names a peer
    or a config flag, but end users see them, so a host can translate them.
  - **Citation chip tooltip** — `citationViewSource`: `"View source -
    {label}"` (template `{label}`: file name and page)
  - **`ArtifactRenderer` file sizes** — `sizeBytes`: `"{size} B"`,
    `sizeKilobytes`: `"{size} KB"`, `sizeMegabytes`: `"{size} MB"` (the number
    is formatted with `locale`)

- **`useStreamingUI({ messages })`** — new optional `messages?:
  Partial<StreamingUIMessages>` on `UseStreamingUIOptions`, with exported
  `DEFAULT_STREAMING_UI_MESSAGES` and `StreamingUIMessages` (root barrel and
  `/hooks`). Covers `initializing`, `connecting`, `loadingComponent`,
  `dashboardLoaded`, `errorProgress`, `connectionFailed`, `requestFailed`,
  `emptyResponse`, `serverSide`, `unknownError`. `StreamingUIRenderer` feeds
  it from the `stream*` `MCPUIStrings` keys through getters (a `messages`
  prop passed directly to the renderer still wins over the context). Every
  other hook in the library (`useAction`, `useAutocomplete`, `useModal`, …)
  is unchanged.

- **`CitationCtx.unresolvedLabel?: string`** — new optional field on the
  exported `CitationCtx` interface (`UIResourceRenderer.tsx`). It supplies
  the placeholder `transformCellCitations` keeps in a table cell for a
  citation marker that no `citationMap` resolves (empty map only). Optional,
  so every existing `renderCellValue(value, citationCtx?)` call site keeps
  type-checking; the placeholder now defaults to English (`citationUnresolved`)
  instead of hardcoded French. A second optional field,
  **`CitationCtx.viewSourceLabel?: string`**, carries the default citation
  chip's tooltip template (`citationViewSource`); the table renderer fills
  both from `useMCPUIStrings()`.

- **New export `formatMCPUIString(template, vars)`** (root barrel) —
  replaces `{name}` placeholders in a template with `vars[name]`; an
  unrecognized `{placeholder}` is left verbatim rather than throwing or
  rendering `undefined`. It lives in the dependency-free
  `src/utils/format-string.ts` (no imports), so the runtime-free adapters
  use it too, and `MCPUIStringsContext.tsx` re-exports it.

- **New `messages` / `labels` options on the runtime-free adapters,
  services and helpers** — these modules cannot read
  `MCPUIStringsProvider` (no `solid-js` import), so their English ships as
  a TRAILING OPTIONAL parameter with an exported default table; every
  existing call site keeps type-checking and behaving identically:

  - **`connectorResultToUILayout(result, options?)`**
    (`src/adapters/connector.ts`) — `options.messages?:
    Partial<ConnectorAdapterMessages>`. Covers the connector adapter's two
    degraded-state paragraphs: `degradedNotice` (unreadable payload,
    template `{versionSuffix}`), `degradedVersionSuffix` (template
    `{version}`), `versionWarning` (unrecognized schema version, template
    `{version}`, `{expected}`). New exports `ConnectorAdapterMessages` and
    `DEFAULT_CONNECTOR_MESSAGES` from `@seed-ship/mcp-ui-solid/adapters`
    (not the root barrel — no other connector-adapter export is there
    either):

    ```ts
    import { connectorResultToUILayout } from '@seed-ship/mcp-ui-solid/adapters'

    connectorResultToUILayout(result, {
      messages: {
        versionWarning: '> ⚠ Schéma connecteur non reconnu (`{version}`, attendu `{expected}`).',
      },
    })
    ```

  - **`macroRunToScratchpadState(run, options?)` /
    `macroInterrogationToChatPromptConfig(q, options?)`**
    (`src/adapters/macro-run.ts`) — `options.messages?:
    Partial<MacroRunAdapterMessages>`. The real fields are
    `agentSectionTitle` (`"Agent"`), `progressSectionTitle` (`"Progress"`),
    `resultSectionTitle` (`"Result"`), `runAborted` (`"Macro run
    aborted."`), `runFailed` (`"Macro run failed."`), `confirmDefault`
    (`"Please confirm to continue."`). New exports
    `MacroRunAdapterMessages`, `MacroRunAdapterOptions` and
    `DEFAULT_MACRO_RUN_MESSAGES` from `@seed-ship/mcp-ui-solid/adapters`:

    ```ts
    macroRunToScratchpadState(run, { messages: { resultSectionTitle: 'Résultat' } })
    ```

  - **`validateFieldValue(value, field, messages?)` /
    `validateFormData(data, fields, messages?)`** (`src/services/validation.ts`)
    — `messages?: Partial<FormValidationMessages>` (13 fields: `required`,
    `mustBeChecked`, `minLength`, `maxLength`, `invalidPattern`,
    `invalidEmail`, `invalidNumber`, `minValue`, `maxValue`, `minDate`,
    `maxDate`, `invalidOption`, `invalidFormat`). New exports
    `validateFieldValue`, `validateFormData`, `FormValidationMessages` and
    `DEFAULT_VALIDATION_MESSAGES` from the root barrel and
    `@seed-ship/mcp-ui-solid/validation` (the two validators were not
    exported from any entry point before). `FormRenderer` feeds
    this from `useMCPUIStrings()` (the `field*` keys above) — a host does
    not normally call `validateFieldValue` directly for that path. The
    STRUCTURAL validators (`validateComponent`, `validateLayout`, …) keep
    their English `ValidationError.message` — see the exclusion policy
    below.

  - **`graphToDegradedTable` / `mapToDegradedTable` /
    `chartToDegradedTable`** (`src/utils/degraded-projections.ts`) —
    `labels?: Partial<DegradedProjectionLabels>` (`source`, `target`,
    `label`, `node`, `type`, `lat`, `lng`, `info`, `marker`, `feature`,
    `series`). **`chartToDataTable(params, labels?)`**
    (`src/components/chart-data-table.ts`) — `labels?:
    Partial<ChartDataTableLabels>` (`series`, `point`, `label`,
    `seriesName`, `x`, `y`, `r` — the last three are the Chart.js point
    property names the cells mirror, still overridable). New root-barrel
    exports `graphToDegradedTable`, `mapToDegradedTable`,
    `chartToDegradedTable`, `chartToDataTable` (not exported from any entry
    point before), `DegradedProjectionLabels`, `DEGRADED_PROJECTION_LABELS`,
    `ChartDataTableLabels`, `CHART_DATA_TABLE_LABELS`. The renderers pass
    the `degradedCol*` / `chartTable*` keys from `useMCPUIStrings()`.

    ```ts
    graphToDegradedTable(graph, { source: 'Origine', target: 'Destination' })
    ```

- **The chrome-strings guard is now a TypeScript-AST scanner over all of
  `src`.** `scripts/chrome-scan.ts` (outside `src`, not published; `node
  scripts/chrome-scan.ts [root] [--json] [--raw]`) parses every non-test
  source and flags: JSX text; literals reaching a visible attribute, a JSX
  child or the clipboard through `||` / `??`, each ternary branch, template
  spans, `formatMCPUIString`, helper returns, `const` variables and signal
  setters; prose in object properties, `*Label`-style helper returns and
  arrays; French text (accented characters or stopwords); and hardcoded
  BCP-47 locale tags or argument-less `toLocaleString()` calls in
  components. `console.*` / logger / telemetry calls, `onError` payloads and
  thrown errors are skipped by AST context (see **P7** below) — the scanner
  never has to allow-list them individually. The repository's exclusions
  (`ALLOW_LIST`, `SANCTIONED_TABLES`, `SCOPED_EXCLUSIONS`) live in
  `scripts/chrome-scan.policy.ts` and are enforced by
  `mcpui-strings-guard.test.ts` — see **Tests**.

- **Runtime pseudo-localization test**, `MCPUIStrings.pseudolocale.test.tsx`
  — see **Tests**.

### Changed

- **New `locale` key (default `'en-US'`) drives every number, date and
  collation call the library makes on its own behalf.** `strings.locale` now
  feeds:
  - `UIResourceRenderer` — table sort (`localeCompare`, was hardcoded
    `'fr'`) and the client-side pagination range total (`toLocaleString`,
    was hardcoded `'fr-FR'`), and the tool-error card timestamp
    (`toLocaleString`, was called with no argument at all — the runtime's
    implicit locale, which can differ between SSR and hydration);
  - `DataPreviewSection` — number / currency / date cell formatting and
    sort comparison (were `'fr-FR'` / `'fr'`; the `" EUR"` currency suffix
    itself stays — P4), the page-info row counts (were `'fr-FR'`), and
    percent cells (were `toFixed(1)` + `"%"`, now `Intl.NumberFormat` with
    `style: 'percent'` — identical output in `en-US`);
  - `StreamingUIRenderer` — the metadata panel cost (was `"$"` +
    `toFixed(4)`, now `Intl.NumberFormat` currency USD with a narrow symbol
    — identical output in `en-US`);
  - `ArtifactRenderer` — the file-size number (was `toFixed(1)`);
  - `ScratchpadPanel` — the filter-preview row count and the data-source
    card's `row_count` (were argument-less);
  - `MapRenderer` — `buildPopupContent(feature, popup, allowHtml?, locale?)`
    and `addGeoJSONLayer(..., allowHtml?, locale?)` gain a new trailing
    optional `locale` parameter for the numbers in auto-generated popups
    (was hardcoded `'fr-FR'`).

  Restore the previous French formatting with
  `<MCPUIStringsProvider strings={{ locale: 'fr-FR' }}>`.

  `useMCPUIStrings()` always returns a valid tag: an empty or invalid
  `locale` (for example `'not_a_locale'`, which makes `Intl` throw a
  `RangeError`) resolves to `'en-US'`, and a valid one is canonicalized
  (`'fr-fr'` → `'fr-FR'`). The same check is exported as
  `resolveMCPUILocale(locale)`. A locale change re-renders the counts and
  citation wording that depend on it; GeoJSON map popups read it when they
  open, so the map is not rebuilt.

  Time zones are a separate concern from the locale. Date-only
  `DataPreviewSection` cells (`2026-09-17`) are now formatted in UTC, so the
  server and every viewer show the same calendar date. Date-time cells and the
  tool-error card timestamp are formatted only after mount, in the viewer's
  time zone, because the server cannot know it: server markup shows the raw
  date-time value, then the formatted date replaces it.

- **Five more chrome defaults move from French to English**, matching
  every other key (a published library ships no hardcoded non-English
  chrome):
  - `tableSearchPlaceholder`: `"Rechercher dans le tableau..."` → `"Search
    the table..."` (`UIResourceRenderer` table search input; a connector's
    own `tableParams.searchPlaceholder` still wins when set);
  - `verifiedStripLabel`: `"[non vérifié]"` → `"[unverified]"`
    (`VerifiedText` `mode="strip"`);
  - `scratchpadEdit`: `"Modifier"` → `"Edit"` (`ScratchpadPanel`'s
    collapsed auto-submit form edit button);
  - `citationUnresolved`: `"[réf. {id}]"` → `"[ref. {id}]"`, now backed by
    the new `CitationCtx.unresolvedLabel`;
  - `formPrefilledOne` / `formPrefilledMany`: `"{count} champ(s)
    pré-rempli(s) sur {total}"` → `"{count} field(s) pre-filled out of
    {total}"` (`FormRenderer` and `ScratchpadPanel`'s prefill summary).

  Restore the previous French text for these five, and the connector
  adapter's degraded-state text (also changed from French to English —
  `DEFAULT_CONNECTOR_MESSAGES`, below), with:

  ```tsx
  <MCPUIStringsProvider
    strings={{
      locale: 'fr-FR',
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

  ```ts
  connectorResultToUILayout(result, {
    messages: {
      degradedNotice:
        '### Résultat non rendu\n\nLe résultat du connecteur n\'a pas pu être interprété{versionSuffix}. Cet état explicite remplace une disparition silencieuse du rendu.',
      degradedVersionSuffix: ' (schéma : `{version}`)',
      versionWarning:
        '> ⚠ Schéma connecteur non reconnu (`{version}`, attendu `{expected}`). Le rendu ci-dessous est en mode dégradé.',
    },
  })
  ```

- **`StreamingUIRenderer` no longer shows the machine code `ssr` as its
  error heading** when streaming is started during server rendering. It
  renders `streamServerSideTitle` (`"Streaming unavailable"`) instead. The
  hook's `StreamError.error` keeps the code `'ssr'` for consumers that test
  it.

- **`ScratchpadPanel`'s feedback badge now shows the option's label**, not
  its machine value (`approve` / `reject` / `comment`); nothing is shown
  after the icon for a free-text comment.

- **`MCPActionProvider`'s fallback action error** — when the action
  executor throws a non-`Error` value, `ActionResult.error` (which
  `FormRenderer` displays) now reads `errorUnknown` instead of a hardcoded
  string.

### Exclusion policy

Every user-visible chrome string now reads from `MCPUIStrings` (components)
or an exported `messages`/`labels` option (runtime-free adapters, services,
helpers, hooks) — enforced by `mcpui-strings-guard.test.ts`: anything the
scanner flags must become a key or an option, or be allow-listed here under
one of P1–P8.

- **P1 — keyboard key caps inside `<kbd>`.** `AutocompleteDropdown`'s
  `<kbd>Enter</kbd>` and `<kbd>Esc</kbd>` — the physical key reads "Enter"
  whatever the UI language. The surrounding hint prose IS localized
  (`autocompleteHintNavigate` / `autocompleteHintSelect` /
  `autocompleteHintDismiss`).
- **P2 — legal attribution wording.** `MapRenderer`'s `"OpenStreetMap</a>
  contributors"` tile attribution — exact wording required by the ODbL. A
  host overrides the whole notice via `params.attribution` for another
  language.
- **P3 — developer diagnostics** that name an npm package, a peer
  dependency or a config flag; bracketed `[Component] …` messages;
  debug-only panels behind an explicit debug flag; developer-misuse errors;
  and the structural payload-schema diagnostics of `services/validation.ts`:
  - `GraphRenderer`'s install hint under the localized
    `graphUnavailable` heading: `"Install"` / `"@antv/g6"` / `"peer
    dependency to render"` / `"type: \"graph\""` / `"components."` — it
    names the missing optional `@antv/g6` peer, for whoever installs the
    host.
  - `RenderContext`'s `'Component "'` / `'" cannot be rendered outside of
    UIResourceRenderer'` — a developer-misuse error (a renderer used
    outside `<UIResourceRenderer>`).
  - `ScratchpadPanel`'s debug overlay (`| ev:`, `| sec:`, `| last:`,
    behind the `debugOverlay` prop) and its `FormDebugTrace` panel (behind
    the `debugTrace` prop) — both mirror raw server/event keys verbatim, for
    developers.
  - `services/validation.ts`'s structural validators — `mapZodIssuesToErrors`,
    `validateGridPosition`, `validateChartComponent`, `validateTableComponent`,
    `validatePayloadSize`, `validateIframeDomain`, `validateComponent`,
    `validateLayout` — their `ValidationError.message` quotes a payload
    path (e.g. `params.data.datasets[0]`) and is addressed to whoever
    produced the payload, not to the end user. The validation CARD chrome
    around them (`validationError`, `validationWarning`,
    `validationUnknownError`) IS localized; the end-user form messages of
    `validateFieldValue` / `validateFormData` ARE localized through
    `DEFAULT_VALIDATION_MESSAGES`.
- **P4 — machine tokens**: file-format acronyms, HTTP verbs, unit symbols,
  ISO currency codes, and chart point property names. `DataPreviewSection`'s
  `"CSV"` / `"JSON"` export-button glyphs (their `title` attributes,
  `exportCsvRows` / `exportJsonRows`, ARE localized) and its `" EUR"`
  currency suffix; `"ms"` after execution times and durations
  (`FooterRenderer`, `StreamingUIRenderer`, `ScratchpadPanel`); and
  `chartToDataTable`'s `x` / `y` / `r` column headers (the Chart.js point
  property names the cells mirror — still overridable through the
  `labels` parameter).
- **P5 — pure module functions with a documented render override.** No
  occurrence remains: the default citation chip's tooltip used to be the
  only one and is now localized (`citationViewSource`, passed through
  `CitationCtx.viewSourceLabel`). The item stays in the policy for future
  helpers.
- **P6 — components with their own documented `labels`/`messages` prop.**
  `PresentationFeedback`'s `DEFAULT_PRESENTATION_FEEDBACK_LABELS` — the
  component documents its own `labels` prop
  (`<PresentationFeedback labels={{ prompt: '…' }} />`) and does not read
  `MCPUIStringsProvider`. (`DEFAULT_CONNECTOR_MESSAGES`,
  `DEFAULT_MACRO_RUN_MESSAGES`, `DEFAULT_VALIDATION_MESSAGES`,
  `DEGRADED_PROJECTION_LABELS` and `CHART_DATA_TABLE_LABELS` are the same
  kind of sanctioned default table for a `messages`/`labels` option — see
  **Added**.)
- **P7 — strings the library never renders itself.** Hook-level errors
  returned to the consumer (`useAction`'s `"Max retries (…) exceeded"` /
  `"Action cancelled by onBefore callback"`, `useAutocomplete`'s `"Unknown
  error"`); `props.onError` payloads (`"Chart rendering failed"`,
  `"Component validation failed"`, `"Video failed to load"`); and
  `console.*` / logger / telemetry-only strings. A consumer that reads them
  chooses how to display them. One edge case: the SSR stub executor's
  `"Actions not available server-side"` is an `ActionResult.error` that
  `FormRenderer` would display, but a form cannot be submitted during
  server rendering, so it never reaches the DOM in practice.
- **P8 — LLM-facing schema descriptions, example payloads, comments and
  JSDoc.** `services/component-registry.ts` in full, and the `plugins/`
  system prompts — a catalogue of JSON-schema descriptions and example
  payloads shown to the model; translating it would teach the model to
  emit non-English payloads.

Also out of scope (not i18n): the auto-footer's `poweredBy: 'Deposium'`
brand string (pre-existing since v1.2.0). Payload/content strings in
general (`params.title`, `action.label`, and similar) remain the
producing MCP server's responsibility — this sweep only touches the
library's own chrome.

### Tests

- **`mcpui-strings-guard.test.ts` — AST-based chrome scanner.** Runs
  `scanChrome()` (`scripts/chrome-scan.ts`) over every non-test source under
  `src` and asserts zero unallowed findings. Separately asserts: every
  `ALLOW_LIST` entry still matches a real finding (a fixed literal that no
  longer exists fails the build instead of silently going stale); every
  `SCOPED_EXCLUSIONS` function still exists in its file; every
  `SANCTIONED_TABLES` entry is still exported and non-empty; every entry
  across all three names the policy item (P1–P8) it invokes; and no
  sanctioned table or scoped-exclusion function lets French text or a
  hardcoded locale tag through. A second `describe` block carries
  non-vacuity fixtures — one small source snippet per finding class the
  scanner understands (JSX text, attribute literal, ternary branch,
  template span, helper return, signal setter, prose array/object
  property, arrays rendered item by item through `<For>` or `.map()`,
  French text including single distinctive words, hardcoded locale) —
  asserting the scanner flags
  each one, and a matching "does not flag" fixture per skipped AST context
  (`console.*`, `onError`, thrown errors).
- **`MCPUIStrings.pseudolocale.test.tsx` — runtime pseudo-localization.**
  Mounts the renderers (`UIResourceRenderer` layouts — table, chart, map,
  graph, form, gallery, video, code, carousel, action, artifact, modal,
  error and validation states; `DataPreviewSection`; `ScratchpadPanel`
  sections and statuses; `ChatPrompt`; `FormRenderer`; `StreamingUIRenderer`;
  `GenerativeUIErrorBoundary`; `VerifiedText`; the agent components;
  `AutocompleteDropdown`; `GraphRenderer`'s export menu;
  `EditableUIResourceRenderer`) with a `<MCPUIStringsProvider>` whose
  strings are `⟦key {placeholders}⟧` markers and with CJK-only payload
  content, under `locale: 'fr-FR'`. Walks `document.body` including
  portals and accessible attributes (`aria-label`, `title`, `alt`), and
  separately asserts the tool-error card's clipboard text. Fails on any
  Latin chrome text left over. It backs up the scanner's known blind spots:
  prose stored under machine-looking keys such as `name`, and values passed
  to another file's component props.
- **`mcpui-strings-defaults.test.ts`** pins every `DEFAULT_MCPUI_STRINGS`
  value, so a default cannot drift silently.

### Known follow-ups

- The auto-footer's hardcoded `poweredBy: 'Deposium'` brand string is not
  i18n and is out of scope for this release (pre-existing since v1.2.0).
- `DataPreviewSection` appends `" EUR"` to every `currency` cell whatever
  the data's actual currency (pre-existing; a currency code belongs in the
  payload, not in the library).
- `macroRunToScratchpadState` passes a whole `UIComponent` as the content of
  `data_preview` / `chart` / `map` sections, while those sections expect the
  component's params (pre-existing since the MacroRun adapters shipped). A
  table result therefore shows `previewInvalidContent` in the panel.
- Download filenames (`chart.png`, `table-*.csv`, graph export stems) stay
  in English — they are files, not DOM text, so the policy treats them as
  P4 machine tokens.

## [6.19.1] - 2026-09-16

### Fixed

- **`FeedbackInline` accessible names were hardcoded English.** The two rating
  buttons carried `aria-label="Mark response as useful"` /
  `"Mark response as not useful"` regardless of `MCPUIStringsProvider`, while
  their tooltips already used `strings.feedbackUseful` /
  `strings.feedbackNotUseful`. Both attributes now read the same strings, so
  screen readers get the localized name. Default English accessible names
  therefore become `"Useful"` / `"Not useful"`; the stable hook
  `data-feedback-inline-rating="positive" | "negative"` is unchanged.

## [6.19.0] - 2026-09-16

### Security

- **`text` component XSS fix.** `TextRenderer` now sanitizes both branches of
  its `innerHTML` sink: the markdown branch (`marked.parse` → sanitize, as
  before) *and* the non-markdown `params.content` branch, which previously
  went straight into `innerHTML` completely raw. On the client both now run
  through the new `prose` sanitize profile: `<style>`, `<form>`, `<textarea>`,
  `<select>`, `<button>`, `<iframe>`, `<object>`, `<embed>` and the `style`
  attribute are stripped; standard prose markup survives (links, emphasis,
  lists, tables, headings, `<hr>`, `<del>`, `<sup>`/`<sub>`), including
  markdown task-list checkboxes (`<input type="checkbox" disabled>` — every
  event handler and `<form>` are still forbidden, so nothing is
  submittable). `iframe` is forbidden in `prose` **by design** — the
  supported way to embed is the `iframe` **component type**, which goes
  through `getIframeSandbox()` / `validateComponent()`; this is now pinned by
  a test. Missing/`null` `params.content` now renders empty instead of the
  literal string `"undefined"`.
- **New `safeUrl()` guard** (`src/utils/safe-url.ts`) on the `text`
  component's image-markdown branch (`[![alt](img)](link) *credit*`): the
  branch is taken only when `safeUrl(imageUrl, { allowDataImage: true })` is
  defined, and the `<a>` wrapper only when `safeUrl(linkUrl)` is defined —
  otherwise the content falls back to the normal sanitized markdown path (an
  unsafe link yields the bare `<img>`). Allowed: relative URLs and absolute
  `http:`/`https:`/`mailto:`/`tel:` URLs, plus (with `allowDataImage`)
  `data:image/(png|jpeg|jpg|gif|webp);base64,…`. Rejected: `javascript:`,
  `vbscript:`, `data:text/html`, `data:image/svg+xml`, `file:`, `blob:`,
  `about:`, `ftp:`, unparseable strings, empty/whitespace-only input, and any
  string containing control characters; matching is scheme-normalized, so
  `JAVASCRIPT:` and leading whitespace are also rejected.
- **`renderCellValue`'s last-resort JSON fallback is now escaped.** An
  object-shaped cell value with no matching renderer (e.g.
  `{ details: '<img src=x onerror=alert(1)>' }`) previously stringified
  straight to `innerHTML`; it now returns `escapeHtml(JSON.stringify(value))`.
  This is a **public behaviour change** — `renderCellValue` is exported from
  the package root — so a plain debug object now comes back with HTML
  entities, e.g. `{&quot;a&quot;:1}`.
- **`cellLink` / `resource` sanitize profiles hardened.** `cellLink` (link-
  shaped table cells) is no longer bare DOMPurify defaults: it now sets
  `FORBID_TAGS: ['style','form','textarea','select','iframe','object','embed']`
  and `FORBID_ATTR: ['style']` (keeping `ADD_ATTR: ['target','rel']`),
  closing an `<svg><style>body *{visibility:hidden}</style></svg>` link-label
  stylesheet-injection path. `resource` (`ui://` `rawHtml` content) was
  previously `{}` (bare defaults); it now sets
  `FORBID_TAGS: ['style','form','input','textarea','select','button','iframe','object','embed']`
  and `FORBID_ATTR: ['style','formaction','form']`, closing a host-page
  restyling path and a phishing-form path — headings, tables, lists, links,
  images and class attributes still survive.
- **`highlightQuery(html, query)` is DOM-based** since v6.19.0: same
  signature and `<mark class="bg-yellow-200 dark:bg-[#222F49] text-inherit
  rounded px-0.5">` wrapper, early return for an empty/whitespace query, and
  `html` returned unchanged when `typeof document === 'undefined'` (SSR). It
  now parses into a detached `<template>` and walks text nodes only, so a
  match can no longer be spliced into an HTML entity (`&amp;` searched for
  `amp`) or an attribute value (`title="foo"`).
- **`code` component: `&` was not escaped.** The no-highlight.js fallback
  (`highlight.js` absent, or its own highlight call throws) escaped `<`/`>`
  but not `&`, so source containing `&lt;script&gt;` rendered as a literal
  `<script>` tag once double-unescaped by the browser. Both paths now use the
  shared `escapeHtml()`. `highlight.js` output itself is untouched — it
  already escapes its own input.
- **Table cells and `UIResourceHtmlRenderer`** now sanitize through the same
  shared `sanitizeHtml()` entry point instead of ad hoc inline `DOMPurify.sanitize()`
  calls. Behaviour for citation chips and cell link/markdown/HTML rendering is
  unchanged — the exact prior DOMPurify configs were lifted verbatim into
  named profiles (`cellLink` / `cellMarkdown` / `cellHtml` / `resource`).
- **SSR contract.** New `sanitizeHtml()` (`src/utils/sanitize-html.ts`) is
  now the single sanitizer for every sink that carries untrusted markup
  (`text`, table cells, `ui://` resources) — it is not the only `innerHTML`
  binding in the package: `CodeBlockRenderer`'s `<code innerHTML>` binds
  highlight.js output, or `escapeHtml(code)` when highlight.js fails to load
  or `highlight()` throws, and this sink boundary is now documented in the
  `sanitize-html.ts` and `SafeHtml.tsx` docblocks. On the server — or any
  environment where DOMPurify cannot run (`isServer`, `!DOMPurify.isSupported`,
  or `DOMPurify.sanitize` not being a function, which is the actual behavior
  of dompurify 3.4.x with no `window`) — the sink returns `escapeHtml(input)`
  and nothing else; there is no tag-stripping, so text that merely looks like
  markup is preserved as visible, inert text (`values < 10 and > 5` renders
  as `values &lt; 10 and &gt; 5`, not `values 5`) — escaped tags remain
  visible as inert text, so server output can contain the literal characters
  of e.g. `onerror=`. For `text` components specifically, both the markdown
  and non-markdown branches ship the **escaped markdown source** on the
  server, not escaped `marked` output — so block structure (tables, lists,
  headings) is **not** present on first paint and the region visibly reflows
  once the client hydrates. On the client it runs real DOMPurify with the
  caller's profile. The new `<SafeHtml>` component
  (`src/components/SafeHtml.tsx`) replaces every direct `innerHTML` binding
  and, in `onMount` (client-only, post-hydration), re-applies the sanitized
  HTML if the hydrated DOM still shows the server's escaped text — covering
  `solid-js/web`'s `setProperty(node, 'innerHTML', v)` early-return during
  hydration. Net effect: the server never ships live markup, and the client
  upgrades to the rich sanitized version, with a visible reflow, once
  mounted.
- `UIResourceRenderer.tsx` no longer imports `dompurify` directly; it is now
  imported in exactly one module (`utils/sanitize-html.ts`).

- **Link-like table cells (`{ url, name }`) are re-sanitized as a whole.**
  Sanitizing the bare `url` string leaves quotes and `javascript:` untouched,
  so a crafted value could break out of the `href` attribute or smuggle a
  scriptable link. The composed `<a>` now runs through the `cellLink` profile
  (`javascript:` hrefs dropped, injected attributes stripped).

- **Every `href` / `src` binding is allow-listed.** Beyond the text
  component's image-markdown branch, `safeUrl()` now guards the `image`
  (anchor + `<img>`), `link`, `artifact` (download link), `action`
  (link-style actions, `#` fallback) and `footer` renderers, the image
  gallery thumbnails and the lightbox image. `javascript:`, `vbscript:`,
  `data:text/html`, `file:` and `blob:` URLs are dropped (the attribute is
  simply omitted); `http(s):`, `mailto:`, `tel:`, relative URLs and, for
  images only, base64 `data:image/*` are kept. `iframe` (domain allow-list +
  sandbox) and `video` (embed URL built from the provider id) were already
  filtered.

### Added

- **Accessible table pagination.** The prev/next buttons are `type="button"`
  with `aria-label` (glyphs moved into `aria-hidden="true"` spans) and carry
  the new stable hooks `data-mcp-ui-action="page-prev"` / `"page-next"`; the
  "page X / Y" indicator is `aria-live="polite"`, and the fullscreen-only
  page-size `<select>` has an `aria-label` and `data-mcp-ui-action="page-size"`.
  All three labels come from `MCPUIStrings` (`paginationPrevious`,
  `paginationNext`, `paginationPageSize` — new, optional, EN defaults
  "Previous page" / "Next page" / "Rows per page") and can be localized via
  `MCPUIStringsProvider`.
- **`GridRenderer` landmark semantics.** The grid container now carries
  `role="group"` and an `aria-label`, falling back through the component's
  `title`, `params.title`, `params.label`, then the new `MCPUIStrings.gridRegion`
  default ("Layout grid"). A blank or whitespace-only `title` is now treated
  as **absent**, so `title: ""` falls through to `params.label` / the
  localized default instead of yielding an empty `aria-label`.
- **Stable portal-root hooks.** `PortalDropdownMenu`'s menu root and
  `ExpandableWrapper`'s fullscreen overlay root now carry
  `data-mcp-ui-portal="menu"` / `data-mcp-ui-portal="dialog"` respectively, so
  host apps and tests can target them without relying on `role` selectors or
  DOM structure.
- **New `@seed-ship/mcp-ui-solid/adapters/presentation` subpath.** A
  runtime-agnostic ESM+CJS build of the pure `createComparisonLayout` /
  `createGeographyLayout` / `createEvidenceLayout` helpers (previously only
  reachable via `/adapters`, which also carries connector/macro adapters with
  real runtime dependencies). The built output contains zero `import`/`require`
  statements, so a plain-Node MCP server can build layouts without pulling in
  `solid-js`, `zod` or `@seed-ship/mcp-ui-spec`. `@seed-ship/mcp-ui-solid/adapters`
  continues to re-export the same three helpers.

- **Stable action hooks.** `data-mcp-ui-action="expand" | "copy" | "close"`
  on `ExpandableWrapper`'s buttons, `data-mcp-ui-action="copy"` on the inline
  copy button of text/metric/table components,
  `data-mcp-ui-action={action.icon}` on every `ComponentToolbar` button, and
  (see the pagination bullet above) `"page-prev" | "page-next" | "page-size"`
  on the table pagination controls, which — like `ExpandableWrapper`'s three
  buttons — now newly carry an `aria-label` in addition to `title` (host CSS
  using `button[aria-label]` as a proxy selector will start matching them
  that didn't before). Host CSS should target the `data-mcp-ui-action` hooks
  instead of `aria-label` / `title` text, which is localizable (see Changed).
  `ExpandableWrapper`'s expand, copy and close buttons now all carry
  `type="button"` — the pagination buttons already had it. The inline copy
  button now has an `aria-label` too.
- **`typesVersions`** for every published subpath (`./components`, `./hooks`,
  `./types`, `./validation`, `./types-only`, `./adapters`,
  `./adapters/presentation`, `./plugins/duckdb`), so consumers on TypeScript
  `moduleResolution: "node"` (which ignores `exports`) resolve subpath types.
- `LICENSE` is now shipped in the tarball (it was missing — only the monorepo
  root had one). Same for `@seed-ship/mcp-ui-spec` (next release) and
  `@seed-ship/mcp-ui-cli` 5.0.1.

- **`ExpandableWrapper` `onExpandedChange?: (expanded: boolean) => void`** —
  called on mount and on every change. Renderers that render their own
  wrapper need it because their `useExpanded()` call sits above the wrapper's
  context provider (see Fixed).

### Changed

- **`solid-js` remains a required peer dependency (`^1.9.0`).** It is not
  optional: pnpm (with auto-install-peers) or npm 7+ installs it
  automatically regardless of which subpath is used. `./validation` and
  `./adapters/presentation` import nothing from `solid-js` in their built
  output, so a Node-only consumer of either subpath simply carries an
  unused `solid-js` in `node_modules` rather than getting a missing-peer
  warning.
- **Package size.** `npm pack --dry-run` now reports 5.6 MB unpacked / 671
  files (1.3 MB packed), down from the 39.8 MB unpacked / 5428 files that
  were actually published as `6.18.0`. Cause: `vite.config.ts`'s Rollup
  `external` was a 6-entry allow-list, which — combined with
  `preserveModules` — silently bundled every other dependency (`@antv/g6`,
  `leaflet`, `highlight.js`, `zod`, `@seed-ship/mcp-ui-spec`, …) into
  `dist/node_modules/.pnpm/**`. It is now a predicate that externalizes
  every bare specifier and bundles only relative/absolute paths and Rollup
  virtual modules — fixed to also recognize a Windows drive-path module id
  in both its native backslash form (`C:\...`) and the forward-slash form
  (`C:/...`) that Rollup/Vite normalize to, so it isn't misclassified as a
  bare specifier and left external. The optional visual-library imports
  (`@antv/g6`, `@tanstack/solid-virtual`, `chart.js/auto`, `highlight.js`,
  `leaflet`, `leaflet.markercluster`) and their CSS side-imports remain lazy
  `import(...)` calls, unaffected.
- `package.json`'s `files` allow-list (`dist`, `src`, `README.md`,
  `CHANGELOG.md`, `LICENSE`) now also excludes test sources from the
  published tarball — `!src/**/*.test.ts`, `!src/**/*.test.tsx`,
  `!src/test-setup.ts` — dropping 72 src test files (~431 KB) and
  `src/test-setup.ts` (1.4 KB). (Two build-artifact `test-setup` entries
  still ship inside `dist/` — `dist/test-setup.d.ts` and its map, ~270 B
  combined — a separate, smaller follow-up.) `sideEffects` is set to
  `["**/*.css"]`: every other JS/TS module is declared side-effect free,
  which holds today because no `src` module imports CSS at the top level or
  is otherwise relied on for import-for-side-effect.
- `dist/mcp-ui-solid.css` is **no longer emitted**. It only ever contained
  vendor CSS (highlight.js themes, Leaflet) pulled in through the lazy
  `import(...)` calls above, which are now external; it was never referenced
  by any `exports` entry.

No new required runtime dependency. `dompurify`, `marked`, `zod` and
`@seed-ship/mcp-ui-spec` remain regular `dependencies` (they are genuine
runtime requirements of the core render/validation path); `chart.js`,
`highlight.js`, `leaflet`, `leaflet.markercluster`, `@antv/g6`,
`@tanstack/solid-virtual`, `@duckdb/duckdb-wasm` and `protomaps-leaflet`
remain optional peers. `solid-js` is a required peer, as it always has been.

- **`ExpandableWrapper`'s expand button `aria-label` is now localized**
  (`MCPUIStrings.expand`, default `"Expand"`) instead of the hardcoded English
  `"Expand to fullscreen"`. Hosts whose CSS or tests matched that literal
  should switch to `button[data-mcp-ui-action="expand"]`.

### Fixed

- **Declaration-barrel bug (pre-existing, root symbols silently typed `any`).**
  The types build's `build:types:copy` step used to `cp dist/<dir>/index.d.ts
  dist/<dir>.d.ts` — a copy that moves the file up one directory, so relative
  re-exports inside it (e.g. `export { UIResourceRenderer } from
  './UIResourceRenderer'`) pointed at a `dist/UIResourceRenderer.d.ts` that
  does not exist. Under `skipLibCheck` (the default for most consumers)
  TypeScript silently swallowed the unresolved module, and every symbol
  flowing through those barrels resolved to `any`: confirmed, via a real
  consumer probe (`moduleResolution: "bundler"` + `skipLibCheck`), for
  `UIResourceRenderer`, `StreamingUIRenderer` and `GenerativeUIErrorBoundary`
  imported from the package root, `UIResourceRenderer` from
  `/components`, `useStreamingUI` from `/hooks`, and `createComparisonLayout`
  from `/adapters`. (`createChatBus` / `validateLayout` from the root,
  `createGeographyLayout` from `/adapters/presentation`, and `UILayout` from
  `/types` and `/types-only` were already typed correctly and stayed
  correct.) The fix writes a real re-export barrel instead of copying —
  `export * from './components/index';` for each of `components`, `hooks`,
  `types` and `adapters`, plus `export { default } from './components/index';`
  for `components` specifically, since `export *` doesn't carry a default
  export. Two regression tests (`src/packaging.dts.test.ts`, and a
  build-free source-level check in
  `src/adapters/presentation.subpath.test.ts`) now pin the emitted barrel
  shape and the presentation subpath's `import type`-only contract.
- **`./plugins/duckdb` CJS types.** `build:types:cts` now also copies
  `dist/plugins/duckdb.d.ts` to `dist/plugins/duckdb.d.cts`, and the
  `require.types` export condition points at the `.d.cts` file instead of
  the ESM `.d.ts` — the ESM file raised `TS1479` for CommonJS consumers.
- **Fullscreen table page size never applied.** `TableRenderer` renders its
  own `<ExpandableWrapper>`, so its `useExpanded()` call only ever saw an
  outer wrapper and stayed `false`: the larger fullscreen `pageSize` (v4.3.4)
  and the page-size selector (v4.3.7) were unreachable. The table now also
  listens to the wrapper's `onExpandedChange`; the selector is rendered in
  fullscreen and pinned by a test.

## [6.18.0] - 2026-09-14

### Added

- Pure, opt-in comparison/geography/evidence layout helpers in `/adapters`.
  Caller-supplied IDs, payloads and provenance are preserved; helpers only
  arrange components and reject incompatible slot types or duplicate IDs.
- Native chart/data view switch with keyboard-operable buttons, accessible
  canvas description, localizable chrome and complete point/bubble data.
- Container-width reflow for read-only composite and nested grids below 640px;
  original desktop coordinates return when space permits.

### Fixed

- Align the LLM-facing chart/table/graph catalogue with native renderer/schema
  capabilities, retaining the legacy `QuickchartRegistry` export.
- Expose existing table search and client paging options in public types and
  carry bubble radii through the chart contract.
- Prevent unpositioned layout children from creating implicit extra columns.
- Guard asynchronous chart creation against superseded props and unmounts.
- Bound chart data scrolling and apply chart/table custom classes.
- Validate pagination controls and bubble radii at the renderer boundary;
  clamp client pages when data shrinks or an initial page exceeds the row count.
- Preserve nested grid coordinates throughout editable layouts on small screens.

No new runtime dependency, cross-view filtering, host persistence or backend
wiring. Existing external-renderer trust settings remain unchanged.

## [6.17.0] - 2026-08-06

Map contract parity across the spec, Solid public types, LLM-facing registry,
and GeoJSON popup trust boundary.

### Added

- Re-export the spec's `LatLngPoint` type from the package root and `/types`
  entry points. `MapComponentParams.center` and `MapMarker.position` now accept
  both `[lat, lng]` tuples and `{ lat, lng }` objects, matching the runtime
  schema without breaking existing tuple payloads.
- Expand `MapRegistry.schema` to every field accepted by
  `MapComponentParamsSchema`, including GeoJSON styling and popups, named
  layers, marker clustering and PMTiles. The registry explicitly states that
  map coordinates must already be resolved; the renderer does not geocode.
- Add spec-registry parity, public type parity and GeoJSON popup trust-boundary
  regression tests.

### Fixed / security

- Forward the host-only `allowHtmlPopups` opt-in through top-level and named
  GeoJSON layers. The default untrusted path remains unchanged: popup template
  markup is ignored and feature values are escaped. Even on the trusted path,
  substituted feature values remain escaped.

### Non-breaking

- All type and registry changes are additive. Existing marker-only maps and
  tuple coordinates continue to work, and no payload can enable trusted HTML.

## [6.16.0] - 2026-07-03

Post-audit polish pass (global multi-agent analysis follow-up): spec↔solid
type-drift fix, XSS-escaper consolidation, dead-code removal, and the first
behavioral coverage of the SSE streaming engine.

### Fixed

- `composite` is a valid `ComponentTypeSchema` member but had drifted out of
  solid's hand-maintained `ComponentType` union **and** its
  `KNOWN_COMPONENT_TYPES` set, so a `composite` component was flagged
  `UNKNOWN_COMPONENT_TYPE` despite the pass-through docstrings claiming
  otherwise. `ComponentType` is now re-exported from `@seed-ship/mcp-ui-spec`
  and `KNOWN_COMPONENT_TYPES` is derived from `ComponentTypeSchema.options`, so
  the enum has a single source of truth and cannot drift again. A `spec↔solid`
  drift-guard test locks this in.
- Because `composite` now passes the validation gate, a `composite` nested as a
  `components[]` entry (or streamed) — which has no leaf render branch — would
  have rendered a silent blank. `ComponentRenderer` now surfaces the visible
  "Unsupported component type" notice for it, preserving audit P1.6's guarantee.
- `MapRenderer` and `GraphRenderer` carried two divergent private `escapeHtml`
  copies — the map one did **not** escape the single quote. Both now import one
  canonical escaper (`utils/escape-html.ts`, escapes `& < > " '`).

### Added

- `hooks/useStreamingUI.test.ts` — first behavioral coverage of the 469-line SSE
  streaming engine: progressive accumulation, out-of-order buffering / reorder,
  terminal (non-recoverable) error, and recoverable-error reconnect with
  backoff. (The hook reads an SSE body via `fetch` + `getReader()`, not
  `EventSource`.)

### Docs

- Fixed a `DegradedFallback` docstring that named a non-existent
  `component:error` telemetry event (callers emit `render:error`) and a stale
  `SPEC_VALIDATORS` "14/17 types" count.

## [6.15.0] - 2026-05-31

Unknown component types never render a silent blank (audit P1.6).

### Fixed

- An unrecognized component `type` has no renderer branch, so it previously
  rendered **nothing** — and under `errorMode: 'silent'` it passed the
  validation gate without even an error card, producing a fully invisible
  failure. The validation gate now routes any `UNKNOWN_COMPONENT_TYPE` to a
  visible **"Unsupported component type: X"** notice **regardless of
  `errorMode`**.
- The privacy-safe telemetry signal already emitted by the gate
  (`validation:failed` with `firstErrorCode: 'UNKNOWN_COMPONENT_TYPE'`) lets
  hosts detect drift; the fallback notice itself stays purely presentational.

Behavior change only for previously-invisible unknown types; valid components
are unaffected.

## [6.14.0] - 2026-05-31

Make the external quickchart.io chart fallback an explicit host opt-in
(audit P1.7).

### Security / privacy

- The chart renderer could silently fall back to **quickchart.io** when the
  native `chart.js` peer was unavailable (auto mode) — encoding the **entire
  chart config** (labels + data) into an external image URL. That is an
  implicit network call that can leak potentially sensitive data and behaves
  differently offline.
- A new **host-level** prop `allowQuickchartFallback` (on `<UIResourceRenderer>`
  and `<StreamingUIRenderer>`) gates **all** quickchart.io access.
  **Default `false`**:
  - in `auto` mode, when Chart.js is missing the chart now **degrades to a
    local data table** (the P2.5 fallback ladder) and emits a `render:error`
    telemetry signal (`componentType: 'chart'`) — no external call;
  - an explicit `renderer: 'iframe'` request is likewise declined (and
    degraded) unless the host opts in.
- Native Chart.js stays the preferred path and is unchanged. Setting
  `allowQuickchartFallback` restores the previous quickchart behaviour.

  Like `allowHtmlPopups` (v6.10.0), this is deliberately a host prop, not a
  payload field — a payload must not be able to opt itself into an external
  call.

## [6.13.0] - 2026-05-31

`graph` is now first-class in the `UIComponent` params union (audit follow-up
to P1.4/P1.5).

### Added

- `GraphComponentParams`, `GraphNode`, `GraphEdge` and `GraphLayout` types
  (mirroring `GraphComponentParamsSchema` in `@seed-ship/mcp-ui-spec`), and
  `GraphComponentParams` is now part of the `UIComponent` `params` union.
  Previously a `type: 'graph'` component could not be expressed as a typed
  `UIComponent` — the union ended at `MapComponentParams`.
- `GraphRegistry` now ships a **typed** example (it was an empty array in
  v6.12.0 precisely because the union lacked graph params).
- `types/graph-types.test.ts` — compile-time + runtime assertion that a graph
  component with `nodes`/`edges` is assignable to `UIComponent`.

Type-widening only; existing valid code keeps compiling.

## [6.12.0] - 2026-05-31

Registry/schema parity for `graph` (audit P1.5).

### Added

- `GraphRegistry` — the static `ComponentRegistry` now includes a `graph`
  entry (it previously knew `graph` in `KNOWN_COMPONENT_TYPES` and the schema
  but had no registry entry). The registry is now 20 types.
- A registry ↔ schema parity test: every `ComponentTypeSchema` option must
  have a registry entry, with an explicit exceptions list (`composite`, a
  layout container rendered inline rather than a leaf registry entry). Guards
  against a future type being added to the schema/renderer but forgotten in
  the registry.

### Known limitation

- `GraphRegistry.examples` is empty for now: the registry `ComponentExample`
  `params` type is a union of the legacy component params that does not yet
  include graph (`nodes` / `edges`). The entry's `schema` fully documents
  graph params; a typed example will follow once `GraphComponentParams` is
  added to the `UIComponent` params union (a separate solid-types task).

## [6.11.0] - 2026-05-31

Map hardening (audit `docs/briefs/AUDIT-2026-05-30-visual-renderers-g6-ontology.md`).

### Fixed — PMTiles no longer fails silently (P1.3)

A failed PMTiles overlay (most often the optional `protomaps-leaflet` peer not
being installed) previously only emitted a `console.warn`, leaving the user
with an unexplained empty/incomplete layer. `<MapRenderer>` now:

- keeps the base map usable, and
- shows a visible **"PMTiles layer unavailable"** notice over it, and
- reports a `render:error` telemetry event (`componentType: 'map'`).

### Security — marker tooltip/popup escaping is now actually wired (P1.2 follow-up)

v6.10.0 added the `bindMarkerContent` escaping helper but the marker render
loops still bound `marker.tooltip` / `marker.popup` as **raw HTML**, so the
"text-safe by default" guarantee only ever applied to the GeoJSON popup path.
All three marker paths (clustered, cluster-fallback, plain) now route through
`bindMarkerContent`, so marker tooltips/popups are HTML-escaped by default and
only rendered as HTML when the host opts in via `allowHtmlPopups` (unchanged
from v6.10.0). `bindMarkerContent` is now exported and unit-tested.

## [6.10.0] - 2026-05-31

### Security — map popups/tooltips are text-safe by default (XSS hardening)

Leaflet renders bound tooltip/popup strings as **HTML**, so `marker.tooltip`,
`marker.popup` and a GeoJSON `popup.template` were an **XSS vector** when the
payload is untrusted — the default for an LLM/connector-driven public package
(audit `docs/briefs/AUDIT-2026-05-30-visual-renderers-g6-ontology.md`, P1.2).

`<MapRenderer>` now treats that content as **plain text by default**:

- `marker.tooltip` / `marker.popup` are HTML-escaped before binding.
- a GeoJSON `popup.template` (raw HTML) is **ignored** on the default path;
  the safe auto-generated popup (`titleField` / `fields`, values already
  escaped) is used instead.
- substituted `{{prop}}` values in a template are escaped even on the
  trusted path (they are data, not markup).

A **host** that renders `<MapRenderer>` with trusted data can restore rich
HTML popups via the new `allowHtmlPopups` prop. This is deliberately a
host-level prop, **not** a payload field — a malicious payload could just set
its own flag. The `<UIResourceRenderer>` path never sets it, so every
payload-driven map is text-safe.

**Behavior change:** if you previously relied on HTML inside
`marker.tooltip` / `marker.popup` / `popup.template`, pass `allowHtmlPopups`
to `<MapRenderer>` (or migrate that markup into the structured
`titleField` / `fields` popup config). Maps that pass plain-text popups —
the common case — are visually unchanged.

### Tests

- `MapRenderer.security.test.ts` — 14 cases via new exported pure helpers
  `popupSafeText` and `buildPopupContent`: escapes by default, passes raw
  HTML only when opted in, template gated on the untrusted path, auto-popup
  always escapes values.

## [6.9.0] - 2026-05-31

### Added — renderer fallback ladder (no silent blanks)

Every heavy renderer now follows the same three-rung contract (audit
`docs/briefs/AUDIT-2026-05-30-visual-renderers-g6-ontology.md`, P2.5):

1. **native** render when the peer lib is available and succeeds;
2. **degraded but useful** view when the native render throws — a visible
   notice plus a plain data table, so the user still sees the underlying
   data instead of a blank space;
3. a `component:error` **telemetry** event (`detail.degraded = true`) so the
   failure is observable by hosts that mount `<MCPUITelemetryProvider>`.

Previously a render-path failure left an empty canvas / blank container
(graph, chart) or a bare red error string (map). Now:

- **`graph`** (`<GraphRenderer>`) — on G6 render error, degrades to an
  edge table (Source / Target / Label) or, when there are no edges, a node
  list. The export menu (PNG / Mermaid / JSON) stays usable.
- **`map`** (`<MapRenderer>`) — the Leaflet drawing block is now wrapped;
  on failure it degrades to a coordinate table (markers + GeoJSON features
  → Type / Lat / Lng / Info).
- **`chart`** (`<ChartJSRenderer>`) — on Chart.js render error, degrades to
  a series table (labels × datasets) instead of a blank canvas.

New exports: `DegradedFallback` component (+ `DegradedFallbackProps`) for
hosts that want to build consistent fallbacks of their own. New pure
projection helpers (`graphToDegradedTable`, `mapToDegradedTable`,
`chartToDegradedTable`) under `src/utils/degraded-projections`.

`source_card` is intentionally out of scope here — it is not yet a real
`UIResourceRenderer` type (tracked separately as audit P2.6).

## [6.8.2] - 2026-05-30

### Fixed — `type:'map'` rejected when it renders purely from GeoJSON

`validateComponent` rejected a `type:'map'` as `INVALID_MAP` unless it had
`center` or `markers`. But since spec@5.2.0 a map can render purely from
`params.geojson`, named `layers`, or a `pmtiles` source (e.g. a Cadastre /
choropleth map with an auto-fit viewport and no markers). Those valid maps —
which `<MapRenderer>` draws fine — were blocked before reaching the renderer.

The validator now accepts a map carrying **any** of `center`, `markers`,
`geojson`, `layers`, or `pmtiles`, aligning the Solid check with
`MapComponentParamsSchema`. A genuinely empty map (none of those) is still
rejected. Per audit `docs/briefs/AUDIT-2026-05-30-visual-renderers-g6-ontology.md` (P1.1).

## [6.8.1] - 2026-05-30

### Fixed — `type:'graph'` crashed with "renderer is not a function"

`GraphRenderer` passed `renderer: 'canvas' | 'svg'` (a **string**) to the
G6 v5 `Graph` constructor. In G6 v5 `renderer` is a factory
`(layer) => IRenderer`, not a string (that was the v4 contract), so G6 threw
`renderer is not a function` — and because the default path also passed the
string `'canvas'`, **every** `type:'graph'` component crashed, not just the
`svg` one. This was an upstream bug in `mcp-ui-solid`, not a missing peer
dependency in consumer apps.

- Default (canvas): the `renderer` field is now **omitted** — G6 uses its
  built-in canvas renderer (documented default `() => new CanvasRenderer()`).
- `rendererPref: 'svg'`: reserved but **not wired yet** — it degrades to the
  canvas default with a one-time `console.warn` instead of injecting the
  faulty string. A real G6 v5 SVG renderer needs the `@antv/g-svg` factory
  (a transitive dep of `@antv/g6`, not statically resolvable at build time);
  wiring it behind proper optional-peer resolution is a follow-up.

### Tests

- New `GraphRenderer.g6.test.tsx` — the previously-missing "G6 available"
  contract path (the gap that let this regression ship). Mocks only the
  `Graph` constructor and asserts: `Graph` is constructed, `render()` is
  called, the default config carries **no** `renderer` field, and a string
  `renderer` is never passed (incl. the `svg` path).

Audit: `docs/briefs/AUDIT-2026-05-30-visual-renderers-g6-ontology.md` (P0).
The brief `BRIEF-graph-component-g6.md` was corrected to match (its example
and test expectation carried the same faulty string contract).

## [6.8.0] - 2026-05-22

### Changed — payload-size limit raised 50KB → 512KB

`DEFAULT_RESOURCE_LIMITS.maxPayloadSize` moved from `50 * 1024` to
`512 * 1024`. The single payload-size guard is shared by every component
type; at 50KB it rejected otherwise-valid `type:'map'` components carrying a
realistic `params.geojson` `FeatureCollection` as `PAYLOAD_TOO_LARGE`. A
dense multi-feature map (e.g. a département-wide choropleth) runs 300-500KB
even after reasonable geometry simplification — 512KB leaves real headroom
for that while still rejecting runaway payloads. Genuinely large datasets
belong in vector tiles (PMTiles), not inline GeoJSON.

- `validatePayloadSize()` and the reject-on-oversize principle are
  **unchanged** — only the default ceiling moved. Validation is not disabled,
  and a caller passing stricter `limits` keeps full control.
- Behaviour before/after: a valid component between 50KB and 512KB was
  rejected, now passes; a payload over 512KB is still rejected. Components
  under 50KB are unaffected. Per-registry limits (e.g. the 5KB/10KB presets
  in `component-registry.ts`) are independent and untouched.

## [6.7.0] - 2026-05-22

### Added — MacroRun Phase 2 adapters

Pure adapters from the `MacroRunV1` contract (new in
`@seed-ship/mcp-ui-spec@5.3.0`) to existing MCP-UI primitives. Published on
the opt-in `@seed-ship/mcp-ui-solid/adapters` subpath — never imported by the
core renderer path.

- `macroRunToScratchpadState(run: MacroRunV1): ScratchpadState` — builds an
  `agent_card` section, a `stepper` (or `split_stepper` when steps carry
  `parallel` branches), a `prompt` section for an embedded
  `pendingInterrogation`, and one section per `results` entry. Run status
  maps `pending→loading`, `running→processing`, `awaiting_input→waiting_human`,
  `completed→complete`, `failed`/`aborted`→`error` (aborted is never
  retryable). `results` is optional — the adapter works without UI results.
- `macroInterrogationToChatPromptConfig(q: MacroInterrogationV1): ChatPromptConfig`
  — maps `choice` / `confirm` / `form` directly, and routes `elicitation`
  through the existing `elicitationToPromptConfig()` helper. Always returns a
  `ChatPromptConfig`. Usable standalone or via `macroRunToScratchpadState`.

Both are **pure functions** — no fetch, no SSE listener, no persistence, no
global state.

**Out of scope (host / runtime responsibility):** the producer runtime that
emits a `macro-run/v1` snapshot (a later goal on the producing repo), and all
host-side wiring — SSE listener, fetch, persistence, resume. These adapters
only translate a snapshot the host already has. The `action:'submit'`
executors are untouched, and MacroRun is kept separate from the tool-call
action path.

## [6.6.1] - 2026-05-22

### Fixed — `action: 'submit'` is no longer inert outside a `<form>`

`ActionParamsSchema.action` allows `'tool-call' | 'link' | 'submit'`, but
at runtime `submit` did nothing : `ActionGroupRenderer` only branched on
`tool-call` / `link`, and the standalone `action` renderer emitted a
native `type="submit"` button — which only fires inside a real `<form>`.
Standalone resources rendered by `<UIResourceRenderer>` have no
surrounding form, so the click was inert.

`submit` actions now route through the host executor — like `tool-call`,
but **not treated as a tool call** :

- `<ActionGroupRenderer>` and the standalone `action` renderer both call
  `executeAction({ action: 'submit', toolName, params })` on click.
- The action **kind** is preserved : `ActionRequest` gains an optional
  `action?: 'tool-call' | 'submit' | 'link'` field so a host `executor`
  can tell a submit apart from a tool call (e.g. POST to
  `params.submit_url`). The full `params` payload (`submit_url`,
  `connector_id`, `feedback_value`, `preferred_layout`, …) is passed
  through intact.
- The submit button is now `type="button"` (JS-handled) — it works with
  no surrounding `<form>`, and shows the same loading / disabled state as
  a `tool-call` button.
- The `defaultExecutor` `mcp-action` `CustomEvent` detail now carries
  `action`, so a window-level listener can route submits too.

Backward compatible : `action` is optional everywhere and absent on every
pre-6.6.1 request — a request without it is still treated as `tool-call`.

## [6.6.0] - 2026-05-21

Sprint OpenData / macros — cf. `docs/briefs/ROADMAP-opendata-macro-mcpui.md`
(decisions D1-D10 + R1-R4). Ships steps 1-5 of the execution order :
`StreamingUIRenderer` parity, `MCPUIStringsProvider`, the
`ConnectorDynamicResultV1` contract consumption, `PresentationFeedback`,
and the opt-in connector adapters. The macro adapters are deferred to a
later phase (they need a macro-run contract). Pairs with
`@seed-ship/mcp-ui-spec@5.1.0`.

### Added — opt-in connector adapters (`@seed-ship/mcp-ui-solid/adapters`) (D5 / D6)

New dedicated subpath export — **never** imported by the core renderer
path, so consumers that don't emit connector results pay nothing for it:

```ts
import { connectorResultToUILayout } from '@seed-ship/mcp-ui-solid/adapters'

const layout = connectorResultToUILayout(connectorResult)
```

- `connectorResultToUILayout(result)` — assembles a `ConnectorDynamicResultV1`
  (`primary` + `supplemental[]` + `actions`) into one `UILayout`. **Pure**
  (D5) — deterministic, no side effects, safe to re-run after feedback.
- `connectorActionsToActionGroup(actions)` — wraps connector actions into
  an `action-group` `UIComponent`.
- **Unknown `schemaVersion` never throws** (R2) : a usable-but-unversioned
  envelope still renders, prefixed with a visible warning notice ; a truly
  unreadable payload becomes an explicit degraded `UILayout` (a `text`
  notice with id `connector-degraded`). Never a silent disappearance.

**Scope note** : this ships the *connector* adapters. The *macro* adapters
(`macroRunToScratchpadState`, `macroInterrogationToChatPromptConfig`) are
deferred — they need a macro-run contract that the roadmap leaves to
Phase 2.

### Added — `PresentationFeedback` component (R3 / D9 / Phase 4)

A new opt-in feedback widget — **distinct** from `FeedbackInline` :

- `FeedbackInline` — was the *answer* good? (response quality)
- `PresentationFeedback` — was the answer *shown well*? (layout / readability)

They are separate components, separate exports, separate payloads — the
two axes never collapse (cf. R3). `PresentationFeedback` collects a
`verdict` (`readable` / `not_readable`) and, when not readable, problem
tags + an optional preferred layout + a free-text comment, then emits a
`ConnectorRenderFeedback` payload via `onSubmit`.

- Stateless : the host persists the feedback and owns any re-render
  (cf. D1 — adapter pure + host state). The component never mutates the
  rendered result.
- Best-effort : a rejected `onSubmit` promise is swallowed, the UI flips.
- Localizable : all labels ship in English, overridable via the `labels`
  prop (`DEFAULT_PRESENTATION_FEEDBACK_LABELS` exported).
- `ConnectorRenderFeedback` / `ConnectorRenderProblem` /
  `ConnectorPreferredLayout` types are re-exported from the package root
  for convenience (defined in `@seed-ship/mcp-ui-spec`).

### Added — `MCPUIStringsProvider` : i18n for the library's chrome (D2 / R4)

MCP-UI hardcoded a handful of its own UI strings (the expand-button
tooltip, the feedback acknowledgements…) — and they were an inconsistent
FR/EN mix. New opt-in context to localize them :

```tsx
import { MCPUIStringsProvider } from '@seed-ship/mcp-ui-solid'

<MCPUIStringsProvider strings={{ expand: 'Agrandir', feedbackUseful: 'Utile' }}>
  <App />
</MCPUIStringsProvider>
```

- `MCPUIStrings` — flat string map of the library's own "chrome" strings.
  **Content** (table headers, chart titles, action labels) is NOT covered:
  it comes from the payload, already localized by the producer.
- `DEFAULT_MCPUI_STRINGS` — English defaults. A published library ships no
  hardcoded non-English chrome.
- `<MCPUIStringsProvider strings={...}>` — partial override; unset keys fall
  back to the EN defaults.
- `useMCPUIStrings()` — reads the active strings; returns the EN defaults
  when no provider is mounted (every renderer works standalone).

Wired consumers : `FeedbackInline` (button tooltips + acks),
`ExpandableWrapper` (expand / copy / close chrome), `StreamingUIRenderer`
(retry button). Component props that already carry a label
(`FeedbackInline.positiveAck`, `ExpandableWrapper.copyLabel`) keep priority
over the provider.

**Behavior change** : `FeedbackInline`'s ack defaults were French
(`'Merci !'`, `"Noté, on s'améliore"`) — they are now English
(`'Thanks!'`, `"Noted — we'll improve"`). Consumers relying on the FR
defaults pass a `<MCPUIStringsProvider>` with FR strings, or the
`positiveAck` / `negativeAck` props. `ExpandableWrapper`'s default heading
casing was also unified to `'Expanded view'` (it was inconsistently
`'Expanded View'` for the heading vs `'Expanded view'` for the aria-label).

### Changed — `StreamingUIRenderer` renders with full fidelity (Gap 1 / D3)

`StreamingUIRenderer` previously rendered each streamed component through an
inline simplified renderer (`StreamingComponentRenderer`) that only showed a
type label, the title, and — for metrics — the value. A streamed `table` /
`chart` / `map` did NOT render the real component.

Each streamed `UIComponent` is now delegated to the real
`<UIResourceRenderer>`. Streaming and static paths use the literal same
renderer, so they cannot drift. Validation, telemetry, the error boundary
and `errorMode` all come from `<UIResourceRenderer>` — the duplicated copies
in the streaming path are deleted.

- New `toolbarVariant` prop on `<StreamingUIRenderer>`, forwarded to streamed
  components (parity with the static `<UIResourceRenderer toolbarVariant>`).
- Delegation is a one-way value import — `UIResourceRenderer` never imports
  `StreamingUIRenderer`, no cycle.
- Progress bar, skeletons, arrival animation and metadata display unchanged.
- The streamed component's grid `position` is normalized to full-width
  before delegation: `StreamingUIRenderer` owns the 12-column layout,
  `<UIResourceRenderer>` only renders the component.

### Changed — `size-limit` budgets

The "Streaming renderer" `size-limit` budget was raised from 30 KB to 1 MB.
Post-D3 that entry's reachable graph equals the full renderer set, and
`size-limit` measures the pre-built `dist/` including lazy `import()` chunks
(leaflet, `@antv/g6`, chart.js) that are fetched on demand, not at import.
The figure is a worst-case total, not eager load cost — the budget is
generous headroom, since `size-limit` here is a regression guardrail and
does not gate CI. The "Hooks only" and "Full bundle" entries are unchanged —
their pre-existing overages predate this sprint.

## [6.5.0] - 2026-05-05

Closes Demande 1 + Demande 2 of `deposium_solid`'s
`BRIEF-MCPUI-2026-05-10.md` (rescue-duplicate root-cause investigation).

### Added — `getUiResourceStableKey(content)` helper

New public function exported from the package root :

```ts
import { getUiResourceStableKey } from '@seed-ship/mcp-ui-solid'

getUiResourceStableKey({ id: 'dashboard-q3', components: [...] })
// → 'dashboard-q3'  (passthrough)

getUiResourceStableKey({ type: 'chart', params: { ... } })
// → 'a4f3b91'  (FNV-1a 32-bit, 7 chars base36)
```

If `content.id` is a non-empty string, the helper returns it verbatim.
Otherwise it derives a deterministic hash from the content with `id` and
`metadata.generatedAt` stripped — stable across renders for the same
logical payload, sync, no peer dependency.

This is the canonical implementation of the spec's "bare payload"
fallback policy (cf. `mcp-ui-spec` README → §Runtime Payload Identity).
Host apps that pre-process payloads before passing them to a renderer
(e.g. wrapping a bare chart config into a layout) should reuse this
helper instead of generating `Date.now()` or counter-based ids — those
break `<For>` reconciliation and double-mount detection.

### Added — opt-in duplicate-mount observability

`<UIResourceRenderer>` now exposes two ways for consumers to detect
when the same content key is mounted concurrently more than once :

1. **Per-instance callback** :

   ```tsx
   <UIResourceRenderer
     content={layout}
     onMountDuplicate={({ key, count, firstMountedAt }) => {
       console.warn('[app] duplicate mount', { key, count })
     }}
   />
   ```

2. **Module-level reporter** (app-wide telemetry) :

   ```ts
   import { setDuplicateMountReporter } from '@seed-ship/mcp-ui-solid'

   setDuplicateMountReporter(({ key, count }) => {
     telemetry.warn('mcp-ui.duplicate-mount', { key, count })
   })
   ```

The new `debugDuplicateMounts` prop forces a `console.warn` from a
single instance even when the global `setDebugMode()` flag is off —
useful when you want to diagnose one suspect surface without flipping
the global switch.

**The renderer never deduplicates visually on its own.** Hiding a 2nd
mount would mask parent-framework bugs and could remove legitimate
co-mounts (drawer + main panel showing the same card). Consumers who
want dedup implement it on top of the reported events.

### Added — `data-mcp-ui-{layout|component}-id` DOM attributes

Every `<UIResourceRenderer>` wrapper now carries a stable identity
attribute :

- The outer wrapper carries `data-mcp-ui-layout-id` when `content` is
  a `UILayout` (composite), or `data-mcp-ui-component-id` when `content`
  is a single `UIComponent`.
- Each per-component wrapper inside a layout carries
  `data-mcp-ui-component-id`.

This enables CSS targeting, debug overlay tooling, and DOM-based
double-mount detection without a wrapper :

```js
document.querySelectorAll('[data-mcp-ui-layout-id="dashboard-q3"]').length
// → 2 (whoops — somewhere in the parent framework, this is mounted twice)
```

### Internal — no `Date.now()` in identity-bearing code paths

Audit confirmed : every `Date.now()` call inside `mcp-ui-solid` is for
telemetry timestamps (`ts: Date.now()`), cache TTLs, or download-filename
fallbacks — none feed into a rendered DOM `id` or a key passed to
`<For>`. The new `getUiResourceStableKey` helper preserves this
invariant by hashing content rather than reading the clock.

### Spec companion — `mcp-ui-spec@5.0.6`

Documentation-only patch bump : the spec README now formalizes the
runtime-payload identity contract (§Runtime Payload Identity) — `id`
obligation, fallback policy, and pointer to `getUiResourceStableKey`.

## [6.4.0] - 2026-05-03

Closes axe 3 of `deposium_solid`'s
`SOLID-MCPUI-IMPROVEMENT-AXES-2026-05-03.md` handoff.

### Changed — Export menus now mount via `<Portal>`

Both Export dropdowns shipped by the renderers — the `TableRenderer`
(`Copy TSV / Download CSV / Download JSON`) and the `GraphRenderer`
(`Download PNG / Download Mermaid / Download JSON`) — now render via
`solid-js/web` `<Portal>` on `document.body` instead of an in-tree
`position: absolute` sibling.

This fixes two long-standing pain points :

1. **`overflow: hidden` clipping** — when the table or graph lives
   inside a chat bubble, a card, or any ancestor with `overflow: hidden`,
   the legacy in-tree menu got clipped at the ancestor's boundary.
   Mounting on `document.body` escapes the clip stack entirely.
2. **`z-index` wars** — chat surfaces stack composer / message rails
   above the message list, and ancestor `z-index` creates a new stacking
   context that captured the in-tree menu. A portal is a sibling of the
   document, so a single `z-index: 9999` wins.

Pre-v6.4.0 deposium had to ship a `overflow: visible !important`
override + 4 `z-index` overrides on its `ChatUIIsland.tsx` to work
around this. Both can now be removed.

### Added — `<PortalDropdownMenu>` (factored helper)

The portal-mounting + click-outside + Escape + scroll/resize
re-positioning logic is factored into a generic component for reuse.
Exported under both `@seed-ship/mcp-ui-solid` root and
`@seed-ship/mcp-ui-solid/components` :

```tsx
import { PortalDropdownMenu } from '@seed-ship/mcp-ui-solid'

const [open, setOpen] = createSignal(false)
let triggerRef: HTMLButtonElement | undefined

<button ref={triggerRef} onClick={() => setOpen(true)}>Menu</button>
<PortalDropdownMenu open={open()} onClose={() => setOpen(false)} trigger={triggerRef}>
  <button onClick={...}>Item 1</button>
  <button onClick={...}>Item 2</button>
</PortalDropdownMenu>
```

### Non-breaking

The behavior change is transparent to consumers — the menu still opens
and closes from the same trigger button, with the same items. Tests :
7 added in `PortalDropdownMenu.test.tsx` (mount target, position from
`getBoundingClientRect`, outside click + Escape close, trigger /
in-menu mousedown ignored).

## [6.3.1] - 2026-05-03

### Added — `<UIResourceRenderer toolbarVariant>` forwarding

Forwards the `toolbarVariant?: 'hover' | 'always-visible'` prop introduced
on `<ExpandableWrapper>` in v6.3.0 down through `<UIResourceRenderer>` to
every internal renderer that wraps `<ExpandableWrapper>` :

- `TableRenderer` (in `UIResourceRenderer.tsx`)
- `ChartJSRenderer` (native chart path)
- `GraphRenderer`
- `MapRenderer`
- `VideoRenderer`
- `CarouselRenderer`
- `ImageGalleryRenderer`
- `CodeBlockRenderer`

```tsx
<UIResourceRenderer content={layout} toolbarVariant="always-visible" />
```

Pre-v6.3.1, consumers had to wrap `<ExpandableWrapper>` themselves to
configure variant. Now the surface-level renderer accepts it and
propagates uniformly. Default behavior (hover-only) unchanged.

### Non-breaking

Additive prop. All v6.3.0 APIs unchanged. 3 tests added in
`UIResourceRenderer.fluidity.test.tsx` (default + `'always-visible'` +
explicit `'hover'`).

## [6.3.0] - 2026-05-03

Two consumer-friendly props driven by `deposium_solid`'s
`SOLID-MCPUI-IMPROVEMENT-AXES-2026-05-03.md` handoff (axes 1 + 4).

### Added — `TableComponentParams.maxHeight` (axe 1)

Opt-out for the inline-mode max-height cap. The library defaults a
`max-height: 400px` (or 500px when virtualizing) on tables with > 8
rows so they don't blow out a chat-stream layout. When the consumer's
wrapping container handles overflow, that cap is undesirable — it
forces an internal scroll even with plenty of room.

```ts
TableComponentParams = {
  // ...existing
  maxHeight?: 'auto' | number | string
  //   'auto' → no cap, parent handles overflow
  //   number → `${n}px`
  //   string → CSS length as-is
  //   undefined → existing 400/500px heuristic
}
```

Ignored in expanded (fullscreen) mode — the modal uses
`flex-1 min-h-0` regardless.

Spec dep bump : `@seed-ship/mcp-ui-spec` `^5.0.4` → `^5.0.5`.

### Added — `<ExpandableWrapper toolbarVariant>` (axe 4)

Visibility behavior of the inline expand button :

- `'hover'` (default — backwards compat) : opacity 0, fades to 0.7 on
  parent group hover. Pre-v6.3.0 behavior.
- `'always-visible'` : opacity 0.6 permanent, 1 on hover. Use when the
  inline button needs to be discoverable without hovering — esp. on
  touch surfaces and consumer themes where the hover-only pattern
  hides the affordance.

### Non-breaking

Both additions opt-in. All v6.2.0 APIs unchanged. No tests added —
backwards-compat path covered by existing 583 tests, manual
verification confirmed.

### Out of scope (for follow-up)

- **Axe 2 — dark-theme native (CSS vars)** : ~120 lines of overrides
  côté deposium ; needs design pass + brief. Targeted v7.0.0.
- **Axe 3 — Portal dropdowns** : 3 dropdowns to migrate (chart, table,
  graph). Targeted v6.4.0.

## [6.2.0] - 2026-05-03

Cross-renderer fluidity audit — completes the work started in v6.1.0
across 5 more renderers. Same UX pattern : `<ExpandableWrapper>` for
fullscreen, copy data via the modal-header copy button, responsive
expanded mode, format-specific export when relevant.

### Added — fullscreen + copy/export on 4 more renderers

- **`<MapRenderer>`** : wrapped in `<ExpandableWrapper>`. Copy data
  exports markers as a **GeoJSON FeatureCollection** (`{ type:
  'FeatureCollection', features: [...] }`). Both `[lat, lng]` tuple and
  `{lat, lng}` object marker positions are normalized. When toggled
  to fullscreen, the Leaflet container is given a tick to reflow then
  `mapInstance.invalidateSize()` is called so tiles re-render at the
  new size.
- **`<VideoRenderer>`** : wrapped, copy = video URL. Aspect ratio
  preserved inline ; when expanded, the container fills (aspect
  override) so the video occupies the modal.
- **`<CarouselRenderer>`** : wrapped, copy = items as JSON. When
  expanded, the carousel fills the modal vertically (items keep their
  horizontal scroll-snap layout, more visible at fullscreen size).
- **`<ImageGalleryRenderer>`** : wrapped, copy = newline-separated
  URL list (with captions when present, tab-separated). When
  expanded, the gallery grid fills the modal and gets its own
  internal scroll instead of the modal scrolling.

### Added — `<CodeBlockRenderer>` search + download

- **Search input** in the header — incremental highlight via the same
  `highlightQuery` helper `<TableRenderer>` uses. Wraps `<mark>`
  around matches in the already-syntax-highlighted HTML output (no
  conflict with hljs spans).
- **Download button** in the header — saves the code as a file with
  the right extension picked from `params.language` (covers ts/tsx,
  js/jsx, py, rb, go, rs, java, kt, swift, php, cs, cpp, c, sql,
  json, yml, toml, sh, html, css, scss, md, xml, graphql ; falls
  back to `.txt`). Filename uses `params.filename` when present,
  else `code-<timestamp>.<ext>`.
- Responsive expanded mode : the code area drops its `maxHeight` and
  uses `flex-1 min-h-0` so the syntax-highlighted code fills the
  modal vertically with internal scroll.

### Tests

- `ImageGalleryRenderer.test.tsx` — 2 existing button-count tests
  updated to filter by class so they ignore the new
  `<ExpandableWrapper>` expand button (was counting all buttons).
- All v6.1.0 tests untouched. Total : 583 passed / 1 skipped / 584.

### Non-breaking

- All v6.1.0 APIs unchanged.
- All renderers accept the same params as before. Apps that didn't
  use the expand / copy / search / download features see no
  behavior change.

### What's NOT in this release

- ImageGallery ZIP-all download (would add JSZip dep — heavy).
- Map PNG snapshot export (would add leaflet-image plugin — heavy).
- ImageGallery / Map / Video search (low ROI vs other priorities).

These can come in v6.3.0+ if user demand surfaces.

## [6.1.0] - 2026-05-03

UX consistency / fluidity release. Three small but visible
behaviors that were inconsistent across renderers : fullscreen sizing,
chart export discoverability, table search discoverability.

### Fixed — fullscreen sizing for chart, table, graph

Pre-v6.1.0 bug : when the user clicked the expand button on a chart /
table / graph and went fullscreen, the visualization stayed at its
inline default size (`250px` for chart canvas, `400px` for graph,
`max-height: 400px` for non-virtualized tables, `500px` for
virtualized) instead of filling the modal. Tables in particular added
an inner scroll bar at less than half of the available modal height.

Cause : renderers had hard-coded heights and did not subscribe to
`useExpanded()` from `<ExpandableWrapper>`.

Fix :
- `<ExpandableWrapper>` modal slot adds `flex flex-col` so aware
  children can opt into `flex-1 min-h-0` to fill vertically. Unaware
  children keep working via the existing `overflow-auto` fallback.
- `<ChartJSRenderer>` (native canvas) : when expanded, outer card
  becomes `flex-1 min-h-0 flex flex-col`, canvas wrapper drops the
  fixed pixel height for `height: 100%`. Chart.js
  `responsive: true` + `maintainAspectRatio: false` (already set)
  triggers redraw on container resize.
- `<TableRenderer>` : when expanded, the wrapping card and inner
  padding container both become flex columns, the scroll container
  drops its `max-height` and uses `flex-1 min-h-0` to fill — so the
  internal table body scroll happens inside the visualization, not
  on the modal.
- `<GraphRenderer>` : same pattern as chart — outer card flex-fills,
  G6 canvas container becomes `height: 100%` when expanded. G6
  resize listener picks up the new size automatically.

Inline mode (not expanded) is **unchanged** — same heights, same
scroll heuristics as before.

### Changed — table search input default-on

`<TableRenderer>` : the search input was opt-in via `searchable: true`
or auto-shown only when rows > 10. Now visible by default :

```ts
// before — search hidden on small tables
const isSearchable = () =>
  tableParams.searchable === true ||
  (tableParams.searchable !== false && allRows().length > 10)

// v6.1.0 — opt-out only
const isSearchable = () => tableParams.searchable !== false
```

Backward compat : explicit `searchable: false` still hides the input.
Tables with `searchable: true` (was already on) unchanged. The change
only affects tables with no `searchable` prop and ≤ 10 rows — they
now show search.

### Changed — chart export button default-on + JSON copy added

`<ChartJSRenderer>` : the PNG export button was opt-in via
`exportable: true`. Now visible by default unless explicitly disabled :

```ts
// before
<Show when={params().exportable}>

// v6.1.0
<Show when={params().exportable !== false}>
```

Plus a new **copy data (JSON)** button is now wired into the
`<ExpandableWrapper>` header (visible in the fullscreen modal). Clicks
copy `{ type, data }` of the chart to the clipboard — useful for
debugging / re-emitting / sharing in markdown.

Backward compat : explicit `exportable: false` still hides the button.
Charts with `exportable: true` unchanged. Charts with no prop now show
the button (was hidden).

### Tests

- `src/components/UIResourceRenderer.fluidity.test.tsx` — **+5 tests**
  covering : search visible by default on small + large tables, search
  hidden when explicitly opted out, chart renders without throwing
  when exportable is undefined or false. Responsive expanded-mode
  tests left to manual verification (the modal Portal subtree is
  awkward to assert in jsdom).
- All previous 578 tests untouched. Total : **583 passed / 1 skipped /
  584 total**.

### Non-breaking

- All v6.0.0 APIs unchanged.
- Apps that were relying on the auto-hide of search / export get them
  shown now — opt out with `searchable: false` / `exportable: false`
  if undesired.

### What's NOT in this release (future "after" audit)

The user request was scoped to chart + table responsive + the export
discoverability gaps. A broader cross-renderer audit (map, image-
gallery, video, code, carousel — for consistent copy/export +
fullscreen + search behavior) is deferred to a follow-up release.
Notable known gaps :
- `<MapRenderer>` is NOT yet wrapped in `<ExpandableWrapper>` (no
  fullscreen, no copy/export).
- `<ImageGalleryRenderer>`, `<VideoRenderer>`, `<CarouselRenderer>`
  have no integrated copy/export menus.

## [6.0.0] - 2026-05-02

Major version marker — no API breakage. Bumps to `v6` to signal a
substantial wave : closure of B.1 (14/17 ComponentTypes spec-driven via
v5.5.x), shipping of B.5 telemetry sink (v5.6.0), citation chips in
table cells (v5.7.0), and now the new **`'graph'` ComponentType** below.
Existing consumers can upgrade `5.x → 6.0.0` with **zero migration
steps**.

### Added — `'graph'` ComponentType (peer `@antv/g6 ^5`)

Generic node-link visualization primitive. Domain-neutral by design —
the renderer ships agnostic ; consumers wire meaning via `node.weight` /
`edge.weight` / `node.data` / `edge.data` and the layout choice.

- **`<GraphRenderer>`** — new component. Lazy-loads `@antv/g6 ^5` only
  on first mount (mirrors `<ChartJSRenderer>` + `<MapRenderer>`
  patterns). Apps that don't install the peer see an informative
  yellow fallback ("install @antv/g6 to render type: graph") instead
  of a crash.
- **`isG6Available()`** exported — runtime check for the peer.
- **7 layout enum** (`force`, `dagre`, `mindmap`, `tree`, `circular`,
  `grid`, `concentric`) plus passthrough object form
  `{ type, options }` for the full G6 layout knob set.
- **Default layout heuristic** when `params.layout` is omitted :
  `'force'` if edges present, `'circular'` otherwise.
- **Default behaviors** : drag-canvas + zoom-canvas + drag-element +
  click-select. Each opt-out via the corresponding `enable*` prop.
- **Default tooltip** enabled (label + compact JSON of `node.data` on
  hover) ; opt-out via `tooltip: false`.

### Added — copy + export menu on graph (UX fluidity)

Every graph mounts with a copy + 3-format export menu — same UX
philosophy as `<TableRenderer>` :

- **Copy (default, top-right CopyButton via `<ExpandableWrapper>`)** —
  copies the structured `{ nodes, edges }` JSON to clipboard. Most
  useful for re-emitting / debugging.
- **Export menu** :
  - **PNG** — visual snapshot via the underlying canvas/SVG. Click →
    download.
  - **Mermaid** — `flowchart LR` (or `TD` for hierarchical layouts)
    syntax with `weight · label` edge decorations. Markdown / GitHub
    rendering friendly.
  - **JSON** — pretty-printed `{ nodes, edges }`, reimportable.

Helpers exported for consumers building their own export menus :
**`graphToMermaid(params)`** + **`graphToJSON(params)`**.

### Spec dep bump

- `@seed-ship/mcp-ui-spec` `^5.0.3` → `^5.0.4` (adds the Graph schemas
  and `'graph'` to `ComponentTypeSchema`). All other prior schemas
  unchanged.

### Validation wiring

- `'graph'` added to `KNOWN_COMPONENT_TYPES` and to `SPEC_VALIDATORS`
  with legacy code `INVALID_GRAPH`. The spec's
  `GraphComponentParamsSchema.nodes.min(1)` is the only structural
  invariant ; edge `source` / `target` ids are not cross-checked
  against nodes (LLM payloads sometimes ship dangling refs ; G6 v5
  ignores them gracefully).

### Tests

- `src/components/GraphRenderer.test.tsx` — **+17 tests** (1 skipped
  intentionally, see test file comment) :
  - `graphToJSON` shape preservation (3)
  - `graphToMermaid` syntax for both flowchart directions, label
    decorations, escape handling, edge cases (9)
  - `<UIResourceRenderer>` integration : `'graph'` recognized,
    INVALID_GRAPH on empty nodes, valid full payload, layout object
    form passthrough (4)
- `src/components/GraphRenderer.fallback.test.tsx` — **+2 tests** with
  `vi.mock('@antv/g6')` forcing the peer unimportable to verify the
  yellow fallback UI + clean mount/unmount cycle.
- All previous 560/560 untouched. Total : **578 passed / 1 skipped /
  579 total**.

### Telemetry integration (free)

`<GraphRenderer>` mounts inside the existing `ComponentRenderer` flow,
so the `MCPUITelemetryProvider` (v5.6.0) automatically receives
`component:mounted` / `component:rendered` / `component:unmounted`
events for graphs with `componentType: 'graph'` — no extra wiring
needed.

### Migration

- 100% backward compatible. No existing API changed.
- Apps not installing `@antv/g6` see a fallback message on `type:
  'graph'` payloads ; everything else renders identically.
- Apps installing `@antv/g6 ^5` get graph rendering immediately.
- The major bump (5.7.0 → 6.0.0) is a milestone marker, not a
  semver-breaking signal. No code change required to upgrade.

## [5.7.0] - 2026-05-02

### Added — citation chips inside table cells (opt-in)

Implements `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md`. Lifts the chip-rendering responsibility out of consumer apps (deposium had a server-side bridge in `deposium_MCPs` commit `7df433ae` that this obsoletes) so any host stops mirroring chip HTML byte-for-byte.

- **`TableComponentParams.citationMap`** (optional, JSON-serializable) — `Record<string|number, { page, file?, file_id? }>`. When present, `<TableRenderer>` walks each cell string and replaces LLM `[N]` / `Citation [N]` / `[CITATION N]` / `[📄 CITATION N]` markers with chip HTML carrying `data-citation-page` + `data-citation-doc` + `data-citation-verified` attrs. Hosts can route clicks via `target.closest('[data-citation-page]')` delegation — same path as inline-markdown chips.
- **`TableComponentParams.citationRender`** (optional, function — NOT JSON-serializable, consumer-wired) — override returning sanitized chip HTML for one marker. Wins over the default chip shape.
- **`renderCellValue(value, citationCtx?)`** — new optional 2nd arg. Standalone use (outside `<TableRenderer>`) supported : same opt-in behavior, same DOMPurify whitelist guarantees.
- **`CitationCtx`** + **`CitationEntry`** types exported from the package root.
- **`defaultCitationChip()`** uses neutral Tailwind classes (`bg-gray-800 text-gray-500 border-gray-600 hover:border-teal-500`) layered with the `.citation-ref` CSS class — hosts already styling `.citation-ref` for their inline chips get visual consistency for free, no per-table override needed.

Markdown composition : cells like `**MSP** [1]` produce `<strong>MSP</strong>` AND a chip in the same cell. The hasMarkdown / hasHtml branches in `renderCellValue` were re-ordered + DOMPurify whitelists extended so chip HTML survives both paths.

Resolution rules :
- Resolved id (in map) → default chip shape `[file - page]` + button with citation attrs.
- Unresolved id with **non-empty** map → marker dropped silently (likely LLM hallucination, mirrors typical host behavior).
- Unresolved id with **empty** map → human-visible `[réf. N]` placeholder.
- `[p.5]` page form → preserved (negative lookbehind).
- `[text](url)` markdown link → preserved (existing branch runs first).

CSV export of cells with citations : raw markers (`[1]`) flow through unchanged. The chip HTML is only injected at render time; the CSV path uses the original `row[key]` value, which is the right choice for re-importable exports.

### Changed

- Dep bump : `@seed-ship/mcp-ui-spec` `^5.0.2` → `^5.0.3` (adds `CitationEntrySchema` + `TableComponentParamsSchema.citationMap` for cross-stack type safety).

### Tests

- `src/components/TableRenderer.citation.test.tsx` — **+15 tests** covering : no-ctx regression, single + multi chip emission, unresolved id (non-empty + empty map paths), `citationRender` override, `[p.5]` skip, markdown-link skip, mixed `**bold** [1]` compose, canonical marker shortcut, DOMPurify attr survival, button element check, plus 3 integration tests on a real `<UIResourceRenderer>` mount (no map → plain text, with map → chips in DOM, render override → custom chips).
- Existing 545/545 tests untouched, all still pass.
- Total solid suite : **560/560 tests pass** (vs 545 on v5.6.0, +15 net).

### Migration

- 100% backward compatible. `citationMap` not set → cells render exactly as before.
- Hosts opt in by adding `citationMap: gaResult.citation_map` to their table params.
- deposium_MCPs can now revert commit `7df433ae` (server-side `renderCitationChipHTML` + `replaceCitationsInCellHTML` helpers) and emit raw `[📄 CITATION N]` markers in cells with `params.citationMap` set — chip rendering happens client-side.

## [5.6.0] - 2026-04-27

Closes B.1 migration (14/17 ComponentTypes spec-driven) AND ships B.5 — UI
telemetry sink, both per deposium audit `MCP-UI-AUDIT-2026-04-26.md` §M.

### Added — B.5 UI telemetry sink

- **`<MCPUITelemetryProvider sink options>`** + **`useTelemetry()`** hook + **`MCPUITelemetryContext`**. Provider is **OPTIONAL** — when absent, all dispatch sites no-op (zero behavior change for apps that don't opt in).
- **`createTelemetryDispatcher(sink, options)`** exposed for advanced usage / SSR contexts / testing without a Provider.
- **`TelemetryEvent`** discriminated union (6 event types) :
  - `component:mounted` (id + componentType + ts)
  - `component:rendered` (+ durationMs, read from existing v5.4.0 perf marks — no double measurement)
  - `component:unmounted`
  - `validation:failed` (+ errorCount + firstErrorCode — **NO** payload data, **NO** error messages)
  - `render:error` (+ errorMessage from `<GenerativeUIErrorBoundary>` — **NO** stack trace, **NO** payload)
  - `action:dispatched` (+ actionName from `<ActionRenderer>` clicks and `<FormRenderer>` submits — **NO** form values)
- **`TelemetryOptions`** : `sampleRate` (default 1.0), `bufferMs` (default 100), `bufferMax` (default 50), `sampleByType` (per-event-type override — e.g. `{ 'render:error': 1.0 }` to keep all errors while sampling mounted/rendered at 0.1).
- **Sink contract** : receives a **batch** (`TelemetryEvent[]`) — even with `bufferMs: 0` (single-element array). **FAIL-OPEN** : sink throws or rejects silently, never crashes the renderer.
- **Privacy hard rule** : no event carries the component params / data brut, only meta + types + counts + timing. Safe to log centrally.
- New file `src/services/telemetry.ts` (dispatcher) + `src/context/MCPUITelemetryContext.tsx` (Provider).

### Changed — B.1 final migration (map + form to Zod)

- **Dep bump** : `@seed-ship/mcp-ui-spec` `^5.0.1` → `^5.0.2` (relaxed map.center to LatLngPoint union + form field.name regex per deposium audit §L answers).
- `validation.ts` : **`map` and `form` joined `SPEC_VALIDATORS`** dispatch. Closed B.1 to **14/17 ComponentTypes** Zod-driven. The remaining 3 (`chart`, `table`, `modal`) stay imperative as documented (rich validators / nothing to validate).
- `map` post-spec chained check preserved : "center OR markers" rule stays imperative because Zod can't express it without `.refine()` overhead.
- Legacy codes preserved via mapper : `EMPTY_FORM`, `INVALID_MAP` still emitted on failure.

### Tests

- `src/services/telemetry.test.ts` — **+10 tests** for dispatcher (batch delivery, buffering, bufferMax force-flush, manual flush idempotency, fail-open on throw + on rejected promise, sampling 0/1/per-type override).
- `src/context/MCPUITelemetryContext.test.tsx` — **+5 integration tests** (no Provider = no events, mounted dispatch, validation:failed shape with privacy assertion on key set, fail-open on render, sampleRate=0 drops everything).
- Existing 530/530 tests untouched, all still pass.
- Total solid suite : **545/545 tests pass** (vs 530 on v5.5.1, +15 net).

### Non-breaking

- All v5.5.x APIs unchanged.
- Apps without `<MCPUITelemetryProvider>` see **zero behavior change**.
- Only newly-added shapes (`{lat,lng}` for map, `kebab-case` / dot-paths for form field names) accepted that were previously rejected — no shape that worked before is rejected now.

### What deposium can now do

1. Wrap their app : `<MCPUITelemetryProvider sink={batchedSinkToBackend}>`.
2. Implement the consumer-side `/admin/ui-telemetry` endpoint (~3-4h per §M.6.4).
3. Aggregate in their dashboard : P50/P95 render durations per ComponentType, top validation:failed codes, action dispatch counts.

## [5.5.1] - 2026-04-27

### Security — Iframe whitelist bug fix

- **`validateIframeDomain` predicate bug** : `services/validation.ts:572` checked `allowed === 'localhost'` (the whitelist entry being literally the string `'localhost'`) instead of `domain === 'localhost'` (the URL's hostname being localhost). Once `'localhost'` was added to `DEFAULT_IFRAME_DOMAINS` (Sprint 0+, present since the beginning), the whitelist became **fully inoperative** — every external URL passed the check. Affected all iframe + video components rendered through `<UIResourceRenderer>` / `<StreamingUIRenderer>`.
- **Fix** : loopback (`localhost` and `127.0.0.x`) is detected on the URL's hostname only ; the literal `'localhost'` whitelist entry is skipped from the iteration. Whitelisted domains + their subdomains continue to pass as before.
- **Impact** : pre-v5.5.1, an LLM-generated iframe with `https://evil.example.com/x` would render. Post-v5.5.1, it's rejected with `DOMAIN_NOT_WHITELISTED` (the existing code, behavior now actually fires).
- **Backward compat** : Apps using `<iframe url="https://..." />` with **legitimately whitelisted** URLs are unaffected. Apps relying on the bug to display arbitrary iframes will now see them rejected — workaround is `iframePolicy: 'extend'` + `customIframeDomains: [...]` or `iframePolicy: 'allow-all'` (latter for trusted contexts only).

### Tests

- `services/validation.test.ts` : new `describe('validateIframeDomain — security regression (v5.5.1)')` block — 8 tests locking in the correct behavior (rejects external + typo-squat domains, accepts whitelist + subdomains + localhost + 127.0.0.x, respects `allow-all` and `extend` policies).
- 2 test cosmetics: `chartType` typo → `type` at `validation.test.ts:50`, `artifact` moved from `PASSTHROUGH_TYPES` to `VALIDATED_TYPES` (it has its own case since v5.5.0).
- Total solid suite : **530/530 tests pass** (vs 523 on v5.5.0, +7 net).

## [5.5.0] - 2026-04-27

B.1 PR2 — `services/validation.ts` migration vers Zod schemas spec-driven (cf. audit deposium `MCP-UI-AUDIT-2026-04-26.md` §I + greenlight §J). **Non-breaking, aucune migration consumer requise.**

### Changed — validation refactor (B.1 PR2)

- Nouvelle dépendance : **`@seed-ship/mcp-ui-spec` ^5.0.1** (workspace).
- `validateComponent()` consomme désormais les Zod schemas exportés depuis `mcp-ui-spec` pour **12 ComponentTypes sur 17** : `metric`, `text`, `iframe`, `image`, `link`, `action`, `video`, `carousel`, `image-gallery`, `action-group`, `code`, `artifact`.
- Mapper interne **`mapZodIssuesToErrors(issues, legacyCode)`** : convertit `ZodIssue[]` → `ValidationError[]` en préservant le `code` legacy par type (`INVALID_METRIC`, `EMPTY_CAROUSEL`, etc.). **L'API publique `validateComponent()` retourne exactement la même shape `{valid, errors: [{path, message, code}]}` qu'avant** — voir audit §J.1 (deposium a confirmé que `errors[].code` n'est lu nulle part en logique métier).
- Path Zod normalisé : `params.<joined>` (ex. `params.title`, `params.data.datasets`) — cohérent avec les chemins legacy.
- 5 ComponentTypes restent **délibérément sur le path impératif** :
  - `chart` + `table` — leurs validateurs (`validateChartComponent`, `validateTableComponent`) font cross-field consistency + resource limits + codes riches (`MISSING_DATA`, `DATA_LENGTH_MISMATCH`, `DUPLICATE_COLUMN_KEY`...) que Zod ne peut pas exprimer aussi proprement.
  - `form` — `FormComponentParamsSchema` du spec a une regex stricte sur les noms de fields qui pourrait rejeter des payloads LLM valides. Conservatisme.
  - `map` — spec exige `center: tuple([number, number])` mais la prod accepte `{lat, lng}` objects. Backward-compat.
  - `modal` — tous params optionnels, rien à valider.

### Fixed — Artifact validation drift (side-effect)

- **Pré-v5.5.0 bug** : `validation.ts` exigeait `params.content` (code `INVALID_ARTIFACT`) mais `<ArtifactRenderer>` consomme `url + filename + mimeType`. Tout artifact rendu valide échouait la validation, et tout artifact "validé" ne pouvait pas être rendu.
- **Fix** : la migration vers `ArtifactComponentParamsSchema` aligne automatiquement la validation sur ce que le renderer attend (`url + filename + mimeType` requis, `size` ≥ 0, `description` optionnel).
- Code legacy `INVALID_ARTIFACT` préservé pour les consumers qui filtrent dessus.

### Preserved — Resource limits + iframe whitelist (sécurité)

Explicitement **gardés impératifs**, hors scope de la migration Zod :
- `validatePayloadSize` (max 50KB par défaut)
- `validateChartComponent` data points limits (max 1000 par défaut)
- `validateTableComponent` row limits (max 100 par défaut)
- `validateIframeDomain` + `DEFAULT_IFRAME_DOMAINS` whitelist (~45 domaines)
- `getIframeSandbox` tiered sandbox flags

Ces couches sont chaînées **après** le spec parse (cf. `iframe` + `video` → spec parse réussi → domain whitelist).

### Build pipeline (mcp-ui-spec @ 5.0.1+)

Bonus : remplacement du `scripts/generate-dts.js` hand-rolled (qui ne déclarait que 9 schemas sur ~30) par `tsc -p tsconfig.build.json --emitDeclarationOnly`. Les 30+ schemas sont maintenant tous correctement déclarés dans `dist/schemas.d.ts` automatiquement. Élimine une dette de maintenance.

### Tests

- `services/validation.test.ts` (49 tests) — **inchangé**, passe tel quel → preuve que l'API externe est préservée.
- `services/validation.spec-migration.test.ts` — **+18 nouveaux tests** ciblant explicitement v5.5.0 :
  - Mapper preserve legacy `code` per type (12 types vérifiés)
  - ZodIssue path → `params.<joined>` translation
  - Artifact bug fix (url+filename+mimeType requis, plus content)
  - Iframe + video chain : spec parse réussi → domain check, parse failed → SKIP domain check (no cascade)
  - Imperative passthrough types préservent leurs codes riches (`MISSING_DATA`, `EMPTY_COLUMNS`, `EMPTY_FORM`, etc.)
  - Invariants : `UNKNOWN_COMPONENT_TYPE`, `MISSING_PARAMS`, `INVALID_GRID_COL_START` toujours émis

Suite totale solid : **523/523 tests pass** (vs 505 sur v5.4.0).

### Cross-stack — bénéfice deposium

Avec spec@5.0.1 + solid@5.5.0, deposium peut maintenant factoriser sa validation cross-stack :
```ts
import { ChartComponentParamsSchema } from '@seed-ship/mcp-ui-spec'
// Côté MCPs (backend) : valider extracted_charts à la source
// Côté Solid (frontend) : héritage automatique via mcp-ui-solid
```

### Non-breaking guarantee

- API `validateComponent()` shape **identique** : `{ valid: boolean, errors?: Array<{path, message, code}> }`.
- Tous les codes legacy préservés via le mapper (51 codes existants).
- Resource limits + iframe whitelist + sandbox flags **inchangés**.
- Seul changement de comportement observable : `artifact` accepte maintenant les payloads que le renderer rend réellement (bug fix).

## [5.4.0] - 2026-04-26

Combo non-breaking d'observabilité + UX, motivé par l'audit deposium_MCPs `MCP-UI-AUDIT-2026-04-26.md` (items B.2 + B.3 + B.4).

### Added — B.2 Runtime debug mode

- **`setDebugMode(enabled: boolean | null)`** + **`isDebugEnabled()`** exportés depuis l'index. Permet d'activer le verbose logging sans recompilation, utile pour debugger une session prod (Docker dev avec `NODE_ENV=production` notamment).
- 4 sources d'activation (OR logique) : `NODE_ENV !== 'production'` (existant), `process.env.MCP_UI_DEBUG === 'true'`, `globalThis.__MCP_UI_DEBUG__ === true`, ou `setDebugMode(true)`.
- `setDebugMode(null)` réinitialise à la détection env-based.
- `error()` log toujours, indépendamment du mode (inchangé).

### Added — B.4 Performance markers

- Nouveaux helpers **`markRenderStart(id)`** + **`markRenderEnd(id)`** + constante **`PERF_PREFIX`** (`'mcp-ui:component:'`) exportés depuis l'index.
- Câblés automatiquement dans `<UIResourceRenderer>` + `<StreamingUIRenderer>` autour de chaque `ComponentRenderer`. Émettent :
  - `mcp-ui:component:<id>:render-start`
  - `mcp-ui:component:<id>:render-end`
  - `mcp-ui:component:<id>:render` (un `performance.measure` entre les deux)
- Visibles automatiquement dans Chrome DevTools "Performance" panel sous user timings, sans config consumer.
- SSR-safe (`performance` est gardé) ; coût négligeable (<μs par mark).

### Added — B.3 `errorMode` prop sur les renderers

- Nouveau type **`ValidationErrorMode = 'block' | 'inline-warn' | 'silent'`** + nouvelle prop **`errorMode?: ValidationErrorMode`** sur `<UIResourceRenderer>` et `<StreamingUIRenderer>`.
- `'block'` (default, **backward-compatible**) : carte rouge "Validation Error" pleine slot — comportement pré-v5.4.0.
- `'inline-warn'` : chip jaune compact dans le slot, message d'erreur dans le tooltip + `aria-label`. Évite de polluer une conversation chat avec un gros bloc rouge.
- `'silent'` : aucun rendu visible (le slot reste vide). `onError` est appelé dans les 3 modes.
- Ne s'applique qu'au path **validation** (`validateComponent` failure). Les runtime errors capturées par `<GenerativeUIErrorBoundary>` continuent d'utiliser le fallback existant.

### Tests

- 3 nouveaux fichiers de tests : `src/utils/logger.test.ts` (10 tests), `src/utils/perf.test.ts` (5 tests), `src/components/UIResourceRenderer.errorMode.test.tsx` (6 tests).
- Suite totale : **505/505 tests pass** (vs. 484 sur v5.3.1).

### Non-breaking

- Aucun changement d'API existante. Les apps qui ne passent pas `errorMode` voient exactement le comportement v5.3.1.

## [5.3.1] - 2026-04-25

### Security

- Bump `dompurify` from `^3.3.3` → `^3.4.1` to resolve 4 open Dependabot advisories : SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode, FORBID_TAGS bypass via function-form ADD_TAGS, prototype-pollution → XSS via CUSTOM_ELEMENT_HANDLING fallback, and ADD_TAGS short-circuit FORBID_TAGS bypass. All fixed in 3.4.0.
- No API surface change. 484/484 tests pass.

## [5.3.0] - 2026-04-22

### Added — A. `<ElicitationForm>` schema-driven renderer

- **`<ElicitationForm event onAccept onCancel? onDecline? dismissLabel?>`** — thin wrapper over `<ChatPrompt>` + `elicitationToPromptConfig()` that accepts a spec-shaped `ElicitationEvent` (MCP 2025-06-18) and exposes a spec-shaped `onAccept(content)` callback whose payload is ready to send back as the `accept` outcome of an `elicitation/create` reply.
- Inverse mapping owned here : single boolean → `{ propName: true }`, single enum → `{ propName: enumValue }` (numeric coerced when schema is `integer`/`number`), multi-property form → values map passed through unchanged.
- Forward mapping (spec → ChatPromptConfig) reuses the existing `elicitationToPromptConfig` helper from v5.2.0 — same rules, same tests, no duplication.
- `dismissLabel="Decline"` + `onDecline` lets you surface an explicit decline action distinct from passive cancel.
- Type export : `ElicitationFormProps`.

### Added — B. `useServerCapabilities()` hook + store

- **`createServerCapabilitiesStore()`** factory + module singleton + **`<ServerCapabilitiesProvider>`** for multi-instance scoping (mirrors the v5.2.0 `scratchpad-store` pattern).
- **`setServerCapabilities(info)`** — push the parsed MCP `initialize` response into the singleton from your transport adapter.
- **`useServerCapabilities()`** — reactive accessor returning `{ info, capabilities, serverInfo, protocolVersion, hasCapability }`. Components can gate rendering on advertised capabilities (e.g. `<Show when={hasCapability('tools')}>`).
- Type exports : `ServerCapabilities`, `ServerInitializeInfo`, `ServerCapabilitiesStoreHandle`.
- Note : `elicitation` is a **client** capability per MCP spec 2025-06-18 — this store tracks **server** capabilities only. Gate `<ElicitationForm>` on your own client-side state, not on this store.

### Added — C. Recipe : pseudo-elicit → spec adapter

- New doc `docs/recipes/elicitation-pseudo-spec-adapter.md` — drop-in TypeScript adapter for consumer apps talking to MCP servers that ship a legacy "pseudo-elicit" payload inline with `tools/call` results (e.g. deposium_MCPs as of 2026-04). Adapter lives in the consumer app — mcp-ui stays vendor-agnostic by design.

### Added — D. Recipe : `<FeedbackInline>` wiring

- New doc `docs/recipes/feedback-inline-wiring.md` — concrete pattern for wiring `<FeedbackInline>.onSubmit` to a feedback HTTP endpoint, with the Deposium `POST /api/feedback` shape as a worked example. Mapping `'positive' | 'negative'` to the endpoint is direct.

### Tests

- New file : `components/ElicitationForm.test.tsx` (7 tests) — covers boolean/enum/numeric/multi-property accept paths, X-dismiss, confirm-cancel button, and `onDecline` precedence.
- New file : `stores/server-capabilities-store.test.tsx` (10 tests) — factory isolation, derived accessors, singleton fallback, provider scoping, reactive update propagation.

### Non-breaking

- All additions are optional and additive. v5.2.0 consumers upgrade with zero code changes.

### Aligned with deposium_MCPs

- v5.3.0 closes the items in mcp-ui's court per the `mcp-ui ↔ deposium_MCPs alignment 2026-04-22` doc :
  - Plan B B.3.5 unblock acknowledged (HTTP transport now bidirectional via SDK `StreamableHTTPServerTransport`).
  - Pseudo-elicit confirmed as stable legacy ; consumer-side adapter pattern now documented.
  - Feedback endpoint `POST /api/feedback` wire shape documented.
  - `<ElicitationForm>` and `useServerCapabilities()` deferred items shipped.

## [5.2.0] - 2026-04-22

### Added — D1 multi-instance scratchpad store

- **`createScratchpadStore()`** factory — returns an isolated `ScratchpadStoreHandle` (`dispatch`, `state`, `pinned`, `close`). Closes the v4.x known limitation that two `ScratchpadPanel` instances shared state.
- **`ScratchpadStoreProvider`** + **`ScratchpadStoreContext`** — scope a store to a SolidJS subtree. Accepts an optional `store` prop; creates one internally otherwise.
- **`useScratchpadState()` is now context-aware** — reads the provider's store when mounted inside one, falls back to the module singleton otherwise. Zero-breaking for v4.x single-instance consumers.
- Type export : `ScratchpadStoreHandle`.

### Added — D2 ChatPrompt controller primitive

- **`createChatPromptController()`** — one primitive owning resolver closure + `AbortSignal` wiring + re-entrance policy. Consumers go from ~20 LOC of hand-threaded resolver to `bus.commands.handle('showChatPrompt', ctrl.handle)` + `<Show when={ctrl.activePrompt()}>{cfg => <ChatPrompt ... />}</Show>`.
- **`PromptReplacedError`** — exported error class thrown when a new `showChatPrompt` arrives before the previous resolves. Use `instanceof` or `err.name === 'PromptReplacedError'`.
- **`AbortSignal` honoured** — already-aborted signals reject synchronously with `DOMException('Prompt aborted', 'AbortError')` without showing UI. In-flight aborts reject + clear `activePrompt`.
- **`ctrl.abort(reason?)`** — programmatic cancellation (route change, modal close, ...).
- Type export : `ChatPromptController`.

### Added — D5 per-message inline feedback

- **`<FeedbackInline>`** — per-message thumbs up/down, non-blocking, many can coexist. Complements `ChatPrompt` (modal one-at-a-time) and `ScratchpadPanel` feedback section (structured, panel-side). Optimistic UI, best-effort persistence via consumer-owned `onSubmit(rating, context)`.
- Type exports : `FeedbackInlineProps`, `FeedbackInlineContext`.

### Added — D6 MCP elicitation handling

- **`ChatEvents.onElicitation`** — new event for MCP `elicitation/create` requests (spec 2025-06-18). Symmetric to `onClarificationNeeded`.
- **Types** : `ElicitationEvent`, `ElicitationRequestedSchema`, `ElicitationPropertySchema`.
- **`elicitationToPromptConfig(event)`** — converts an MCP elicitation payload to a `ChatPromptConfig`. Smart mapping :
  - Single `boolean` property → `type: 'confirm'`
  - Single property with `enum` of ≤4 values → `type: 'choice'`
  - Anything else → `type: 'form'` with per-property field-type inference
  - Inferences : `string` → `text`, `string/format:email` → `email`, `string/format:date|date-time` → `date`, `number|integer` → `number`, `boolean` → `checkbox`, any `enum` → `select`.

### Tests

- **467 passing** (+29 vs v5.1.0).
- New files : `stores/scratchpad-store.test.tsx` (7), `services/chat-prompt-controller.test.ts` (7), `components/FeedbackInline.test.tsx` (7).
- Extended `services/chat-bus.test.ts` with 8 new elicitation tests.

### Non-breaking

- All additions are optional.
- `scratchpad-store.ts` refactored to extract a factory; module singleton remains as default so `dispatchScratchpad` / `useScratchpadState` keep working identically.

### Design rationale

Full scope doc lives in the Deposium project : `docs/2026/r&d/mcpui-v5.2.0-scope.md`. It regroups v5.1.0 consensus carry-forward (D1, D2) with two new items arising from the MCP SDK audit 2026-04-14 (D5 feedback inline, D6 elicitation helper).

### Deferred

- `<ElicitationForm>` schema-driven form renderer — waiting for real Claude Desktop payloads.
- `createChatPromptController` FIFO queue mode — YAGNI until a concrete need.
- `useServerCapabilities()` hook — needs a second consumer + Phase B protocol align on `capabilities.extensions`.
- OAuth client-side docs — add as a doc patch when Deposium moves to OAuth Resource Server.

## [5.1.0] - 2026-04-14

### Added — D4 custom choice rendering

- **`ChoicePromptConfig.optionRenderer?: (option, index) => JSX.Element`** — render prop for custom option bodies (confidence badges, rich metadata layouts, etc.). mcp-ui still wraps the returned JSX in the `<button>` with the `onClick` handler, keyboard support, and focus styles — only the *content* is yours.
- **`ChoicePromptConfig.buttonClass?: string`** — escape hatch appended to each option button's Tailwind classes for colour/border tweaks without a full `optionRenderer`.
- **`ChoicePromptConfig.containerClass?: string`** — escape hatch appended to the options wrapper's layout class.
- **Generic `ChoicePromptConfig<TMeta = Record<string, unknown>>`** — type parameter flows to `ChoiceOption<TMeta>` so consumers get strongly-typed `option.metadata` in their `optionRenderer` closure without casting. Default backward-compatible.
- **`ChoiceOption<TMeta>` type exported from the root package** — reusable shape for consumers building their own renderers or helpers.
- **Option buttons now have `type="button"`** — prevents accidental form submission when a `ChatPrompt` is nested inside an HTML `<form>`.

### Documented — D3 AbortSignal + re-entrance contract

- **`ChatPrompt.tsx` header JSDoc rewritten** — the v4.x doc claimed "Supports AbortSignal for cleanup on navigation" but the component never listened to any signal. v5.1.0 doc explicitly states that `ChatPrompt` is a pure presentation component and lifecycle (including abort) is the consumer's responsibility.
- **`ChatCommands.showChatPrompt` JSDoc rewritten** — documents the full implementer contract: no default handler, Promise wiring on `onSubmit`/`onDismiss`, `DOMException('AbortError')` rejection on `signal.aborted`, re-entrance auto-reject policy. Points at v5.2.0 `createChatPromptController()` as the future primitive.
- **README section `ChatPromptResponse — dismissed / aborted / answered`** — rewritten with a full reference wiring example covering re-entrance, `AbortSignal`, and the `DOMException('AbortError')` Web Platform convention. Consumer-side error branching example (`err.name === 'AbortError'`).

### Tests
- **438 passing** (+5 vs v5.0.0). New coverage in `ChatPrompt.test.tsx` for: default rendering unchanged when `optionRenderer` absent, custom renderer receives `option + index` + metadata, custom renderer button still wires `onClick`, `buttonClass` appended without dropping defaults, `containerClass` appended to wrapper, option buttons have `type="button"`.

### Non-breaking
- All additions are optional — existing consumers using `ChoicePromptConfig` as a plain interface with no generic parameter or new fields keep working identically.

### Deferred to v5.2.0 (unchanged)
- `createScratchpadStore()` factory for multi-instance scratchpad panels (D1).
- `createChatPromptController()` primitive centralising resolver lifecycle + re-entrance + abort (D2 + D3 code).
- `correlationId` natively threaded through `ChatPromptConfig` → `ChatPromptResponse`.
- Optional `progress_update` SSE event type for long-running agent pipelines.

See `/home/nico/code_source/tss/deposium_fullstack/docs/2026/r&d/mcpui-v5.1.0-consensus.md` for the full design discussion and the v5.1.0/v5.2.0 sequencing arbitration.

## [5.0.0] - 2026-04-14

### Major release — synchronized with `@seed-ship/mcp-ui-spec` 5.0.0 and `@seed-ship/mcp-ui-cli` 5.0.0

### Breaking
- **`ClarificationEvent.options[].file_id` removed from the TypeScript type** (deprecated in v4.3.9, removed in v5.0.0 as announced). The `clarificationToPromptConfig()` helper still migrates runtime `file_id` into `metadata.file_id` transparently, so host apps receiving payloads from older servers continue to work without upgrade pressure. New code should emit `metadata: { file_id }` directly.
- **`ChatPromptConfig.type = 'select'` and `SelectPromptConfig`** — already removed in 4.3.9 (the variant was declared in 4.0 but `ChatPrompt.tsx` never rendered it). Listed here for the v5 breaking recap.

### Changed
- Version bump 4.3.9 → 5.0.0 for the synchronized monorepo major release.
- Root `README.md` + monorepo `CHANGELOG.md` consolidated with the full 4.x → 5.0.0 history.

### Documented
- v5.1.0 scope: `createScratchpadStore()` factory (multi-instance scratchpad), re-entrant `showChatPrompt` (auto-reject / FIFO queue), `ChatPrompt` AbortSignal wiring, `optionRenderer?` slot on `ChoicePromptConfig`.

## [4.3.9] - 2026-04-14

### Added — Sprint 52 multi-agent primitives

#### Type additions (all non-breaking)
- **`ChoicePromptConfig.options[].metadata?: Record<string, unknown>`** (G1) — free-form metadata on prompt choices (confidence, source, tags...). Opaque to the default renderer, preserved through `showChatPrompt → ChatPromptResponse` roundtrip. Use a custom ChoiceBody wrapper to display it.
- **`ClarificationEvent.options[].metadata?: Record<string, unknown>`** (G3) — same extension point on clarification events. Legacy `file_id?: number` deprecated in JSDoc (removal in v5.0.0).
- **`ClarificationEvent.type?: string`** (G3) — free-form type tag for host routing (e.g. `'intent_disambiguate'`, `'file_select'`).

#### New helper: `clarificationToPromptConfig()` (G11)
- Universal bridge converting `ClarificationEvent` → `ChatPromptConfig` for any MCP-UI consumer
- Transparent `file_id` legacy migration into `metadata.file_id`
- Explicit `metadata.file_id` takes precedence over legacy field
- Agnostic — zero Deposium-specific concepts
- Exported from `@seed-ship/mcp-ui-solid`

#### New testing entry point: `createMockChatBus()` (G6)
- New sub-module `src/testing/` with `createMockChatBus({ promptResponses, onShowChatPrompt })`
- Pre-programs `showChatPrompt` responses in FIFO order for flow tests
- Spy hook on `onShowChatPrompt` for assertions
- Throws helpful error when the queue is exhausted

### Removed — dead code (G7)
- **BREAKING (theoretical, never implemented)**: `ChatPromptConfig.type = 'select'` removed from the union type. `SelectPromptConfig` interface removed + export dropped from `src/index.ts`. The `'select'` variant was declared in v4.0 but `ChatPrompt.tsx` never had a rendering branch — it was dead code. Use `'form'` with a single `select` field, or `'choice'` for visual picks.

### Documented — known limitations (G5, G8, G9, G10)
- **`ChatPromptResponse.dismissed`** (G5) — full semantics in JSDoc: X icon/Cancel → `true`, explicit click/submit → `undefined`, AbortSignal → Promise rejection (host responsibility until v4.4.0).
- **Scratchpad store is a singleton** (G8) — two `ScratchpadPanel` instances share state. Documented as known limitation. Factory `createScratchpadStore()` planned for v4.4.0.
- **`showChatPrompt` is not re-entrant** (G9) — calling it while another prompt is active leaks the previous Promise. Documented in JSDoc. Host apps must queue/dismiss manually. Auto-reject planned for v4.4.0.
- **`correlationId` is host-propagated** (G10) — README recipe. mcp-ui does not auto-forward the ID; host SSE parsers must thread it into subsequent event emissions.

### Documented — integration recipes (G2)
- **Bridging external clarification events** — new README section showing the `onClarificationNeeded → clarificationToPromptConfig → showChatPrompt` flow, with metadata preservation and opaque type tags.

### Documentation catch-up
- Backfilled `CHANGELOG.md` entries for 4.3.6, 4.3.7, 4.3.8 (previously missing).

## [4.3.8] - 2026-04-11

### Added
- **Search term highlighting** — matched query terms are wrapped in `<mark>` tags across all visible cells. `bg-yellow-200` in light mode, `bg-[#222F49]` in dark mode. New `highlightQuery` helper skips HTML tag content to preserve markup.

### Fixed
- **Fullscreen phantom scrollbar** — removed `h-full` from the table wrapper in expanded mode so it shrinks to content. No more empty space or unnecessary scrollbar when rows don't fill the viewport.

## [4.3.7] - 2026-04-11

### Changed
- **Prev/Next pagination is now the default** — replaced the progressive "show more" mode with unified Prev/Next navigation for consistency between chat and fullscreen views.
- **Page size selector in fullscreen** — dropdown with 10 / 30 / 60 / 100 / All options.
- **Fullscreen table fills the viewport** via `calc(100vh - 180px)`.
- **Header contrast** — thead background bumped from `bg-gray-50` to `bg-gray-100` for better visibility in chat view.

## [4.3.6] - 2026-04-11

### Fixed
- **Opaque sticky header** — changed from `bg-gray-900/50` (translucent) to `bg-gray-900` (opaque) so the header remains readable over chat bubbles behind it.
- **Compact search input** — `max-w-xs min-w-[200px]` instead of `w-full` so the filter field doesn't span the entire table width.

## [4.3.5] - 2026-04-11

### Fixed — Sticky Table Header on Scroll
- Table scroll container now has bounded `max-height` (400px chat, 70vh fullscreen) when rows > 8
- Combined with existing `sticky top-0` thead, header stays visible while scrolling
- Works in both chat view and fullscreen modal

## [4.3.4] - 2026-04-11

### Added — Context-Aware Table Pagination (chat vs fullscreen)

#### `useExpanded` context from ExpandableWrapper
- ExpandableWrapper now provides `isExpanded` signal via SolidJS context
- TableRenderer adapts pageSize automatically: compact in chat view, full in expanded view
- Chat view: `Math.min(10, pageSize)` rows — keeps chat compact
- Fullscreen: full `pageSize` rows — room to browse
- Optional `chatPageSize` override (default: `min(10, pageSize)`)
- Zero server changes needed — just send `pageSize: 20` as before
- `useExpanded()` hook exported for custom components that need the same behavior

## [4.3.3] - 2026-04-11

### Added — Table Search Filter

#### `searchable` prop on table params
- Text input above the table for real-time client-side filtering
- Searches across ALL columns, case-insensitive and accent-insensitive (NFD normalization)
- 200ms debounce to avoid filtering on every keystroke
- Clear button (×) to reset search
- Result count shown when filtering ("N results on M")
- Pagination applies AFTER filtering — filter narrows the dataset, then paginates
- Auto-enabled when `rows.length > 10` (unless `searchable: false`)
- Custom placeholder via `searchPlaceholder` prop
- Sort resets search pagination to first page/batch

## [4.3.2] - 2026-04-11

### Added — Progressive Table Pagination

#### `showAllLabel` prop enables progressive "show more" mode
- When `showAllLabel` is set on table params, pagination switches from paged (Prev/Next) to progressive (append)
- Shows first `pageSize` rows, then "Afficher plus (N suivantes)" button
- Each click appends the next batch — no page navigation
- Button disappears when all rows are visible
- Sort resets progressive state to first batch
- Backward-compatible: without `showAllLabel`, existing paged pagination unchanged
- Server just needs `{ pageSize: 25, showAllLabel: 'Afficher plus' }` when rows > 25

## [4.3.1] - 2026-04-11

### Added — Debug Trace Mode for Forms & PPR

#### `debugTrace` prop on ScratchpadPanel
- Collapsible debug panel below each form section
- Per-field trace: prefill, source, displayHint, muted, prefillMode, valueFormat
- Submitted values display with success/empty indicators
- Auto-submit decision trace with reason (missing fields, user interaction, etc.)
- Server `_debug` data display (resolvers, routing, missing fields) when present
- Raw SSE payload viewer (collapsible JSON)
- Zero impact when disabled — no extra rendering or state

## [4.3.0] - 2026-04-11

### Added — Prefill Enhancements (Phase B)

#### `prefillMode: "resolve"` for autocomplete fields (Proposal 1)
- Autocomplete fields can receive display names (e.g. "Paris") instead of codes
- MCP-UI calls `apiUrl` to resolve to `valueField` (e.g. code "75056") client-side
- Reduces server-side complexity — no async value resolution needed before emitting forms
- Fallback: raw prefill value used if API call fails

#### Smart tag display (Proposal 2)
- Select/multi-select fields show `label` not `value` for prefilled codes
- Autocomplete shows `displayHint` or resolved label as chip text instead of raw code

#### Prefill confidence summary (Proposal 3)
- Shows "N champ(s) pré-rempli(s) sur M" when at least one field is prefilled
- Displayed in both FormRenderer and EmbeddedFormSection (scratchpad forms)

#### Auto-submit toast mode (Proposal 4)
- When ALL fields are prefilled + `autoSubmitDelay` set, shows compact toast instead of full form
- Toast shows prefilled values summary with countdown, "Modifier" to expand, × to cancel
- Any interaction cancels countdown and expands full form

#### `valueFormat` validation (Proposal 5)
- Optional regex pattern on form fields — validates submitted value format
- `valueFormatHint` for human-readable error message on failure
- Runs after type-specific validation, supports arrays (multi-select)

#### Autocomplete always submits `valueField` (Proposal 6)
- On blur without selection, auto-resolves typed text to first API result
- Ensures form never submits display names when `valueField` is configured
- Fixes silent data corruption when users type instead of selecting

### Changed
- `@seed-ship/mcp-ui-spec` bumped to 3.2.0 (`prefillMode`, `valueFormat`, `valueFormatHint`)

## [4.2.2] - 2026-04-11

### Added — Prefilled Forms with Source Indicators

#### Form field prefill (`prefill`, `source`, `displayHint`, `muted`)
- **`prefill`** — pre-populated value on form fields (string or string[] for multi-select)
- **`source`** — how the value was obtained: `detected`, `inferred`, `default`, `user`
- **`displayHint`** — human-readable caption below the field (e.g. "Rhône — déduit de Lyon")
- **`muted`** — reduced opacity styling, clears on focus/click for seamless editing
- Source badges: checkmark for detected, link for inferred, pencil for user-provided
- Backward-compatible — fields without prefill render exactly as before

#### Auto-submit countdown (`autoSubmitDelay`)
- When all required fields are prefilled, shows "Submit in Ns..." with cancel button
- Any user interaction cancels the countdown
- Server controls via `autoSubmitDelay` (1000–30000ms) on form params

#### EmbeddedFormSection (scratchpad forms)
- Initializes `formData` with `field.prefill` values (was always `{}`)
- Re-applies prefill on streaming SSE updates without overwriting user edits
- Full auto-submit countdown support

### Changed
- `@seed-ship/mcp-ui-spec` bumped to 3.1.0 (new schema fields)
- `FormFieldSchema` adds `prefill`, `displayHint`, `source`, `muted`
- `FormComponentParamsSchema` adds `autoSubmitDelay`
- `PrefillSourceSchema` and `PrefillSource` type exported

## [4.0.0] - 2026-04-07

### Added — Data Verification Layer (anti-hallucination)

#### `validateAgainstSource()` — Pure data validator
- Compares numbers in LLM-generated text against source data rows
- Regex-based extraction — zero LLM calls, <1ms latency, $0.00 cost
- Configurable tolerance for rounding (default 1%)
- Ignore patterns for years, postal codes, indices
- Returns `DataValidation` with confidence score, verified/hallucinated breakdown

#### `useDataValidator()` — Reactive SolidJS hook
- Wraps `validateAgainstSource()` in a `createMemo`
- Auto-re-validates when text or source rows change
- Returns `valid()`, `confidence()`, `hallucinatedCount()` accessors

#### `VerifiedText` component — Inline verification badges
- **highlight** mode: green badges for verified numbers, amber for hallucinated
- **strip** mode: replaces hallucinated numbers with `[non vérifié]`
- **annotate** mode: tooltip on hover with closest source number and distance
- Confidence progress bar with color coding (green/amber/red)
- `onHallucinationClick` callback for interactive analysis

#### `DataPreviewSection` component — Source data table
- Paginated table with configurable page size (default: 25)
- Column type support (number right-aligned, date formatted, string left-aligned)
- French locale number formatting
- CSV/JSON export buttons
- Source attribution + data freshness label
- Total row count indicator for paginated datasets

### Added — GeoJSON Map Rendering

#### MapRenderer v3.1.0 — GeoJSON, choropleth, popups
- **GeoJSON** layer rendering (polygons, lines, circle markers for points)
- **Choropleth** coloring by property value with configurable color scale stops
- **Feature popups** on click — auto-generated or custom HTML template
- **Multi-layer** support with Leaflet layer control
- **Named layers** with per-layer style and popup overrides
- **PMTiles** vector tile support via optional `protomaps-leaflet` peer dep
- Backward-compatible — existing marker/clustering APIs unchanged

#### New types
- `MapGeoJSONStyle` — fill/stroke/opacity + choropleth field/scale
- `MapPopupConfig` — titleField, fields, or custom template
- `MapLayer` — named layer with geojson/style/popup
- `MapPMTilesConfig` — URL, paint rules, label rules, zoom limits

### Added — Time-series Chart Support

#### ChartJSRenderer v3.1.0 — Time axis
- `timeAxis` config on `ChartComponentParams` for date-based x-axis
- Configurable parser format, display unit, tooltip format
- Min/max date bounds
- Dataset `data` now accepts `Array<{x, y}>` for scatter/time-series

### Added — New Scratchpad Section Types (18 total)

- `verified_text` — renders `VerifiedText` with inline badges
- `data_preview` — renders `DataPreviewSection` with pagination + export
- `map` — renders `MapRenderer` with GeoJSON/choropleth/popups
- `chart` — renders `ChartJSRenderer` for embedded time-series/charts

### Changed
- `ScratchpadSection.type` union now includes 18 types (was 14)
- `ChartComponentParams.data.datasets[].data` accepts `{x,y}[]` in addition to `number[]`
- `ChartComponentParams.data.datasets[]` now has `fill` and `tension` properties
- `protomaps-leaflet` added as optional peer dependency

### Technical
- 423 tests (was 417), all passing
- Zero new runtime dependencies
- Full backward compatibility with v3.x APIs

## [3.0.5] - 2026-04-06

### Fixed
- **Autocomplete valueField bug**: `handleInput` was clearing stored value on every keystroke. Now only clears when user text differs from selected label.

## [3.0.4] - 2026-04-06

### Fixed
- **npm README**: Updated package-level README.md for npm display

## [3.0.3] - 2026-04-05

### Added — ARCH1: Direct scratchpad store
- `dispatchScratchpad()` — singleton reactive store, eliminates ChatBus relay chain race condition
- `useScratchpadState()` — hook for components to read scratchpad state reactively
- DX1 lifecycle console messages (create/update/close)

## [3.0.2] - 2026-04-05

### Added
- DX1 console messages for ScratchpadPanel lifecycle
- Debug overlay for scratchpad state inspection

## [3.0.1] - 2026-04-05

### Fixed
- Multi-select scroll in FormFieldRenderer (increased max-h, inline scroll styles, search filter)
- ChatPrompt overflow-visible (was overflow-hidden, clipping dropdown menus)

## [3.0.0] - 2026-04-04

### Added — v3.0.0 Milestone
- **18 form field types** — range/slider, tags/chips, toggle switch, fieldset group
- **14 scratchpad section types** — error, source_card, diff + all previous
- **Smart field status** — `fieldStatus` (required/unsupported/unknown) + `statusReason`
- **Multi-source HITL** — sectionMode append/upsert, asyncAction, pinned mode, debug overlay
- **HITL multi-tour** — Turn state, progression stepper
- **Interactive filter chips** — Click to edit, "+" to add
- **Embedded forms** — FormFieldRenderer in scratchpad with depends_on
- **Preview auto-refresh** — previewEndpoint + configurable method/headers

## [1.2.6] - 2025-11-26

### Fixed - Sprint 12: Component Rendering (tagged release)
- **CarouselRenderer**: Now actually rendered in UIResourceRenderer's ComponentRenderer
- **ArtifactRenderer**: Now actually rendered in UIResourceRenderer's ComponentRenderer
- Components were previously exported and registered but not rendered in the main switch
- Fixed props mapping for both components

## [1.2.5] - 2025-11-26

### Fixed - Sprint 12: Component Rendering (re-release)
- **CarouselRenderer**: Now actually rendered in UIResourceRenderer's ComponentRenderer
- **ArtifactRenderer**: Now actually rendered in UIResourceRenderer's ComponentRenderer
- Components were previously exported and registered but not rendered in the main switch
- Fixed props mapping for both components

## [1.2.4] - 2025-11-26

### Note
- Skipped due to npm publish issue (version already existed)

## [1.2.3] - 2025-11-26

### Fixed - Sprint 9: UI Fixes
- **ErrorCardRenderer**: Added for proper error display
- **UIResource vs UILayout routing**: Fixed validation routing
- **auto-layout.ts**: Fixed label → title property mapping

## [1.2.2] - 2025-11-26

### Added - Sprint 4: Public Exports & Registry

#### Component Exports (NEW)
- **FooterRenderer**: Now publicly exported for custom footer implementations
- **ActionRenderer**: Interactive button/link component with tool-call support
- **ArtifactRenderer**: Downloadable artifact display with filename, size, MIME type
- **CarouselRenderer**: Horizontal carousel with snap scrolling and navigation
- **GridRenderer**: Nested CSS Grid layout for complex dashboard templates

#### Component Registry Entries (NEW)
- Added 5 new registry entries in `component-registry.ts`:
  - `grid`: Nested CSS Grid layout with columns, gap, areas, children
  - `action`: Interactive button/link with tool-call, link, submit actions
  - `footer`: Metadata display with executionTime, model, sourceCount
  - `carousel`: Horizontal item carousel with snap scrolling
  - `artifact`: Downloadable file display with URL, filename, mimeType, size

### Technical
- All Sprint 4 components now available via main package export
- Registry entries enable LLM prompt engineering with schema definitions
- Full TypeScript types exported for all new components

## [1.2.1] - 2025-11-25

### Fixed
- Minor build fixes and dependency updates

## [1.2.0] - 2025-11-25

### Added - Phase 5.0 Quick Wins

#### GridRenderer (NEW)
- **Nested CSS Grid layouts** for complex template builder layouts
- Supports `columns`, `gap`, `minRowHeight`, and `areas` configuration
- Recursive rendering of child components via `UIResourceRenderer`
- Enables sidebar + main + footer dashboard layouts

#### MCPActionContext + useAction() (NEW)
- **Context Provider pattern** replaces CustomEvent for action dispatch
- `MCPActionProvider` wrapper for orchestration (Mastra integration ready)
- `useAction()` hook with execute, isExecuting state, and error handling
- `useMCPActionSafe()` for components outside provider (fallback to CustomEvent)
- `useToolAction()` for binding to specific tool names
- Typed `ActionRequest` and `ActionResult` interfaces
- Support for audit callbacks (`onAction`) and webhook events (`onWebhook`)

#### FooterRenderer Auto-Injection (NEW)
- Automatically inject footer when layout has metadata (executionTime, sourceCount, llmModel)
- Opt-out via `layout.metadata.hideFooter: true`
- Respects explicit footer components if already present
- Shows "Powered by Deposium" with execution metrics

### Changed
- **ActionRenderer refactored** to use `useAction()` hook internally
- Added loading spinner state during tool-call execution
- Button auto-disables while action is executing

### Types
- Added `GridComponentParams` interface for grid configuration
- Added `footer`, `carousel`, `artifact` to `ComponentType` union
- Extended `UILayout.metadata` with `executionTime`, `sourceCount`, `hideFooter`
- New exports: `MCPActionProvider`, `MCPActionContext`, `useMCPAction`, `useAction`, `useToolAction`

### Technical
- New directories: `src/context/`, `src/hooks/useAction.ts`
- Full TypeScript support with strict types
- SSR-compatible with `isServer` guards

## [1.1.0] - 2025-11-25

### Documentation
- **Comprehensive README Rewrite**: Complete documentation overhaul
  - Added architecture diagram and SSR guide
  - Documented all 12 component renderers with examples
  - Added conditional export setup for SolidStart
  - Included troubleshooting section for common SSR issues
- **CHANGELOG Catch-up**: Added 33 missing version entries (v1.0.11 to v1.0.43)
- **Phase 5 Roadmap**: Documented planned advanced components

### Notes
- This minor version bump marks a documentation milestone
- No code changes - all functionality identical to v1.0.43

## [1.0.43] - 2025-11-25

### Fixed
- **Object-to-Link Conversion**: Handle object values in `renderCellValue()` for table cells
  - Backend/LLM may send `{url, name}` objects instead of markdown strings
  - Previous: `String(value)` produced `[object Object]` in cells and broken URLs
  - Now: Auto-converts objects with `url` property to clickable HTML links
  - Supports `name`, `label`, or `title` as link text (falls back to URL)
  - Objects without `url` but with `name/label/title` render as plain text
  - Other objects are serialized with `JSON.stringify()`

### Technical Details
```typescript
// Before: "[object Object]" displayed, broken links
// After: Proper clickable links
if (value.url) {
  const label = value.name || value.label || value.title || value.url
  return `<a href="${sanitizedUrl}">${sanitizedLabel}</a>`
}
```

## [1.0.42] - 2025-11-25

### Added
- **Source Exports via "solid" Condition**: Add direct source exports for SolidStart SSR compatibility
  - New `"solid"` condition in package.json exports points to TypeScript source files
  - Allows Vite/SolidStart to compile components in the same context as the app
  - Fixes SSR hydration mismatches when compiled separately
  - **Requires**: Consuming app must add `conditions: ['solid']` in Vite config

### Technical Details
```json
{
  "exports": {
    ".": {
      "solid": "./src/index.ts",      // ← Source for SolidStart
      "import": "./dist/index.js",    // ← Compiled for other bundlers
    }
  }
}
```

### Migration Notes
For SolidStart users on Railway/SSR platforms, add to `app.config.ts`:
```typescript
resolve: {
  conditions: ['solid', 'development', 'browser']
}
```

## [1.0.41] - 2025-11-25

### Changed
- Switch from SSR to DOM mode for client-side rendering experiments
- Reverted in v1.0.42

## [1.0.40] - 2025-11-25

### Improved
- **Smart Cell Rendering**: Enhanced `renderCellValue()` with better markdown/link detection
  - Extract actual URL from markdown links before validation
  - Support image URLs in markdown format
  - Improved detection of URLs without protocol prefix

## [1.0.39] - 2025-11-24

### Fixed
- Rebuild with fresh `dist/` containing createEffect fix from v1.0.38
- Clean rebuild to ensure all SSR fixes are included in the package

## [1.0.38] - 2025-11-24

### Fixed
- **SSR Compatibility**: Replace `onMount` with `createEffect` for better SSR behavior
  - `createEffect` runs on both server and client
  - More predictable execution timing
  - Fixes certain edge cases in streaming UI

## [1.0.37] - 2025-11-24

### Fixed
- **SSR Mode Restoration**: Restore `generate: 'ssr'` mode for Railway Node 22 compatibility
  - Previous version accidentally reverted to DOM mode
  - Re-enables proper SSR compilation for server environments

## [1.0.36] - 2025-11-24

### Fixed
- **SSR Guard Improvement**: Use `typeof window` check instead of `isServer` import
  - More reliable detection in mixed environments
  - Fixes edge cases where `isServer` wasn't properly tree-shaken

## [1.0.35] - 2025-11-24

### Fixed
- **SSR Guard in useStreamingUI**: Add SSR guard to `fetch()` calls in useStreamingUI hook
  - Prevents SSR crashes when hook is instantiated during server render
  - `fetch` is guarded to only execute client-side

## [1.0.34] - 2025-11-24

### Fixed
- **Client-Only API Guards**: Use `onMount` pattern for all client-only APIs in GenerativeUIErrorBoundary
  - Consistent pattern across all components
  - Prevents accidental server-side execution

## [1.0.33] - 2025-11-24

### Fixed
- **Railway SSR Fix**: Wrap client APIs in GenerativeUIErrorBoundary for Railway SSR
  - Additional guards for browser-only code
  - Improved compatibility with Railway's Node.js environment

## [1.0.32] - 2025-11-24

### Fixed
- **CustomEvent SSR Fix**: Wrap CustomEvent in `onMount` for Railway SSR compatibility
  - `CustomEvent` constructor doesn't exist in Node.js
  - Now only created client-side during mount

## [1.0.31] - 2025-11-24

### Fixed
- Fix build configuration and TypeScript declarations
- Update pnpm-lock.yaml for v1.0.31 dependencies
- Ensure all type definitions are properly exported

## [1.0.30] - 2025-11-24

### Improved
- **Table Rendering**: Improve table rendering with markdown support
  - Tables now parse markdown links in cell values
  - Better export path configuration
  - Enhanced styling for table cells

## [1.0.29] - 2025-11-24

### Added
- **SSR-Safe Type Imports**: Add `/types-only` sub-export for SSR-safe type imports
  - Allows importing types without triggering component code
  - Useful for server-side type checking

```typescript
// SSR-safe type import
import type { UIResource } from '@seed-ship/mcp-ui-solid/types-only'
```

## [1.0.28] - 2025-11-24

### Fixed
- **Validation Entry Point**: Compile validation.ts as proper entry point
  - Fixes import errors when using `/validation` export

## [1.0.27] - 2025-11-24

### Fixed
- **Validation Imports**: validation.ts imports from dist instead of src
  - Prevents source-map resolution issues

## [1.0.26] - 2025-11-24

### Changed
- Version bump (synced with mcp-ui-spec v1.0.15, mcp-ui-cli v1.0.14)

## [1.0.25] - 2025-11-23

### Added
- **Validation Sub-Export**: Add `/validation` sub-export for SSR-safe imports
  - Validation utilities available without loading UI components
  - Useful for server-side schema validation

```typescript
import { validateUIResource } from '@seed-ship/mcp-ui-solid/validation'
```

### Fixed
- Add SSR compatibility checks for client-only APIs throughout codebase

## [1.0.24] - 2025-11-23

### Improved
- **Table Styling**: Improve table rendering with better styling
  - Enhanced header styling
  - Better cell padding and borders
  - Improved responsive behavior

## [1.0.23] - 2025-11-23

### Changed
- Version bump for npm publication with updated token
- Synchronized with mcp-ui-spec v1.0.12, mcp-ui-cli v1.0.11

## [1.0.22] - 2025-11-23

### Changed
- Version bump for npm publication
- Synchronized with mcp-ui-spec v1.0.11, mcp-ui-cli v1.0.10

## [1.0.21] - 2025-11-23

### Added
- **New Renderers**: Four new component renderers for enhanced UI capabilities
  - `ActionRenderer`: Interactive buttons with callback support
  - `ArtifactRenderer`: File/download artifact display
  - `CarouselRenderer`: Image/content carousel with navigation
  - `FooterRenderer`: Metadata and footer information display
- **Validation Enhancements**: Extended validation for new component types

### Technical Details
ActionRenderer example:
```typescript
<ActionRenderer
  action={{
    type: 'action',
    label: 'Download Report',
    actionType: 'download',
    payload: { fileId: '123' }
  }}
  onAction={(action) => handleAction(action)}
/>
```

## [1.0.18] - 2025-11-22

### Changed
- Version bump for npm publication
- Synchronized with mcp-ui-spec v1.0.8, mcp-ui-cli v1.0.8

## [1.0.17] - 2025-11-22

### Added
- **Component Type Validation**: Add validation for iframe, image, link component types
  - Schema validation for `iframe` with src and sandbox attributes
  - Schema validation for `image` with src, alt, and dimensions
  - Schema validation for `link` with href and text

## [1.0.16] - 2025-11-22

### Fixed
- **SSR Compatibility**: Fix SSR compatibility by using CSS strings instead of style objects
  - Vite's solid plugin generates different code for style objects vs strings
  - CSS strings avoid the `setStyleProperty` issue in SSR

## [1.0.15] - 2025-11-22

### Changed
- Version bump for npm publication

## [1.0.13] - 2025-11-17

### Added
- **New Renderers**: Add iframe, image, and link renderers to mcp-ui-solid
  - `IframeRenderer`: Secure iframe embedding with sandbox support
  - `ImageRenderer`: Responsive image display with lazy loading
  - `LinkRenderer`: External link rendering with proper security attributes
- **Markdown Support**: Add markdown rendering to TextRenderer
  - Uses `marked` library for parsing
  - Sanitizes output with DOMPurify

### Technical Details
```typescript
// TextRenderer now supports markdown
<TextRenderer
  component={{
    type: 'text',
    content: '# Hello\n\nThis is **markdown**!'
  }}
/>
```

## [1.0.12] - 2025-11-17

### Added
- **Markdown in TextRenderer**: Basic markdown support using `marked` library
  - Headings, bold, italic, links, lists
  - Code blocks with syntax highlighting
  - Sanitized HTML output

### Fixed
- Composite layout detection in UIResourceRenderer
- Optional chaining for componentId in error display
- Defensive position check in validateGridPosition
- Defensive position checks in UIResourceRenderer

---

## [1.0.10] - 2025-11-17

### Fixed
- **CONDITIONAL EXPORTS FIX**: Added `"solid"` condition to all package.json exports
  - This completes the SSR fix started in v1.0.9
  - Allows Vite's SSR resolver to correctly identify which module to load in server vs browser contexts
  - Without this, module resolution conflicts occurred even with SSR-compatible compilation
  - Follows SolidJS library best practices for proper module resolution

### Technical Details
**The Missing Piece in v1.0.9:**
- v1.0.9 correctly changed `generate: 'ssr'` in vite.config.ts
- BUT package.json exports didn't include the `"solid"` condition
- This caused Vite to load the same build for both SSR and browser
- Result: Module resolution conflicts with `solid-js/web` during SSR

**How Conditional Exports Fix This:**
```json
{
  "./components": {
    "solid": "./dist/components/index.js",
    "import": "./dist/components/index.js",
    "require": "./dist/components/index.cjs"
  }
}
```

### Why This Matters
- **v1.0.8**: Added `isServer` guards (fixed symptoms)
- **v1.0.9**: Changed to SSR compilation mode (fixed compilation)
- **v1.0.10**: Added conditional exports (fixed module resolution)

## [1.0.9] - 2025-11-17

### Fixed
- **ROOT CAUSE SSR FIX**: Changed vite-plugin-solid configuration to use SSR-compatible compilation mode
  - Updated `generate: 'dom'` → `generate: 'ssr'` in vite.config.ts
  - Updated `hydratable: false` → `hydratable: true` in vite.config.ts
  - This prevents module-level `template()` calls that crash in SSR environments

### Technical Details
- **SSR mode** compiles JSX to server-safe string rendering
- **Hydratable mode** enables client-side hydration after SSR
- No module-level browser API calls that crash in Node.js

## [1.0.8] - 2025-11-16

### Fixed
- **CRITICAL SSR FIX**: Added `isServer` guards to all browser APIs in `GenerativeUIErrorBoundary.tsx`
  - Browser APIs: `performance.now()`, `navigator.userAgent`, `window.innerWidth/height`
  - These APIs don't exist in Node.js SSR environment

## [1.0.7] - 2025-11-16

### Fixed
- **CRITICAL SSR FIX**: Replaced `ref` callback with `onMount` to eliminate `use()` directive
  - `use` is NOT exported from `solid-js/web` in Node/SSR environment
  - Solution: Replaced `ref` callback with `onMount()` which is SSR-safe

## [1.0.6] - 2025-11-16

### Fixed
- Add `solid-js` to devDependencies for tests to pass in CI/CD

## [1.0.5] - 2025-11-16 (UNPUBLISHED)

### Fixed
- **CRITICAL SSR FIX**: Replaced dynamic style objects with CSS strings

### Changed
- Updated `vite` from ^5.0.10 to ^6.3.6
- Updated `vite-plugin-solid` from ^2.8.2 to ^2.11.8
- Updated `vitest` from ^1.1.0 to ^4.0.8
- Updated `solid-js` peerDependency from ^1.8.0 to ^1.9.0

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@seed-ship/mcp-ui-solid` package
- `UIResourceRenderer` component for static dashboard rendering
- `StreamingUIRenderer` component for progressive streaming rendering
- `GenerativeUIErrorBoundary` for error isolation and retry logic
- `useStreamingUI` hook for SSE connection management
- Component validation and layout validation services
- Component registry system
- Full TypeScript support with comprehensive types
- 12-column responsive grid layout system
- Support for chart, table, metric, and text components

### Features
- **Progressive Streaming**: Components appear incrementally via SSE
- **Error Boundaries**: Graceful error handling with retry capability
- **Validation**: Built-in component and layout validation
- **Type Safety**: Full TypeScript definitions
- **Performance**: TTFB <500ms, optimized rendering
- **Responsive**: 12-column grid with flexible positioning
