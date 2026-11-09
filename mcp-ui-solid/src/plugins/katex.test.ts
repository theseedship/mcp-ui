import { describe, expect, it } from 'vitest'
import { renderKatexMath } from './katex'

describe('renderKatexMath', () => {
  it.each([
    ['inline fraction', '\\frac{1}{2}', false, 'mfrac'],
    ['display fraction', '\\frac{1}{2}', true, 'mfrac'],
    ['inline subscript', 'x_i', false, 'msub'],
    ['display subscript', 'x_i', true, 'msub'],
    ['inline matrix', '\\begin{matrix}a&b\\\\c&d\\end{matrix}', false, 'mtable'],
    ['display matrix', '\\begin{matrix}a&b\\\\c&d\\end{matrix}', true, 'mtable'],
  ])('renders a %s as MathML', (_name, tex, displayMode, node) => {
    const output = renderKatexMath(tex, { displayMode })!
    const host = document.createElement('div')
    host.innerHTML = output
    const math = host.querySelector('math')
    expect(math).not.toBeNull()
    expect(math?.querySelector(node)).not.toBeNull()
    expect(output).not.toContain('katex-html')
    expect(host.querySelector('[style]')).toBeNull()
  })

  it('emits MathML without KaTeX HTML layout or inline styles', () => {
    const output = renderKatexMath('x^2', { displayMode: false })!
    const host = document.createElement('div')
    host.innerHTML = output
    expect(output).toContain('<math')
    expect(output).not.toContain('katex-html')
    expect(host.querySelector('[style]')).toBeNull()
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
    expect(renderKatexMath('\\notARealCommand{', { displayMode: true })).toBeNull()
  })

  it('does not retain macro definitions after a failed render', () => {
    expect(renderKatexMath('\\gdef\\shared{x}\\notARealCommand{', { displayMode: false })).toBeNull()
    expect(renderKatexMath('\\shared', { displayMode: false })).toBeNull()
  })
})
