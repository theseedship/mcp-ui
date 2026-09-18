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
  if (/^\d/.test(tex) && /^\d/.test(following)) return true

  // A currency opener can otherwise pair with the opening delimiter of a
  // later expression ("$5 then ($x$)"). Reinterpret that first candidate
  // only when it starts with a bounded numeric amount and its apparent closer
  // is immediately followed by a complete later inline body. This deliberately
  // leaves inherently ambiguous standalone forms ($5$, $2 + 3$, $2\pi$) as
  // math and does not depend on the prose between the two delimiters.
  const amount = /^\d+(?:[.,]\d{1,2})?(?=$|[\s,;:!?()[\]+*/-])/.exec(tex)?.[0]
  if (!amount) return false

  // A standalone numeric token is valid math even when followed by prose or
  // another expression ("$5$, then $x$"). Reassignment requires content
  // beyond the amount itself.
  const trailing = tex.slice(amount.length)
  if (!trailing) return false

  // During streaming, the later formula may not have closed yet. An unmatched
  // opening parenthesis before its dollar is sufficient structural evidence
  // that the numeric dollar was currency; otherwise a permissive renderer can
  // briefly flash "5 then (" as math.
  const hasUnmatchedOpeningParen = (trailing.match(/\(/g)?.length ?? 0) > (trailing.match(/\)/g)?.length ?? 0)
  const containsTexCommand = /\\[A-Za-z]+/.test(trailing)
  if (hasUnmatchedOpeningParen && !containsTexCommand) return true

  const closerLooksLikeLaterOpener = /^(?![\s,.;:!?)}\]])(?:\\[^\n]|[^\\\n$])+\$(?!\$)/.test(following)
  return closerLooksLikeLaterOpener
}

const CELL_LINK_ATTRIBUTES = 'target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline"'

function cellLinkExtension(): MarkedExtension {
  return {
    renderer: {
      link(this: Renderer, token: Tokens.Link): string {
        // Marked owns escaping of the destination, title and nested label
        // tokens. Only inject fixed attributes into its already-safe anchor.
        const anchor = Renderer.prototype.link.call(this, token) as string
        return anchor.replace('<a ', `<a ${CELL_LINK_ATTRIBUTES} `)
      },
    },
  }
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
  const extensions = [mathExtension(renderer)]
  if (profile === 'cellMarkdown') extensions.push(cellLinkExtension())
  if (textRenderer) extensions.push(textRenderer)
  const parser = new Marked({ gfm: true }, ...extensions)
  const parsed = parser.parse(input, { async: false }) as string
  return sanitizeHtml(parsed, FINAL_PROFILES[profile])
}
