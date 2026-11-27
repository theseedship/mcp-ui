# Solid 2.0.4 adapter qualification — 2026-11-27

## Candidate and why it exists

`@seed-ship/mcp-ui-solid@8.0.0-solid2.5` is a cohort bump of the published
`8.0.0-solid2.4` (Solid 2.0.0). Source base: `origin/feat/solid2-preview`
(PR #34); branch `test/solid2-stable-204`. No production `src` change.

Published `.4` peers exactly `solid-js@2.0.0` and `@solidjs/web@2.0.0`, but
`@solidjs/web@2.0.4` peers `solid-js@^2.0.4`. A 2.0.4 host therefore cannot
satisfy `.4`'s exact peers (and an override would hide a real mismatch). `.5`
re-pins the exact peers to 2.0.4. Intended channel: `solid2`; `latest` stays 7.x
(Solid 1). Do not use a peer exception, runtime alias or forced override.

## Cohort

| Package | `.4` (published) | `.5` (candidate) |
| --- | --- | --- |
| `solid-js` (peer + dev) | 2.0.0 | 2.0.4 |
| `@solidjs/web` (peer + dev) | 2.0.0 | 2.0.4 |
| `@solidjs/signals` | 2.0.0 | 2.0.4 |
| `@solidjs/compiler` | 2.0.0 | 2.0.3 (no 2.0.4 exists) |
| `@solidjs/babel-plugin` | 2.0.0 | 2.0.3 (no 2.0.4 exists) |
| `@solidjs/vite-plugin` | 3.0.1 | 3.0.1 |
| `@solidjs/testing-library` | 1.0.0-rc.2 | 1.0.0-rc.2 |
| Node | >=22.12.0 | >=22.12.0 |

Unchanged: Spec 6.0.0, CLI 5.0.2, public schema, HTML trust policy, optional
KaTeX `0.18.4 || 0.18.5`, virtual-core 3.13.18.

## What changed / what did not

- Changed: `package.json` pins and peers, lockfile, README compatibility matrix
  and install line, CHANGELOG, qualification docs, and the new
  `tests/solid2/readme-compat.node-test.mjs` guard (README matrix, `solid2`
  dist-tag row, install line vs `package.json`).
- Not changed: any file under `src`. Build and typecheck pass on 2.0.4,
  including its stricter MathML JSX attribute types (no impact on our MathML).
- Upstream 2.0.4 fixes relevant to us: SSR projection serialization, hydration
  of async iterables, store-array `mapArray` / `<For>` after a yield.

## Measured results

Local, on WSL2 / Node 24.19.0 / pnpm 8.15.0, uncommitted tree based on
`0cf7aba` (2026-11-27). Hosted CI must re-establish these on the exact head.

| Gate | Local result |
| --- | --- |
| Frozen lockfile / lint / build / typecheck | pass / 0 errors (existing warnings) / pass / pass |
| Workspace unit tests | 2,458 passed, 1 skipped (Solid 2,260 + 1 skipped in 137 files; Spec 182; CLI 16) |
| Node safeguards (10 files incl. `readme-compat`) | 133 / 133 |
| Packed consumers `full` and `optional-absent` | install, probe (20 entries, 72 files) and SSR/hydration Chromium runs pass in dev and production; 0 page errors, 0 external requests |
| Compiled-browser `dist-browser` (full) | dev 4 / production 4 checks |
| KaTeX 0.18.4 / 0.18.5 / absent | Node 21 / 21 / 4; Chromium 5+5 / 5+5 / 2+2 |
| Expected contained diagnostics | one `SSR_RENDER_ERROR_CONTAINED` boundary probe (full only), one fixture stream error |
| Local tarball | `seed-ship-mcp-ui-solid-8.0.0-solid2.5.tgz`, 2,745,194 bytes |
| Local tarball SHA-256 | `656f73155619f9fd44a0c1f20899f2e17549c64f51f4af46dca0586d71b6b2ec` |
| Exact head SHA | `<TBD after commit>` |
| CI run URL / ID / artifact ID | `<TBD>` |
| SHA-256 of the CI **inner `.tgz`** (not the artifact ZIP) | `<TBD>` |

A local build is evidence, not release identity: the published bytes must match
the hosted CI artifact, not this local archive.

## Gates remaining

1. Hosted CI success on the exact head, with the immutable artifact; record the
   inner tarball SHA-256 above.
2. A separate, main-based promotion-policy PR for `.5` (policy only; do not
   merge the runtime port into main, keep #34 open and 7.x on `latest`).
3. `stage=false` validation on trusted main bound to the same head/artifact,
   then protected staging.
4. Maintainer npm approval with 2FA. Afterwards verify public `solid2`
   points at `.5`, `latest` is unchanged and the public tarball bytes match
   the qualified artifact.

This document authorizes none of these external operations.

## Deposium host steps

Bump `solid-js` and `@solidjs/web` to 2.0.4 **together with** `.5`:

```sh
pnpm add @seed-ship/mcp-ui-solid@8.0.0-solid2.5 solid-js@2.0.4 @solidjs/web@2.0.4
```

`.4` must not be paired with 2.0.4 (and `.5` must not be paired with 2.0.0).
Align the host's signals/compiler/Babel/Vite-plugin pins, update its lockfile,
and re-test real chat streaming, errors, sources, tables, charts, Mermaid,
fullscreen, theme and disposal. Before the public release, integrate only the
identified qualified `.tgz`. Do not mutate application worktrees as part of
library qualification.
