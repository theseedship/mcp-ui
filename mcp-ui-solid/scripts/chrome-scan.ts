/**
 * chrome-scan — AST scanner for hardcoded, user-visible "chrome" strings.
 *
 * @since v6.20.0 (6th i18n pass). Replaces the regex guard of passes 1–5,
 * which structurally could not see text before / between interpolations,
 * one-literal ternaries, records keyed by arbitrary names, lowercase
 * fallbacks, French without accents or hardcoded locales.
 *
 * NOT PUBLISHED: lives outside `src/` (the package `files` field publishes
 * `src` + `dist` only) and is not part of the `tsc` program (`rootDir` is
 * `./src`). It uses only erasable TypeScript syntax, so Node ≥ 22.18 runs it
 * directly:
 *
 * ```sh
 * node scripts/chrome-scan.ts [root] [--json] [--raw]
 * ```
 *
 * - `root`  — directory to scan (default: this package's `src`)
 * - `--json` — machine-readable output
 * - `--raw`  — do not apply the repository policy (ALLOW_LIST)
 *
 * Exit code 1 when unallowed findings remain.
 *
 * Parsing is syntactic only (`ts.createSourceFile`, no type-checking).
 *
 * ## Rules
 *
 * | rule          | what is flagged                                                              |
 * |---------------|------------------------------------------------------------------------------|
 * | `jsx-text`    | JSX text with a run of ≥ 2 Latin letters (entities decoded)                  |
 * | `visible-sink`| a literal flowing into a visible JSX attribute or rendered as a JSX child    |
 * | `setter`      | a literal passed to `setXxxError/Message/Label/…()` or `createSignal('…')`   |
 * | `prose-prop`  | prose as an object-literal property value (components/hooks/adapters/…)      |
 * | `label-return`| prose returned from a function named like `*label*`, `*title*`, `*message*`  |
 * | `prose-array` | an array literal holding ≥ 2 prose strings                                   |
 * | `clipboard`   | a literal passed to `clipboard.writeText` or a `copyData`/`getCopyText` prop |
 * | `french`      | French wording anywhere (accents or stopwords in a multi-word literal)       |
 * | `locale`      | a hardcoded BCP-47 tag, or an argument-less locale call in components        |
 *
 * "Flows into" follows `||`, `??`, `&&`, `+`, each ternary branch
 * independently, parentheses, `as` / `!` / `satisfies`, template spans,
 * `formatMCPUIString(template, vars)` (both the template and the vars),
 * arrow-function bodies / `return` statements of inline functions,
 * `createMemo(() => …)`, `.map(() => …)`, and — by name, file-wide — a
 * `const`/`let` whose identifier later reaches one of the sinks above.
 *
 * P7 contexts are skipped by AST shape, not by allow-list: arguments of
 * `console.*`, `logger.*`, `log.*`, `telemetry.*`, `*.onError(…)`,
 * `new XxxError(…)` and `throw` statements.
 */

import ts from 'typescript'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export type ChromeRule =
  | 'jsx-text'
  | 'visible-sink'
  | 'setter'
  | 'prose-prop'
  | 'label-return'
  | 'prose-array'
  | 'clipboard'
  | 'french'
  | 'locale'

export interface Finding {
  /** Path relative to the scanned root, `/`-separated. */
  file: string
  /** 1-based line of the literal. */
  line: number
  rule: ChromeRule
  /** The literal: JSX text trimmed, template with `${…}` kept verbatim. */
  text: string
  /** How the literal reached the rule (`attr:title`, `jsx-child`, `prop:label`, …). */
  context: string
}

export interface ScopedExclusion {
  /** Path relative to the scanned root. */
  file: string
  /** Names of the functions (declaration or `const x = () =>`) whose body is excluded. */
  functions: readonly string[]
  /** Rules excluded inside those functions (default: every rule but `french`/`locale`). */
  rules?: readonly ChromeRule[]
}

export interface SanctionedTable {
  /** Root-relative file declaring the table. */
  file: string
  /** Name of the `const` holding the English defaults. */
  name: string
}

export interface ScanOptions {
  /**
   * Names of the sanctioned English default tables (`DEFAULT_MCPUI_STRINGS`,
   * `DEFAULT_*_MESSAGES`, `*_LABELS`). The initializer of a `const` with one
   * of these names is not scanned (except for French / locale).
   */
  sanctionedTables?: readonly SanctionedTable[]
  /** Function scopes excluded by policy (e.g. payload-schema diagnostics). */
  scopedExclusions?: readonly ScopedExclusion[]
}

