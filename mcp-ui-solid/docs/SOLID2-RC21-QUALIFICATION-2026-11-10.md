# Solid 2 RC.21 qualification — 2026-11-10

## Candidate and scope

Candidate `@seed-ship/mcp-ui-solid@8.0.0-solid2.3`, intended opt-in npm channel
`solid2`, starts from synchronized preview head `f37ce251c041159c625764c42fb39677eaf9c73a`.
That head has the same file tree as the `.2` / RC.20 KaTeX qualification after
PR #44. Synchronization integrated main ancestry into the preview, not the
runtime port into stable main. The old canonical checkout was not edited.

Core, web, signals, compiler and Babel are exactly `2.0.0-rc.21`; the Vite plugin
is exactly `3.0.0-next.57`. Vite stays 8.3.5, virtual-core stays 3.13.18 and the
Seroval pair remains renderer-owned at 1.7.0. Spec 6.0.0 and CLI 5.0.2 are
unchanged. KaTeX remains optional and accepts only `0.18.4 || 0.18.5`.
Do not install this candidate over an RC.19/RC.20 or Solid 1 reactive tree.

The producer lock changes only this Solid/tooling cohort, its peer contexts
and obsolete Babel type packages no longer used by the new plugin. The
existing vitefu/Vite peer metadata warning is not hidden or treated as a
runtime success; actual build and consumer checks are separate evidence.

## Required proof

Run build before typechecking/testing a clean worktree: the Spec workspace's
real declarations and built subpath contracts must exist. A failure caused by
missing build fixtures is not evidence for or against RC.21 compatibility.

Qualification includes source tests/type contracts, offline cohort/release
safeguards, and the actual built and packed candidate in clean RC.21 hosts:

- Full and optional-absent consumers, compiled browser entry points, native
  engines, streaming/cleanup, text/table/source and dev/production SSR/hydration.
- Exact KaTeX 0.18.4, exact 0.18.5 and absent peer, including plugin-relative
  resolution, ESM/CJS, MathML, invalid TeX, sanitization and resource limits.
- Independent Solid 1 baseline using its own runtime and lockfile.

Existing diagnostic gates remain strict; the new RC.21
`CAUGHT_REACTIVE_READ` is explicitly fatal in both SSR harnesses, with a named
regression. Browser math qualification rejects all console warnings/errors.
The next.57 consumer fixtures use `start.nodeServer`, replacing the removed
`start.node` option; the middleware contract remains `(event, next)`.
The full consumer explicitly sets `build.manifest: true` to retain the client
manifest inspected by qualification; next.57 otherwise removes this internal
metadata after embedding it in the server. The manifest assertion is retained.
Both runners await log finalization before checking SSR diagnostics, with
delayed-write regressions, so late diagnostics cannot escape the gate.
Do not mask diagnostics or widen peers to an untested RC range to get a pass.
Record actual test counts, exact head/run/artifact and the `.tgz` SHA-256 in
the PR and raw CI reports. A source version or old green run is not proof.

The primary CI artifact includes all three KaTeX consumers alongside the full,
optional-absent and compiled-browser reports. Every consumer uses the same
already packed Solid tarball and Spec fixture, rather than an independently
repacked archive from a different workflow. The separate KaTeX workflow is an
additional targeted check, not the promotion evidence source.

## Deposium / Mermaid checkpoint

The inspected local application had direct KaTeX 0.18.4 and Mermaid 12.0.0
resolving its own 0.16.47. This differs from current remote main: application
[PR #1105](https://github.com/theseedship/deposium_solid/pull/1105) already merged
Mermaid 12.3.0 with a narrow `mermaid@12.3.0>katex` override to 0.18.4. Do not
duplicate that fix or replace it with a global override. Outdated local
worktrees and installed dependencies require application-owned synchronization
that preserves their WIP; no local pull/install/deployment is implied here.

The separate direct-KaTeX 0.18.5 application PR is not the Mermaid fix. It needs
an MCPUI version whose peer permits 0.18.5, plus the host's own lockfile and
tests. Library tests do not prove the real application has integrated RC.21.

## Integration and release boundary

Only after host cohort alignment, review and separately authorized publication:

```sh
pnpm add --save-exact @seed-ship/mcp-ui-solid@8.0.0-solid2.3 katex@0.18.5
```

Before publication use an identified tested `.tgz`, not npm `latest` or an
unpinned Git branch. Match core/web/signals/compiler/Babel RC.21 and the
reviewed Vite plugin, use Node >=22.12.0, and commit the host lockfile. Recheck
actual chat streaming, sources, forms, virtualization, native renderers,
focus, theme, hydration and disposal in the application.

This work does not merge PR #34 into main, alter stable Solid 1 / `latest`,
publish or stage npm, dispatch release workflows or deploy the application.
The trusted promotion workflow still binds `.1` / RC.20; a future `.3` upload
requires a separate policy update and exact successful archive validation,
followed by protected GitHub approval and maintainer npm 2FA. `.2` RC.20 and
its prior evidence remain historical fallbacks, not RC.21 release evidence.
