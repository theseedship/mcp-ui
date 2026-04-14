# @seed-ship/mcp-ui-solid Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
