import katex from 'katex'
import type { MathRenderer } from '../context/MCPUIMathContext'

/**
 * Optional KaTeX adapter. It emits MathML only: no HTML layout tree, inline
 * styles, fonts, stylesheet, shared macro state, or trusted TeX commands.
 */
export const renderKatexMath: MathRenderer = (tex, { displayMode }) => {
  try {
    return katex.renderToString(tex, {
      displayMode,
      output: 'mathml',
      // Invalid TeX must return null so the core can preserve the complete
      // source token, including its delimiters, instead of showing KaTeX's
      // red error MathML and silently consuming the dollars.
      throwOnError: true,
      trust: false,
      maxExpand: 1000,
      maxSize: 20,
      macros: {},
    })
  } catch {
    return null
  }
}