// ─── Vocabulary ─────────────────────────────────────────────────────────

const SINK_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'title',
  'alt',
  'placeholder',
  'label',
  'caption',
  'message',
  'hintText',
  'summary',
  'description',
  'emptyText',
  'copyLabel',
  'fallback',
  'text',
  'tooltip',
])

/** camelCase chrome props (`confirmLabel`, `emptyMessage`, `ariaLabel`, …). */
const SINK_ATTR_SUFFIX = /[a-z](Label|Title|Text|Message|Placeholder|Caption|Description|Hint|Tooltip|Ack)$/

const CLIPBOARD_ATTRS = new Set(['copyData', 'getCopyText'])

const SETTER_CALLEE = [/^set[A-Z]\w*(Error|Message|Label|Title|Text|Status)$/, /^set(Error|Message|Status|Progress)$/]

const LABELISH_FUNCTION = /label|title|message|text|caption|summary|hint|placeholder|alt/i

/**
 * Files / dirs where object-literal prose, label returns and prose arrays are
 * scanned. `plugins/` is left out on purpose: its prose is LLM system /
 * user prompts (P8), never rendered — sinks, French and locales still apply.
 */
const PROSE_DIRS = /^(components|hooks|adapters|services|utils|context|stores)\//

/** P8 by construction — the LLM-facing component catalogue. */
const PROSE_EXCLUDED_FILES = new Set(['services/component-registry.ts'])

/** Property keys that never hold chrome (styling, ids, discriminants, geometry). */
const MACHINE_KEYS = new Set([
  'class',
  'className',
  'classList',
  'style',
  'id',
  'type',
  'role',
  'href',
  'src',
  'target',
  'rel',
  'name',
  'for',
  'key',
  'd',
  'viewBox',
  'fill',
  'stroke',
  'transform',
  'points',
  'color',
  'background',
  'backgroundColor',
  'border',
  'borderColor',
  'fontFamily',
  'font',
  'mimeType',
  'contentType',
  'sql',
  'query',
  'pattern',
  'format',
  'method',
  'Authorization',
  'headers',
  'transition',
  'animation',
  'boxShadow',
  'box-shadow',
])

const FRENCH_ACCENT = /[À-ÖØ-öø-ÿ]/
const FRENCH_SHORT_STOPWORDS = new Set([
  'le',
  'la',
  'les',
  'des',
  'du',
  'une',
  'sur',
  'pour',
  'avec',
  'dans',
  'non',
  'pas',
  'est',
  'sont',
])
const FRENCH_LONG_STOPWORDS = new Set([
  'aucun',
  'aucune',
  'résultat',
  'resultat',
  'chargement',
  'rechercher',
  'modifier',
  'annuler',
  'fermer',
  'champ',
  'réf',
])

/**
 * French words distinctive enough to flag on their own (a one-word literal such
 * as `Chargement` or a template `Chargement ${x}`). English homographs
 * (`modifier`, `champ`) are deliberately absent.
 */
const FRENCH_SINGLE_WORDS = new Set([
  'chargement',
  'rechercher',
  'recherche',
  'annuler',
  'fermer',
  'resultat',
  'résultat',
  'résultats',
  'aucune',
  'enregistrer',
  'supprimer',
  'valider',
  'suivant',
  'précédent',
  'télécharger',
  'afficher',
  'masquer',
  'envoyer',
])

const LOCALE_METHODS = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'])

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

// ─── Text heuristics ────────────────────────────────────────────────────

const hasLetters = (s: string): boolean => /[A-Za-z]{2}/.test(s)

/** Decodes the entities a JSX text may carry; unknown named entities become a space. */
export function decodeJsxEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (_, n: string) => ENTITIES[n.toLowerCase()] ?? ' ')
}

