import { describe, expect, it } from 'vitest'
import { renderKatexMath } from './katex'

describe('renderKatexMath', () => {
  it('emits MathML without KaTeX HTML layout or inline styles', () => {
    const output = renderKatexMath('x^2', { displayMode: false })!
    expect(output).toContain('<math')
    expect(output).not.toContain('katex-html')
    expect(output).not.toContain('style=')
  })

  it('does not trust URL-producing commands', () => {
    const output = renderKatexMath('\\href{javascript:alert(1)}{bad}', { displayMode: false })!
    const host = document.createElement('div')
    host.innerHTML = output
    expect(host.querySelector('a')).toBeNull()
    expect(host.querySelector('[href]')).toBeNull()
  })

  it('does not retain macro definitions between calls', () => {
    renderKatexMath('\\gdef\\shared{x}', { displayMode: false })
    expect(renderKatexMath('\\shared', { displayMode: false })).toBeNull()
  })

  it('returns null for invalid TeX so the caller can preserve its source', () => {
    expect(renderKatexMath('\\notARealCommand{', { displayMode: false })).toBeNull()
  })
})
