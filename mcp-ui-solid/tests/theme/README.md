# Theme browser regression

This fixture mounts the real `ChatPrompt`, table `UIResourceRenderer`,
`ExpandableWrapper`, `PortalDropdownMenu`, `ScratchpadPanel`, and
`AutocompleteDropdown` and `AutocompleteFormField`. It includes a required-field form, native selects,
an explicit validation error, a disabled submit control, and an open
scratchpad options filter. It checks actual Chromium `getComputedStyle` values,
not jsdom's incomplete CSS implementation. Tailwind v4 and the package's plain
CSS are loaded together, with a class-based `dark` variant.

Supply existing browser tooling without adding dependencies to this package:

```sh
MCP_THEME_BROWSER_DEPS=/path/to/node_modules \
MCP_THEME_CHROMIUM=/path/to/chromium \
node mcp-ui-solid/tests/theme/browser.mjs --host
```

The tooling directory must contain `playwright` and `@tailwindcss/vite`.
Vite and the Solid plugin use this workspace's installed dependencies.
`MCP_THEME_CHROMIUM` is optional if Playwright's matching browser is installed.

`baseline-6.24.0.json` was captured from the immutable `v6.24.0` commit
`54e100d5dec1af8cea7673537f399b4f696b151b`, with Chromium 153.0.8010.12
and Tailwind 4.3.3. Its 18 groups contain inline light/dark styles,
input/error focus, choice-button hover, an open filter, and both portal
surfaces, including class changes while each portal stays open. The runner
records browser/Tailwind versions and refuses to overwrite the baseline
from any other commit or from modified tracked source.

For baseline reproduction, create a detached worktree at that exact commit,
provide its dependencies, and run with
`MCP_THEME_SOURCE_ROOT=/path/to/baseline/mcp-ui-solid/src` and `--capture`.
Only capture from clean source. Normal runs compare the current source
against the frozen computed styles. Tailwind version changes can alter its
palette, so use the baseline's version when investigating a mismatch.

`--host` additionally checks synthetic ancestor token overrides on inline
components and both portal surfaces, a live token change while the menu
remains open, source-local dark mode, removal of inherited tokens while
portals stay open, canonical muted/control-border/focus/hover tokens,
full shadows, and restoration of the same expanded content without
duplication. Typed input/textarea text and both autocomplete field branches
are checked with host tokens and no `.dark` class, including muted input
precedence and its focus transition. Its colors are arbitrary test
values, not a recommended theme palette. Omit the flag to replay only the
frozen default-style baseline. `MCP_THEME_RESULT_PATH` optionally writes the
current computed-style samples for investigating differences.

The runner also reports contrast ratios for represented text/control
foregrounds against their composited ancestor backgrounds. Browser canvas
converts the actual computed colors to sRGB before luminance calculation.
The durable baseline also includes `controlContrast`: actual rendered
1px control borders and the focused input's 2px ring/UA outline against
composited *adjacent parent* backgrounds, not against the control fill.
The active-control measurements preserve existing defaults, including
the following deficits against a 3:1 control/indicator target:

| Measured default | Light | Dark |
| --- | ---: | ---: |
| Required input / form select / scratchpad select border | 1.47 | 1.94 |
| Table search / choice button border | 1.24 | 1.94 |
| Required input 2px focus ring | 3.76 | 3.90 |
| Required input computed 1px `auto` UA outline | 19.03 | 1.30 |

All represented inactive control borders are below 3:1. The dark UA outline
alone is also below 3:1, but the simultaneously visible blue 2px ring is
above 3:1. An `auto` outline's computed style does not establish its exact
platform-painted pixels. Disabled submit controls remain in the visual
baseline but are excluded from active-control threshold claims. The
standalone error-field ring measures 3.81:1 against its white fixture
surroundings in both modes; this does not characterize every embedded
error-field background. No production defaults were changed to raise ratios.

`chartPalette` is a supplementary measurement extracted from installed
Chart.js 4.5.1's seven Colors-plugin defaults, on white: opaque ratios
2.79, 2.85, 2.04, 1.49, 2.19, 3.68, 1.62; 50%-alpha fill ratios
1.65, 1.71, 1.43, 1.22, 1.48, 1.85, 1.26. Six of seven opaque defaults
and all seven half-alpha fills are below 3:1 against white. This is not
rendered-chart proof, nor a measurement of adjacent series, host themes,
dark canvases, or every Chart.js chart type.

These are bounded fixture sanity measurements, not an accessibility audit:
font size/weight, opacity, images/gradients, every field/state variant,
all control-adjacent colors, and every possible host theme are not evaluated.

The test intentionally dispatches DOM clicks to open the portal surfaces;
it tests their styling and lifecycle, not pointer hit-testing or keyboard
accessibility. Chart/graph/map canvas rendering and screenshots are not
part of this fixture's coverage. Native operating-system select popup
pixels are not available through DOM computed styles; the select control
and the scratchpad's custom DOM dropdown are covered.
