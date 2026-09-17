/**
 * chrome-scan policy — the repository's exclusions for `chrome-scan.ts`.
 *
 * Consumed by `src/context/mcpui-strings-guard.test.ts` (which fails on any
 * finding not covered here and on any stale entry) and by the scanner CLI
 * (`node scripts/chrome-scan.ts`), so both report the same number.
 *
 * Not published (outside `src/`).
 *
 * Exclusion policy — the only user-visible texts allowed to stay hardcoded:
 *
 * - P1 Keyboard key caps inside `<kbd>`.
 * - P2 Legal attribution wording (OpenStreetMap / ODbL tile notice).
 * - P3 Developer diagnostics: messages naming an npm package, a peer
 *   dependency or a config flag; bracketed `[Component] …` messages;
 *   debug-only panels behind an explicit debug flag; developer-misuse
 *   errors; payload-schema diagnostics of `services/validation.ts`.
 * - P4 Machine tokens: file-format acronyms, HTTP verbs, unit symbols,
 *   ISO currency codes, chart point property names.
 * - P5 Pure module functions with a documented render override.
 * - P6 Components with their own documented labels/messages prop.
 * - P7 Strings the library never renders itself (hook-level errors returned
 *   to the consumer, onError payloads, console/telemetry, thrown errors).
 * - P8 LLM-facing schema descriptions / example payloads, comments.
 */

import type { AllowEntry, ChromeRule, Policy, SanctionedTable, ScanOptions, ScopedExclusion } from './chrome-scan.ts'

export interface PolicySanctionedTable extends SanctionedTable {
  policy: Policy | 'baseline'
  reason: string
}

export interface PolicyScopedExclusion extends ScopedExclusion {
  policy: Policy
  reason: string
}

/**
 * English default tables the library is ALLOWED to hold — each is the
 * injectable baseline of a `strings` / `messages` / `labels` option. The
 * guard asserts each one is exported from its file.
 */
export const SANCTIONED_TABLES: readonly PolicySanctionedTable[] = [
  {
    file: 'context/MCPUIStringsContext.tsx',
    name: 'DEFAULT_MCPUI_STRINGS',
    policy: 'baseline',
    reason: 'baseline — the English chrome catalogue itself, overridden by <MCPUIStringsProvider>.',
  },
  {
    file: 'components/PresentationFeedback.tsx',
    name: 'DEFAULT_PRESENTATION_FEEDBACK_LABELS',
    policy: 'P6',
    reason: 'P6 — English baseline of the documented `labels` prop of PresentationFeedback.',
  },
  {
    file: 'adapters/connector.ts',
    name: 'DEFAULT_CONNECTOR_MESSAGES',
    policy: 'P6',
    reason: 'P6 — English baseline of `ConnectorResultToUILayoutOptions.messages` (runtime-free adapter).',
  },
  {
    file: 'adapters/macro-run.ts',
    name: 'DEFAULT_MACRO_RUN_MESSAGES',
    policy: 'P6',
    reason: 'P6 — English baseline of `MacroRunAdapterOptions.messages` (runtime-free adapter).',
  },
  {
    file: 'services/validation.ts',
    name: 'DEFAULT_VALIDATION_MESSAGES',
    policy: 'P6',
    reason: 'P6 — English baseline of the `messages` option of `validateFieldValue` / `validateFormData`; FormRenderer feeds it from MCPUIStrings.',
  },
  {
    file: 'utils/degraded-projections.ts',
    name: 'DEGRADED_PROJECTION_LABELS',
    policy: 'P6',
    reason: 'P6 — English baseline of the `labels` parameter of the degraded projections; the renderers feed it from MCPUIStrings.',
  },
  {
    file: 'components/chart-data-table.ts',
    name: 'CHART_DATA_TABLE_LABELS',
    policy: 'P6',
    reason: 'P6 — English baseline of the `labels` parameter of `chartToDataTable`; ChartJSRenderer feeds it from MCPUIStrings.',
  },
  {
    file: 'hooks/useStreamingUI.ts',
    name: 'DEFAULT_STREAMING_UI_MESSAGES',
    policy: 'P6',
    reason: 'P6 — English baseline of `UseStreamingUIOptions.messages`; StreamingUIRenderer feeds it from MCPUIStrings (`stream*` keys).',
  },
]

/** Function scopes excluded wholesale, each with its policy item. */
export const SCOPED_EXCLUSIONS: readonly PolicyScopedExclusion[] = [
  {
    file: 'services/validation.ts',
    functions: [
      'mapZodIssuesToErrors',
      'validateGridPosition',
      'validateChartComponent',
      'validateTableComponent',
      'validatePayloadSize',
      'validateIframeDomain',
      'validateComponent',
      'validateLayout',
    ],
    policy: 'P3',
    reason:
      'P3 — Payload-schema diagnostics: `ValidationError.message` of the STRUCTURAL validators, addressed to the payload producer and quoting payload paths (`params.data.datasets[0]`). The validation card chrome around them IS localized (`validationError`, `validationWarning`, …); the END-USER form messages go through DEFAULT_VALIDATION_MESSAGES.',
  },
  {
    file: 'components/ScratchpadPanel.tsx',
    functions: ['FormDebugTrace'],
    policy: 'P3',
    reason:
      'P3 — Debug-only panel rendered under the explicit `debugTrace` prop: it mirrors raw server keys (`_debug`, `prefillMode`, `valueFormat`) next to JSON, for developers.',
  },
]

export const SCAN_OPTIONS: ScanOptions = {
  sanctionedTables: SANCTIONED_TABLES,
  scopedExclusions: SCOPED_EXCLUSIONS,
}

