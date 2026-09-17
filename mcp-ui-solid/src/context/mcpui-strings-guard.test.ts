// @vitest-environment node
/**
 * Chrome-strings guard — no hardcoded user-visible English under `src`.
 *
 * v6.20.0 (6th pass): the regex matchers of passes 1–5 are gone. Each pass
 * an independent verifier found leaks a regex structurally cannot see (text
 * before / between interpolations, one-literal ternaries, records keyed by
 * arbitrary names, lowercase fallbacks, French without accents, hardcoded
 * locales). The guard now runs the TypeScript-AST scanner
 * `scripts/chrome-scan.ts` (not published) over every non-test source file
 * and fails on any finding the repository policy
 * (`scripts/chrome-scan.policy.ts`) does not cover.
 *
 * Fix a finding by reading the string from `useMCPUIStrings()` (component —
 * add an optional key with the literal as its English default) or from an
 * injectable `messages` / `labels` table (runtime-free adapter / service /
 * util / hook). Otherwise add an ALLOW_LIST entry naming its exclusion-policy
 * item (P1…P8). The same result is available from the CLI:
 *
 * ```sh
 * node scripts/chrome-scan.ts            # repository policy applied
 * node scripts/chrome-scan.ts <dir> --raw  # every finding, no policy
 * ```
 */

import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isAllowed,
  isMachineToken,
  listSourceFiles,
  matchesEntry,
  scanChrome,
  scanSource,
  type Finding,
  type ScanOptions,
} from '../../scripts/chrome-scan'
import {
  ALLOW_LIST,
  KNOWN_ISSUES,
  SANCTIONED_TABLES,
  SCAN_OPTIONS,
  SCOPED_EXCLUSIONS,
} from '../../scripts/chrome-scan.policy'

const SRC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const findings = scanChrome(SRC_DIR, SCAN_OPTIONS)
/**
 * Scoped exclusions and sanctioned tables only filter findings of their own
 * file, so a staleness check rescans that one file instead of all of `src`
 * (a full rescan per entry exceeded the default test timeout on CI).
 */
const countInFile = (file: string, options: ScanOptions) =>
  scanSource(file, readFileSync(join(SRC_DIR, file), 'utf8'), options).length
const describeFinding = (f: Finding) => `${f.file}:${f.line} [${f.rule} ${f.context}] → ${JSON.stringify(f.text)}`

describe('chrome strings guard (AST scanner)', () => {
  it('finds no unallowed hardcoded chrome anywhere under src', () => {
    const offenders = findings
      .filter((f) => !isAllowed(f, [...ALLOW_LIST, ...KNOWN_ISSUES]))
      .map(describeFinding)
    expect(
      offenders,
      'Read these strings from useMCPUIStrings() (component) or an injectable messages/labels table (adapter/service/util/hook), or allow-list them in scripts/chrome-scan.policy.ts with an exclusion-policy item (P1…P8).'
    ).toEqual([])
  })

  it('scans adapters, hooks, services, utils, components and context — never tests', () => {
    const files = listSourceFiles(SRC_DIR)
    for (const dir of ['adapters/', 'hooks/', 'services/', 'utils/', 'components/', 'context/']) {
      expect(files.some((f) => f.startsWith(dir)), `No file scanned under src/${dir}`).toBe(true)
    }
    expect(files.some((f) => f.startsWith('testing/'))).toBe(false)
    expect(files.some((f) => f.includes('.test.'))).toBe(false)
    expect(files.some((f) => f.endsWith('.d.ts'))).toBe(false)
  })

  // ── The escape hatches stay honest ─────────────────────────────────────

  it('has no stale allow-list entry (each still matches a finding)', () => {
    for (const entry of [...ALLOW_LIST, ...KNOWN_ISSUES]) {
      expect(
        findings.some((f) => matchesEntry(f, entry)),
        `Stale allow-list entry: ${entry.file} → ${entry.match}`
      ).toBe(true)
    }
  })

  it('has no stale scoped exclusion (each still suppresses a finding)', () => {
    for (const scope of SCOPED_EXCLUSIONS) {
      const without = countInFile(scope.file, {
        ...SCAN_OPTIONS,
        scopedExclusions: SCOPED_EXCLUSIONS.filter((s) => s !== scope),
      })
      for (const fn of scope.functions) {
        const source = readFileSync(join(SRC_DIR, scope.file), 'utf8')
        expect(
          new RegExp(`(function|const)\\s+${fn}\\b`).test(source),
          `Scoped exclusion names a missing function: ${scope.file} → ${fn}`
        ).toBe(true)
      }
      expect(
        without,
        `Stale scoped exclusion: ${scope.file} (${scope.functions.join(', ')})`
      ).toBeGreaterThan(countInFile(scope.file, SCAN_OPTIONS))
    }
  })

  it('exports every sanctioned default table, and each one is live', () => {
    for (const table of SANCTIONED_TABLES) {
      const source = readFileSync(join(SRC_DIR, table.file), 'utf8')
      expect(
        new RegExp(`^export const ${table.name}\\b`, 'm').test(source),
        `${table.name} must be exported from ${table.file} so hosts can spread it`
      ).toBe(true)
      const without = countInFile(table.file, {
        ...SCAN_OPTIONS,
        sanctionedTables: SANCTIONED_TABLES.filter((t) => t !== table),
      })
      expect(without, `Stale sanctioned table: ${table.name}`).toBeGreaterThan(
        countInFile(table.file, SCAN_OPTIONS)
      )
    }
  })

  it('makes every entry name its policy item', () => {
    for (const entry of [...ALLOW_LIST, ...SCOPED_EXCLUSIONS, ...SANCTIONED_TABLES]) {
      expect(entry.reason, `Missing policy prefix: ${entry.file}`).toMatch(/^(P[1-8]|baseline) — /)
      expect(entry.reason.startsWith(entry.policy)).toBe(true)
    }
    for (const entry of KNOWN_ISSUES) expect(entry.reason).toMatch(/^out-of-scope — /)
  })

  it('never lets French or a hardcoded locale through a sanctioned table or a scope', () => {
    expect(findings.filter((f) => f.rule === 'french' || f.rule === 'locale').map(describeFinding)).toEqual([])
  })
})

