# Theming (6.25.0)

Set `--mcp-ui-*` custom properties on any ancestor of the library's components.
They inherit through nested components and can be scoped differently for two
instances on the same page. No provider, global theme or new dependency is
required. Continue scanning `src/**/*.{ts,tsx}` with Tailwind v4 and use the
host's class-based `.dark` variant. Import the existing autocomplete CSS when
using those components, as before.

## Defaults and inheritance

The migrated component roots carry `mcp-ui-root`, but **do not assign public
token defaults** there. Assigning `--mcp-ui-surface: white` on a nested root
would mask an inherited host value. Instead, each static utility consumes a
token with the exact old color as its fallback, for example:

```tsx
class="bg-[color:var(--mcp-ui-surface,var(--color-white,#fff))] dark:bg-[color:var(--mcp-ui-surface,var(--color-gray-800,#1f2937))]"
```

The host's existing Tailwind palette remains authoritative. Fallbacks retain
the original per-component shades, dark variants and alpha paints; there is
deliberately no single replacement palette that collapses those distinctions.
Removing a token restores that original fallback. A custom color replaces the
whole paint, including opacity, rather than applying the old opacity to it.
Host tokens apply without a `.dark` class too; that class only selects the
original dark fallbacks. Normal form text falls back to its inherited color
when `--mcp-ui-fg` is absent, while muted fields keep their secondary role.

## Tokens

Values below describe the original fallbacks, not declarations on the root.
`gray-*`, `blue-*`, etc. refer to the host's Tailwind color variables. Exact
per-use defaults remain visible in the static source classes. The frozen
6.24.0 browser fixture records representative resolved light/dark values.

| Token | Role | Original default / behavior |
| --- | --- | --- |
| `--mcp-ui-bg` | Outer resource-renderer background | Transparent |
| `--mcp-ui-surface` | Cards, panels, menus, input surfaces | White; dark gray-800, with original local exceptions |
| `--mcp-ui-surface-muted` | Headers, secondary/disabled surfaces | Original gray-50/100; dark gray-700/900 variants |
| `--mcp-ui-surface-hover` | Hovered neutral elements | Original gray-50/100; dark gray-700 variants |
| `--mcp-ui-fg` | Primary text | Original gray-700/900; dark gray-100/300/white |
| `--mcp-ui-fg-muted` | Descriptions and secondary text | Original gray-500/600; dark gray-400 variants |
| `--mcp-ui-fg-subtle` | Hints, placeholders, disabled text | Original gray-400 and existing autocomplete RGBA values |
| `--mcp-ui-border` | Decorative borders and dividers | Original gray-100/200; dark gray-600/700 |
| `--mcp-ui-border-control` | Form-field outlines | Original gray-300; dark gray-600, with local variants |
| `--mcp-ui-focus` | Focus ring/border | Original blue-400/500 |
| `--mcp-ui-accent` | Primary action, link, selected text | Original blue/indigo shades |
| `--mcp-ui-accent-fg` | Text on a strong action fill | White |
| `--mcp-ui-accent-hover` | Strong action hover fill | Original blue-700 |
| `--mcp-ui-accent-soft` | Selection and preview backgrounds | Original blue-50/100; dark blue-900 with original alpha |
| `--mcp-ui-accent-border` | Accent borders | Original blue-200/300; dark blue-600/800 |
| `--mcp-ui-danger` | Destructive/error text or strong fill | Original red/rose shades |
| `--mcp-ui-danger-hover` | Destructive hover fill | Original red-700 |
| `--mcp-ui-danger-soft` | Error backgrounds | Original red-50/100; dark red-900 with original alpha |
| `--mcp-ui-danger-border` | Error borders | Original red-200/300; dark red-600/800 |
| `--mcp-ui-warning` | Warning/loading text or strong fill | Original amber/yellow/orange shades |
| `--mcp-ui-warning-hover` | Warning action hover | Original amber-700 |
| `--mcp-ui-warning-soft` | Warning backgrounds | Original amber/yellow/orange soft paints |
| `--mcp-ui-warning-border` | Warning borders | Original amber/yellow/orange border shades |
| `--mcp-ui-success` | Successful/completed states | Original green/emerald shades |
| `--mcp-ui-success-soft` | Success backgrounds | Original green-50/100; dark green-900 with original alpha |
| `--mcp-ui-info` | Ready/information states | Original cyan/sky/teal shades |
| `--mcp-ui-info-soft` | Information backgrounds | Original cyan/sky/teal soft paints |
| `--mcp-ui-info-border` | Information borders | Original cyan/sky/teal border shades |
| `--mcp-ui-secondary` | Processing/comparison states | Original purple/violet/pink shades |
| `--mcp-ui-secondary-soft` | Secondary-state backgrounds | Original purple/violet/pink soft paints |
| `--mcp-ui-highlight` | Table search match | Original yellow-200 and existing dark search paint |
| `--mcp-ui-overlay` | Dialog backdrop | Black at 50% |
| `--mcp-ui-shadow` | Full shadow value, not a color | Existing Tailwind shadow or autocomplete box-shadow |
| `--mcp-ui-scrollbar-thumb` / `--mcp-ui-scrollbar-track` | Scratchpad native scrollbars | Original automatic rendering when unset |
| `--mcp-ui-chart-1` … `--mcp-ui-chart-8` | Series / graph node / pie-point colors | Engine-managed defaults when absent |
| `--mcp-ui-chart-grid` | Chart grid / graph edges | Existing engine defaults |
| `--mcp-ui-chart-axis` | Chart axis border / graph node stroke | Existing engine defaults |
| `--mcp-ui-chart-label` | Axes, legend, graph labels, no-data text | Existing engine defaults |

