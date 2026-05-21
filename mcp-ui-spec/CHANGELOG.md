# @seed-ship/mcp-ui-spec Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Sprint OpenData / macros — cf.
`mcp-ui-solid/docs/briefs/ROADMAP-opendata-macro-mcpui.md`.
Accumulating toward 5.1.0.

### Added — `ConnectorDynamicResultV1` contract (R1)

The canonical JSON contract a connector / MCP server emits to describe a
rich, ready-to-render result. It crosses repo boundaries (MCPs emitter →
`mcp-ui-solid` consumer) deployed independently, so it lives in the spec
(the shared contract layer) and carries an explicit, namespaced
`schemaVersion` discriminant.

- `ConnectorDynamicResultV1Schema` + `ConnectorDynamicResultV1` type.
  `schemaVersion` is a **required** string literal
  `'connector-dynamic-result/v1'` (exported as `CONNECTOR_DYNAMIC_RESULT_V1`).
- `ConnectorActionSchema` (alias of the existing `ActionParamsSchema` — no
  parallel type), `ConnectorFollowupSchema`, `ConnectorRenderHintsSchema`.
- `primary` / `supplemental` carry `UIComponent` / `UILayout` payloads as
  passthrough objects — the spec validates the envelope, the renderer owns
  runtime component validation.
- `queryHash` is optional in the payload, required once presentation
  feedback is persisted (recommended: `hash(connectorId + toolName +
  normalizedIntent)`, not the raw query).

### Added — connector fixtures

`examples/connector/` ships 5 reference `ConnectorDynamicResultV1` payloads
covering the documented data.gouv.fr / clinicaltrials scenarios:
real-estate, DPE, pollution, clinical trials, and the empty/error degraded
state. Every fixture is asserted to parse against the schema.

## [5.0.6] - 2026-05-05

Documentation-only patch — no schema changes. Closes Demande 1.1 + 1.2 of
deposium's `BRIEF-MCPUI-2026-05-10.md`.

### Documented — Runtime Payload Identity contract

The README now formalizes the identity contract for runtime `UILayout` /
`UIComponent` payloads (distinct from the registry-side `Component`
definitions documented previously) :

- **`id` is obligatoire** on every well-formed `UILayout` and `UIComponent`,
  and MUST be stable across renders for the same logical content. Producers
  that emit `wrap-${Date.now()}` or `Math.random()` ids are non-conformant.
- **Bare-payload fallback** : renderers MUST gracefully accept payloads
  without `id` (e.g. a producer emitting a chart config directly) and
  MUST derive a stable key from the content — not from a counter or
  timestamp. The canonical implementation is `getUiResourceStableKey()`,
  shipped in `@seed-ship/mcp-ui-solid@6.5.0`.

This codifies behavior that was previously implicit, so host apps and
producers can rely on it without reading renderer source.

## [5.0.5] - 2026-05-03

### Added — `TableComponentParamsSchema.maxHeight`

Driven by deposium handoff (axe 1) — the lib hardcodes a
`max-height: 400px` (500px virtualizing) cap on tables with > 8 rows
in inline mode, which forces an internal scroll even when the consumer's
wrapping container has plenty of room.

- New optional field `maxHeight: 'auto' | number | string`.
  - `'auto'` → no cap, the parent container's overflow handles it.
  - number → interpreted as `${n}px`.
  - string → used as-is (CSS length).
  - undefined → existing behavior unchanged (400/500px caps).

Renderer support ships in `@seed-ship/mcp-ui-solid@6.3.0`.
Backward compatible — purely additive.

## [5.0.4] - 2026-05-02

### Added — `'graph'` ComponentType + Graph schemas

Generic node-link visualization primitive. Domain-neutral by design — the
`weight` field on both nodes and edges is a generic ranking signal whose
semantics (rerank score, frequency, criticality, contribution, etc.) are
opaque to the lib and decided by the consumer.

- **`'graph'`** added to `ComponentTypeSchema` enum.
- **`GraphNodeSchema`** : `id` (required), `label`, `type`, `size`,
  `weight`, `style`, `data` (all optional). `weight` drives default node
  size when `size` is omitted, and acts as the sort key for the
  `concentric` layout.
- **`GraphEdgeSchema`** : `source` + `target` (required, must match node
  ids), `label`, `type`, `weight`, `style`, `data` (all optional).
  `weight` drives default stroke width and the attractive force in
  `force` layouts.
