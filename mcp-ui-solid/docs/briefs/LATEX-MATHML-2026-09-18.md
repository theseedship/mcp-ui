# LaTeX presentation: library and host boundary

## Decision

This is an opt-in presentation feature in Solid 6.23.0, not a new MCP schema.
Use a dedicated `MCPUIMathProvider` plus a synchronous `MathRenderer` contract.
The supplied `/plugins/katex` adapter is an explicit optional peer import.
Its peer and development dependency are pinned to KaTeX 0.18.4: that version
uses Commander 8 and includes the prototype-pollution fix from 0.18.2.
KaTeX 0.18.5–0.18.7 require Commander 15 (Node >=22.12), incompatible with
the repository's Node 20 support. Install with `pnpm add --save-exact katex@0.18.4`.

Alternatives considered:

- Generic host `markdownExtensions`: rejected for this scope; exposes Marked's
  parser/renderer/async contracts and lets unrelated extensions interact with
  citations and sanitization. Sharing the chat extension unchanged would not
  preserve its HTML output under the library's style restrictions.
- Automatically lazy-importing KaTeX in the core: avoided; requires loading,
  error, SSR and asynchronous update state for every consumer.
- Narrow MathML callback plus a maintained adapter: chosen. Hosts can reuse
  their own renderer without giving control over the whole parser;
  non-math consumers do not import KaTeX.

`MCPUIConfig` is not expanded, so the config contract repaired in PR #28 is
not changed again. MathML output avoids relaxing the ban on inline styles.
It is not pixel-identical to KaTeX's CSS-based HTML output.

## Safety and degradation

Core owns delimiters, currency guards, code exclusion, budgets and final
sanitization. No global `marked.use` mutation or shared macro state. Callback
output is sanitized as MathML, then the final prose/cell result is sanitized
again. Annotation and annotation-xml content is removed completely. Server
rendering retains escaped source; it never calls the host renderer. Existing
SafeHtml hydration repair upgrades the client. Source copy/export is retained.

## MCPs and SolidStart handoff

- MCPs continue emitting ordinary `text` (`markdown: true`) and `table`
  components; no new component type or schema/version change in Spec.
- Producers send dollar-delimited TeX as data. JSON must escape backslashes
  correctly (e.g. `"$\\frac{a}{b}$"`), not HTML or executable render functions.
- SolidStart hosts install the optional peer and mount the math provider
  around the MCP UI renderers. The existing chat formatter need not change.
- The repository does not modify Deposium's chat or host integration. Check
  native MathML on the target browsers; SSR first paint remains plain source.
- PR #28's config compatibility fix is now merged into main and included here.
  Stage 6.23.0 through the existing release process and approve on npm afterward.
  A version change in this branch does not itself mean publication occurred.

References: [KaTeX options](https://katex.org/docs/options.html),
[KaTeX 0.18.2 security fix](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.2),
[Marked instance isolation](https://marked.js.org/using_advanced#instance).
