# Solid 2 preview qualification

Status: locally qualified preview on the documented matrix, not published. This branch is not
the Solid 1 production line. No release, tag, npm staging or deployment is
authorized by this document.

## Source and packaging decision

- Source: main `c107b89c862505ab51253c0a28505c70a6e39886`.
- Stable npm `latest` verified on 2026-10-23: `6.25.1`.
- Isolated branch: `feat/solid2-preview`; proposed local version
  `7.0.0-solid2.0`. Same package name, separate artifact/channel only.
- Stable source and lockfile stay in an independent detached checkout.
- Public source condition `solid` does not select a runtime version: only
  install this preview into an independently pinned Solid 2 target.
- Wire schemas, payloads, trust policy, callbacks and citation metadata remain
  in scope for parity; Spec and CLI do not need version changes.

## Exact workbench

| Package | Pin |
| --- | --- |
| solid-js, @solidjs/web, @solidjs/signals | 2.0.0-rc.18 |
| @solidjs/compiler, @solidjs/babel-plugin | 2.0.0-rc.18 |
| @solidjs/vite-plugin | 3.0.0-next.51 |
| Vite | 8.3.5 |
| @solidjs/testing-library | 1.0.0-rc.2 |
| Vitest / @vitest/ui | 4.1.11 |
| jsdom | 27.2.0 |
| @tanstack/virtual-core | 3.13.18 |

These published versions were checked on 2026-10-23. The scoped Vite plugin
replaces the old wrapper; the runtime, renderer and JSX types move together.
The old Seroval override is removed because the renderer owns its matching
Seroval/Seroval-plugins 1.7.0 serialization dependencies. The Solid 1 virtualizer
adapter cannot run in this tree. Its replacement is a small imperative TanStack
core bridge with no hidden Solid root. The owning table dynamically loads the
optional namespace; optimized consumers without the peer still build.

The plugin's transitive vitefu 1.1.1 has an outdated Vite <=7 peer declaration,
while the scoped plugin supports Vite 8/9. The workspace install reports that
metadata warning; no runtime alias or old serializer override hides it.

## Runtime and public package decisions

- JSX DOM types and render/Portal/SSR APIs come from `@solidjs/web`; core,
  stores, contexts and scheduler come from `solid-js` RC.18. Store updates use
  draft callbacks, effects track inputs in compute and return cleanup in apply.
- Ordinary UI writes are staged. Public imperative scratchpad/capability handles,
  prompt controllers and externally supplied stream callbacks observe committed
  state. Explicit flushes are restricted to those observation boundaries.
- Optional contexts use explicit null defaults, normalizing their historical
  undefined-facing hooks; merge sources filter undefined to retain old defaults.
- Portals install effects under their component owner, not inside ref callbacks.
  Expansion reparents the original DOM instead of remounting visualizations.
- Source `solid` and explicit `/src/*` entries are retained for host compilation.
  Browser distributions live in `dist/`; real SSR distributions in `dist/server/`.
  Node/worker import/require conditions select the server graph, while browser
  defaults select the client graph. Declarations remain at the advertised paths.
- The ten runtime entries are root, components, hooks, types, validation,
  types-only, adapters, adapters/presentation, plugins/duckdb and plugins/katex.
  The KaTeX entry is explicitly opt-in and requires its peer. Other engines stay
  lazy; no optional engine or monorepo dependency graph is bundled into the package.
- No Spec or CLI source/schema/version change is needed. Wire shapes, citations,
  callbacks and sanitization profiles stay unchanged. Server validation callbacks
  remain synchronous; client notifications run after commit.

