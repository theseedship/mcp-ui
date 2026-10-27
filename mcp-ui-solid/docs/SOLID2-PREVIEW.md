# Solid 2 preview qualification

> Source preparation explicitly resumed on 2026-10-27 for the `8.0.0-solid2.0`
> candidate: RC.19, stable security carry-over and fresh package qualification
> only. The pause and qualification results below describe the earlier
> `7.0.0-solid2.0` candidate (including historical RC.18 / RC.19 records).
> See the
> [current Deposium handoff](./SOLID2-DEPOSIUM-HANDOFF-2026-10-27.md).
> A version string alone does not qualify a release: bind proof to the exact
> new source HEAD and archive. No release operation or application change is
> authorized by this resumption.

## Current source candidate and release boundary

The candidate manifest is now `8.0.0-solid2.0`, targeting the exact RC.19
runtime/toolchain and the stable Spec 6 / CLI 5.0.2 line. Stable `7.x`, including
future `7.1.x`, remains Solid 1 on npm `latest`; Solid 2 is the opt-in `8.x` line
on `solid2`. Qualification must bind to this exact source HEAD and its archive;
the historical `7.0.0-solid2.0` SHA, archive and checksum do not qualify it.

Before any use of a preview promotion workflow, the separate RC.19 / Spec 6 /
CLI 5.0.2 infrastructure PR must be reviewed and merged into stable main. This
does not merge runtime PR #34. Dispatch, upload, tag, runtime merge and app
installation remain unauthorized. The Deposium host migration is in progress;
installation requires the application team's approval.

## Historical source, workbench and qualification (through 2026-10-24)

At the 2026-10-24 checkpoint, preparation was paused with no resumption date.
That pause is historical; source is now being prepared on `feat/solid2-preview`
and open draft PR #34. The matrix below records only the earlier qualification,
not permission to migrate, merge, release, tag, stage npm or deploy.

The [pause and resumption handoff](./SOLID2-PREVIEW-HANDOFF-2026-10-23.md)
preserves the earlier checkpoint and restart evidence. Its pause instruction
has been superseded by the explicit 2026-10-27 source-preparation resumption;
its archived qualifications remain historical.

## Source and packaging decision

- Initial Solid 1 baseline: `c107b89c862505ab51253c0a28505c70a6e39886`.
- Last integrated stable main: `725f862ac76170c40ab796a1d4773b0dbb90be27`
  (#38). Last qualified functional preview: `96715b9746b259d26219b24a503e92a7106275a4`.
  Later pause-documentation commits are not the source of that CI archive.
- Stable npm `latest` verified on 2026-10-23: `6.25.1` (historical snapshot).
- Isolated branch: `feat/solid2-preview`; the earlier local candidate was
  `7.0.0-solid2.0`. This is not the current package or promotion identity.
- Stable source and lockfile stay in an independent detached checkout.
- Public source condition `solid` does not select a runtime version: only
  install this preview into an independently pinned Solid 2 target.
- Wire schemas, payloads, trust policy, callbacks and citation metadata remained
  in scope for parity. That earlier plan did not change Spec/CLI; the current
  candidate now uses Spec 6 and CLI 5.0.2 and requires fresh qualification.

## Historical exact workbench: RC.18

| Package | Pin |
| --- | --- |
| solid-js, @solidjs/web, @solidjs/signals | 2.0.0-rc.18 |
| @solidjs/compiler, @solidjs/babel-plugin | 2.0.0-rc.18 |
| @solidjs/vite-plugin | 3.0.0-next.51 |
| Vite | 8.3.5 |
| @solidjs/testing-library | 1.0.0-rc.2 |
| Vitest / @vitest/ui | 4.1.12 |
| jsdom | 27.2.0 |
| @tanstack/virtual-core | 3.13.18 |

These are the frozen workbench pins at the pause, not future upgrade advice.
Vitest was updated with stable PR #38; all other listed pins are retained.
The scoped Vite plugin
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
- For this historical candidate, no Spec or CLI source/schema/version change was
  planned. The current candidate carries Spec 6 / CLI 5.0.2 while preserving the
  wire shapes, citations, callbacks and sanitization profiles. Server validation
  callbacks remain synchronous; client notifications run after commit.

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

Historical qualified snapshot `96715b9` (local Node 24.19.0 / pnpm 8.15.0):
build and all three typecheck targets pass; 143 Vitest files, 2,417 passed and one existing GraphRenderer
placeholder skip. Lint passes with zero errors and 424 warnings (Spec 1, CLI 2,
Solid 421), compared with 425 in the unchanged baseline. The Node harness
suites are separate from those Vitest counts. CI run `40036418438`, attempt 1,
passed for that exact functional snapshot. After any branch update, bind new
CI and artifacts to the actual new head; this old success is not inherited.

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

The canonical [pause/resumption handoff](./SOLID2-PREVIEW-HANDOFF-2026-10-23.md)
is included in the package's existing documentation list. It identifies the
preserved CI ZIP and inner tarball, their separate checksums and matching reports.
The older local Node 24 archive and its `source-provenance.json` are historical,
not replacements for the later CI snapshot or a future release candidate.

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

Historical detached source `c107b89c862505ab51253c0a28505c70a6e39886`,
Node 24.19.0 / pnpm 8.15.0, frozen lockfile:

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

## Release and application boundary

This resumption authorizes source preparation and qualification only. Do not
dispatch, upload, tag, merge runtime PR #34, or install into the Deposium host.
Do not use the legacy stable publication workflow: it matches prerelease tags
but stages with `--tag latest`, and the GitHub release workflow marks releases
as stable.

The manual preview channel already on main is pinned to the earlier version,
RC.18 and Spec 5.7.0; do not dispatch it for this candidate. A separate
RC.19 / Spec 6 / CLI 5.0.2 infrastructure PR must first be reviewed and merged
to stable main before any future use of its policy. That merge does not merge
the runtime PR. Later review-only and staging operations still require their
own exact source/CI/artifact binding and explicit approvals; the source PR must
remain open. The current [channel procedure](../../.github/SOLID2_PREVIEW_RELEASE.md)
is the historical 7.x/RC.18 policy, not instructions to use for 8.x.

## Official references

- https://v2.solidjs.com/migration/from-solid-1
- https://v2.solidjs.com/migration/from-solid-start
- https://v2.solidjs.com/migration/data-fetching-from-solid-1
- https://v2.solidjs.com/reference/vite-plugin-solid/start