const CSS_TOKEN =
  /^(-?[\d.]+(px|rem|em|%|vh|vw|s|ms|deg|fr|ch)?|#[0-9a-f]{3,8}|[a-z-]+\([^)]*\)?|\)|solid|dashed|dotted|none|auto|inherit|transparent|bold|normal|italic|center|left|right|top|bottom|span|\/|!important|linear|inset|ease|ease-in|ease-out|ease-in-out|infinite|alternate|forwards|both|sans-serif|serif|monospace|system-ui)$/i

/** Tailwind / CSS class token: carries `-`, `:`, `[`, `/` or is a known utility. */
const CLASS_TOKEN =
  /^(!?-?[a-z0-9@]+[:\-/.[\]#%()'_,=>&*+][a-z0-9:\-/.[\]#%()'_,=>&*+]*|flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|static|border|rounded|shadow|italic|underline|truncate|transition|uppercase|lowercase|capitalize|group|peer|container|prose|antialiased|grow|shrink|invisible|visible|contents|table|outline|ring|filter|blur|resize|select-none|snap|isolate|shadow|dark|not-italic|ordinal|break-all|whitespace-nowrap)$/

/**
 * Is `text` (interpolations already replaced by spaces) a machine token —
 * class list, URL, path, id, MIME type, event name, CSS value — rather than
 * words a person reads?
 */
export function isMachineToken(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (/^(https?:|mailto:|tel:|data:|blob:|\/\/|\.{0,2}\/)/i.test(t) && !/\s/.test(t)) return true
  if (/^#[\w-]+$/.test(t)) return true // fragment / selector / hex color
  if (/^[a-z]+\/[a-z0-9.+*-]+(;.*)?$/i.test(t) && !/\s/.test(t)) return true // MIME
  if (/^[a-z]\w*$/.test(t) && /[A-Z]/.test(t)) return true // camelCase identifier
  if (/^[a-z0-9]+([_\-.:/][a-z0-9]+)+$/i.test(t) && !/^[A-Z][a-z]/.test(t)) return true // kebab/snake/dotted/event ids
  if (/^[\w-]+\.(tsx?|jsx?|json|csv|png|svg|css|md|html)$/i.test(t)) return true // file names
  if (/^[a-z_$][\w$]*(\.[\w$]+|\[[^\]\s]*\])+$/.test(t)) return true // property paths `params.data[0]`
  if (isCssValue(t)) return true
  const tokens = t.split(/\s+/)
  if (tokens.length > 1 && tokens.every((w) => CSS_TOKEN.test(w)) && tokens.some((w) => !/^[a-z]+$/i.test(w))) return true
  if (tokens.length > 1 && tokens.every((w) => CLASS_TOKEN.test(w)) && tokens.some((w) => /[-:[/]/.test(w))) return true
  if (tokens.length === 1 && CLASS_TOKEN.test(t) && /[-:[]/.test(t) && !/^[A-Z]/.test(t)) return true
  return false
}

const CSS_UNITISH = /^(-?[\d.]+(px|rem|em|%|vh|vw|s|ms|deg|fr|ch)|fn|#[0-9a-f]{3,8})$/i

/** `0 4px 6px rgba(…)`, `background-color 150ms ease`, `repeat(3, 1fr)`, `@keyframes …`. */
function isCssValue(t: string): boolean {
  if (/^@(keyframes|media|supports)\b/.test(t)) return true
  const s = t
    .replace(/\b(rgba?|hsla?|repeat|calc|var|scale|scale[XY]|translate|translate[XY]|rotate|minmax|url|cubic-bezier|linear-gradient|radial-gradient)\([^()]*\)/gi, ' fn ')
    .replace(/,/g, ' ')
    .trim()
  if (!s) return true
  const tokens = s.split(/\s+/)
  return (
    tokens.some((w) => CSS_UNITISH.test(w)) &&
    tokens.every((w) => CSS_UNITISH.test(w) || /^(-?[\d.]+|[a-z]+(-[a-z]+)+|all|opacity|transform|ease|linear|infinite|solid|dashed|dotted|none|auto|inset|color|border|alternate|forwards|backwards|both|normal|bold|center|span|\/|!important)$/.test(w))
  )
}

/**
 * Visible parts of an HTML-markup literal (innerHTML builders): the values
 * of `title` / `alt` / `aria-label` / `placeholder` attributes and the text
 * between tags. `undefined` when the literal is not markup.
 */
export function markupParts(raw: string): { attrs: string[]; text: string } | undefined {
  const looksLikeMarkup = /<\/?[a-z][\w-]*(\s|>|\/>|$)/i.test(raw) || /^\s*[a-z-]+="[^"]*"\s*\/?>/i.test(raw)
  if (!looksLikeMarkup) return undefined
  const attrs = [...raw.matchAll(/\b(?:title|alt|aria-label|placeholder)=(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2] ?? '')
  let text = raw
  // A fragment that continues an open tag (`title="…">`) — drop up to its `>`.
  if (!/^\s*</.test(text) && /^[^<]*="[^"]*"[^<]*>/.test(text)) text = text.replace(/^[^<]*?>/, ' ')
  text = text.replace(/<[^>]*(>|$)/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ')
  return { attrs, text }
}

/** Removes `${…}` (balanced) from a template's raw text. */
function stripInterpolations(text: string): string {
  let out = ''
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (depth === 0 && text[i] === '$' && text[i + 1] === '{') {
      depth = 1
      i++
      out += '0'
      continue
    }
    if (depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      continue
    }
    out += text[i]
  }
  return out
}

/** Weak test used for visible sinks: letters and not a machine token. */
export function isVisibleText(raw: string): boolean {
  const t = stripInterpolations(raw)
  return hasLetters(t) && !isMachineToken(t)
}

/** Prose heuristic used for object properties, label returns and arrays. */
export function isProse(raw: string): boolean {
  const t = stripInterpolations(raw).trim()
  if (!hasLetters(t)) return false
  if (isMachineToken(t)) return false
  return /[A-Za-z][^A-Za-z]*\s+[^A-Za-z]*[A-Za-z]/.test(t) || /^[A-Z][a-z]/.test(t) || /(\.\.\.|…|:|\.)$/.test(t)
}

export function isFrench(raw: string): boolean {
  const t = stripInterpolations(raw)
  if (FRENCH_ACCENT.test(t)) return true
  const words = t.split(/\s+/).map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')).filter(Boolean)
  if (words.length === 1) return FRENCH_SINGLE_WORDS.has(words[0].toLowerCase())
  if (words.length < 2) return false
  return words.some((w) => FRENCH_SHORT_STOPWORDS.has(w) || FRENCH_LONG_STOPWORDS.has(w.toLowerCase()))
}

// ─── AST helpers ────────────────────────────────────────────────────────

type StringNode = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression

const isFunctionLike = (n: ts.Node): n is ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration =>
  ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)

function calleeName(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  return ''
}

function calleeText(expr: ts.Expression, sf: ts.SourceFile): string {
  return expr.getText(sf).replace(/\?\./g, '.').replace(/\s+/g, '')
}

function literalText(node: StringNode, sf: ts.SourceFile): string {
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1)
  return node.text
}

function attrName(attr: ts.JsxAttribute): string {
  return attr.name.getText()
}

function propertyKey(prop: ts.PropertyAssignment): string {
  const n = prop.name
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text
  return n.getText()
}

/** The name a function is known by (declaration, `const x =`, property, `createMemo` wrapper). */
function functionName(fn: ts.Node): string {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) {
    return fn.name.getText()
  }
  let p: ts.Node | undefined = fn.parent
  if (p && ts.isCallExpression(p)) p = p.parent
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
  if (p && ts.isPropertyAssignment(p)) return propertyKey(p)
  return ''
}

/** P7 — `console.*`, `logger.*`, `telemetry.*`, `onError(…)`, `new XError`, `throw`. */
function inDiagnosticContext(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (isFunctionLike(p)) return false
    if (ts.isThrowStatement(p)) return true
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText(sf))) return true
    if (ts.isCallExpression(p)) {
      const c = calleeText(p.expression, sf)
      if (/^(console|logger|log|telemetry)\./.test(c)) return true
      if (/(^|\.)(onError|dispatchTelemetry|emitTelemetry|reportError)$/.test(c)) return true
      if (/(^|\.)logger\.\w+$/.test(c) || /(^|\.)telemetry\.\w+$/.test(c)) return true
    }
  }
  return false
}

