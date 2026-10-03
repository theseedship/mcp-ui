# GeoAI daily forecast: local example (SYNTHETIC FIXTURE)

This directory shows how a host can present a daily-forecast result with the
existing MCP-UI components and the three presentation recipes
(`createComparisonLayout`, `createGeographyLayout`, `createEvidenceLayout`).
It answers section 7 of the brief `2026-10-03-mcp-ui-geoai-display-brief.md`.

**All data here is invented.** Places carry "(fixture)", the numbers are
made up, and nothing is real weather. Lyon, Brest and Grenoble use their
real coordinates only so that latitude/longitude order can be checked.

## What this is, and what it is not

| It is | It is not |
| --- | --- |
| A LOCAL EXAMPLE in the source checkout, outside the package `files` list | A published package API (nothing here is exported or released) |
| Built against the working-tree `src/` (6.24.0) | The version installed by Deposium (the brief saw 6.23.0 in Solid) |
| Checked in jsdom with Chart.js and Leaflet mocked | Behaviour observed in the deployed chat, or a browser recipe |

Signature, cross-tenant access and re-authorization tests stay in MCPs and
Solid. Streaming then reload (one instance per view, right message, same
data) needs a test in the application.

## Files

- `fixture.ts`: the host-prepared presentation model. It is not the private
  GeoAI receipt: MCP-UI never sees signatures or scopes.
- `build-layouts.ts`: plays the host's role. Totals, maxima, coverage and
  covered dates are computed here, because the brief puts statistics on the
  host. Units come from the model.
- `geoai-daily-forecast.test.tsx`: the checks below.
- `../../tsconfig.examples.json`: type-checks the example against `src/`.

## The fixture covers

- Two successful places and one failed place (Grenoble, `upstream_failed`,
  no rows, no series).
- Three ISO dates; precipitation (`mm`) and wind speed (`km/h`), units read
  from the model.
- A real zero (Lyon rain on 2026-10-04), distinct from a missing value.
- One missing cell (Lyon wind on 2026-10-05) and one entirely missing series
  (Brest wind).
- A partially different period: Brest has no value on 2026-10-06. The date
  stays on every axis and in every table.
- A threshold result exactly at an inclusive threshold (Lyon wind 31 km/h,
  `≥ 31`, exceeded), computed by the host.
- A threshold result with a decimal value just below an inclusive threshold
  (Lyon rain 4.2 mm on 2026-10-05, `≥ 4.25`, not exceeded), computed by the
  host. The value is the real one of the series, and neither number may be
  rounded on display.
- Provenance with unknown fields (model, model issue time, source URL are
  `unavailable`; the collection time is not the model issue time).

## Views and the brief's criteria

| View (layout key) | Built with | Brief criterion covered |
| --- | --- | --- |
| `header` | text | Places, dates actually covered, "Numerical forecast", provider/model, failed place named |
| `daily` | table | One row per place and date, readable names with units, `null` kept as `null`, mark + legend |
| `chart-rain` (bar), `chart-wind` (line) | chart | One variable and unit per chart, one series per place, ISO category labels (no `timeAxis`, no iframe), gaps visible, whole-series-missing note |
| `comparison-rain`, `comparison-wind` | `createComparisonLayout` | Same period for every place; a total or maximum only when complete, otherwise `null` plus an explicit available-days figure and coverage ("2 of 3 days") |
| `geography` | `createGeographyLayout` | Queried points, labels, `fitBounds`, same coordinates in the table; markers `[lat, lon]` |
| `thresholds` | table | Place, date, value, unit, operator, threshold, host result unchanged; a decimal value and threshold shown unrounded |
| `evidence` | `createEvidenceLayout` | Provider, model, collection and capture times, licence, unknowns as `unavailable`, no link, no invented timestamp or citation |

Test sections in `geoai-daily-forecast.test.tsx`:

- a. Every component passes `validateComponent` and its `@seed-ship/mcp-ui-spec` schema.
- b. Parity: chart labels equal the model dates, chart values equal the daily-table cells, no zero where a value is missing, the failed place only in the header, no partial figure presented as a complete total.
- c. Coordinates: `[lat, lon]` markers equal the geography table; any GeoJSON must be `[lon, lat]`.
- d. The threshold rows: a value exactly at an inclusive threshold, and a decimal value just below one (4.2 against `≥ 4.25`, unrounded); host verdict unchanged, never recomputed from the numbers; every value exists in its series.
- e. Unknown provenance written as `unavailable`; no link, URL, citation, file id or invented timestamp.
- f. Rendering with `UIResourceRenderer`: no validation error card, `[data-mcp-missing-value]`, `[data-mcp-missing-legend]`, `[data-mcp-chart-notes]` with `gaps`, `bars` and `no-data` notes, the real zero rendered as `0`, lines that break at a missing value (`spanGaps: false`), the thresholds table showing `4.2` and `4.25` exactly as given, and export parity of the daily table.

Export parity (the daily table's CSV keeps the real zero as `0` and writes an
empty field for a missing value, its JSON keeps `null`) and the display
fidelity of a decimal value below an inclusive threshold (`4.2` against
`≥ 4.25`, shown unrounded, verdict unchanged) are now tested here.

Not covered here (needs a browser or the app):

- Narrow-screen layout, keyboard use, screen readers and contrast.
- Comprehension without colour alone and without hover. This needs a browser
  review: chart and map tooltips are hover-only, and the tables and the notes
  under the charts are the non-hover path.
- Genuinely different per-place date windows. The fixture shares one date grid
  and models a shorter coverage as nulls.
- PNG export of a chart.
- Streaming then reload.

## Run it

From `mcp-ui-solid/`:

```bash
npx vitest run examples/geoai-daily-forecast
npx tsc --noEmit -p tsconfig.examples.json
npx eslint examples/geoai-daily-forecast
```
