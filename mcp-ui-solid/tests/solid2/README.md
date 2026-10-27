# Solid 2 clean-tarball qualification

### Native-engine identity and zoom scope

The engine fixture tests the real Chart.js renderer's own fullscreen first,
under its default `chartZoom: 'expanded'` policy. It waits for the actual zoom
plugin API, clicks **Zoom in**, verifies the reported zoom level increases,
clicks **Reset zoom**, and verifies the original level returns. The report
archives SDK instance IDs before, during and after that gate. Changing zoom
options can reconstruct Chart.js under the renderer's existing lifecycle; this
gate does not claim invariant SDK identity across configuration changes.

Only afterward does it establish the strict baseline for two outer-wrapper
fullscreen/citation cycles without changing chart parameters or zoom policy.
Those cycles require stable Chart.js/Leaflet instance identity, all ordered G6
canvas-layer identities, component mount counts and exactly-once citations.
G6 may keep its background canvas empty: readiness requires actual painted
pixels on at least one native layer, and rejects an entirely unpainted stack.
The hierarchical diagram fixture is native G6 dagre with three synthetic nodes
and two directed edges. A Mermaid iframe/service integration is not qualified.

On failure, the engine JSON includes `failureReadinessSnapshot`: Chart registry
ID and zoom API state, dimensions/paint state for every Chart/G6 layer, Leaflet
container/marker/loaded-tile counts and highlighted-code keyword count.

This harness is local-only. It never packs, publishes, installs dependencies, or
changes the library package. Preparation copies authored fixture files into a new
empty durable consumer and writes that consumer's manifest. No aliases, library
workspace links, Solid 1 compatibility layers, or diagnostic suppression are used.
Do not run it against production services or a real account.

## Preparation and installation gates

Run after the library has been built and the maintainer supplies its tarball:

```sh
node mcp-ui-solid/tests/solid2/run.mjs prepare \
  --tarball /absolute/artifacts/seed-ship-mcp-ui-solid-7.0.0-solid2.0.tgz \
  --spec-tarball /absolute/artifacts/seed-ship-mcp-ui-spec-6.0.0.tgz \
  --consumer /home/nico/worktrees/mcp-ui-solid2-consumer-full \
  --profile full
```

`--spec-tarball` is optional: omitting it pins public Spec `6.0.0`, not a workspace
dependency. The source tarball is hashed during preparation and rechecked before
every probe/run. An existing nonempty consumer is never overwritten. To repeat a
qualification, reuse the installed consumer with `run` or choose a new directory.

Installation is a **separate authorized action** in the generated consumer:

```sh
pnpm install --ignore-scripts
# Retain pnpm-lock.yaml. Subsequent installs use --frozen-lockfile --ignore-scripts.
```

The generated `.npmrc` disables automatic peer installation. Full profile lists
every browser engine explicitly at the exact locally inspected versions, including
KaTeX `0.18.4` and TanStack virtual-core `3.13.18`. It pins Solid/web/signals/compiler/
  Babel `2.0.0-rc.19`, scoped Vite plugin `3.0.0-next.51`, Vite `8.3.5`, explicit
  Babel core `7.29.6`, and Node types `22.19.11`.
The runner rejects package realpaths outside its own consumer. pnpm's internal
consumer-local symlinks are normal; linking to the MCPUI source checkout is not.

## Import, optional-absent, SSR and browser matrix

```sh
node mcp-ui-solid/tests/solid2/run.mjs probe --consumer /home/nico/worktrees/mcp-ui-solid2-consumer-full

MCP_THEME_BROWSER_DEPS=/home/nico/code_source/tss/deposium_fullstack/deposium_solid/node_modules \
MCP_THEME_CHROMIUM=/home/nico/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
node mcp-ui-solid/tests/solid2/run.mjs run \
  --consumer /home/nico/worktrees/mcp-ui-solid2-consumer-full --mode both
```

The probe imports each concrete public runtime entry through ESM and CJS under
ordinary Node conditions and verifies every advertised export target exists.
This includes the actual published server-distribution entry when supplied by the
package's `node` condition. It also verifies shipped source files. It does not
claim that Node can execute uncompiled TSX.

Dev and production are separate runs. Dev uses the official plugin's generated
SSR/hydration entries. Production runs `vite build`, verifies client manifest plus
server/server.js and server/node.js, then executes the generated Node server.
Both compile the package's public `solid` source condition; an additional explicit
`./src/components/SafeHtml.tsx` import exercises the supported source export.
App and Document use the documented `HydrationScript` contract; no custom entry,
legacy SolidStart/Vinxi server, alias, or interop wrapper is introduced.
The pinned plugin's shipped README and generated handler take precedence over
the older website middleware example: next.51 calls `(event, next)` with
`event.request` and an argument-free `next()`, not `(request, next)`.

