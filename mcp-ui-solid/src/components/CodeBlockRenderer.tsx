/**
 * CodeBlockRenderer - Syntax highlighted code block
 * Sprint 6: Code & Maps
 * Sprint Ultimate: Theme Synchronization (U.1)
 */

import { Component, createEffect, onCleanup, createSignal, Show, For } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { UIComponent, CodeComponentParams } from '../types'
import { ExpandableWrapper, useExpanded } from './ExpandableWrapper'
import { highlightQuery } from './UIResourceRenderer'

/** Map of `params.language` → file extension for the v6.2.0 download button. */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: 'ts', tsx: 'tsx', javascript: 'js', jsx: 'jsx',
  python: 'py', ruby: 'rb', go: 'go', rust: 'rs', java: 'java',
  kotlin: 'kt', swift: 'swift', php: 'php', csharp: 'cs', cpp: 'cpp',
  c: 'c', sql: 'sql', json: 'json', yaml: 'yml', toml: 'toml',
  bash: 'sh', shell: 'sh', html: 'html', css: 'css', scss: 'scss',
  markdown: 'md', xml: 'xml', graphql: 'graphql',
}

// Lazy load highlight.js
let hljs: any = null
// Track if styles have been loaded globally
let stylesLoaded = false

export interface CodeBlockRendererProps {
    /**
     * UIComponent containing code params
     */
    component?: UIComponent

    /**
     * Direct code params
     */
    params?: CodeComponentParams
}

