# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This file is the **monorepo-wide** changelog. Per-package changelogs live in
> `mcp-ui-solid/CHANGELOG.md`, `mcp-ui-spec/CHANGELOG.md`, and
> `mcp-ui-cli/CHANGELOG.md`. Major releases bump all three packages in lockstep.

## [5.2.0] - 2026-04-22 (`mcp-ui-solid` only)

### Added — D1 multi-instance scratchpad store
- `createScratchpadStore()` factory — returns an isolated `ScratchpadStoreHandle` (`dispatch`, `state`, `pinned`, `close`). Use when two or more scratchpads need to coexist (chat + admin dashboard, agent-on-agent orchestration UIs, ...).
- `ScratchpadStoreProvider` + `ScratchpadStoreContext` — scope a store to a SolidJS subtree. Accepts an optional `store` prop; creates one internally otherwise.
- `useScratchpadState()` is now context-aware — reads the provider's store when mounted inside one, falls back to the module singleton otherwise. **Zero-breaking** : single-instance consumers (the v4.x path) keep working unchanged.

### Added — D2 ChatPrompt controller primitive
- `createChatPromptController()` — centralises `showChatPrompt` lifecycle in one primitive. Owns the resolver closure, `AbortSignal` wiring, and re-entrance policy. Consumers go from ~20 LOC of manual wiring to `bus.commands.handle('showChatPrompt', ctrl.handle)` + `<Show when={ctrl.activePrompt()}>{cfg => <ChatPrompt ... />}</Show>`.
- `PromptReplacedError` — thrown when a new `showChatPrompt` arrives before the previous one resolves. Exported from the root package for `instanceof` checks.
- `AbortSignal` honoured : already-aborted signals reject synchronously with `DOMException('Prompt aborted', 'AbortError')` without showing UI. In-flight aborts reject + clear `activePrompt`.
- `ctrl.abort(reason?)` — programmatic cancellation (e.g. on route change).

### Added — D5 per-message inline feedback
- **`<FeedbackInline>`** component — per-message thumbs up/down, non-blocking, many can coexist. Complements `ChatPrompt` (modal one-at-a-time) and `ScratchpadPanel` feedback section (structured, panel-side). Optimistic UI, best-effort persistence via consumer-owned `onSubmit(rating, context)`.
- Exports `FeedbackInlineProps`, `FeedbackInlineContext` types.

### Added — D6 MCP elicitation handling
- `ChatEvents.onElicitation` — new event for MCP `elicitation/create` requests (spec 2025-06-18). Symmetric to `onClarificationNeeded`.
- `ElicitationEvent`, `ElicitationRequestedSchema`, `ElicitationPropertySchema` types.
- `elicitationToPromptConfig(event)` helper — converts an MCP elicitation payload to a `ChatPromptConfig`. Smart mapping : single boolean → confirm, single enum ≤4 → choice, everything else → form with per-property field-type inference (`string/email/date` → `text/email/date`, `number/integer` → `number`, `boolean` → `checkbox`, `enum` → `select`).

### Tests
- **467 passing** (+29 vs v5.1.0). New files : `stores/scratchpad-store.test.tsx` (7), `services/chat-prompt-controller.test.ts` (7), `components/FeedbackInline.test.tsx` (7). Plus 8 new tests in `services/chat-bus.test.ts` for `elicitationToPromptConfig`.

### Non-breaking
- All additions are optional. `scratchpad-store.ts` refactored to extract a factory but the module singleton remains as default — `dispatchScratchpad` / `useScratchpadState` keep working exactly as before.

### Scope doc
- See `docs/2026/r&d/mcpui-v5.2.0-scope.md` in the Deposium project for the full design rationale, test plan, and migration path.

### Deferred to v5.3.0 or later
- `<ElicitationForm>` schema-driven form renderer — wait for real Claude Desktop payloads to avoid over-engineering.
- `createChatPromptController` FIFO queue mode.
- `useServerCapabilities()` hook — needs a second consumer + Phase B protocol align.
- OAuth client-side docs recipe.

## [5.1.0] - 2026-04-14 (`mcp-ui-solid` only)

### Added — D4 custom choice rendering
- `ChoicePromptConfig.optionRenderer?: (option, index) => JSX.Element` — render prop for custom option bodies. mcp-ui still wraps the returned JSX in a `<button>` with the `onClick` handler.
- `ChoicePromptConfig.buttonClass?` + `ChoicePromptConfig.containerClass?` — Tailwind escape hatches appended to the button and container classes.
- Generic `ChoicePromptConfig<TMeta = Record<string, unknown>>` — `ChoiceOption<TMeta>` flows through so `optionRenderer` closures get strongly-typed `option.metadata` without casting.
- `ChoiceOption<TMeta>` type exported from the root package.
- Option buttons now have `type="button"` — prevents accidental form submission when nested.

### Documented — D3 AbortSignal + re-entrance contract
- `ChatPrompt.tsx` header JSDoc rewritten: explicitly states that `ChatPrompt` is a pure presentation component with no internal `AbortSignal` listening. Lifecycle is the consumer's responsibility.
- `ChatCommands.showChatPrompt` JSDoc rewritten: full implementer contract (no default handler, Promise wiring, `DOMException('AbortError')` on abort, re-entrance auto-reject policy).
- README `ChatPromptResponse` section rewritten with a complete reference wiring example covering re-entrance + `AbortSignal` + the Web Platform `DOMException('AbortError')` convention.

