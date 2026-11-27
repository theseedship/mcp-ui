# KaTeX exact-peer tarball matrix

This is a test-only consumer of the packed Solid 2.0.4 candidate `@seed-ship/mcp-ui-solid@8.0.0-solid2.5` and Spec packages. Published `.3` (RC.21) and `.4` (2.0.0) proofs are separate. Runtime pins are exact Solid 2.0.4, compiler/Babel plugin 2.0.3, Vite plugin 3.0.1. It never installs during `prepare`, aliases source, overrides the KaTeX peer, publishes, or deploys. Run the three consumers in separate empty durable directories outside this repository:

```sh
node mcp-ui-solid/tests/katex/run.mjs prepare --tarball /absolute/solid.tgz --spec-tarball /absolute/spec.tgz --consumer /durable/katex-0184 --version 0.18.4
pnpm --dir /durable/katex-0184 install --ignore-scripts
node mcp-ui-solid/tests/katex/run.mjs probe --consumer /durable/katex-0184
MCP_THEME_BROWSER_DEPS=/absolute/browser-tools/node_modules node mcp-ui-solid/tests/katex/run.mjs run --consumer /durable/katex-0184
```

Repeat with `--version 0.18.5` and `--version absent`, each in a new empty directory. `probe` checks public Node ESM/CJS root and plugin imports, real adapter behavior, and absent-peer failure isolation. `run` checks development and production Chromium SSR/hydration, MathML geometry, inert hostile content, diagnostics, local-only requests, reactive updates, and unmount. Each run retains raw logs, HTML, screenshots, and JSON evidence under its consumer. The workflow triggers only for PRs targeting `feat/solid2-preview`; release policy and public npm qualification are separate work.