export const CodeBlockRenderer: Component<CodeBlockRendererProps> = (props) => {
    const [highlightedCode, setHighlightedCode] = createSignal<string>('')
    const [isCopied, setIsCopied] = createSignal(false)
    const [isHljsLoaded, setIsHljsLoaded] = createSignal(false)
    const [activeTheme, setActiveTheme] = createSignal<'light' | 'dark'>('dark')
    const [wordWrap, setWordWrap] = createSignal(false)

    const params = () => props.params || (props.component?.params as CodeComponentParams)
    const isExpanded = useExpanded()
    const [searchQuery, setSearchQuery] = createSignal('')

    // v6.2.0 — search highlight: re-wraps `<mark>` around matches in the
    // already-highlighted (hljs) HTML output. `highlightQuery` is the same
    // helper TableRenderer uses (only wraps text outside of HTML tags so
    // syntax span colors stay intact).
    const displayedHTML = () => {
      const q = searchQuery().trim()
      return q ? highlightQuery(highlightedCode(), q) : highlightedCode()
    }

    const handleDownload = () => {
      const code = params()?.code
      if (!code) return
      const lang = (params()?.language || '').toLowerCase()
      const ext = LANGUAGE_EXTENSIONS[lang] || 'txt'
      const stem = (params()?.filename || `code-${Date.now()}`).replace(/\.[^.]+$/, '')
      const filename = stem.endsWith(`.${ext}`) ? stem : `${stem}.${ext}`
      const blob = new Blob([code], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    // Load highlight.js on mount
    createEffect(async () => {
        if (!hljs) {
            try {
                // Use the full highlight.js bundle with all languages for simplicity
                const module = await import('highlight.js')
                const resolved = module.default || module
                // Guard: verify the resolved module has the expected API
                if (typeof resolved?.highlight === 'function') {
                    hljs = resolved
                } else {
                    console.warn('highlight.js loaded but missing highlight() method')
                }
                setIsHljsLoaded(true)
            } catch (e) {
                console.warn('Failed to load highlight.js', e)
                // Continue without highlighting - fallback to plain text
                setIsHljsLoaded(true)
            }
        } else {
            setIsHljsLoaded(true)
        }
    })

    // Theme management - Sprint Ultimate U.1: Reactive theme synchronization
    // Load both theme stylesheets once, then toggle via data-attribute
    createEffect(async () => {
        if (isServer || stylesLoaded) return

        // Load both themes upfront for instant switching
        try {
            await Promise.all([
                import('highlight.js/styles/github.css'),
                import('highlight.js/styles/github-dark.css')
            ])
            stylesLoaded = true
        } catch (e) {
            console.warn('Failed to load highlight.js themes', e)
        }
    })

    // Reactive theme detection - listens to system preference changes
    createEffect(() => {
        if (isServer) return

        // Priority 1: Explicit theme from params
        const paramTheme = params()?.theme
        if (paramTheme) {
            setActiveTheme(paramTheme)
            return
        }

        // Priority 2: System preference with live updates
        // Check if matchMedia is available (not in all test environments)
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            setActiveTheme(mediaQuery.matches ? 'dark' : 'light')

            const handleChange = (e: MediaQueryListEvent) => {
                // Only update if no explicit theme in params
                if (!params()?.theme) {
                    setActiveTheme(e.matches ? 'dark' : 'light')
                }
            }

            mediaQuery.addEventListener('change', handleChange)
            onCleanup(() => mediaQuery.removeEventListener('change', handleChange))
        }
    })

    // Apply highlighting
    createEffect(() => {
        const code = params()?.code || ''
        const language = params()?.language || ''

        if (hljs && isHljsLoaded()) {
            try {
                let result
                if (language && hljs.getLanguage(language)) {
                    result = hljs.highlight(code, { language }).value
                } else {
                    result = hljs.highlightAuto(code).value
                }
                setHighlightedCode(result)
            } catch (e) {
                setHighlightedCode(code.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
            }
        } else {
            // Fallback: simple escaping
            setHighlightedCode(code.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        }
    })

    // Line numbers generation
    const lineNumbers = () => {
        if (params()?.showLineNumbers === false) return []
        const code = params()?.code || ''
        const lines = code.split('\n')
        const start = params()?.startLine || 1
        return lines.map((_, i) => start + i)
    }

    const handleCopy = async () => {
        const code = params()?.code
        if (code) {
            try {
                await navigator.clipboard.writeText(code)
                setIsCopied(true)
                setTimeout(() => setIsCopied(false), 2000)
            } catch (e) {
                console.error('Failed to copy code', e)
            }
        }
    }

    return (
        <ExpandableWrapper title={params()?.filename || params()?.language || 'Code'} copyData={params()?.code} copyLabel="Copy code">
        <div class={`w-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm flex flex-col ${isExpanded() ? 'flex-1 min-h-0' : ''}`}>
            {/* Header */}
            <div class="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {params()?.filename || params()?.language || 'Code'}
                </div>
                <div class="flex items-center gap-2">
                    {/* Search input (v6.2.0) */}
                    <input
                        type="text"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        placeholder="Search…"
                        class="px-2 py-0.5 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none w-32"
                        aria-label="Search in code"
                    />
                    {/* Download button (v6.2.0) */}
                    <button
                        onClick={handleDownload}
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                        aria-label="Download code as file"
                        title="Download code"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>
                    {/* Word wrap toggle */}
                    <button
                        onClick={() => setWordWrap(!wordWrap())}
                        class={`focus:outline-none transition-colors ${wordWrap() ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        aria-label="Toggle word wrap"
                        title={wordWrap() ? 'Disable word wrap' : 'Enable word wrap'}
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a4 4 0 010 8H9m4 0l-3-3m3 3l-3 3M3 6h18M3 14h4" />
                        </svg>
                    </button>
                    {/* Copy button */}
                    <button
                        onClick={handleCopy}
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                        aria-label="Copy code"
                        title="Copy code"
                    >
                        <Show when={isCopied()} fallback={
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        }>
                            <svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </Show>
                    </button>
                </div>
            </div>

            {/* Code Area */}
            <div
                class={`relative overflow-auto flex ${isExpanded() ? 'flex-1 min-h-0' : ''}`}
                style={!isExpanded() && params()?.maxHeight ? { 'max-height': params()?.maxHeight } : {}}
            >
                {/* Line Numbers */}
                <Show when={params()?.showLineNumbers !== false}>
                    <div class="flex-none text-right select-none bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-4 px-2 text-gray-400 font-mono text-xs leading-5">
                        <For each={lineNumbers()}>
                            {(num) => <div class="px-2">{num}</div>}
                        </For>
                    </div>
                </Show>

                {/* Code Content - Sprint Ultimate U.1: data-theme for reactive theming */}
                <pre
                    class="flex-1 m-0 p-4 font-mono text-gray-800 dark:text-gray-100 bg-transparent leading-5"
                    style={wordWrap() ? { 'white-space': 'pre-wrap', 'word-break': 'break-all' } : {}}
                    data-theme={activeTheme()}
                >
                    <code
                        class={`hljs ${params()?.language ? `language-${params()?.language}` : ''}`}
                        innerHTML={displayedHTML()}
                    />
                </pre>
            </div>
        </div>
        </ExpandableWrapper>
    )
}