interface Flow {
  rule: Exclude<ChromeRule, 'jsx-text' | 'french' | 'locale'>
  context: string
  /** Strict prose heuristic required (props, returns, arrays), else weak visible test. */
  strict: boolean
}

interface FileCtx {
  file: string
  sf: ts.SourceFile
  options: ScanOptions
  /** Identifier names that reach a sink in this file → the flow they reach. */
  sinkNames: Map<string, Flow>
  /** `const [getter, setter] = createSignal(…)` — setter name → getter name. */
  signalGetters: Map<string, string>
  /** Array identifiers rendered item-by-item as JSX text (`<For each={X}>`, `X.map(…)`). */
  renderedArrayNames: Set<string>
  /** Inline array literals rendered item-by-item as JSX text. */
  renderedArrayNodes: Set<ts.Node>
}

/** True when `fn` renders its first parameter (or `param()`) as a JSX child. */
function rendersParamAsText(fn: ts.Node | undefined): boolean {
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return false
  const param = fn.parameters[0]
  if (!param || !ts.isIdentifier(param.name)) return false
  const name = param.name.text
  let found = false
  const walk = (n: ts.Node): void => {
    if (found) return
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      const e = n.expression
      if (
        (ts.isIdentifier(e) && e.text === name) ||
        (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === name && e.arguments.length === 0)
      ) {
        found = true
        return
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(fn.body)
  return found
}

/** A rendered collection source: `<For each={src}>{(x) => …{x}…}</For>` or `src.map((x) => …{x}…)` inside JSX. */
function renderedCollectionSource(node: ts.Node): ts.Expression | undefined {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'For') {
    const each = node.openingElement.attributes.properties.find(
      (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === 'each'
    )
    const expr = each?.initializer && ts.isJsxExpression(each.initializer) ? each.initializer.expression : undefined
    const child = node.children.find((c): c is ts.JsxExpression => ts.isJsxExpression(c) && !!c.expression)
    if (expr && child && rendersParamAsText(child.expression)) return expr
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'map' &&
    rendersParamAsText(node.arguments[0])
  ) {
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isJsxExpression(p)) return node.expression.expression
      if (ts.isSourceFile(p) || ts.isFunctionDeclaration(p)) break
    }
  }
  return undefined
}

