/**
 * Test Setup - Global mocks for vitest
 * Sprint Ultimate U.4: SSR Hydration Tests
 */

import { vi } from 'vitest'

// The suite runs in jsdom, but a single file may opt into `environment: node`
// (`// @vitest-environment node`) to exercise the SSR paths. Setup files still
// run there, so the browser-only mocks below target this alias instead of the
// bare `window` global — in jsdom it IS `window`, in node it is a throwaway.
const dom = (typeof window !== 'undefined' ? window : ({} as unknown)) as Window & typeof globalThis

// Mock window.matchMedia for tests
// This is needed because jsdom doesn't implement matchMedia
Object.defineProperty(dom, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (used by some charting libraries)
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
dom.ResizeObserver = MockResizeObserver as any

// Mock IntersectionObserver (used by lazy loading)
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
dom.IntersectionObserver = MockIntersectionObserver as any