## Reproduction and clean-package gates

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm lint
pnpm -r exec vitest run --maxWorkers=4
node --test mcp-ui-solid/tests/solid2/harness.node-test.mjs
```

Use `pnpm pack --pack-destination /absolute/dedicated/artifacts` from each package
directory, not `pnpm --filter ... pack` (pnpm 8 adds unsupported recursive flags).
The full clean-consumer instructions, exact engine pins and durable evidence
layout are in [the repository harness guide](https://github.com/theseedship/mcp-ui/blob/feat/solid2-preview/mcp-ui-solid/tests/solid2/README.md). Each consumer uses
an independent manifest and lockfile, no workspace resolution, no host backend,
real account or chargeable request. CI creates local-only tarballs, executes both
profiles in dev/optimized Node SSR plus Chromium and retains reports/locks/logs.
Its independent Solid 1 job checks the original commit with its own lockfile.

When consuming the `solid` source condition in Vite dev, its plugin deliberately
excludes the library itself from prebundling. Installed CommonJS engines must be
included explicitly, otherwise browsers may receive their raw CommonJS modules.
The qualified host includes installed Leaflet/markercluster, G6, highlight.js,
Chart.js/auto and chartjs-plugin-zoom using Vite's standard nested dependency
syntax (`@seed-ship/mcp-ui-solid > engine`). Omit entries for peers not installed;
the optional-absent profile has no such inclusions. This is host configuration,
not a runtime alias, forced interoperability shim or an engine dependency of the
library. See the [actual host config](https://github.com/theseedship/mcp-ui/blob/feat/solid2-preview/mcp-ui-solid/tests/solid2/consumer/vite.config.ts) and
[Vite's nested CommonJS guidance](https://vite.dev/config/dep-optimization-options#optimizedeps-exclude).

Current local source results (Node 24.19.0 / pnpm 8.15.0): build and all three
typecheck targets pass; 143 Vitest files, 2,414 passed and one existing GraphRenderer
placeholder skip. Lint passes with zero errors and 424 warnings (Spec 1, CLI 2,
Solid 421), compared with 425 in the unchanged baseline. The Node harness
suites are separate from those Vitest counts. Hosted CI is a separate gate.

The real-package full and optional-absent profiles pass in dev and optimized
production, including the generated Node SSR host. The full host records six
core gates and six native-engine gates per mode. The compiled-browser probe
separately imports all ten public entries without the Solid compiler/source
condition. There are 14 Node harness/static-loader tests in three suites.
Unexpected runtime/ownership/hydration errors and real external requests are
rejected; one exact intentional SSE fixture error is recorded, not suppressed.
The negative server error-boundary test deliberately retains its contained-error
diagnostic and verifies that both fallback and host notification occur once.
Native Canvas2D readback and large test-bundle warnings remain visible.

Actual source-condition engines exercised: Chart.js including finite zoom/reset,
Leaflet markers and local synthetic tiles, G6 dagre (three nodes/two directed
edges), highlight.js and KaTeX. Each engine mounts once and keeps its DOM across
two outer expansion/citation cycles. The Chart SDK's own zoom-policy changes
still reconfigure it as before; the handoff distinguishes these observations.
PMTiles/DuckDB namespace/API/build paths are covered without running their
data/Worker/WASM engines. Do not extrapolate that limited proof to initialization.

Do not infer success from static harness checks or mocks: Q1 found real hydration
namespace drift and a build failure against Vite's absent optional-peer stub.
Both are reproduced by the real consumer and corrected in Q2. Captured historical
6.23 table DOM is not recaptured: only theme utilities, opaque linked title IDs,
empty compiler anchors and attribute order are normalized; content/attrs remain
compared. The current validation limit is 100 table rows, so the consumer exercises
100 valid virtualized rows without bypassing the trust/resource limits.

## Deposium Solid 2 integration handoff

The concise [pilot handoff](./SOLID2-PREVIEW-HANDOFF-2026-10-23.md) ships in the
package too; final Git SHA, archive checksum and matching report paths are
delivered together in the durable artifact's `source-provenance.json`.

Read-only inventory found 38 static imports across 32 files (22 production files):
34 root imports, three `/validation`, one `/plugins/katex`, and ten lazy root
imports across five files. The app scans published `src/**/*.{ts,tsx}` for CSS.
No production `/src/*` JS import was found; the fixture explicitly checks one.

Important consumers are the root config provider, ChatBusSetup, ChatInterfaceStreaming,
ChatUIIsland, GenerativeDashboardLayout, ServerCapabilitiesInit, scratchpad stream
dispatch, server API validation and the localization/math bridge. ChatUIIsland's
capture routing depends on component IDs, nearest `role="group"`, child action
order/normalized labels, and excluding `data-mcp-ui-action` controls. These DOM
contracts, citation page/file metadata and default-disabled submit reconstruction
are retained. Capabilities keep unknown extension fields and bus/SSE callbacks
remain distinct, including HITL-paused completion semantics.

Install the approved identified tarball only into the separate Solid 2 target;
pin both required runtime peers and compiler together and commit that target's
lockfile. Solid DOM type imports in host code move to `@solidjs/web`; MCPUI public
import names and wire payloads do not need migration aliases. Provide KaTeX and
other desired engines explicitly at the qualified versions. Do not install a
Solid 1 virtual adapter into that target.

The host still needs its own Solid 2 lifecycle port. For example, the inspected
`ServerCapabilitiesInit.tsx` calls `onMount(async ...)`; port it to a synchronous
`onSettled` callback that launches/cancels the asynchronous work. Keep store
dispatch outside pure component/root constructors, in events, parser callbacks
or effect apply phases. Do not broadly add flush to host computations: the public
imperative MCPUI methods already preserve immediate observation contracts.

The synthetic host proves library behavior, not the real Deposium chat bus,
backend, auth, deployed adapter or product interaction. Those remain the next
integration gate. Keep staging references/deployments separate from the current
production main. Roll back by checking out/deploying the old application and its
lockfile, never by inserting the Solid 1 renderer into the Solid 2 reactive tree.

## Fresh Solid 1 baseline

Detached source above, Node 24.19.0 / pnpm 8.15.0, frozen lockfile:

- Build and typecheck pass; lint has 0 errors and 425 existing warnings.
- Spec: 166 tests; CLI: 7; Solid: 2,182 plus 1 existing skip.
- Total: 2,355 passed, 1 existing skip, no initial failures.
- Chromium 153.0.8010.12 / Tailwind 4.3.3: 18 default-style groups match the
  frozen 6.24.0 fixture; host tokens and portal lifecycle checks pass.
- Baseline source remains clean. These results do not qualify the preview.

## Initial inventory and qualification gates

110 production source files, 70 importing Solid. Two store modules use the
removed store path; 18 files use effects, 11 mount callbacks and 24 cleanup.
No production createResource call was found. Bus services are framework-free,
but their reactive stores, context providers and imperative consumers are not.
Keep singleton identity, synchronous imperative store handles, subscription
disposal and multi-instance isolation under explicit tests.

The public package retains source, ESM/CJS/type entries, CSS, lazy optional
engines, validation and adapters. Consumer integration additionally relies on
`data-mcp-ui-component-id`, `role="group"`, action order and
`data-mcp-ui-action`, plus scanning published TSX source for Tailwind classes.

Before claiming completion: preview build/types/tests; exact tarball in a clean
host; all supported entry imports; dev and optimized SSR/hydration in Chromium;
large virtualized tables; optional engines/math; portal/citation identity;
streaming cancellation/remount/listener counts; two-instance isolation;
unchanged sanitation and wire fixtures; CI running the new checks.

## Release prohibition

Do not push a preview tag or dispatch the current publication workflow. It
matches prerelease tags but stages with `--tag latest`; the GitHub release
workflow also marks releases as stable. A separate reviewed preview-channel
change and explicit approval of SHA, version, tarball and dist-tag are required
before any publication. First delivery is a durable local tarball with SHA-256.

## Official references

- https://v2.solidjs.com/migration/from-solid-1
- https://v2.solidjs.com/migration/from-solid-start
- https://v2.solidjs.com/migration/data-fetching-from-solid-1
- https://v2.solidjs.com/reference/vite-plugin-solid/start