// ── Non-vacuity — one synthetic sample of every class the regex guard missed ──

const FIXTURE_COMPONENT = `
export function Fixture(props: any) {
  const strings = useMCPUIStrings()
  const copy = () => navigator.clipboard.writeText(\`Error in \${props.tool}: \${props.message}\`)
  const statusLabel = () => {
    if (props.done) return 'all conditions met'
    return strings.ok
  }
  const BADGES = { loading: 'Loading...' }
  const STEPS = ['first step', 'second step']
  const LEVELS = ['low', 'medium', 'high']
  const KINDS = ['north', 'south']
  const SIZES = ['sm', 'md']
  const modifierKey = 'modifier'
  const busy = () => \`Chargement \${props.model}\`
  const cancelWord = 'Annuler'
  const STYLES = { active: 'bg-blue-500 text-white hover:bg-blue-600', docs: 'https://example.com/docs', event: 'mcp:action-complete' }
  console.error('Failed to load chart data')
  if (!props.ok) throw new Error('Invalid payload shape')
  props.onError?.({ message: 'Chart rendering failed' })
  setError('Map library could not be loaded.')
  const [phase, setPhase] = createSignal('')
  const done = () => setPhase('comment')
  return (
    <div class="flex items-center gap-2 text-sm" onClick={copy}>
      <span>Unknown field type: {props.type}</span>
      <span>{props.n} result{props.s} on {props.m}</span>
      <span>Showing {props.a} - {props.b} of {props.c}</span>
      <span>+{props.n} added</span>
      <span>{props.n} Rows</span>
      <span>(virtualized: {props.n} rows)</span>
      <img alt="Chart preview" src="/a.png" />
      <div role="slider" aria-valuetext="half way" />
      <Field label={'name of field'} />
      <span title={props.tool || 'unknown tool'} />
      <span>{props.code || 'UNKNOWN'}</span>
      <span>{props.count ? \`\${props.count} selected\` : props.placeholder}</span>
      <button aria-label={props.open ? strings.hide : 'Show details'} />
      <span>{props.value.toLocaleString('fr-FR')}</span>
      <span>{String(props.a).localeCompare(String(props.b), 'fr')}</span>
      <span>{props.total.toLocaleString()}</span>
      <span>{'Chargement en cours'}</span>
      <a href="https://example.com/a" title={\`https://example.com/\${props.id}\`} />
      <span onClick={done}>{phase()}</span>
      <input type="submit" value="Send now" />
      <input type="text" value="plain-value" />
      <span>{strings.ok} {BADGES.loading} {STEPS[0]} {STYLES.active} {statusLabel()}</span>
      <For each={LEVELS}>{(level) => <span>{level}</span>}</For>
      <For each={['alpha', 'beta']}>{(item) => <em>{item}</em>}</For>
      <ul>{KINDS.map((kind) => <li>{kind}</li>)}</ul>
      <For each={SIZES}>{(size) => <span class={size} data-key={modifierKey} />}</For>
    </div>
  )
}
`

const FIXTURE_ADAPTER = `
export const toLayout = () => ({
  content: 'The connector result could not be interpreted',
  kind: 'degraded-notice',
})
export const note = { hint: 'Voir la carte' }
`

