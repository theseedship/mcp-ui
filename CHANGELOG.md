# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