/**
 * Follows `node` upward through value-preserving expressions and reports
 * where it lands. Returns `undefined` when the value lands nowhere visible.
 */
function followFlow(start: ts.Node, ctx: FileCtx, depth = 0): Flow | { variable: string } | undefined {
  const { sf } = ctx
  let node: ts.Node = start
  for (let guard = 0; guard < 60; guard++) {
    const p = node.parent
    if (!p) return undefined
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p) || ts.isSatisfiesExpression(p) || ts.isTypeAssertionExpression(p)) {
      node = p
      continue
    }
    if (ts.isConditionalExpression(p)) {
      if (p.condition === node) return undefined
      node = p
      continue
    }
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) {
        node = p
        continue
      }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (p.left === node) return undefined
        node = p
        continue
      }
      if (op === ts.SyntaxKind.EqualsToken && p.right === node && ts.isIdentifier(p.left)) {
        return { variable: p.left.text }
      }
      return undefined
    }
    if (ts.isTemplateSpan(p)) {
      node = p.parent // the TemplateExpression
      continue
    }
    if (ts.isArrowFunction(p) && p.body === node) {
      node = p
      continue
    }
    if (ts.isReturnStatement(p)) {
      let fn: ts.Node | undefined = p.parent
      while (fn && !isFunctionLike(fn)) fn = fn.parent
      if (!fn) return undefined
      const name = functionName(fn)
      if (LABELISH_FUNCTION.test(name) && PROSE_DIRS.test(ctx.file) && !PROSE_EXCLUDED_FILES.has(ctx.file)) {
        return { rule: 'label-return', context: `return:${name}`, strict: true }
      }
      if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
        node = fn
        continue
      }
      if (ts.isFunctionDeclaration(fn) && fn.name) return { variable: fn.name.text }
      return undefined
    }
    if (ts.isCallExpression(p)) {
      const name = calleeName(p.expression)
      const args = p.arguments as ts.NodeArray<ts.Node>
      if (name === 'formatMCPUIString' && args[0] === node) {
        node = p
        continue
      }
      if ((name === 'createMemo' || name === 'map' || name === 'String' || name === 'untrack') && args[0] === node) {
        node = p
        continue
      }
      if (name === 'writeText' && args[0] === node) return { rule: 'clipboard', context: 'clipboard.writeText', strict: false }
      if (args.includes(node) && SETTER_CALLEE.some((r) => r.test(name))) {
        return { rule: 'setter', context: `setter:${name}`, strict: false }
      }
      if (name === 'createSignal' && args[0] === node) return { rule: 'setter', context: 'createSignal', strict: true }
      if (ts.isIdentifier(p.expression) && args[0] === node && ctx.signalGetters.has(name)) {
        // `setStatus('Loading')` where `status()` is rendered.
        return { variable: ctx.signalGetters.get(name)! }
      }
      if (p.expression === node && p.arguments.length === 0 && ts.isIdentifier(node)) {
        // `label()` — a signal / memo read: the call carries the value.
        node = p
        continue
      }
      return undefined
    }
    if (ts.isPropertyAssignment(p) && p.initializer === node) {
      const obj = p.parent
      const call = obj?.parent
      if (ts.isObjectLiteralExpression(obj) && call && ts.isCallExpression(call) && calleeName(call.expression) === 'formatMCPUIString' && call.arguments[1] === obj) {
        node = call
        continue
      }
      const key = propertyKey(p)
      if (MACHINE_KEYS.has(key) || key.startsWith('data-') || /(Class|ClassName|Color|Style|Id|Url|Href|Src|Path|Key)$/.test(key)) return undefined
      if (CLIPBOARD_ATTRS.has(key)) return { rule: 'clipboard', context: `prop:${key}`, strict: false }
      if (PROSE_DIRS.test(ctx.file) && !PROSE_EXCLUDED_FILES.has(ctx.file)) {
        return { rule: 'prose-prop', context: `prop:${key}`, strict: true }
      }
      return undefined
    }
    if (ts.isShorthandPropertyAssignment(p)) {
      const key = p.name.text
      if (MACHINE_KEYS.has(key)) return undefined
      if (PROSE_DIRS.test(ctx.file) && !PROSE_EXCLUDED_FILES.has(ctx.file)) {
        return { rule: 'prose-prop', context: `prop:${key}`, strict: true }
      }
      return undefined
    }
    if (ts.isVariableDeclaration(p) && p.initializer === node && ts.isIdentifier(p.name)) {
      return { variable: p.name.text }
    }
    if (ts.isJsxExpression(p)) {
      const q = p.parent
      if (q && (ts.isJsxElement(q) || ts.isJsxFragment(q))) return { rule: 'visible-sink', context: 'jsx-child', strict: false }
      if (q && ts.isJsxAttribute(q)) return attributeFlow(q)
      return undefined
    }
    if (ts.isJsxAttribute(p)) return attributeFlow(p)
    return undefined
  }
  void depth
  return undefined
}