describe('chrome scanner — non-vacuity', () => {
  const root = mkdtempSync(join(tmpdir(), 'chrome-scan-fixture-'))
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  write('components/Fixture.tsx', FIXTURE_COMPONENT)
  write('adapters/fixture.ts', FIXTURE_ADAPTER)
  write('components/Fixture.test.tsx', "export const t = <span>Ignored test text</span>")
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const hits = scanChrome(root)
  const flagged = (text: string, rule?: Finding['rule']) =>
    hits.some((f) => f.text === text && (rule === undefined || f.rule === rule))

  const POSITIVES: Array<[label: string, text: string, rule: Finding['rule']]> = [
    ['text before an interpolation', 'Unknown field type:', 'jsx-text'],
    ['text between interpolations (1)', 'result', 'jsx-text'],
    ['text between interpolations (2)', 'on', 'jsx-text'],
    ['range prose', 'Showing', 'jsx-text'],
    ['range prose tail', 'of', 'jsx-text'],
    ['lowercase word after an interpolation', 'added', 'jsx-text'],
    ['capitalised word after an interpolation', 'Rows', 'jsx-text'],
    ['text starting with (', '(virtualized:', 'jsx-text'],
    ['alt literal', 'Chart preview', 'visible-sink'],
    ['aria-valuetext', 'half way', 'visible-sink'],
    ['lowercase label={…}', 'name of field', 'visible-sink'],
    ['lowercase fallback', 'unknown tool', 'visible-sink'],
    ['ALL-CAPS fallback', 'UNKNOWN', 'visible-sink'],
    ['one-literal ternary (template branch)', '${props.count} selected', 'visible-sink'],
    ['one-literal ternary (string branch)', 'Show details', 'visible-sink'],
    ['record keyed by an arbitrary key', 'Loading...', 'prose-prop'],
    ['array of English words (1)', 'first step', 'prose-array'],
    ['array of English words (2)', 'second step', 'prose-array'],
    ['helper return from a *Label function', 'all conditions met', 'label-return'],
    ['adapter content', 'The connector result could not be interpreted', 'prose-prop'],
    ['setter message', 'Map library could not be loaded.', 'setter'],
    ['signal setter whose getter is rendered', 'comment', 'visible-sink'],
    ['value of a submit input', 'Send now', 'visible-sink'],
    ['French without accents', 'Chargement en cours', 'french'],
    ['French in an adapter', 'Voir la carte', 'french'],
    ['toLocaleString("fr-FR")', 'fr-FR', 'locale'],
    ['localeCompare(x, "fr")', 'fr', 'locale'],
    ['argument-less toLocaleString() in a component', 'props.total.toLocaleString()', 'locale'],
    ['clipboard template', 'Error in ${props.tool}: ${props.message}', 'clipboard'],
    ['array of single words rendered via <For each={X}>', 'medium', 'prose-array'],
    ['inline array rendered via <For>', 'alpha', 'prose-array'],
    ['array rendered via X.map(…) in JSX', 'north', 'prose-array'],
    ['single distinctive French word in a template', 'Chargement ${props.model}', 'french'],
    ['single distinctive French word literal', 'Annuler', 'french'],
  ]

  for (const [label, text, rule] of POSITIVES) {
    it(`flags ${label}`, () => {
      expect(flagged(text, rule), `${label} not flagged; hits:\n${hits.map(describeFinding).join('\n')}`).toBe(true)
    })
  }

  const NEGATIVES: Array<[label: string, text: string]> = [
    ['Tailwind class string', 'bg-blue-500 text-white hover:bg-blue-600'],
    ['class attribute', 'flex items-center gap-2 text-sm'],
    ['URL', 'https://example.com/docs'],
    ['URL template in a title', 'https://example.com/${props.id}'],
    ['event name', 'mcp:action-complete'],
    ['kebab discriminant', 'degraded-notice'],
    ['console.error', 'Failed to load chart data'],
    ['throw new Error', 'Invalid payload shape'],
    ['props.onError payload', 'Chart rendering failed'],
    ['text of a test file', 'Ignored test text'],
    ['value of a text input', 'plain-value'],
    ['array of class tokens rendered into class=', 'sm'],
    ['English homograph of a French word', 'modifier'],
  ]

  for (const [label, text] of NEGATIVES) {
    it(`does not flag ${label}`, () => {
      expect(hits.filter((f) => f.text === text).map(describeFinding)).toEqual([])
    })
  }

  it('rejects pathological class-like and camelCase tokens in linear time', () => {
    // Nested quantifiers made these take seconds (and grow exponentially).
    const started = Date.now()
    expect(isMachineToken('a' + '-'.repeat(60) + '!')).toBe(false)
    expect(isMachineToken('a' + 'A'.repeat(60) + '!')).toBe(false)
    expect(Date.now() - started).toBeLessThan(500)
    expect(isMachineToken('hover:bg-blue-600')).toBe(true)
    expect(isMachineToken('citationUnresolved')).toBe(true)
  })

  it('reports root-relative files and 1-based lines', () => {
    const f = hits.find((h) => h.text === 'Unknown field type:')!
    expect(f.file).toBe('components/Fixture.tsx')
    expect(FIXTURE_COMPONENT.split('\n')[f.line - 1]).toContain('Unknown field type:')
  })

  it('honours sanctioned tables and scoped exclusions', () => {
    const scoped = scanChrome(root, {
      sanctionedTables: [{ file: 'components/Fixture.tsx', name: 'BADGES' }],
      scopedExclusions: [{ file: 'components/Fixture.tsx', functions: ['statusLabel'] }],
    })
    expect(scoped.some((f) => f.text === 'Loading...')).toBe(false)
    expect(scoped.some((f) => f.text === 'all conditions met')).toBe(false)
    // …but never French or locales.
    expect(scoped.some((f) => f.text === 'fr-FR')).toBe(true)
  })
})
