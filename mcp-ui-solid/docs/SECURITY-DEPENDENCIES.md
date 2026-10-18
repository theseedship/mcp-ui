# Security dependency notes (6.25.1)

Verified on 2026-10-18. This is a dependency-remediation record, not a claim
that every renderer or consuming application has been security-audited.

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