Typography, spacing and radii are not changed by this release. Native
scrollbars retain their automatic appearance unless the host supplies tokens.
Existing non-color `!important` utilities and the pre-existing
autocomplete selected-state/reduced-motion rules remain; the theme migration
adds no `!important` rule and no global palette selector.

## Host example

```css
.app-theme {
  --mcp-ui-surface: #fff;
  --mcp-ui-surface-muted: #f1f5f9;
  --mcp-ui-surface-hover: #e2e8f0;
  --mcp-ui-fg: #0f172a;
  --mcp-ui-fg-muted: #475569;
  --mcp-ui-fg-subtle: #64748b;
  --mcp-ui-border: #cbd5e1;
  --mcp-ui-border-control: #64748b;
  --mcp-ui-accent: #1d4ed8;
  --mcp-ui-accent-hover: #1e40af;
  --mcp-ui-accent-fg: #fff;
  --mcp-ui-accent-soft: #dbeafe;
  --mcp-ui-focus: #1d4ed8;
  --mcp-ui-chart-1: #1d4ed8;
  --mcp-ui-chart-grid: #cbd5e1;
  --mcp-ui-chart-axis: #64748b;
  --mcp-ui-chart-label: #334155;
}
.dark .app-theme {
  --mcp-ui-surface: #0f172a;
  --mcp-ui-surface-muted: #1e293b;
  --mcp-ui-surface-hover: #334155;
  --mcp-ui-fg: #f8fafc;
  --mcp-ui-fg-muted: #cbd5e1;
  --mcp-ui-fg-subtle: #94a3b8;
  --mcp-ui-border: #475569;
  --mcp-ui-border-control: #94a3b8;
  --mcp-ui-accent: #93c5fd;
  --mcp-ui-accent-hover: #60a5fa;
  --mcp-ui-accent-fg: #0f172a;
  --mcp-ui-accent-soft: #1e3a8a;
  --mcp-ui-focus: #93c5fd;
  --mcp-ui-chart-1: #93c5fd;
  --mcp-ui-chart-grid: #475569;
  --mcp-ui-chart-axis: #94a3b8;
  --mcp-ui-chart-label: #e2e8f0;
}
```

Choose semantic status colors and all series colors appropriate for the host.
Recheck contrast against the actual backgrounds, including hover/disabled
states and chart series. The example is a starting point, not a full theme
or an accessibility certification.