/** `value` of `<button>` / `<input type="button|submit|reset">` is visible text. */
function isVisibleValueAttr(attr: ts.JsxAttribute): boolean {
  const element = attr.parent?.parent
  if (!element || !(ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element))) return false
  const tag = element.tagName.getText()
  if (tag === 'button') return true
  if (tag !== 'input') return false
  return element.attributes.properties.some(
    (p) =>
      ts.isJsxAttribute(p) &&
      p.name.getText() === 'type' &&
      !!p.initializer &&
      ts.isStringLiteral(p.initializer) &&
      ['button', 'submit', 'reset'].includes(p.initializer.text)
  )
}

function attributeFlow(attr: ts.JsxAttribute): Flow | undefined {
  const name = attrName(attr)
  if (name === 'value' && isVisibleValueAttr(attr)) return { rule: 'visible-sink', context: 'attr:value', strict: false }
  if (CLIPBOARD_ATTRS.has(name)) return { rule: 'clipboard', context: `attr:${name}`, strict: false }
  if (SINK_ATTRS.has(name) || SINK_ATTR_SUFFIX.test(name)) return { rule: 'visible-sink', context: `attr:${name}`, strict: false }
  return undefined
}

function lineOf(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

function enclosingFunctionNames(node: ts.Node): string[] {
  const names: string[] = []
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (isFunctionLike(p)) {
      const n = functionName(p)
      if (n) names.push(n)
    }
  }
  return names
}

function inSanctionedTable(node: ts.Node, file: string, options: ScanOptions): boolean {
  const names = options.sanctionedTables?.filter((t) => t.file === file).map((t) => t.name)
  if (!names?.length) return false
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && names.includes(p.name.text)) return true
  }
  return false
}

function inScopedExclusion(node: ts.Node, rule: ChromeRule, ctx: FileCtx): boolean {
  const scopes = ctx.options.scopedExclusions?.filter((s) => s.file === ctx.file)
  if (!scopes?.length) return false
  const names = enclosingFunctionNames(node)
  return scopes.some(
    (s) =>
      (s.rules ? s.rules.includes(rule) : rule !== 'french' && rule !== 'locale') &&
      names.some((n) => s.functions.includes(n))
  )
}

/** Inside `style={…}` or a `<style>` / `<script>` element. */
function inStyleContext(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return p.name.getText() === 'style'
    if (ts.isJsxElement(p)) {
      const tag = p.openingElement.tagName.getText()
      return tag === 'style' || tag === 'script'
    }
  }
  return false
}

function isInsideTypeOrImport(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isExternalModuleReference(p)) return true
    if (ts.isImportTypeNode(p)) return true
  }
  return false
}

// ─── Scanning ───────────────────────────────────────────────────────────

