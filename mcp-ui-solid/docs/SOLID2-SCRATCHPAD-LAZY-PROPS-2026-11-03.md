# MCP-UI Solid 2 — Scratchpad lazy props, 2026-11-03

## Candidate and boundary

Source branch: `feat/solid2-preview`, open PR #34, still review-only. Candidate
`@seed-ship/mcp-ui-solid@8.0.0-solid2.1` targets the exact Solid 2 RC.20 cohort.
The published `.0` targets RC.19; stable `7.x` / `latest` remains Solid 1.
Spec 6.0.0 and CLI 5.0.2 are unchanged. No application edit, runtime-PR merge,
npm upload or deployment is authorized by this source fix.

## Root cause, not an app-only workaround

The host supplied an ordinary JSX conditional for Scratchpad `pinned`. Solid's
compiler creates a memo when that getter is read. Scratchpad's creation log
read it inside owner-backed `onSettled`, whose internal tracked-effect scope
forbids creating reactive primitives. This raised
`PRIMITIVE_IN_FORBIDDEN_SCOPE` and halted later reactive updates.

A second regression was reproduced for `debug`: the state effect's apply
callback called a logger that read props, so a lazy getter created a memo with
no ambient owner (`PRIMITIVE_IN_EFFECT_CALLBACK`). Both failed on RC.19 before
the patch; the issue was not uniquely caused by the host's RC.20 upgrade.

The fix snapshots the mount-only creation-log fields in component setup under
`untrack`. The debug effect captures flag/id/data in compute and its apply
logger takes only those values. Auto-close continues to use its existing
compute/apply snapshot. No diagnostic is suppressed, no `runWithOwner` escape
is added, and callers need not hoist each conditional into an app-owned memo.

## Qualification

The focused regressions exercise real compiler-generated conditional props,
initial mount, live pin/debug changes, once-only creation logging, complete-state
auto-close and timer cleanup. Their original RC.19 failures were observed red;
the focused patch passed before changing the runtime cohort.

The RC.20 producer and clean consumer pin core, web, signals, compiler and Babel
to `2.0.0-rc.20`, plus Vite plugin `3.0.0-next.51`. The frozen-lock cohort guard
rejects RC.19/RC.20 mixing and preserves renderer-owned Seroval and virtual-core.
The lockfile update is confined to the Solid toolchain family and its peer edges.

The real `.1` tarball CI includes a public Scratchpad probe in both full and
optional-absent consumers, tested through dev/production SSR and hydration.
Read the exact current PR head and its successful first-attempt CI, then the
artifact reports/checksum. Do not reuse `.0`'s already-published tarball or an
older green head as evidence for `.1`. Synthetic library qualification does not
prove the full Deposium chat or its other lifecycle paths.

## Release and consumer handoff

Before upload, update the trusted main preview policy from `.0` / RC.19 to
`.1` / RC.20 in a separate infrastructure PR; its merge changes no stable
package versions and does not publish anything. Use the protected manual
preview workflow on main to promote only the qualified Solid tarball under
`solid2`, then maintainer npm 2FA approval. Keep `latest` on Solid 1.

After publication, the application team can pin `8.0.0-solid2.1`, commit its
own lockfile and rerun the real search-expansion/scratchpad repro on its coherent
RC.20 tree. A temporary app-side memo workaround can then be evaluated for
removal by that team; no such application change is part of this patch.