## Portals and mounted graphics

Export menus and dialogs stay mounted under `document.body`. Moving them into
the host container would restore clipping and transformed-parent positioning
bugs. The library copies only effective `--mcp-ui-*` values and local dark
state from the menu trigger or the stationary inline expansion slot. It
updates them while the portal is open and clears stale values when its
anchor changes. `ModalRenderer` uses a hidden inline anchor. Fullscreen
content is still moved, not duplicated.

Canvas renderers read computed tokens from their own roots. Ancestor
class/style/data-attribute changes, token removal and DOM reparenting trigger
an in-place Chart.js `update('none')` or G6 `setOptions`/`draw`, preserving
renderer identity and layout/zoom. Explicit dataset, scale, element, tooltip,
node and edge styles keep precedence. Chart payload objects are shallow-cloned
before the engine adds its generated colors, allowing one payload in multiple
independently themed instances.
Point paint overrides are separate from the line/radar stroke: an explicit
point outline does not block a host series color on the line itself. Live
updates also refresh Chart.js's shared point/bar paints without replacing
their shared option objects or changing non-color settings.

Chart.js tooltips use `surface`, `fg` and `border`; G6 tooltip content reads
those current tokens when shown. An omitted series token leaves its original
engine color. Chart.js's default cycle is seven colors, while configured host
tokens address eight repeating slots. No default palette is installed globally.

Pure stylesheet/CSSOM or media-query changes without a DOM attribute change
are not observed. When switching such a host theme, also update the host's
class or a `data-theme` attribute. The supported light/dark strategy remains
the `.dark` ancestor class.

## Coverage and known accessibility gaps

Migrated: `ChatPrompt`, `UIResourceRenderer` (including table chrome and virtual
rows), `ScratchpadPanel`, `FormFieldRenderer`, `AutocompleteFormField`,
`AutocompleteDropdown`, `GhostText`, `ComponentToolbar`, `ExpandableWrapper`,
`PortalDropdownMenu`, `FormRenderer`, `ActionGroupRenderer`, `ModalRenderer`,
missing-value/degraded/error surfaces, and Chart.js/G6 chrome and canvas colors.

Not fully migrated: map/Leaflet chrome and external tiles, code highlighting
themes, `AgentCard`/`AgentHandoff`/`AgentStatusBadge`, standalone artifact,
carousel, footer, grid/editor, gallery/video and presentation-feedback chrome,
and other renderers outside the list above. Native OS select popups are outside
the library's DOM styling. Hosts should remove old overrides only for migrated
surfaces and retain targeted overrides for these remaining components.

Default colors are preserved even where they miss accessibility targets.
The frozen Chromium fixture measured these existing gaps:

| Measurement | Light | Dark | Target |
| --- | ---: | ---: | ---: |
| Required input / form select / scratchpad select border | 1.47:1 | 1.94:1 | 3:1 |
| Search / choice control border | 1.24:1 | 1.94:1 | 3:1 |
| Required input visible 2px focus ring | 3.76:1 | 3.90:1 | 3:1 |

The represented text measurements reached at least 4.52:1; this is not a full
audit of every field, state or renderer. Supplementary Chart.js 4.5.1 palette
measurements on white put six of seven opaque default colors, and all seven
50%-alpha fills, below 3:1. These are palette measurements, not a rendered
canvas or adjacent-series audit. Changing those defaults would alter existing
appearance, so hosts must supply their own accessible theme where needed.

See [`tests/theme/README.md`](../tests/theme/README.md) for the exact baseline
commit, tool versions, measured deficits and limits. The fixture checks actual
computed styles, not screenshot equality; raster canvas appearance and native
popup pixels are outside that comparison.

## Release handoff

This is a Solid-only 6.25.0 release. The MCP schema and Spec/CLI versions are
unchanged. Hosts can upgrade, bind their design tokens, remove the corresponding
overrides and run their own browser contrast checks. The public release follows
review/CI, the `v6.25.0` tag, then maintainer approval of the staged npm package.