Development host requirement: the scoped Solid plugin excludes `exports.solid`
packages from prebundling. Their lazy nested CommonJS peers therefore need the
standard Vite `optimizeDeps.include` entries, such as
`@seed-ship/mcp-ui-solid > leaflet`, `> leaflet.markercluster`, `> @antv/g6`, and
`> highlight.js`, plus `> chart.js`, `> chart.js/auto` and `> chartjs-plugin-zoom` so the lazy auto entry and the host's
Chart registry share the optimizer's actual module graph. The fixture adds only peers explicitly installed by its own
manifest, so optional-absent includes none. This follows [Vite's nested CommonJS
guidance](https://vite.dev/config/dep-optimization-options#optimizedeps-exclude),
not an alias, runtime wrapper or forced `needsInterop` setting. Production has a
separate real bundle gate. Results qualify this Vite integration, not all bundlers.

Prepare and install a **second independent consumer** with `--profile optional-absent`
and run `probe` **and `run --mode both`** there. Its optional peer resolution must fail for every optional
engine. Importing the deliberately opt-in KaTeX plugin is expected to report only
the missing KaTeX peer; every other public import must succeed. The independent
optional-absent App runs the real Vite dev and optimized SSR/browser graph for
plain text, a nonvirtualized sortable table, a source import, and the visible
missing-G6 fallback. No synthetic resolver, alias, fake engine module, or test
mock is provided: Vite resolves the installed package's optional-peer metadata.
The full profile separately runs the richer browser qualification below.

Browser assertions cover:

- SSR sentinel DOM identity through hydration; text, sanitizer, real KaTeX MathML,
  source export, citation metadata, and table label references;
- sorting, exact raw TSV/citation values, actual CSV download and real virtual-core
  scroll of 100 rows with bounded rendered row count (the unchanged default
  validator rejects more than 100 rows; this harness does not bypass it);
- modal Escape/focus, two expand cycles, live theme variables, light/dark styles,
  unchanged canvas DOM node and mount count, citation callback/page/document;
- two independent bus providers, listener counts, callbacks, disposal/remount;
- real local SSE fragments, success/error, explicit stop, unmount cancellation,
  remount, fetch abort counts, and absence of late callbacks;
- runtime errors, hydration/ownership diagnostics, duplicate package mounts, and
  accidental external network requests (blocked and treated as failures).

After these primary checks pass, the full fixture explicitly starts the real
Chart.js, Leaflet, G6 and highlight.js renderers. `engines-browser.mjs` checks drawn
canvas pixels, live Chart instance identity, Leaflet instance/markers/tiles,
syntax highlighting, repeated fullscreen/citation cycles, DOM identity, listener
counts and unmount. Its report is separate. Synthetic map tiles and three exact
Leaflet marker image URLs are fulfilled locally; no provider/CDN data is fetched.
An earlier failing primary gate means the real-engine gate was **not reached**.

Clipboard is explicitly instrumented in the browser, not written to the user's OS.
SSE is served entirely by the fixture middleware. Playwright is loaded from the
external existing tooling path; it is not added to the consumer dependency graph.
Evidence (raw SSR HTML, browser JSON, screenshots, CSV, server/build logs and final
report.json) is retained under the consumer's `qualification-results/` directory.
A failure exits nonzero and preserves evidence. There is no automatic retry: stop
after two failures at the same gate and report them for review.

## Static checks before a tarball is available

```sh
node --check mcp-ui-solid/tests/solid2/run.mjs
node --check mcp-ui-solid/tests/solid2/browser.mjs
node --check mcp-ui-solid/tests/solid2/import-probe.mjs
node --test mcp-ui-solid/tests/solid2/harness.node-test.mjs mcp-ui-solid/tests/solid2/dist-browser.node-test.mjs
```

These checks do **not** prove the consumer installs, builds, hydrates, or passes
the browser matrix. Record those stages only after execution against the exact
tarball. The preview CI packs the real packages, runs both profiles and the
separate compiled-browser probe, and retains the inputs, lockfiles and reports.

Known scope gaps: external Mermaid/iframe diagram integrations beyond the local
G6 dagre hierarchy; pointer/touch drag and resize; the real
Deposium chat bus/backend;
cross-browser engines; actual deployment adapters. Table selection is not claimed:
the current public table contract has no row-selection API. Cipher/credential,
storage, account, and deployment behavior are deliberately out of scope.
The main runner's browser graph uses the source condition. Browser execution of
the published client-distribution condition is a separate qualification gate,
not something proved by the Node import probe or this source-condition SSR run.