- **`GraphLayoutNameSchema`** : enum of 7 layouts — `force`, `dagre`,
  `mindmap`, `tree`, `circular`, `grid`, `concentric`. Power users opt
  into other G6 layouts via the object form
  `{ type: 'force', options: { ... } }` — `options` is a passthrough.
- **`GraphLayoutSchema`** : union of shorthand string OR
  `{ type, options? }` object.
- **`GraphComponentParamsSchema`** : `nodes` (required, min 1), `edges`,
  `layout`, `title`, `height`, `width`, `rendererPref` (`canvas`|`svg`),
  `fitView`, `enableZoom`, `enableDrag`, `enableSelect`, `tooltip`,
  `className`. Sensible defaults applied at render time.
- Inferred types : `GraphNode`, `GraphEdge`, `GraphLayoutName`,
  `GraphLayout`, `GraphComponentParams`.

Renderer support ships in `@seed-ship/mcp-ui-solid` (lazy-loads
`@antv/g6 ^5` as peer-optional). Apps without the peer installed see an
informative fallback instead of a crash.

### Tests

- `src/schemas-graph-v5.0.4.test.ts` — **+26 tests** (node minimal +
  rich, edge minimal + rich, all 7 layout shorthand names, layout object
  form with passthrough options, params with weights + concentric
  ordering, empty-edges acceptance, rejection paths). Total spec :
  77/77 pass.

### Non-breaking

- All previously valid payloads remain valid. `'graph'` is purely
  additive.

## [5.0.3] - 2026-05-02

### Added — citation chip support in table cells (prep for solid@5.7.0)

