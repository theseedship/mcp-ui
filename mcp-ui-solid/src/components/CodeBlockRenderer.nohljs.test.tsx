/**
 * `CodeBlockRenderer` with highlight.js UNAVAILABLE (v6.19.0).
 *
 * `<code innerHTML>` is the one innerHTML sink of this package that does not
 * go through `sanitizeHtml` (see `utils/sanitize-html`): it is safe only
 * because the fallback escapes the source itself. That fallback needs a module
 * registry where the dynamic `import('highlight.js')` rejects, which is why it
 * lives in its own file — `CodeBlockRenderer.test.tsx` mocks a *working*
 * highlight.js, and the module-level `hljs` cache is per module registry.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render } from '@solidjs/testing-library'
import { CodeBlockRenderer } from './CodeBlockRenderer'

vi.mock('highlight.js', () => {
  throw new Error('highlight.js is unavailable')
})

// Deliberately full of characters that must not survive as markup.
const SOURCE = '&lt;script&gt;alert(1)&lt;/script&gt; a && b'

describe('CodeBlockRenderer — highlight.js fails to load', () => {
  // The component logs the rejection on purpose; keep the suite output clean.
  let warn: ReturnType<typeof vi.spyOn>
  beforeAll(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => warn.mockRestore())

  it('shows the source as text instead of parsing it as markup', async () => {
    const { container } = render(() => (
      <CodeBlockRenderer params={{ code: SOURCE, language: 'javascript' }} />
    ))

    await vi.waitFor(() => {
      expect(container.querySelector('code')?.textContent).toBe(SOURCE)
    })

    const code = container.querySelector('code')!
    expect(container.querySelector('script')).toBeNull()
    // `&` is escaped too — the old hand-rolled `< >`-only replace let
    // `&lt;script&gt;` render as a literal tag.
    expect(code.innerHTML).toContain('&amp;lt;script&amp;gt;')
    expect(code.innerHTML).not.toContain('<script')
  })

  it('escapes a genuinely hostile source', async () => {
    const hostile = '<img src=x onerror=alert(1)>'
    const { container } = render(() => (
      <CodeBlockRenderer params={{ code: hostile, language: 'javascript' }} />
    ))

    await vi.waitFor(() => {
      expect(container.querySelector('code')?.textContent).toBe(hostile)
    })
    expect(container.querySelector('img')).toBeNull()
  })
})
