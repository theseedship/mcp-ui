# Solid 2.0.0 adapter qualification — 2026-11-18

## Candidate, not a second port

`@seed-ship/mcp-ui-solid@8.0.0-solid2.4` starts from the existing 8.x port at
`origin/feat/solid2-preview`, observed source
`4d7c6d08ab2b919e7f306b0d58a9513a0723c81d` (PR #34). It recompiles that adapter;
it must not replace the port with code from the old canonical checkout.
Its intended npm channel is `solid2`. Source version, qualification, staging,
public publication and application integration remain separate gates.

Published `.3` has exact RC.21 runtime peers. It does **not** support stable
2.0.0; preserve its incompatibility diagnostic. Do not use a peer exception,
runtime alias or a forced override to claim compatibility.

## Coherent build and host

The required `solid-js` and `@solidjs/web` peers are exactly `2.0.0`. Producer
and test consumers also pin signals, compiler and Babel plugin to `2.0.0`,
and `@solidjs/vite-plugin` to `3.0.1`. Node must be >=22.12.0. Use repository
pnpm 8.15.0 and a frozen lockfile after regeneration. Keep the serializer
pair owned by the stable runtime; do not carry the RC.21 Seroval override
or assume its old resolution is valid for stable.

The optional KaTeX peer stays exactly `0.18.4 || 0.18.5`. Spec 6.0.0,
CLI 5.0.2, public schemas, HTML trust policy and virtual-core 3.13.18 are not
upgraded by this qualification. Mermaid is only isolated test tooling for a
synthetic iframe-rendering fixture, not a new production dependency.

The lock currently resolves Seroval 1.8.2 and seroval-plugins 1.8.0 against that
same Seroval 1.8.2 instance. Their package patch numbers need not match; their
actual peer identity must. The guard verifies the renderer-selected lock record
and its peer dependency, not an assumed equality between package versions.

## Required distributed-package proof

Build the workspace before typechecking generated Spec/library declarations.
Rebuild the actual client and server exports, then pack once. Full and
optional-absent consumers must install those real tarballs without workspace
links and prove one physical runtime, not merely matching version strings.

Keep source lint/build/type/tests, release/cohort safeguards, and independent
Solid 1 baseline. Require dev/production SSR and Chromium hydration, error
boundary callbacks and escaping, compiled browser entry points, real optional
engines, Chart.js series updates and Mermaid rendering/fullscreen. The
Mermaid fixture must use the real pinned test engine, serve only exact local
test routes and reject unmatched external traffic; it does not qualify the
remote Mermaid provider application itself. Preserve strict reactive and
hydration diagnostics and distinguish intentional fixture errors explicitly.
The negative SSR fixture necessarily emits `SSR_RENDER_ERROR_CONTAINED`; retain
the raw diagnostics and recognize only its exact message, component scope,
source and one occurrence per independently measured document request. Generated
HTML evidence is excluded from Vite's source watcher, not from any diagnostic
check. Production must preserve Solid's private SSR error redaction to
`Internal Server Error`; no private error details may leak into server HTML.
This is not a general exception for contained errors.

All three KaTeX hosts (0.18.4, 0.18.5, absent) use the same already packed
candidate and Spec fixture as the primary browser matrix. Keep Node ESM/CJS,
MathML inline/display/fractions/indices/matrices, invalid/unsafe TeX, currency,
limits, updates and unmount checks. No diagnostic or sanitization weakening.

Record actual counts and failures in the PR. Only successful exact-head CI
and its immutable archive can qualify the candidate; do not relabel old RC
proof. The application chart-data incident is outside this renderer lot.

## Deposium handoff and release

Before npm, the application team can integrate the identified qualified `.tgz`.
Provide candidate version, source SHA, run URL/ID, artifact ID, tarball filename
and SHA-256 of the **inner `.tgz`**, not the artifact ZIP. Announce availability
without implying that source qualification equals complete application E2E.

After separately authorized public publication and host cohort alignment:

```sh
pnpm add --save-exact @seed-ship/mcp-ui-solid@8.0.0-solid2.4
```

Deposium must align its runtime and build cohort, review any patch targeting
the old Vite plugin, update its own lockfile, and test real chat streaming,
errors, sources, tables, charts, Mermaid, fullscreen, theme and disposal.
Keep its `.3`/stable incompatibility control active until the new package is
installed. Do not mutate application worktrees as part of library qualification.

Prepare promotion-policy-only changes separately on stable main. Keep #34
open and main's 7.x/Solid 1 packages on `latest`; never merge the runtime port
into main merely to publish. After reviewed preview integration, obtain fresh
first-attempt successful #34 CI and recheck its exact current head/artifact.
Use those same identities for `stage=false` validation on trusted main.
Any upload requires protected staging and maintainer npm/2FA approval.
After approval verify public `solid2`, unchanged `latest`, and public tarball
bytes matching the qualified artifact. This document itself authorizes none
of those external operations.
