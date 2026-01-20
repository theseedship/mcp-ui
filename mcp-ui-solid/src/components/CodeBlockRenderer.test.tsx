/**
 * CodeBlockRenderer Tests
 * Sprint 6 Refinement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { CodeBlockRenderer } from './CodeBlockRenderer'
import type { CodeComponentParams } from '../types'

// Mock highlight.js
vi.mock('highlight.js', () => ({
    default: {
        highlight: vi.fn((code, _options) => ({ value: `<span class="hljs-keyword">mocked</span> ${code}` })),
        highlightAuto: vi.fn((code) => ({ value: `<span class="hljs-keyword">auto</span> ${code}` })),
        getLanguage: vi.fn(() => true),
    }
}))

describe('CodeBlockRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        })
    })

    const defaultParams: CodeComponentParams = {
        code: 'console.log("Hello")',
        language: 'javascript',
    }

    it('renders code content', async () => {
        render(() => <CodeBlockRenderer params={defaultParams} />)

        // Check if code is rendered (handling potential highlighting delay)
        const codeElement = await screen.findByText((_content, element) => {
            return element?.tagName.toLowerCase() === 'code'
        })
        expect(codeElement).toBeTruthy()
    })

    it('renders filename when provided', () => {
        render(() => <CodeBlockRenderer params={{ ...defaultParams, filename: 'example.js' }} />)
        expect(screen.getByText('example.js')).toBeTruthy()
    })

    it('copies code to clipboard', async () => {
        render(() => <CodeBlockRenderer params={defaultParams} />)

        const copyButton = screen.getByTitle('Copy code')
        fireEvent.click(copyButton)

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("Hello")')
    })

    it('renders line numbers by default', () => {
        render(() => <CodeBlockRenderer params={{ ...defaultParams, code: 'line 1\nline 2' }} />)
        // Should find "1" and "2" in line number column
        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
    })

    it('hides line numbers when disabled', () => {
        render(() => <CodeBlockRenderer params={{ ...defaultParams, code: 'line 1', showLineNumbers: false }} />)
        // Should NOT find "1"
        expect(screen.queryByText('1')).toBeNull()
    })

    it('respects start offset', () => {
        render(() => <CodeBlockRenderer params={{ ...defaultParams, code: 'line 1\nline 2', startLine: 10 }} />)
        expect(screen.getByText('10')).toBeTruthy()
        expect(screen.getByText('11')).toBeTruthy()
    })

    it('handles styling class', () => {
        const { container } = render(() => <CodeBlockRenderer params={defaultParams} />)
        const code = container.querySelector('code')
        expect(code?.className).toContain('language-javascript')
    })
})
