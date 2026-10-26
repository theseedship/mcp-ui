# Zod 4 on the stable Solid 1 line — 2026-10-26

## Authority and boundaries

Implements the [Deposium brief at c4835ec5d](https://github.com/theseedship/deposium_solid/blob/c4835ec5d/docs/handoffs/BRIEF-MCPUI-ZOD4-STABLE-2026-10-26.md)
from stable main `725f862ac76170c40ab796a1d4773b0dbb90be27`, in isolated branch
`fix/zod4-stable-security`. The dirty shared checkout is untouched. This is
preparation of installable stable packages, not publication authorization.

Solid remains 1.9.17 in the producer lock with the unchanged `^1.9.0` peer.
No Solid 2 runtime, visual redesign, MCP protocol change, toolchain upgrade,
Deposium change, SQL access or deployment is included. PR #34 and its preserved
branch remain paused; no preview workflow or archive is consumed here.

## Versions and SemVer decision

| Candidate | Version | Reason |
| --- | --- | --- |
| Spec | 6.0.0 | Its public schema objects and inferred Zod types move from Zod 3 to 4. |
| MCPUI Solid | 7.0.0 | Conservative compatibility boundary for the Spec 6 minimum and public Spec-derived types. It still uses Solid 1 and does not directly export Zod schema classes. |
| CLI | 5.0.2 | The public file/options command functions remain unchanged; Zod is an internal dependency and the additional changes fix packaging/validation defects. |

All three declare exact Zod `4.6.6`, the corrected version requested by the
brief. Solid and CLI declare `workspace:^6.0.0` for Spec; pnpm pack converts
this to public `^6.0.0`. A consumer-only override to the exact local Spec tarball
allows testing these unpublished candidates; it is not a source alias or a
replacement for publishing Spec first. No workspace override pretends to fix
old installed application copies.

The old unpublished `7.0.0-solid2.0` experiment is historical, not an alternative
package for this stable Solid 1 candidate. If Solid 2 is resumed later, reassess
its package version and reviewed channel policy. Do not publish that old archive
or widen its peers to reconcile the numbers.

## Compatibility decisions

- Convert the 20 Spec and three connector single-argument records to explicit
  string keys. The existing two-argument `citationMap` contract is untouched.
- Remove six inert inner defaults whose Zod 3 outer `.optional()` prevented
  materialization. Preserve both absent keys and own keys with `undefined` in
  grid, security, performance and component metadata; tests compare complete
  parsed objects with `toStrictEqual` and ownership checks.
- Make raw macro outcome `content` explicitly optional, preserving the old
  acceptance of missing/undefined content. Other stored macro shapes stay valid.
- Give gallery transforms truthful string-input/numeric-literal-output types
  and recursive macro schemas explicit input/output types, without `as any`.
- Preserve Solid's application `ValidationResult.errors[].code` and `params.*`
  paths. Human-readable native Zod diagnostics may differ, for example missing
  text changes from `Required` to `Invalid input: expected string, received
  undefined`. The invalid payload is rejected in both versions and the renderer
  still shows the same validation-notice structure; no renderer code is changed.
- CLI uses `ZodError.issues`, not its removed `errors` alias. Ajv's separate
  `validate.errors` is retained. Existing JSON Schema hostname/URI constraints
  are registered with the official formats plugin, not disabled. Zod and JSON
  Schema are not identical: a hostname can pass the former and fail Ajv, as an
  explicit regression test demonstrates.

## Pre-existing packaging gates repaired

The baseline build passed while emitted-package contracts were broken:

- Spec `/schemas` pointed to nonexistent JS/CJS files and its build deleted a
  declaration folder still referenced by `types.d.ts`.
- CLI's advertised declarations were not produced by its canonical build, its
  JSON Schema lookup relied on repository layout, and CommonJS default interop
  made Ora non-callable.
- Strict NodeNext consumers encountered extensionless declaration references
  in Spec and Solid, including copied CJS wrappers targeting the ESM graph.

The build retains the complete Spec declaration graph, exposes the actual
runtime subpaths and JSON Schema, emits CLI types, and normalizes real emitted
declarations using TypeScript AST nodes. ESM references use explicit `.js` and
the complete CJS declaration graph uses `.cjs`/`.d.cts`; unresolved relative
references fail the build. Bare imports and comments are not rewritten. These
are qualified against installed tarballs, not only source aliases.

## Measured baseline and regressions

Producer toolchain: Node 24.19.0, pnpm 8.15.0, TypeScript 5.9.3, Vitest 4.1.12.
Hosted CI uses Node 22 and is an independent gate; no Deposium tool installation
or pnpm 10 conversion substitutes for this repository's frozen lock.

- Baseline main build/types/lint pass: 128 files, 2,355 tests passed plus one
  existing skip; zero lint errors and 425 existing warnings.
- New compatibility tests pass on Zod 3. Under Zod 4 before source adaptation,
  omitted-default and missing-macro-content cases fail, then pass after the fix.
- On real Zod 3, three visit-counter tests fail because bounded collections are
  walked before rejection. Real Zod 4.6.6 rejects leading oversized bounds with
  zero visits, including synchronous/asynchronous and compiled paths. Controls
  show that allowed values are transformed, overwrite order matters, and
  unbounded collections still visit every element. No OOM or timing claim.
- CLI's removed error alias and missing format registration reproduce real
  failures before the corresponding fixes, then pass with the real parsers.
- Existing baseline emitted-package failures and candidate failure logs are
  retained separately; they are not described as regressions caused by Zod.

Exact final counts, tarball SHA-256 values, actual installed resolutions and
consumer/browser reports are generated by the verification scripts and recorded
with the PR/CI artifacts. Intermediate archives are not release candidates.

Final local source gates: 133 Vitest files, 2,379 passing tests and the same one
existing GraphRenderer skip; build and all source/contracts/examples typechecks
pass, lint has zero errors and 425 existing warnings. The declaration-finalizer
tests and offline release safeguards contribute 50 separate Node tests.

The independent packed consumer passes strict NodeNext ESM/CJS and Bundler
typechecks across root/component/hook/validation/adapter public declarations,
with non-`any` renderer signatures. All three packages resolve Zod 4.6.6 and
Solid/CLI resolve the exact same packed Spec. Actual CLI ESM/CJS calls qualify
both successful registry validation and Ajv-only hostname rejection.

Chromium qualifies the full and optional-absent profiles under pinned Solid
1.9.17, Vite 6.4.5 and plugin 2.11.10. Table/citation/fullscreen/copy, Leaflet
marker and escaped tooltip, G6 canvas, optional KaTeX MathML, fallback states
and cleanup are exercised with no page/console errors. Two full-profile Leaflet
icon attempts are served locally; no external network reaches a remote host.
The host uses normal nested CommonJS prebundling for installed engines, not a
runtime alias. Missing-peer warnings are recorded in the absent profile.

### Preserved baseline SSR boundary

Plain Node loading of compiled Solid root/components still throws the existing
client-only error under server conditions, reproduced with baseline tarballs.
This lot does not add a new server distribution graph. Runtime-free validation
and the other supported Node entries are checked independently; optional KaTeX
is not loadable without its peer. These exceptions are reported, not called
successful plain-Node SSR imports.

The real Solid 1 SSR probe instead compiles the **installed tarball's public
`solid` source condition**, as intended by the existing host contract. Its
client independently uses installed emitted `dist`, not repository aliases;
table SSR/hydration and cleanup pass. The source/dist distinction is recorded
in resolution evidence. The baseline passes the same optional-absent fixture.
This does not establish compatibility with the real Deposium application.

## Security and resource limits

Fresh full audits on matching baseline/current locks: five distinct advisories
before (one HIGH Zod, two moderate/two low fast-uri), four after (the same
fast-uri entries). Production audit after migration still has those four
entries. Audit exit status remains nonzero; there is no clean-audit claim.

The [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)
handles leading upper bounds before element parsing; it does not protect
unbounded schemas or unlimited request bodies. Zod 4's distribution also
contains a legacy `/v3` subpath: testing the installed active v4 parser and
scanning MCPUI source/output for legacy imports is the gate, not claiming the
upstream tarball contains no legacy files.

The existing `validateComponent` size check still accumulates
`PAYLOAD_TOO_LARGE` then calls the actual schema parser. Its size measure is
`JSON.stringify(component).length`, not UTF-8 bytes. A small real-parser spy
regression records this unchanged behavior; no arbitrary new map/table caps or
claim of universal payload hardening is included. A fail-fast change would be
a separate reviewed hardening commit, with its own public-error contracts.

## Reproduction and release gates

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm lint
pnpm -r exec vitest run --maxWorkers=4
node --test scripts/finalize-declarations.test.mjs scripts/solid2-preview/verify.test.mjs
```

The Spec typecheck compiles existing type assertions and new contracts, not
just Vitest. The independent consumer runner in `scripts/zod4-stable/` accepts
actual packed Spec/Solid/CLI paths and expected versions. It checks installed
resolutions, public entries and strict NodeNext/Bundler declarations without
`skipLibCheck`; real Chromium/SSR probes report their graph/conditions and any
baseline limitations explicitly. JSDOM tests are never called browser proof.

Before publication: require green CI/review and separate explicit approval.
Stage/publish Spec first, verify it is public, then stage Solid with the
qualified Spec minimum (and CLI when requested). Keep the pnpm-pack → npm-stage
flow. An upload is not a public release: maintainer npm 2FA remains separate.
Check public/staged state before retrying; no blind version bump, duplicate
stage, Git tag, workflow dispatch, preview or `latest` mutation is authorized
by this record. Deposium consumption requires its own worktree/tests/build/PR.