const p3 = (file: string, match: string, reason: string, rule?: ChromeRule, substring = false): AllowEntry => ({
  file,
  match,
  policy: 'P3',
  reason: `P3 — ${reason}`,
  ...(rule ? { rule } : {}),
  ...(substring ? { substring } : {}),
})

/** Individual literals, each with its policy item. Exact match unless `substring`. */
export const ALLOW_LIST: readonly AllowEntry[] = [
  // ── P1 ──
  {
    file: 'components/AutocompleteDropdown.tsx',
    match: 'Enter',
    rule: 'jsx-text',
    policy: 'P1',
    reason: 'P1 — Key cap inside <kbd>; the surrounding hint prose is localized (autocompleteHint*).',
  },
  {
    file: 'components/AutocompleteDropdown.tsx',
    match: 'Esc',
    rule: 'jsx-text',
    policy: 'P1',
    reason: 'P1 — Key cap inside <kbd>.',
  },
  // ── P2 ──
  {
    file: 'components/MapRenderer.tsx',
    match: 'OpenStreetMap</a> contributors',
    substring: true,
    policy: 'P2',
    reason: 'P2 — OpenStreetMap / ODbL tile attribution; hosts override the whole notice via `params.attribution`.',
  },
  // ── P3 ──
  p3('components/GraphRenderer.tsx', 'Install', 'Same `@antv/g6` peer-dependency diagnostic.', 'jsx-text'),
  p3('components/GraphRenderer.tsx', '@antv/g6', 'Same diagnostic — the npm package name.', 'jsx-text'),
  p3('components/GraphRenderer.tsx', 'peer dependency to render', 'Same `@antv/g6` peer-dependency diagnostic.', 'jsx-text'),
  p3('components/GraphRenderer.tsx', 'type: "graph"', 'Same diagnostic — the payload discriminant, in <code>.', 'jsx-text'),
  p3('components/GraphRenderer.tsx', 'components.', 'Tail of the same `@antv/g6` peer-dependency diagnostic.', 'jsx-text'),
  p3('components/RenderContext.tsx', 'Component "', 'Developer-misuse error: a renderer used outside <UIResourceRenderer>.', 'jsx-text'),
  p3('components/RenderContext.tsx', '" cannot be rendered outside of UIResourceRenderer', 'Same developer-misuse error.', 'jsx-text'),
  p3('components/ScratchpadPanel.tsx', '| ev:', 'Debug overlay behind the explicit `debugOverlay` flag.', 'jsx-text'),
  p3('components/ScratchpadPanel.tsx', '| sec:', 'Debug overlay behind the explicit `debugOverlay` flag.', 'jsx-text'),
  p3('components/ScratchpadPanel.tsx', '| last:', 'Debug overlay behind the explicit `debugOverlay` flag.', 'jsx-text'),
  // ── P4 ──
  {
    file: 'components/DataPreviewSection.tsx',
    match: 'CSV',
    rule: 'jsx-text',
    policy: 'P4',
    reason: 'P4 — File-format acronym on an export button; its `title` IS localized (`exportCsvRows`).',
  },
  {
    file: 'components/DataPreviewSection.tsx',
    match: 'JSON',
    rule: 'jsx-text',
    policy: 'P4',
    reason: 'P4 — File-format acronym on an export button; its `title` IS localized (`exportJsonRows`).',
  },
  {
    file: 'components/FooterRenderer.tsx',
    match: 'ms',
    rule: 'jsx-text',
    policy: 'P4',
    reason: 'P4 — Unit symbol after the execution time (`{executionTime}ms`).',
  },
  {
    file: 'components/StreamingUIRenderer.tsx',
    match: 'ms',
    rule: 'jsx-text',
    policy: 'P4',
    reason: 'P4 — Unit symbol after execution time / TTFB in the metadata panel.',
  },
  {
    file: 'components/ScratchpadPanel.tsx',
    match: 'ms)',
    rule: 'jsx-text',
    policy: 'P4',
    reason: 'P4 — Unit symbol of a progress step duration (`({duration_ms}ms)`).',
  },
  // ── P7 ──
  {
    file: 'context/MCPActionContext.tsx',
    match: 'Actions not available server-side',
    rule: 'prose-prop',
    policy: 'P7',
    reason: 'P7 — `ActionResult.error` of the SSR stub executor, returned to the consumer; no form can submit during SSR, so no renderer shows it.',
  },
  {
    file: 'hooks/useAction.ts',
    match: 'Action cancelled by onBefore callback',
    rule: 'prose-prop',
    policy: 'P7',
    reason: 'P7 — `ActionResult.error` returned to the consumer that supplied `onBefore`; no library renderer passes `onBefore`.',
  },
  {
    file: 'hooks/useAction.ts',
    match: 'Max retries (${maxRetries}) exceeded',
    rule: 'setter',
    policy: 'P7',
    reason: 'P7 — `useAction().lastError`, returned to the consumer; no library renderer reads it.',
  },
  {
    file: 'hooks/useAutocomplete.ts',
    match: 'Unknown error',
    rule: 'setter',
    policy: 'P7',
    reason: 'P7 — `useAutocomplete().error`, returned to the consumer; AutocompleteFormField does not render it.',
  },
]

/**
 * Findings deliberately left for a later release (NOT an exclusion policy
 * item). Tolerated by the guard, kept live by the stale-entry test.
 */
export const KNOWN_ISSUES: readonly (Omit<AllowEntry, 'policy'> & { policy: 'out-of-scope' })[] = [
  {
    file: 'components/UIResourceRenderer.tsx',
    match: 'Deposium',
    rule: 'prose-prop',
    policy: 'out-of-scope',
    reason:
      'out-of-scope — auto-footer `poweredBy: \'Deposium\'` is a brand, not i18n (pre-existing since v1.2.0); out of scope for 6.20.0.',
  },
]
