# KaTeX compatibility candidate — 2026-11-09

> Historical `.2` / RC.20 qualification. For the `.3` / RC.21 candidate and
> the subsequently merged Deposium Mermaid fix, use the
> [current handoff](./SOLID2-RC21-QUALIFICATION-2026-11-10.md).

## Source, candidate and release boundary

Start: published `@seed-ship/mcp-ui-solid@8.0.0-solid2.1`, source
`f2efd502b89a97ab66cc17e96c7c00bcaff0d182` on `feat/solid2-preview`, not the
older canonical Solid 1 checkout. The focused PR targets that Solid 2 branch.
Candidate: `8.0.0-solid2.2`; intended opt-in npm channel: `solid2`.

The optional peer explicitly accepts only `0.18.4 || 0.18.5`; no caret or
future version is promised. Development KaTeX remains pinned to 0.18.4. The
adapter, public exports, Solid/core/web/signals/compiler/Babel RC.20 cohort,
Vite plugin next.51, lockfile, Spec 6.0.0 and CLI 5.0.2 remain unchanged.

This PR does not publish/stage anything or move `latest`. The trusted preview
release policy still binds `.1`; a future `.2` promotion needs a separately
reviewed policy/qualification update, after this candidate is validated. The
generic source CI/harness identity follows `.2`, so merging the focused PR into
the Solid 2 branch does not leave a stale tarball filename/version check.
Do not merge the full Solid 2 port into main or
push a preview Git tag to obtain a build.

## Qualification contract

The focused matrix must build and pack the actual candidate and install it in
clean consumers with strict peer checking, no workspace alias and no KaTeX
override: exact 0.18.4, exact 0.18.5, and KaTeX absent. Check both compiled
ESM/CJS imports, the peer metadata, original exports and tarball SHA-256.
Installed math consumers must exercise inline/display MathML, fractions,
indices, matrices, invalid TeX, macro isolation, untrusted commands and limits.
The absent consumer must import and render the main entry without KaTeX.

Chromium must exercise development and production builds. MCPUI's existing SSR
contract is intentional: the server emits escaped Markdown source without
calling the math renderer; the client upgrades it to sanitized MathML after
hydration. Verify SSR sentinel identity, live updates/unmount and zero browser
or hydration errors. This does not promise server-rendered MathML or identical
layout to Deposium chat's HTML+MathML renderer.

Actual executed counts and the exact candidate tarball checksum are retained
in the PR and uploaded qualification reports, not inferred from this checklist.
The focused workflow reproduces the build, source tests and clean-host matrix;
source preparation alone is not a passing test or publication claim.

## Unchanged security boundary

`renderKatexMath` keeps `output: 'mathml'`, `throwOnError: true`, `trust: false`,
`maxExpand: 1000`, `maxSize: 20` and fresh per-call macros. Invalid TeX returns
null so the caller preserves the complete original token. The two-stage MathML
and final-sink sanitization still removes scripts, links/styles and annotation
subtrees. Source/expression/count bounds remain 100,000 / 4,096 / 128.

[GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) affects
KaTeX >=0.11.0 and <0.18.2: direct 0.18.4 is already patched. This candidate is
compatibility qualification, not a claim to repair that advisory in direct
0.18.4. [KaTeX 0.18.5](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.5)
also depends on Commander 15, which requires Node >=22.12.0.

## Deposium handoff

Only **after** review and separately authorized publication:

```sh
pnpm add --save-exact @seed-ship/mcp-ui-solid@8.0.0-solid2.2 katex@0.18.5
```

This exact-version command chooses the `solid2` candidate without relying on or
changing `latest`; it cannot work from the public registry before publication.
For pre-publication qualification, install the reviewed `.tgz` instead and
retain its checksum. Keep the host's coherent Solid RC.20 cohort, use Node
>=22.12, and commit its own lockfile. The main library import remains usable
without KaTeX; only the explicit `plugins/katex` import requires the optional
peer. Continue wrapping text/table renderers in `MCPUIMathProvider`.

Deposium still owns the reported KaTeX 0.16.47 through Mermaid 12.0.0. Changing
this direct peer does not remediate Mermaid's transitive graph. Inspect that
graph and qualify any Mermaid update/override separately; do not infer that
the whole host audit is clean. Also rerun the real chat, table, currency,
streaming and hydration flows after integrating the candidate. No application
files or transitive Mermaid dependencies are changed by this PR.
