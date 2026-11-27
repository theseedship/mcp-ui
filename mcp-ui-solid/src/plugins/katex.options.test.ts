import katex from 'katex'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderKatexMath } from './katex'

vi.mock('katex', () => ({
  default: { renderToString: vi.fn(() => '<math />') },
}))

const renderToString = vi.mocked(katex.renderToString)

describe('renderKatexMath options', () => {
  beforeEach(() => {
    renderToString.mockClear()
  })

  it('passes the fixed MathML and safety options to KaTeX', () => {
    expect(renderKatexMath('x_i', { displayMode: true })).toBe('<math />')
    expect(renderToString).toHaveBeenCalledTimes(1)
    expect(renderToString).toHaveBeenCalledWith('x_i', {
      displayMode: true,
      output: 'mathml',
      throwOnError: true,
      trust: false,
      maxExpand: 1000,
      maxSize: 20,
      macros: {},
    })
  })

  it('forwards inline mode and creates a fresh macro table per render', () => {
    renderKatexMath('x', { displayMode: false })
    renderKatexMath('y', { displayMode: true })

    expect(renderToString.mock.calls[0]?.[1]?.displayMode).toBe(false)
    expect(renderToString.mock.calls[1]?.[1]?.displayMode).toBe(true)
    expect(renderToString.mock.calls[0]?.[1]?.macros).not.toBe(renderToString.mock.calls[1]?.[1]?.macros)
  })
})
