# Security dependency notes

## 2026-10-24 — compatible tooling fixes, runtime Zod still unresolved

This follow-up updates development tooling on the stable Solid 1 line. It does
not migrate Zod, change public schemas, dismiss advisories, or publish a package.

| Dependency | Previous lock | Updated lock | Scope |
| --- | --- | --- | --- |
| Vite | 6.4.3 | 6.4.5 | CLI, Spec and Solid development/build/test tooling; stays on major 6, compatible with the existing Solid 1 plugin. |
| Vitest / `@vitest/ui` / `@vitest/mocker` | 4.1.11 | 4.1.12 | Test tooling; UI is declared only by Solid. |

The exact development pins and pnpm 8.15.0 lockfile update target the five Vite
advisories ([Windows existence check](https://github.com/advisories/GHSA-587h-7wmj-h5pm),
[argument escaping](https://github.com/advisories/GHSA-698v-4r3x-3vcv),
[editor flags](https://github.com/advisories/GHSA-r825-w8mm-5pxw),
[cross-origin middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw),
[filesystem allowlist](https://github.com/advisories/GHSA-rq7h-c2jc-7f22)) and
two mocker advisories ([manual registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
[Windows traversal](https://github.com/advisories/GHSA-xp26-3454-mjgp)).

Fresh full-workspace `pnpm audit --json` comparison on this date:

- Baseline lock: 8 distinct advisories (2 high, 5 moderate, 1 low).
- Updated lock: **1 high**, runtime Zod
  [`GHSA-mrhx-c7xc-m3w5`](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Audit exit status remains nonzero. This is not a clean security audit.
- GitHub's 11 open Dependabot alerts include four occurrences of the same Zod
  advisory across manifests/lockfile. Removing seven tooling advisory entries
  from this lock does not by itself close GitHub alerts: merge and rescan are
  separate evidence, and package publication is separate again.

No runtime dependency, `solid-js` peer, Solid/plugin resolution, package version
or wire schema changes. In particular Zod remains `3.25.76`; no override forces
an incompatible Zod 4 resolution under the published `^3.22.4` dependency ranges.
The only related non-tooling lock change is Picomatch deduplication to an already
present `4.0.7` through the updated Vite peer graph.

### Why this does not silently switch to `zod/v3` in a Zod 4 package

The advisory lists a fix in 4.6.6. The
[upstream fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)
changes the v4 collection parsers, not v3. The array, set and map parser classes
in the published `4.6.7/v3` API are identical to the corresponding `3.25.76`
classes. Using the newer package with the old subpath is not a remediation.

A bounded local probe used 32 elements, never an OOM test. For array `.max(2)`,
array `.length(2)` and set `.size(2)`, both old root and new `/v3` performed 32
element callbacks and produced 33 issues for invalid values. The real v4 API
stopped before element parsing and produced one issue. Synchronous and async
results agreed. An unbounded array still visits all elements in every version:
input and collection limits remain necessary even after migrating.

Spec exports its schema objects and inferred types. A real v4 migration must
qualify those public APIs, records, optional/default output behavior and errors
against the [migration guide](https://zod.dev/v4/changelog). It is a separate
versioning decision, not a safe lockfile-only patch. A workspace-only fork or
patch would not automatically protect consumers either.

The current Solid entry-point size check also continues into schema validation
after collecting its size error. Changing that path can reduce local exposure,
but cannot fix exported Zod 3 schemas called directly by consumers; it must not
be presented as closing the entire advisory. Runtime Zod remediation remains
an explicit follow-up before claiming the release is security-ready.

### Relation to Dependabot PR #37

That PR's inspected head `27ed1dc168c8efd8acc523fd3fbd1b87c046b558`
changes only the lockfile, resolving Zod 4.6.7 against `^3.22.4` manifest
specifiers. Its CI fails building Spec with 20 `z.record` signature errors.
This compatible tooling follow-up does not adopt that resolution or claim to
supersede the remaining Zod work. Reassess any later revision of #37 separately.

## Historical record: 6.25.1, verified 2026-10-18

Verified on 2026-10-18. This is a dependency-remediation record, not a claim
that every renderer or consuming application has been security-audited.
The sections below preserve that historical snapshot. Their former single
`braces` advisory count is not the current audit result above; its absence from
the current feed is not a claim that this PR patched it.

## Updates

| Dependency | Previous lock | Updated lock | Scope and advisories |
| --- | --- | --- | --- |
| DOMPurify | 3.4.13 | 3.4.17 | Required runtime dependency; published floor is `^3.4.17`. [Rawtext root](https://github.com/cure53/DOMPurify/security/advisories/GHSA-6688-9rhm-gjv2), [hook removal](https://github.com/cure53/DOMPurify/security/advisories/GHSA-p98j-92pf-mc4p) and [subsequent hardening](https://github.com/cure53/DOMPurify/releases/tag/3.4.17). |
| Solid / Seroval / Seroval plugins | 1.9.11 / 1.5.6 / 1.5.0 | 1.9.17 / 1.6.11 / 1.6.11 | Workspace development resolution; Solid remains a required host peer. [Callable invocation](https://github.com/lxsmnsyc/seroval/security/advisories/GHSA-p6vx-979v-rg4c), [TypedArray allocation](https://github.com/lxsmnsyc/seroval/security/advisories/GHSA-jp82-f5mq-hwhp). |
| source-map-js | 1.2.1 | 1.2.2 | Build/test tooling via PostCSS and css-tree. [Indexed-map denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| brace-expansion | 5.0.9 | 5.0.12 | Lint tooling via minimatch. [Rewrite complexity](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr), [nested groups](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [comma recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p). |

The sanitizer accepts strings, not live DOM nodes, and the library's profiles
do not use `IN_PLACE` or node-removing hooks. The two reported DOMPurify
preconditions were not found in these library paths; this is not a finding
that every possible host configuration is safe. No renderer policy is relaxed.

Solid 1.9.17 requests Seroval and its plugins in the supported `~1.6.8` range.
The workspace override follows that range instead of forcing Solid's old
`~1.5.3` resolution. Seroval 1.6.2 alone would not cover the additional
TypedArray advisory, which was fixed in 1.6.3.

## Host applications

This package externalizes dependencies. Its DOMPurify manifest floor affects
the version installed by consumers, but this repository's root pnpm overrides
and development lockfile do **not** propagate to an application's lockfile.
The public `solid-js` peer range remains `^1.9.0` for compatibility; it is not
a guarantee that the host has a corrected Seroval resolution.

Update the application lockfile separately. An upstream-aligned option is
Solid 1.9.17 with its supported Seroval/plugin 1.6.x dependencies; verify the
resolved versions and audit the application itself. The library's new test
performs a real asynchronous Solid server render with hydration serialization,
plus a legitimate Map/Date/typed-array/Promise JSON transport roundtrip through
Solid's own Seroval. It is a compatibility smoke test, not browser hydration
proof, an exploitability assessment of the host, or an end-to-end SolidStart test.

## Remaining advisory: braces 3.0.3

[`GHSA-vfj7-8cjw-p6xm`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
is HIGH severity and has no patched version listed as of the verification
date. It concerns stack exhaustion when deeply nested, attacker-controlled
brace patterns reach recursive glob parsing. `braces` and `brace-expansion`
are different packages: updating the latter does not fix this advisory.

The retained development-only chain is:

```text
ESLint / typescript-eslint
  -> typescript-estree -> globby -> fast-glob -> micromatch -> braces 3.0.3
```

No compatible published parent update that removes this chain was identified.
Even the checked latest globby release still uses fast-glob/micromatch and
braces. The [upstream issue](https://github.com/micromatch/braces/issues/70)
remains the follow-up point.

Current lint scripts use `eslint src`; repository lint configuration has
simple static file patterns and no `parserOptions.project` glob. No production
renderer path to braces was identified. Keep project/glob patterns static and
reviewed, and do not expose this tooling as a service accepting untrusted
patterns without a depth guard and isolation. These observations bound the
known exposure; they do not prove complete unreachability, including through
every future lint configuration or pull request.

The advisory stays visible: no audit suppression, alias, downgrade, vendored
patch or GitHub dismissal is included. Recheck upstream before claiming it
resolved. The verified full-workspace audit moves from 9 advisories
(1 critical, 5 high, 1 moderate, 2 low) to **1 high**; a nonzero full audit
result is therefore expected until this residual is fixed.

## Release boundary

The package version bump does not itself start npm staging. The current
GitHub workflow triggers on an approved `v*.*.*` tag (or manual dispatch),
then uses `npm stage publish`. A successful upload still requires maintainer
approval in npm Staged Packages with 2FA before it is public. Do not label a
merge, a green CI run or an uploaded stage as a public npm release.
