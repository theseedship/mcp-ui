// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { parseMathMarkdown } from './math-markdown'

it('keeps SSR source escaped and never calls the host math renderer', () => {
  const renderer = vi.fn(() => '<math><mi>x</mi></math>')
  const source = '$x$ <img src=x onerror=alert(1)> & end'
  for (const profile of ['prose', 'cellMarkdown'] as const) {
    expect(parseMathMarkdown(source, renderer, profile)).toBe(
      '$x$ &lt;img src=x onerror=alert(1)&gt; &amp; end',
    )
  }
  expect(renderer).not.toHaveBeenCalled()
})