- **`CitationEntrySchema`** + **`CitationEntry`** type — describes the source of a `[N]` citation marker (`page`, optional `file`, optional `file_id`). JSON-serializable.
- **`TableComponentParamsSchema.citationMap`** (optional) — a `Record<string, CitationEntry>` that, when set, lets `<TableRenderer>` (in `mcp-ui-solid@5.7.0+`) replace LLM `[📄 CITATION N]` markers in cell strings with clickable chips. Spec-side: just data; the rendering logic + optional `citationRender` function override stay in `mcp-ui-solid` (functions can't ride JSON).

Driven by `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md`. Backward compatible — `citationMap` is opt-in.

### Tests

- 3 new tests in `schemas-relax-v5.0.2.test.ts` (table without citationMap, with valid map, rejects entry missing page). Total: 51/51 pass.

## [5.0.2] - 2026-04-27

### Changed — schema relaxations driven by deposium audit answers (§L)

After deposium MCPs ran exhaustive grep on production payloads (§M.2 + §M.3 of `MCP-UI-AUDIT-2026-04-26.md`), 2 schemas relaxed to match real-world usage and unblock the final 2 ComponentTypes (`map` + `form`) in the B.1 migration (`mcp-ui-solid@5.6.0`).

- **`MapComponentParamsSchema.center`** + **`MapMarkerSchema.position`** : now accept either a `[lat, lng]` tuple OR a `{lat, lng}` object — mirrors Leaflet's own polymorphic `LatLngLiteral ∪ LatLngTuple` API. New exported types `LatLngObject`, `LatLngTuple`, `LatLngPoint` and schema `LatLngPointSchema`.
- **`FormFieldSchema.name`** regex relaxed from `^[a-zA-Z][a-zA-Z0-9_]*$` to `^[a-zA-Z][\w.-]*$` — also allows `-` (kebab-case for URL params, opendata IDs) and `.` (dot-paths for nested forms). Still requires a leading letter so the value remains a valid CSS selector / JS access key. Deposium's 19 production field names (all snake_case) remain conform.

### Tests

- `src/schemas-relax-v5.0.2.test.ts` — **+14 tests** locking in the new accept/reject behavior (tuple + object centers, kebab + dot field names, still-rejected leading-digit / spaces / accents).
- Total spec suite: **48/48 tests pass** (was 34).

### Non-breaking

- All previously-valid map and form params remain valid. Only newly-accepted shapes added.

## [5.0.1] - 2026-04-27

### Added — 9 primitive component params schemas (B.1 PR1)

Prépare le refactor de `mcp-ui-solid/src/services/validation.ts` (B.1 — voir
`MCP-UI-AUDIT-2026-04-26.md` §I) en exposant des Zod schemas pour les 9
ComponentTypes qui n'en avaient pas encore. Les 8 existants
(`action`, `action-group`, `video`, `image-gallery`, `form`, `modal`,
`code`, `map`) sont inchangés.

- **`ChartComponentParamsSchema`** + `ChartTypeSchema` (8 chart types) +
  `ChartDatasetSchema` (datasets number[] OU {x,y}[]) + `ChartTimeAxisSchema`.
- **`TableComponentParamsSchema`** + `TableColumnSchema` + `TablePaginationSchema`
  + `TableVirtualizeOptionsSchema` + `TableExportableSchema` (boolean OU `{formats, filename}`).
- **`MetricComponentParamsSchema`** + `MetricTrendSchema` (`up | down | neutral`).
  `title` + `value` requis (matche le check impératif actuel).
- **`TextComponentParamsSchema`** — `content` requis.
- **`IframeComponentParamsSchema`** — `url` requis. **Le whitelist domain
  reste impératif** côté `mcp-ui-solid` (`validateIframeDomain`).
- **`ImageComponentParamsSchema`** — `url` requis.
- **`LinkComponentParamsSchema`** — `url` requis.
- **`CarouselComponentParamsSchema`** — `items` non-vide, items kept opaque
  (validés récursivement par le renderer pour éviter une référence circulaire).
- **`ArtifactComponentParamsSchema`** — `url` + `filename` + `mimeType` requis,
  `size` >= 0 si présent.

### Choix de design

- URL fields utilisent `z.string().min(1)` (pas `.url()`) pour matcher le
  comportement actuel de `validation.ts` (juste truthy check). `.url()`
  rejetterait les paths relatifs et `localhost:3000`. Le whitelist sécurité
  reste séparé.
- Tous les types inférés exportés via `z.infer<>` (pour cross-stack consumption
  par deposium notamment — cf. `MCP-UI-AUDIT-2026-04-26.md` §J.2).

### Tests

- `src/schemas-params-v5.0.1.test.ts` — **30 nouveaux tests** (parse OK +
  parse fail sur path attendu pour chaque schema). Suite totale : 34/34 verts.

### Non-breaking

- Aucun schema existant modifié. PR2 (mcp-ui-solid `5.5.0`) consommera ces
  schemas + ajoutera un mapper `ZodIssue → ValidationError` pour préserver la
  shape externe de `validateComponent()` — non-breaking pour les consumers.

## [5.0.0] - 2026-04-14

### Major release — synchronized with `@seed-ship/mcp-ui-solid` 5.0.0

No schema breaking changes in this package. The major bump aligns the three
monorepo packages on a single version line so consumers can pin a single major.

### Changed
- Version bump 3.2.0 → 5.0.0 (synchronized with `@seed-ship/mcp-ui-solid` v5.0.0 and `@seed-ship/mcp-ui-cli` v5.0.0).

## [3.2.0] - 2026-04-11

### Added — Prefill Enhancements (Phase B)
- `FormFieldSchema.prefillMode` — `'exact' | 'resolve'` for autocomplete client-side resolution.
- `FormFieldSchema.valueFormat` — optional regex pattern for strict value format validation.
- `FormFieldSchema.valueFormatHint` — human-readable error message for `valueFormat` failures.

## [3.1.0] - 2026-04-11

### Added — Prefilled Forms (Phase A)
- `PrefillSourceSchema` enum (`user | detected | inferred | default`).
- `FormFieldSchema.prefill` (string | string[]) — pre-populated value.
- `FormFieldSchema.displayHint` — human-readable caption below the field.
- `FormFieldSchema.source` — tracks how the value was obtained, drives source badges.
- `FormFieldSchema.muted` — compact styling hint for high-confidence prefills.
- `FormComponentParamsSchema.autoSubmitDelay` — countdown in ms (1000–30000).

## [3.0.0] - 2026-04-06

### Major release — synchronized with `@seed-ship/mcp-ui-solid` 3.0.0

All three packages bumped to 3.0.0 to mark the "complete HITL chat toolkit"
milestone. Spec additions over the 2.x series:
- Form field types: `range`, `tags`, `toggle`, `fieldset` alongside existing 14 types.
- `fieldStatus` (`required | optional | unsupported | unknown`) + `statusReason`.
- `showWhen` conditional visibility with 13 operators.
- `dependsOn` reactive field options.
- `preview` live-refresh config on form components.
- Multi-select (`multiple: true`) on `select` fields.
- Autocomplete schema (`apiUrl`, `searchParam`, `labelField`, `valueField`, `extraParams`, `minChars`, `debounceMs`).

## [2.2.0] - 2026-04-06

### Added
- `fieldStatus` and `statusReason` on `FormFieldSchema` — per-field API capability indicator aligned with `mcp-ui-solid` v2.12.0.

## [2.0.0] - 2026-03-31

### Major release — synchronized with `mcp-ui-solid` v2.0.0
- Expanded `ComponentTypeSchema` to cover 19 component types (added `code`, `map`, `form`, `modal`, `action-group`, `image-gallery`, `video` among others).
- Per-component schema definitions aligned with the `@seed-ship/mcp-ui-cli` registry validator.
- Scatter/bubble/time-series chart validation — labels optional for point-based charts.

## [1.2.0] - 2025-11-25

### Changed - Phase 5.0 Quick Wins

#### ComponentType Enum Expansion
- **Synchronized with mcp-ui-solid v1.2.0**
- Expanded from 5 types to 13 types:
  - `chart`, `table`, `metric`, `text`, `composite` (existing)
  - `grid` - Nested CSS Grid layouts (NEW)
  - `iframe` - Embedded content
  - `image` - Image display
  - `link` - Clickable links
  - `action` - Tool call buttons (NEW)
  - `footer` - Metadata footer (NEW)
  - `carousel` - Horizontal scrolling
  - `artifact` - Downloadable files

### Notes
- Full backward compatibility with existing registries
- New types support Phase 5.0 template builder features

## [1.1.0] - 2025-11-25

### Documentation
- **Comprehensive README Rewrite**: Complete documentation overhaul
  - Fixed npm scope from `@mcp-ui/spec` to `@seed-ship/mcp-ui-spec`
  - Documented all 10 exported Zod schemas
  - Documented all 11 component types with renderer mappings
  - Added full registry format specification
  - Added Grid Positioning, Security Constraints, Performance Constraints docs
  - Added deprecation and versioning documentation
  - Included complete example registry JSON

### Notes
- This minor version bump marks a documentation milestone
- No schema changes - all validation identical to v1.0.15

## [1.0.15] - 2025-11-24

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.26, mcp-ui-cli v1.0.14)

