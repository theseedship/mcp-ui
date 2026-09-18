import type { Config } from 'dompurify'
import { Marked, Renderer, type MarkedExtension, type Tokens } from 'marked'
import type { MathRenderer } from '../context/MCPUIMathContext'
import { escapeHtml } from './escape-html'
import { canSanitizeHtml, sanitizeHtml } from './sanitize-html'

export type MathMarkdownProfile = 'prose' | 'cellMarkdown'
export type MarkdownTextTransform = (escapedText: string) => string

export const MATH_MARKDOWN_LIMITS = {
  sourceLength: 100_000,
  expressionLength: 4_096,
  expressionCount: 128,
} as const

const MATH_TAGS = [
  'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mtext', 'mspace', 'ms',
  'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr',
  'mtd', 'mover', 'munder', 'munderover', 'mpadded', 'mphantom', 'mstyle', 'menclose',
] as const

const MATH_ATTRS = [
  'xmlns', 'display', 'class', 'mathvariant', 'stretchy', 'fence', 'separator',
  'lspace', 'rspace', 'accent', 'accentunder', 'columnalign', 'rowalign',
  'columnspacing', 'rowspacing', 'columnlines', 'rowlines', 'frame', 'notation',
  'width', 'height', 'depth', 'voffset', 'scriptlevel', 'displaystyle',
] as const

const STRICT_MATHML_CONFIG = {
  ALLOWED_TAGS: [...MATH_TAGS, 'span'],
  ALLOWED_ATTR: [...MATH_ATTRS],
  FORBID_TAGS: ['annotation', 'annotation-xml', 'style', 'a'],
  // DOMPurify normally keeps the text of forbidden tags. TeX annotations can
  // be large and duplicate the accessible MathML, so remove their subtree.
  ADD_FORBID_CONTENTS: ['annotation', 'annotation-xml'],
  FORBID_ATTR: ['style'],
} as Config

const CELL_MARKDOWN_TAGS = [
  'a', 'strong', 'em', 'b', 'i', 'code', 'span', 'br', 'button', 'svg', 'path',
  'p', 'ul', 'ol', 'li', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  ...MATH_TAGS,
]

const FINAL_PROFILES: Record<MathMarkdownProfile, Config> = {
  prose: {
    ADD_TAGS: [...MATH_TAGS],
    ADD_ATTR: [...MATH_ATTRS, 'target', 'rel'],
    FORBID_TAGS: ['annotation', 'annotation-xml', 'style', 'form', 'textarea', 'select', 'button', 'iframe', 'object', 'embed'],
    ADD_FORBID_CONTENTS: ['annotation', 'annotation-xml'],
    FORBID_ATTR: ['style'],
  } as Config,
  cellMarkdown: {
    ALLOWED_TAGS: CELL_MARKDOWN_TAGS,
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'data-citation-page', 'data-citation-source',
      'data-citation-doc', 'data-citation-verified', 'title', 'fill', 'stroke',
      'viewBox', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'd',
      ...MATH_ATTRS,
    ],
    FORBID_TAGS: ['annotation', 'annotation-xml', 'style'],
    ADD_FORBID_CONTENTS: ['annotation', 'annotation-xml'],
    FORBID_ATTR: ['style'],
  } as Config,
}

interface MathToken extends Tokens.Generic {
  type: 'mcpDisplayMath' | 'mcpInlineMath'
  raw: string
  tex: string
  displayMode: boolean
  render: boolean
}

function isCurrencyLike(raw: string, tex: string, following: string): boolean {
  if (/^\$\s|\s\$$/.test(raw)) return true
  if (/^\d+(?:[.,]\d+)?-\s*$/.test(tex)) return true
  return /^\d/.test(following)
}

function mathExtension(renderer: MathRenderer): MarkedExtension {
  let count = 0
  const token = (raw: string, tex: string, displayMode: boolean): MathToken => ({
    type: displayMode ? 'mcpDisplayMath' : 'mcpInlineMath',
    raw,
    tex,
    displayMode,
    render: ++count <= MATH_MARKDOWN_LIMITS.expressionCount && tex.length <= MATH_MARKDOWN_LIMITS.expressionLength,
  })

  return {
    extensions: [
      {
        name: 'mcpDisplayMath',
        level: 'block',
        start(src) {
          const index = src.indexOf('$$')
          return index < 0 ? undefined : index
        },
        tokenizer(src) {
          const match = /^\$\$\s*\n?([\s\S]+?)\n?\s*\$\$(?:\n|$)/.exec(src)
          if (!match) return undefined
          return token(match[0], match[1], true)
        },
        renderer(tokenValue) {
          return renderToken(tokenValue as MathToken, renderer)
        },
      },
      {
        name: 'mcpInlineMath',
        level: 'inline',
        start(src) {
          const index = src.indexOf('$')
          return index < 0 ? undefined : index
        },
        tokenizer(src) {
          const match = /^\$(?!\$)((?:\\[^\n]|[^\\\n$])+?)\$(?!\$)/.exec(src)
          if (!match || isCurrencyLike(match[0], match[1], src.slice(match[0].length))) return undefined
          return token(match[0], match[1], false)
        },
        renderer(tokenValue) {
          return renderToken(tokenValue as MathToken, renderer)
        },
      },
    ],
  }
}

function renderToken(token: MathToken, renderer: MathRenderer): string {
  if (!token.render) return escapeHtml(token.raw)
  try {
    const rendered = renderer(token.tex, { displayMode: token.displayMode })
    if (!rendered) return escapeHtml(token.raw)
    return sanitizeHtml(rendered, STRICT_MATHML_CONFIG)
  } catch {
    return escapeHtml(token.raw)
  }
}

/**
 * Parse Markdown with isolated, bounded math support and sanitize the complete
 * result for its final sink. The optional transform sees escaped ordinary text
 * tokens only. Math, code, raw HTML and link destinations never pass through
 * it, so citation syntax cannot corrupt TeX optional arguments or attributes.
 */
export function parseMathMarkdown(
  source: string,
  renderer: MathRenderer,
  profile: MathMarkdownProfile,
  transformText?: MarkdownTextTransform,
): string {
  const input = source === null || source === undefined ? '' : String(source)
  if (!canSanitizeHtml()) return escapeHtml(input)
  if (input.length > MATH_MARKDOWN_LIMITS.sourceLength) return escapeHtml(input)

  const textRenderer = transformText
    ? {
        renderer: {
          text(this: Renderer, token: Tokens.Text | Tokens.Escape): string {
            // Block text tokens (notably list-item text) can own already
            // tokenized inline children. Recurse first so math and code keep
            // their own renderers; leaf text callbacks run as parsing descends.
            if ('tokens' in token && token.tokens) {
              return this.parser.parseInline(token.tokens)
            }
            // Delegate entity handling and nested token rendering to Marked's
            // own renderer. `escapeHtml` is deliberately not equivalent: it
            // turns source `&amp;` into visible `&amp;` by double-escaping it.
            const safeText = Renderer.prototype.text.call(this, token)
            return transformText(safeText as string)
          },
        },
      }
    : undefined
  const parser = textRenderer
    ? new Marked({ gfm: true }, mathExtension(renderer), textRenderer)
    : new Marked({ gfm: true }, mathExtension(renderer))
  const parsed = parser.parse(input, { async: false }) as string
  return sanitizeHtml(parsed, FINAL_PROFILES[profile])
}