### Tests
- **438 passing** (+5 vs v5.0.0). New coverage in `ChatPrompt.test.tsx`.

### Non-breaking
- All additions are optional — existing consumers keep working identically.

### Deferred to v5.2.0
- `createScratchpadStore()` multi-instance factory (D1).
- `createChatPromptController()` primitive centralising resolver lifecycle + re-entrance + abort (D2 + D3 code, not just docs).
- `correlationId` natively threaded through `ChatPromptConfig → ChatPromptResponse`.
- Optional `progress_update` SSE event type.

See [`docs/2026/r&d/mcpui-v5.1.0-consensus.md`](https://github.com/theseedship/mcp-ui/blob/main/docs/) for the full design discussion and v5.1.0/v5.2.0 sequencing arbitration (3-voice consensus tour : `solid`, `mcpui`, `mcps`).

## [5.0.0] - 2026-04-14

### Major release — Sprint 52 multi-agent primitives + docs consolidation

All three packages bumped to 5.0.0:
- `@seed-ship/mcp-ui-solid` 4.3.9 → 5.0.0
- `@seed-ship/mcp-ui-spec` 3.2.0 → 5.0.0
- `@seed-ship/mcp-ui-cli` 3.0.0 → 5.0.0

### Breaking
- **`ClarificationEvent.options[].file_id` removed from the type** (deprecated in v4.3.9, removed in v5.0.0 as announced). The `clarificationToPromptConfig()` helper still migrates legacy runtime `file_id` into `metadata.file_id` transparently, so host apps receiving payloads from older servers continue to work. New code should emit `metadata: { file_id }` directly.
- **`ChatPromptConfig.type = 'select'` and `SelectPromptConfig`** — already removed in 4.3.9 (the variant was declared in 4.0 but `ChatPrompt.tsx` never rendered it). Documented here for the v5 recap.

### Added — Sprint 52 primitives (solid)
- **`ChoicePromptConfig.options[].metadata?`** — free-form metadata (confidence, source, tags...) preserved through `showChatPrompt → ChatPromptResponse` roundtrip. Opaque to the default renderer.
- **`ClarificationEvent.options[].metadata?`** + **`ClarificationEvent.type?`** — extension points for host routing (e.g. `'intent_disambiguate'`).
- **`clarificationToPromptConfig()`** — universal `ClarificationEvent → ChatPromptConfig` bridge exported from the root package. Migrates legacy `file_id` runtime-side.
- **`createMockChatBus()`** — new `src/testing/` sub-module with FIFO `ChatPromptResponse` queue and spy hook. Useful for testing agent flows without rendering any UI.

### Added — Table UX polish (solid, late 4.3.x series, rolled into v5)
- **Context-aware pagination** — `TableRenderer` reads `useExpanded()` from `ExpandableWrapper` to show compact rows in chat view and full `pageSize` in fullscreen.
- **Page size selector** — dropdown `10 / 30 / 60 / 100 / All` in fullscreen pagination bar.
- **Search input** — client-side filter above the table, case + accent insensitive, 200ms debounced, auto-enabled when `rows.length > 10` (or explicit `searchable: true`). New `searchPlaceholder`.
- **Search term highlighting** — matches wrapped in `<mark>` across all visible cells (`bg-yellow-200` / `dark:bg-[#222F49]`). New exported `highlightQuery()` helper.
- **Sticky header** — `thead` stays visible while scrolling; scroll container bounded at 400px in chat and adapts to viewport in fullscreen.
- **Default export = CSV** — TSV removed from default export menu (still available on explicit `formats: ['tsv']`).

### Added — Form prefill layer (solid, entire 4.2.x + 4.3.0 series, rolled into v5)
- **`prefill` / `source` / `displayHint` / `muted`** on `FormFieldParams` — fields render with pre-populated values and source badges (`detected` / `inferred` / `default` / `user`). Muted fields clear on focus/click.
- **`autoSubmitDelay`** on `FormComponentParams` — countdown with cancel button when all required fields are prefilled. Any interaction cancels. Toast mode shows a compact summary when *all* fields are prefilled.
- **`prefillMode: 'resolve'`** — autocomplete fields accept display names; `mcp-ui-solid` calls the field's own `apiUrl` client-side to resolve into `valueField`. Zero server work.
- **Smart tag display** — select/autocomplete show `label` (or `displayHint`) instead of raw codes for prefilled values.
- **Prefill summary** — "N champs pré-remplis sur M" rendered above the form.
- **`valueFormat` + `valueFormatHint`** — regex validator on form fields for strict format enforcement (INSEE codes, SIRET, ISO dates, etc.).
- **Autocomplete `valueField` guarantee** — on blur without selection, the field auto-resolves typed text to the first API result, ensuring submissions never contain display text.
- **Debug trace mode** — `debugTrace` prop on `ScratchpadPanel` shows a collapsible panel under each form with per-field `prefill`/`source`/`prefillMode` state, submitted values, auto-submit decision reasoning, optional server `_debug` data, and raw SSE payload viewer.
- **spec schema additions** — `prefill`, `displayHint`, `source`, `muted`, `prefillMode`, `valueFormat`, `valueFormatHint`, `autoSubmitDelay`, `PrefillSourceSchema`.

### Documented — known limitations (solid)
- **`ChatPromptResponse.dismissed`** — full semantics in JSDoc: X icon / Cancel → `true`, explicit click/submit → `undefined`, AbortSignal → Promise rejection (host responsibility).
- **Scratchpad store is a singleton** — two `ScratchpadPanel` instances share state. Factory `createScratchpadStore()` planned for v5.1.0.
- **`showChatPrompt` is not re-entrant** — calling it while another prompt is active leaks the previous Promise. Host apps must queue/dismiss manually. Auto-reject planned for v5.1.0.
- **AbortSignal is not listened to** — `ChatPrompt` does not currently react to abort signals. Fix planned for v5.1.0.
- **`correlationId` is host-propagated** — mcp-ui does not auto-forward the ID across the bus; SSE parsers must thread it into subsequent event emissions.

### Documentation catch-up
- **Root `README.md`** — refreshed "What's New in v5.0.0" with the full 4.x → 5.0.0 highlight reel. Version table updated to 5.0.0 across all three packages.
- **Root `CHANGELOG.md`** — backfilled the entire 3.0.x tail + complete 4.0.0 → 4.3.9 history (previously stopped at 3.0.0).
- **`mcp-ui-spec/CHANGELOG.md`** — backfilled 2.x → 5.0.0 (previously stopped at 1.2.0).
- **`mcp-ui-cli/CHANGELOG.md`** — backfilled 2.x → 5.0.0 (previously stopped at 1.1.0).

### Tests
- `@seed-ship/mcp-ui-solid`: **433 passing** (+10 vs v4.3.9). New coverage for `clarificationToPromptConfig` (6 tests) and `createMockChatBus` (4 tests).

---

## 4.x series — mcp-ui-solid only

Versions 4.0.0 → 4.3.9 were published as `mcp-ui-solid` patch/minor releases. `mcp-ui-spec` and `mcp-ui-cli` did not track the 4.x line — they stayed on 3.x (spec reached 3.2.0, cli reached 3.0.0) until the synchronised v5.0.0 bump above.

## [4.3.9] - 2026-04-14 (`mcp-ui-solid`)

### Added — Sprint 52 multi-agent primitives (G1-G11)

Agnostic extension points landed ahead of the breaking v5 bump:
- `ChoicePromptConfig.options[].metadata?` (G1)
- `ClarificationEvent.options[].metadata?` + `type?` (G3). `file_id` **deprecated** in JSDoc (removed in v5.0.0).
- `clarificationToPromptConfig()` helper (G11) — universal `ClarificationEvent → ChatPromptConfig` bridge.
- `createMockChatBus()` test helper (G6) — new `src/testing/` entry point.
- `ChatPromptResponse.dismissed` JSDoc clarified (G5).
- Known limitations documented: scratchpad singleton (G8), `showChatPrompt` non-reentrant (G9), `correlationId` host-propagated (G10).
- README recipe for bridging external clarification events (G2).

### Removed — dead code
- `ChatPromptConfig.type = 'select'` and `SelectPromptConfig` (G7) — never had a rendering branch in `ChatPrompt.tsx`.

## [4.3.8] - 2026-04-11 (`mcp-ui-solid`)

### Added
- **Search term highlighting** — matched query terms wrapped in `<mark>` across all visible cells. `bg-yellow-200` light / `bg-[#222F49]` dark. New `highlightQuery()` helper skips HTML tag content.

### Fixed
- **Fullscreen phantom scrollbar** — removed `h-full` on table wrapper in expanded mode. The wrapper now shrinks to content so short tables don't leave empty space or show an unnecessary scrollbar.

## [4.3.7] - 2026-04-11 (`mcp-ui-solid`)

### Changed
- **Prev/Next pagination is now the default** — replaced the progressive "show more" mode with unified Prev/Next navigation.
- **Page size selector in fullscreen** — dropdown `10 / 30 / 60 / 100 / All`.
- **Fullscreen table fills the viewport** via `calc(100vh - 180px)`.
- **Header contrast** — thead background from `bg-gray-50` to `bg-gray-100` for better chat-view visibility.

## [4.3.6] - 2026-04-11 (`mcp-ui-solid`)

### Fixed
- **Opaque sticky header** — `bg-gray-900/50` (translucent) → `bg-gray-900` (opaque) so the header remains readable over chat bubbles.
- **Compact search input** — `max-w-xs min-w-[200px]` instead of `w-full`.

## [4.3.5] - 2026-04-11 (`mcp-ui-solid`)

### Fixed — Sticky Table Header on Scroll
- Table scroll container now has bounded `max-height` (400px chat, 70vh fullscreen) when rows > 8. Combined with the existing `sticky top-0` thead, header stays visible while scrolling in both chat and fullscreen.

## [4.3.4] - 2026-04-11 (`mcp-ui-solid`)

### Added — Context-Aware Table Pagination (chat vs fullscreen)
- `ExpandableWrapper` provides `isExpanded` signal via SolidJS context.
- `TableRenderer` adapts `pageSize` automatically: compact in chat, full in fullscreen.
- Optional `chatPageSize` override. `useExpanded()` hook exported.

## [4.3.3] - 2026-04-11 (`mcp-ui-solid`)

### Added — Table Search Filter (`searchable`)
- Client-side search input above the table (real-time, case + accent insensitive, 200ms debounced). Auto-enabled when `rows.length > 10`. Custom `searchPlaceholder`. Pagination applies **after** filtering.

## [4.3.2] - 2026-04-11 (`mcp-ui-solid`)

### Added — Progressive Table Pagination (`showAllLabel`) — later superseded by v4.3.7 Prev/Next
- "Show more" button that appends the next page worth of rows instead of replacing. Disappears once all rows are visible.

## [4.3.1] - 2026-04-11 (`mcp-ui-solid`)

### Added — Debug Trace Mode for Forms & PPR
- `debugTrace` prop on `ScratchpadPanel` adds a collapsible panel under each form with per-field prefill state, submitted values, auto-submit decision reasoning, optional server `_debug` data, and raw SSE payload viewer.

## [4.3.0] - 2026-04-11 (`mcp-ui-solid` + `mcp-ui-spec` 3.2.0)

### Added — Prefill Enhancements (Phase B)
- **`prefillMode: "resolve"`** on autocomplete fields — server sends display names, mcp-ui resolves to codes via `apiUrl` client-side (zero server work).
- **Smart tag display** — select/autocomplete show labels not codes.
- **Prefill confidence summary** — "N champs pré-remplis sur M" above the form.
- **Auto-submit toast** — compact summary when all fields are prefilled.
- **`valueFormat` regex validation** with `valueFormatHint`.
- **Autocomplete always submits `valueField`** — on blur without selection, auto-resolves typed text.

## [4.2.2] - 2026-04-11 (`mcp-ui-solid`)

### Fixed
- Ensure `dist` contains prefill support (v4.2.1 dist was stale in the publish pipeline).

### Added
- README section and CHANGELOG entry for the prefilled forms feature.

## [4.2.1] - 2026-04-11 (`mcp-ui-solid`)

### Fixed
- **`EmbeddedFormSection` (scratchpad forms)** now initializes `formData` with `field.prefill` values (was always `{}`). Re-applies prefill on streaming SSE updates without overwriting user edits. Full `autoSubmitDelay` support in scratchpad forms.

## [4.2.0] - 2026-04-11 (`mcp-ui-solid` + `mcp-ui-spec` 3.1.0)

### Added — Prefilled Forms with Source Indicators (Phase A)
- `prefill`, `displayHint`, `source`, `muted` on `FormFieldParams`.
- `PrefillSource` type (`detected | inferred | default | user`) with visual badges.
- `autoSubmitDelay` on `FormComponentParams` — countdown with cancel button when all required fields are prefilled.
- Spec: `PrefillSourceSchema`, schema additions, all optional / backward-compatible.

## [4.1.0] - 2026-04-10 (`mcp-ui-solid`)

### Added — AITL Agent Toolkit (P1-P5)
- Agent section types: `agent_card`, `split_stepper`, `agent_handoff`, `briefing_diff`.
- Components: `AgentCard`, `AgentStatusBadge`, `SplitStepper`, `AgentHandoff`, `BriefingDiff`.
- `StreamingUIRenderer` + scratchpad integration for agent-in-the-loop flows.

## [4.0.6] - 2026-04-08 (`mcp-ui-solid`)

### Fixed
- **TableRenderer sort click** — use `on:click` instead of `onClick` to avoid SolidJS event-delegation edge case on sort header.

## [4.0.5] - 2026-04-08 (`mcp-ui-solid`)

### Fixed
- **Sortable columns** — header click sort with asc/desc/off cycle, pagination fix.

## [4.0.4] - 2026-04-07 (`mcp-ui-solid`)

### Added
- **Client-side auto-pagination** for tables (`pageSize`, `initialPage`, Prev/Next navigation).

## [4.0.3] - 2026-04-07 (`mcp-ui-solid`)

### Added
- **Sortable columns in `DataPreviewSection`** — click header to cycle sort direction.

## [4.0.0] - 2026-04-07 (`mcp-ui-solid`)

### Added — Data Verification Layer (anti-hallucination)
- **`validateAgainstSource()`** — pure regex-based numerical hallucination detector, <1ms, $0.00. Configurable tolerance, ignore patterns for years/postal codes.
- **`useDataValidator()`** — reactive SolidJS hook wrapping the validator in a `createMemo`.
- **`VerifiedText` component** — inline verification badges with `highlight` / `strip` / `annotate` modes and confidence bar.
- **`DataPreviewSection` component** — paginated source data table with CSV/JSON export, column types, French locale formatting, source attribution.

### Added — GeoJSON Map Rendering
- **MapRenderer** — GeoJSON polygons/lines/points, choropleth coloring, feature popups, multi-layer support.
- **PMTiles** — optional vector tile support via `protomaps-leaflet` peer dep.
- New types: `MapGeoJSONStyle`, `MapPopupConfig`, `MapLayer`, `MapPMTilesConfig`.

### Added — Time-series Chart Support
- **`timeAxis` config** on `ChartComponentParams` — date-based x-axis with configurable parser/unit/tooltip format, min/max bounds.
- Dataset `data` now accepts `Array<{x, y}>` for scatter/time-series.

### Added — 18 Scratchpad Section Types
- New: `verified_text`, `data_preview`, `map`, `chart` (was 14).
- `ChartComponentParams.data.datasets[]` now has `fill` and `tension`.
- `protomaps-leaflet` added as optional peer dependency.

### Technical
- 423 tests (was 417), all passing.
- Zero new runtime dependencies.
- Full backward compatibility with v3.x APIs.

## [3.0.5] - 2026-04-06 (`mcp-ui-solid`)

### Fixed
- **Autocomplete `valueField` bug** — `handleInput` was clearing the stored value on every keystroke. Now only clears when the user text differs from the selected label.

## [3.0.4] - 2026-04-06 (`mcp-ui-solid`)

### Fixed
- **npm README** — updated package-level README.md for npm display.

## [3.0.3] - 2026-04-05 (`mcp-ui-solid`)

### Added — ARCH1: Direct scratchpad store
- `dispatchScratchpad()` — singleton reactive store, eliminates the ChatBus relay chain race condition.
- `useScratchpadState()` — hook for components to read scratchpad state reactively.
- DX1 lifecycle console messages (create/update/close).

## [3.0.0] - 2026-04-06

### Major Release — Complete HITL Chat Toolkit

**All 3 packages bumped to 3.0.0** (solid, spec, cli).

### Added (v3.0.0)
- **Range/slider field** — `type: 'range'` with min/max/step, live value display
- **Tags/chips input** — `type: 'tags'` with Enter/comma to add, Backspace to remove, blur to add
- **Toggle field** — `type: 'toggle'` switch button (alternative to checkbox)
- **Fieldset/group** — `type: 'fieldset'` visual grouping container

### Summary: v2.0 → v3.0 (this session)

**Components:**
- `UIResourceRenderer` — 19 component types, expandable, table/chart/code export
- `ChatPrompt` — choice, confirm, form (10+ field types), dismissLabel
- `ScratchpadPanel` — 14 section types, multi-tour HITL, interactive filters, embedded forms
- `ComponentToolbar` — unified toolbar (copy, download, expand, wordwrap)
- `ExpandableWrapper` — fullscreen expand with DOM reparenting

**Chat Bus:**
- 18 event types (token, streamEnd, UILayout, citation, scratchpad, feedback...)
- 11 command types (injectPrompt, sendPrompt, showChatPrompt, updateScratchpad...)
- Throttle + streamKey filtering, correlationId, AbortSignal

**Form Fields (18 types):**
- text, email, password, number, date, textarea, select (single+multi), checkbox, radio
- autocomplete (single+multi with API fetch), range, tags, toggle, fieldset
- fieldStatus (required/optional/unsupported/unknown) + statusReason
- dependsOn reactive fields, showWhen conditional visibility

**ScratchpadPanel (14 section types):**
- data, filter (interactive chips), preview (auto-refresh), message, action
- steps (enriched with embedded content), form (full FormFieldRenderer)
- understanding (confidence badges), feedback (options + comment), prompt (interpretation)
- stepper (multi-source progress), error (retry), source_card (capabilities), diff (comparison)
- sectionMode (replace/append/upsert), asyncAction, pinned, debug/debugOverlay
- Turn state (turn, totalTurns, turnHistory), auto-close, collapsible

**Validation:**
- All 19 component types validated
- Scatter/bubble/time-series chart support
- Tiered iframe sandbox (80+ domains, trusted vs untrusted)
- Payment platforms (Stripe, Polar.sh)

**Security patches:** dompurify, ajv, picomatch, flatted, minimatch, lodash

## [2.15.0] - 2026-04-06

### Added
- **Debug mode** (F11) — `debug` prop logs all state changes and actions to console as structured objects. `debugOverlay` prop shows mini HUD (id, event count, sections, status, last event) in corner.

## [2.14.0] - 2026-04-06

### Added (Multi-Source Scratchpad v2)
- **Section type `error`** (F6) — Error display with severity (warning/error), retry button, collapsible details. `retryAction` triggers `onAction()`.
- **Section type `source_card`** (F9) — Source metadata card: capabilities (supported/unsupported badges), row count, freshness, latency.
- **Section type `diff`** (F10) — Side-by-side source comparison table with highlighted diff columns.
- **`asyncAction` prop** (F7) — When true, action button clicks show loading state and keep scratchpad open until next server update.
- **`pinned` prop** (F8) — Scratchpad stays visible during stream, no auto-close on complete. Closes only on explicit `action: 'close'`.
- **14 section types total**: data, filter, preview, message, action, steps, form, understanding, feedback, prompt, stepper, error, source_card, diff

## [2.13.0] - 2026-04-06

### Added (Scratchpad Multi-Source)
- **`sectionMode`** on `ScratchpadEvent` — `'replace'` (default), `'append'` (add sections), `'upsert'` (update by id or append). Enables multi-tour without re-sending all sections.
- **`mergeScratchpadSections()`** — Exported helper for consumers to merge sections with replace/append/upsert logic.
- **Section type `stepper`** — Multi-source progress indicator with horizontal/vertical orientation. Shows status (done/active/error/pending), summary text, and duration_ms per step.
- **Action aliases** — Actions `done`, `close`, `dismiss`, `validate`, `cancel`, `sufficient` auto-close the scratchpad (+ still call onAction callback).
- **`ready` status distinction** — Blue badge (distinct from `complete` green). Prevents auto-close, shows action buttons prominently.

## [2.12.0] - 2026-04-06

### Added
- **`fieldStatus`** — Per-field API capability indicator on `FormFieldParams`: `'required'` (blocks submit), `'optional'` (default), `'unsupported'` (disabled + grayed + badge), `'unknown'` (yellow badge). Prevents users from filling fields the API ignores.
- **`statusReason`** — Human-readable explanation shown below the field (colored by status: orange for unsupported, yellow for unknown, blue for required).
- **Smart submit** — Unsupported fields automatically excluded from submitted values. Required fields block submit if empty.

### Changed
- `mcp-ui-spec` v2.2.0 — `fieldStatus` and `statusReason` added to `FormFieldSchema` Zod definition.

## [2.11.0] - 2026-04-06

### Added (Universal HITL protocol)
- **`onSubmit` callback** — Dedicated form submission handler on ScratchpadPanel. Cleaner than onAction('submit_form'). All connectors use the same pattern.
- **`status: 'error'` + retry** — Error state with message, code, retryable flag. Shows error panel with retry/close buttons. Handles API failures (429, timeout, auth).
- **`previewMethod` / `previewHeaders`** — Configurable HTTP method and headers for preview auto-fetch. Supports GET endpoints and auth headers.
- **`onRetry` callback** — Dedicated retry handler on error state.
- **Feedback options array** — FeedbackSection now supports `options[]` format (universal) alongside approve/reject (simple). Each option can have icon, variant, and needsComment flag.
- **Free-text comment in feedback** — `allowFreeText` shows input, `needsComment` on option shows input after click.

## [2.10.0] - 2026-04-06

### Added (ScratchpadPanel HITL multi-tour)
- **Section type="understanding"** — Agent shows its comprehension: detected parameters with confidence badges (high=green, medium=yellow, low=red) + data warnings
- **Section type="feedback"** — Thumbs up/down with optional comment input. Calls `onAction('feedback', { approved, value, comment })`
- **Section type="prompt"** — Agent interpretation display: original query, extracted parameters, planned action. Optional "Modify" button for editable prompts
- **Turn state** — `ScratchpadState.turn`, `totalTurns`, `turnHistory[]` with stepper header showing progression (done/active/pending/skipped) across conversation turns
- **Turn history header** — Visual stepper with chevrons between turns, color-coded badges, and summary text per completed turn

## [2.9.0] - 2026-04-06

### Added (ScratchpadPanel v3 — HITL interactive)
- **Interactive filter chips** (#4, #5) — Click chip to edit inline (text input or select dropdown). Click "+" to add new filter. Filter definitions support type, options, placeholder.
- **Search button** (#5) — Prominent "Search" button when `status=waiting_human` and filters have values. Calls `onAction('search', { filters })`.
- **Embedded form sections** (#7, #8) — Section `type='form'` renders a full interactive form using FormFieldRenderer. Supports all field types (select, autocomplete, multi-select, etc.).
- **Reactive depends_on in forms** (#9) — Form fields in scratchpad sections support `depends_on` with `options_endpoint` template. Parent field change triggers child options fetch.
- **Enriched stepper** (#6) — Steps can contain embedded sections (form, filter, etc.) in their `content` field. Active step renders its embedded content. "Next" button per step.
- **Preview auto-refresh** (#10, #11) — `previewEndpoint` + `previewDebounce` on ScratchpadState. Filters change → debounced POST → preview updates automatically.
- **updateScratchpad command** (#9) — New ChatBus command `updateScratchpad(id, { filters?, formData? })` for sending changes back to the agent.
- **waiting_human border** — Blue border pulse when status is `waiting_human` to attract attention.

## [2.8.2] - 2026-04-06

### Fixed (ScratchpadPanel v2)
- **Close button** — `onClose` + `closable` props. X button in header, stops propagation to collapse.
- **Collapsible** — Click header to toggle body. Chevron rotates. `collapsible` prop (default: true).
- **Auto-close on complete** — `autoCloseDelay` prop: calls `onClose()` after N ms when status=complete.
- **Empty state** — Preview with count=0 shows "No results" message + "Modify filters" button.
- **Scrollable body** — `maxHeight` prop (default: 400px) with overflow-y auto.
- **Slide-down animation** — Entry animation on render.
- **Agent message styling** — question type gets blue bg + border, warning gets amber bg, info gets gray bg.
- **Filter remove buttons** — Only shown when `onFilterChange` is provided. Empty state "No filters applied".
- **Action icons** — Optional `icon` prop on action buttons.

## [2.8.0] - 2026-04-06

### Added
- **ScratchpadPanel** (`@experimental`) — HITL/AITL shared workspace between agent and human. Agent fills sections, human can edit filters and validate. Supports data, filter (editable chips), preview (live stats), message, action, steps, and form section types. Status badges (loading/ready/waiting_human/processing/complete). Preview with mini-table. Agent messages with info/question/warning icons.
- **Scratchpad types** — `ScratchpadState`, `ScratchpadSection`, `ScratchpadEvent` in chat-bus types. SSE event `onScratchpad` added to `ChatEvents`.
- **Universal HITL pattern** — Same component works for Human-In-The-Loop (human supervises agent) and Agent-In-The-Loop (agent supervises human/other agent). The scratchpad is a shared state, not directional.

## [2.7.0] - 2026-04-05

### Added
- **Dependent fields** (`dependsOn`) — Child field fetches options from API when parent value changes. Example: selecting department filters commune autocomplete to that department's communes. Supports `apiUrl` with `{value}` template, `labelField`, `valueField`, `extraParams`.
- **Live preview** (`preview`) — Form shows real-time stats as user fills fields. Debounced POST to preview endpoint with selected field values. Shows count/summary before submit. Designed to prevent open data hallucinations.
- **showWhen in ChatPrompt** — Conditional field visibility now supported in ChatPrompt forms via FormFieldRenderer delegation.

## [2.6.4] - 2026-04-05

### Fixed
- **ChatPrompt overflow-hidden** — Root container had `overflow-hidden` clipping all dropdowns (multi-select, autocomplete). Changed to `overflow-visible`.
- **Multi-select scroll** — Dropdown now uses inline scroll styles + z-50 for maximum compatibility. Filter input added when options > 10.
- **Multi-autocomplete** — `{ type: 'autocomplete', multiple: true }` adds chips after each selection, clears input for next search. Returns `string[]`.
- **FormFieldRenderer fallback** — Unknown field types now render as text input with visible amber warning instead of rendering nothing silently.
- **ChatPrompt null guard** — Early return if `props.config` is null/undefined.
- **ChatPrompt dismissLabel** — New prop replaces X icon with text button (e.g. "Envoyer directement" / "Send as-is").

## [2.6.0] - 2026-04-05

### Added
- **Multi-select field** — `{ type: 'select', multiple: true }` renders dropdown with checkboxes + removable chips. Returns `string[]`. Designed for DVF year/department multi-selection.
- **Autocomplete field** — `{ type: 'autocomplete', apiUrl, searchParam, labelField, valueField }` with debounced API fetch and dropdown suggestions. Supports communes (35K), SIRENE, addresses.
- **FormBody refactored** — ChatPrompt form now delegates to `FormFieldRenderer`, making all existing field types (text, email, password, number, date, textarea, select, checkbox, radio) automatically available in ChatPrompt forms.

### Fixed
- **ChatPrompt null guard** (v2.5.2) — Early return if `props.config` is null/undefined
- **ChatPrompt dismissLabel** (v2.5.3) — New `dismissLabel` prop replaces X icon with text button (e.g. "Envoyer directement")

## [2.5.0] - 2026-04-04

### Changed
- Comprehensive README with Chat Bus usage guide, ChatPrompt examples, updated architecture diagram
- Full CHANGELOG with all versions from v1.0.0 to v2.5.0
- Chat Bus types stabilization milestone — types remain `@experimental` but API is production-tested

## [2.4.0] - 2026-04-04

### Added
- **Chat Bus** (`@experimental`) — Event-driven toolkit for chat agent interactions
  - `createEventEmitter()` with throttle support + streamKey filtering
  - `createCommandHandler()` for typed command dispatch
  - `createChatBus()` factory combining events + commands
  - `useChatBus()` SolidJS hook + `ChatBusProvider` context
  - 15 event types: `onToken`, `onStreamEnd`, `onUILayout`, `onCitation`, `onToolCall`, `onChatPromptResponse`, `onAgentSwitch`, `onBriefing`, etc.
  - 10 command types: `injectPrompt`, `sendPrompt` (with correlationId), `showChatPrompt` (with AbortSignal), `toggleConnector`, `setMode`, etc.
  - `ChatEventBase` with `streamKey`/`conversationId` for multi-stream support
  - `EventSubscribeOptions` with throttle + streamKey filter
- **ChatPrompt** (`@experimental`) — Ephemeral structured interactions above chat input
  - 3 subtypes: choice (buttons with icons/descriptions), confirm (with danger variant), form (text/number/select/textarea with validation)
  - Slide-up animation, dismiss button, accessible (`role="dialog"`)
  - Promise-based response with AbortSignal cleanup
- **Agent types** (`@experimental`) — `AgentContext`, `BriefingEvent` (with `ephemeral` flag), `BriefingSection`
- **Stream types** — `StreamDoneMetadata`, `ChatError`, `Citation`, `ToolCallEvent`, `ClarificationEvent`

### Fixed
- Throttle timer now cancelled on unsubscribe (prevents stale callbacks after unmount)
- Error isolation in throttled deferred calls (try/catch)
- `onCustomEvent` streamKey filtering (searches all args, not just first)

### Security
- lodash 4.17.23 → 4.18.1 (Code Injection + Prototype Pollution CVEs)

## [2.3.0] - 2026-04-03

### Added
- **Complete ComponentRegistry** — All 19 types registered with JSON schemas, LLM descriptions, and examples (code, map, form, modal, action-group, image-gallery, video, iframe, image, link)
- **ComponentToolbar** — Unified toolbar component with consistent icon set (copy, download, expand, wordwrap), configurable position, and click feedback
- **Tiered iframe sandbox** — `getIframeSandbox()` gives `allow-same-origin` only to trusted domains (Google, Stripe, Polar.sh, Deposium, etc.); untrusted domains get restrictive `allow-scripts allow-popups` only
- **Payment platform support** — Polar.sh and Stripe domains (checkout, billing, connect, invoice) added to iframe whitelist and trusted list
- **bubble/polarArea chart types** — Added to `ChartType` union

### Fixed
- **Chart validation** — scatter/bubble charts no longer require labels; time-series line charts with `{x, y}` object data pass validation; empty datasets skip length mismatch
- **Comprehensive component validation** — All 18 types now validated: video (url + domain), carousel (items), image-gallery (images), form (fields), action-group (actions), code (content), map (center/markers), artifact (content)
- **ArtifactRenderer** — Optional chaining on `mimeType?.includes()` prevents crash on undefined
- **CodeBlockRenderer** — Guard against highlight.js missing `highlight()` method
- **ChartRenderer reactivity** — Replaced synchronous `if(useNative())` with reactive `<Show>` so Chart.js is used when available
- **Chart validation hardenings** — Null-checks for `params.data`, `datasets`, `labels` prevent TypeError crashes

### Security
- Iframe sandbox hardened: untrusted domains no longer get `allow-same-origin`, preventing access to parent localStorage/cookies

## [2.2.5] - [2.2.11] - 2026-03-31 to 2026-04-03

Incremental releases consolidating fixes and features between v2.2.4 and v2.3.0:

### Added (v2.2.6)
- **Complete ComponentRegistry** — 10 missing entries added (code, map, form, modal, action-group, image-gallery, video, iframe, image, link) with schemas and examples
- **ComponentToolbar** — Unified toolbar component with consistent icons

### Fixed (v2.2.8)
- **Citation buttons in table cells** — DOMPurify now allows `<button>`, `<svg>`, `<path>` and SVG attributes for citation buttons with inline icons

### Fixed (v2.2.9)
- **ChartRenderer reactivity** — Replaced synchronous `if(useNative())` with reactive `<Show>` so Chart.js is used when available

### Fixed (v2.2.10)
- **Chart validation hardenings** — Null-checks for `params.data`, `datasets`, `labels` prevent TypeError crashes
- **validateComponent params guard** — Rejects components with undefined params

### Added (v2.2.7)
- **MCP connector domains** — gamma.app, hubspot.com, data.gouv.fr, clinicaltrials.gov, linear.app added to iframe whitelist

### Fixed (v2.2.11)
- **Scatter/bubble/time-series chart validation** — Labels optional for point-based charts, `{x,y}` data validated
- **9 component validators added** — video (url + domain), carousel, image-gallery, form, action-group, code, map, modal, artifact
- **ArtifactRenderer** — `mimeType?.includes()` prevents crash on undefined
- **CodeBlockRenderer** — Guard against missing `highlight()` method
- **bubble/polarArea** added to `ChartType` union

## [2.2.4] - 2026-03-31

### Changed
- Updated README with v2.2.x features and current package versions
- Added CHANGELOG with full release history

## [2.2.3] - 2026-03-31

### Security
- **dompurify** 3.3.0 → 3.3.3 — mutation-XSS via Re-Contextualization (HIGH)
- **ajv** 8.17.1 → 8.18.0 — ReDoS with `$data` option (HIGH)
- **picomatch** 4.0.3 → 4.0.4 — Method Injection + ReDoS
- **flatted** 3.3.3 → 3.4.2 — Prototype Pollution via `parse()`
- **minimatch** 10.2.2 → 10.2.5 — ReDoS via GLOBSTAR segments

## [2.2.1] - 2026-03-31

### Fixed
- **ComponentRegistry validation** — `validateAgainstRegistry()` returns warnings (not errors) for types without registry entries. Known-but-unvalidated types pass through; truly unknown types (typos) still rejected.
- **HTML links in table cells** — `renderCellValue` detects raw HTML (`<a>` tags, citation links) and sanitizes via DOMPurify. Prevents XSS on plain text path.
- **ExpandableWrapper DOM reparenting** — Content physically moved between inline and modal (not duplicated), preserving Chart.js canvas refs.
- **Table export/expand button collision** — Export dropdown offset to avoid overlap with expand button.

### Added
- **ExpandableWrapper component** — Generic Portal-based fullscreen expand. Escape/backdrop close, optional copy-to-clipboard. Integrated into Table, Chart, Code renderers.
- **Table export** — `exportable` prop with dropdown: Copy TSV / Download CSV / Download JSON. RFC 4180 compliant CSV.
- **Chart export** — `exportable` prop for PNG download. `height` prop (default `250px`).
- **CodeBlock word wrap** — Toggle button next to Copy with active state indicator.

## [2.1.3] - 2026-03-20

### Security
- Patched minimatch CVE-2026-26996
- Upgraded to Node 22

## [2.1.2] - 2026-03-19

### Security
- Patched lodash and seroval vulnerabilities

## [1.0.0] - 2025-11-14

### Added
- **@mcp-ui/solid** (v1.0.0) - SolidJS components for MCP UI
  - UIResourceRenderer component
  - StreamingUIRenderer component
  - Error boundaries and fallbacks
  - Hooks: useStreamingUI
  - 5,771 lines of code

- **@mcp-ui/spec** (v1.0.0) - Component registry specification
  - Zod schemas for validation
  - TypeScript type definitions
  - JSON Schema exports
  - 1,631 lines of code

- **@mcp-ui/cli** (v1.0.0) - Development tooling
  - `mcp-ui validate` command
  - `mcp-ui generate-types` command
  - `mcp-ui test-examples` command
  - `mcp-ui diff` command
  - 1,652 lines of code

### Migration Notes
- Packages previously located at `deposium_MCPs/packages/mcp-ui-*`
- Now available as standalone npm packages
- Use `workspace:*` protocol for internal dependencies
- Full backward compatibility maintained

---

**Note**: Version 1.0.0 represents the initial stable release after migration from the Deposium monorepo.