/** Scans one in-memory source. `file` is the root-relative path (drives dir-scoped rules). */
export function scanSource(file: string, text: string, options: ScanOptions = {}): Finding[] {
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const ctx: FileCtx = {
    file,
    sf,
    options,
    sinkNames: new Map(),
    signalGetters: new Map(),
    renderedArrayNames: new Set(),
    renderedArrayNodes: new Set(),
  }
  const findings: Finding[] = []
  const inComponents = /^components\//.test(file)

  const push = (node: ts.Node, rule: ChromeRule, value: string, context: string) => {
    if (rule !== 'french' && rule !== 'locale' && inSanctionedTable(node, file, options)) return
    if (inScopedExclusion(node, rule, ctx)) return
    findings.push({ file, line: lineOf(node, sf), rule, text: value.replace(/\s+/g, ' ').trim(), context })
  }

  // Pass 1 — identifiers (and label-ish function names) that reach a sink.
  const collect = (node: ts.Node): void => {
    const source = renderedCollectionSource(node)
    if (source) {
      const inner = ts.isParenthesizedExpression(source) ? source.expression : source
      if (ts.isIdentifier(inner)) ctx.renderedArrayNames.add(inner.text)
      else if (ts.isArrayLiteralExpression(inner)) ctx.renderedArrayNodes.add(inner)
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      calleeName(node.initializer.expression) === 'createSignal'
    ) {
      const [getter, setter] = node.name.elements
      if (getter && setter && ts.isBindingElement(getter) && ts.isBindingElement(setter) && ts.isIdentifier(getter.name) && ts.isIdentifier(setter.name)) {
        ctx.signalGetters.set(setter.name.text, getter.name.text)
      }
    }
    if (ts.isIdentifier(node) && node.parent && !isDeclarationName(node) && !inDiagnosticContext(node, sf)) {
      const flow = followFlow(node, ctx)
      if (flow && 'rule' in flow && !ctx.sinkNames.has(node.text)) ctx.sinkNames.set(node.text, flow)
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)

  const checkString = (node: StringNode) => {
    const value = literalText(node, sf)
    if (isFrench(value)) push(node, 'french', value, 'literal')
    if (isInsideTypeOrImport(node)) return
    if (inDiagnosticContext(node, sf)) return
    if (inStyleContext(node)) return

    const markup = markupParts(value)
    if (markup) {
      if (PROSE_EXCLUDED_FILES.has(file)) return
      for (const attr of markup.attrs) if (isVisibleText(attr)) push(node, 'visible-sink', value, 'html-attr')
      if (isVisibleText(markup.text) && isProse(markup.text)) push(node, 'visible-sink', value, 'html-text')
      return
    }

    // Arrays rendered item-by-item as JSX text: even single lowercase words
    // (['low', 'medium', 'high']) reach the DOM.
    if (ts.isArrayLiteralExpression(node.parent) && !PROSE_EXCLUDED_FILES.has(file)) {
      const arr = node.parent
      const decl = arr.parent
      const rendered =
        ctx.renderedArrayNodes.has(arr) ||
        (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && ctx.renderedArrayNames.has(decl.name.text)) ||
        (ts.isAsExpression(decl) && ts.isVariableDeclaration(decl.parent) && ts.isIdentifier(decl.parent.name) && ctx.renderedArrayNames.has(decl.parent.name.text))
      if (rendered && /\p{L}{2}/u.test(value)) {
        push(node, 'prose-array', value, 'rendered-array')
        return
      }
    }

    // Arrays of prose.
    if (ts.isArrayLiteralExpression(node.parent) && PROSE_DIRS.test(file) && !PROSE_EXCLUDED_FILES.has(file)) {
      const proseCount = node.parent.elements.filter(
        (e) => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) && isProse(literalText(e, sf))
      ).length
      if (proseCount >= 2 && isProse(value)) {
        push(node, 'prose-array', value, 'array')
        return
      }
    }

    let flow = followFlow(node, ctx)
    if (flow && 'variable' in flow) {
      const reached = ctx.sinkNames.get(flow.variable)
      flow = reached ? { ...reached, context: `var:${flow.variable}>${reached.context}` } : undefined
    }
    if (!flow) return
    const ok = flow.strict ? isProse(value) : isVisibleText(value)
    if (ok) push(node, flow.rule, value, flow.context)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const decoded = decodeJsxEntities(node.text)
      if (hasLetters(decoded)) push(node, 'jsx-text', decoded, 'jsx')
      if (isFrench(decoded)) push(node, 'french', decoded, 'jsx')
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      checkString(node)
      if (ts.isTemplateExpression(node)) {
        // Visit the spans' expressions only (head/middle/tail are part of this node).
        for (const span of node.templateSpans) visit(span.expression)
        return
      }
    } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      checkLocale(node)
    }
    ts.forEachChild(node, visit)
  }

  const checkLocale = (node: ts.CallExpression | ts.NewExpression) => {
    const args = node.arguments ?? ts.factory.createNodeArray()
    const callee = node.expression
    const name = calleeName(callee)
    const isIntl = ts.isPropertyAccessExpression(callee) && callee.expression.getText(sf) === 'Intl'
    let localeArg: ts.Expression | undefined
    let method = ''
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(callee) && LOCALE_METHODS.has(name)) {
      localeArg = args[0]
      method = name
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(callee) && name === 'localeCompare') {
      localeArg = args[1]
      method = name
    } else if (isIntl) {
      localeArg = args[0]
      method = `Intl.${name}`
    } else {
      return
    }
    // Any literal in the locale position is hardcoded, whatever its shape
    // (`'fr'`, `'en-US-u-nu-arab'`, `'x-private'`, even an invalid tag).
    const hardcoded = (e: ts.Expression | undefined): boolean =>
      !!e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
    if (hardcoded(localeArg)) {
      push(localeArg!, 'locale', (localeArg as ts.StringLiteral).text, method)
    } else if (localeArg && ts.isArrayLiteralExpression(localeArg) && localeArg.elements.some((e) => hardcoded(e))) {
      push(localeArg, 'locale', localeArg.getText(sf), method)
    } else if (inComponents && (!localeArg || (ts.isIdentifier(localeArg) && localeArg.text === 'undefined'))) {
      push(node, 'locale', `${node.getText(sf).slice(0, 80)}`, `${method}:implicit-locale`)
    }
  }

  visit(sf)
  return findings
}