## [1.0.14] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.25, mcp-ui-cli v1.0.13)

## [1.0.12] - 2025-11-23

### Changed
- Version bump for npm publication with updated token
- Synchronized with mcp-ui-solid v1.0.23, mcp-ui-cli v1.0.11

## [1.0.11] - 2025-11-23

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.22, mcp-ui-cli v1.0.10)

## [1.0.10] - 2025-11-23

### Added
- **Validation Enhancements**: Extended Zod schemas for new component types
  - Action component validation
  - Artifact component validation
  - Carousel component validation
  - Footer component validation

### Changed
- Synchronized with mcp-ui-solid v1.0.21, mcp-ui-cli v1.0.9

## [1.0.8] - 2025-11-22

### Changed
- Version bump (synchronized with mcp-ui-solid v1.0.18, mcp-ui-cli v1.0.8)

## [1.0.7] - 2025-11-22

### Changed
- Version bump

## [1.0.5] - 2025-11-22

### Added
- **New Component Types**: Added Zod schemas for iframe, image, link components
  - `IframeComponentSchema` with src and sandbox validation
  - `ImageComponentSchema` with src, alt, dimensions
  - `LinkComponentSchema` with href and text

### Changed
- Version bump for npm publication

## [1.0.2] - 2025-11-17

### Changed
- Migrate to `@seed-ship` npm scope
- Updated package name from `@mcp-ui/spec` to `@seed-ship/mcp-ui-spec`

## [1.0.1] - 2025-11-16

### Fixed
- Add type definitions generation for all packages

## [1.0.0] - 2025-01-14

### Added
- Initial release of `@seed-ship/mcp-ui-spec` package
- JSON Schema v7 specification for component registries
- Zod validation schemas with TypeScript types
- Comprehensive example registry with components:
  - `quickchart-bar` (Bar chart visualization)
  - `metric-card` (KPI metric card)
  - `data-table` (Tabular data display)
- Security constraints specification:
  - Authentication requirements
  - Domain whitelisting
  - Iframe sandboxing
  - Maximum nesting depth
- Performance constraints:
  - Maximum render time limits
  - Maximum data size limits
- Component versioning and deprecation support
- Grid positioning system (12-column layout)

### Features
- **JSON Schema**: Industry-standard v7 schema for validation
- **Zod Integration**: Runtime validation with TypeScript inference
- **Type Safety**: Complete TypeScript definitions
- **Examples**: Working examples for each component type
- **Extensible**: Easy to add new component types