function isDeclarationName(id: ts.Identifier): boolean {
  const p = id.parent
  return (
    ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isImportSpecifier(p) || ts.isJsxAttribute(p)) &&
      (p as { name?: ts.Node }).name === id) ||
    (ts.isPropertyAccessExpression(p) && p.name === id)
  )
}

/** Every non-test `.ts`/`.tsx` under `root`, relative and `/`-separated. */
export function listSourceFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      const rel = relative(root, abs).split(sep).join('/')
      if (entry.isDirectory()) {
        if (rel === 'testing' || entry.name === 'node_modules' || entry.name === '__tests__') continue
        walk(abs)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      if (/\.test\.|\.spec\.|test-setup|\.d\.ts$/.test(entry.name)) continue
      out.push(rel)
    }
  }
  walk(root)
  return out.sort()
}

/** Scans every non-test source under `root`. Pure: reads files, returns findings. */
export function scanChrome(root: string, options: ScanOptions = {}): Finding[] {
  const findings: Finding[] = []
  for (const file of listSourceFiles(root)) {
    findings.push(...scanSource(file, readFileSync(join(root, file), 'utf8'), options))
  }
  return findings
}

// ─── Policy helpers ─────────────────────────────────────────────────────

export type Policy = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8'

export interface AllowEntry {
  /** Root-relative file. */
  file: string
  /** Exact literal, or a substring of it. */
  match: string
  policy: Policy
  /** Starts with the policy item: `P3 — …`. */
  reason: string
  /** Restrict to one rule (optional). */
  rule?: ChromeRule
  /** `match` is a substring of the literal (default: the exact literal). */
  substring?: boolean
}

export type EntryMatcher = Pick<AllowEntry, 'file' | 'match' | 'rule' | 'substring'>

export function matchesEntry(finding: Finding, a: EntryMatcher): boolean {
  return (
    a.file === finding.file &&
    (a.rule === undefined || a.rule === finding.rule) &&
    (a.substring ? finding.text.includes(a.match) : finding.text === a.match)
  )
}

export function isAllowed(finding: Finding, allow: readonly EntryMatcher[]): boolean {
  return allow.some((a) => matchesEntry(finding, a))
}

// ─── CLI ────────────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isMain) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const raw = args.includes('--raw')
  const here = fileURLToPath(new URL('.', import.meta.url))
  const root = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, '..', 'src'))
  const policy = await import('./chrome-scan.policy.ts')
  const options: ScanOptions = raw ? {} : policy.SCAN_OPTIONS
  const all = scanChrome(root, options)
  const unallowed = raw ? all : all.filter((f) => !isAllowed(f, [...policy.ALLOW_LIST, ...policy.KNOWN_ISSUES]))
  if (json) {
    process.stdout.write(JSON.stringify({ root, total: all.length, unallowed }, null, 2) + '\n')
  } else {
    for (const f of unallowed) process.stdout.write(`${f.file}:${f.line}\t${f.rule}\t${f.context}\t${JSON.stringify(f.text)}\n`)
    process.stdout.write(`${all.length} findings, ${all.length - unallowed.length} allowed, ${unallowed.length} unallowed findings\n`)
  }
  process.exitCode = unallowed.length > 0 ? 1 : 0
}
