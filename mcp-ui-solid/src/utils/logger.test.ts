/**
 * Tests for logger debug-mode controls — v5.4.0 (B.2)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLogger, setDebugMode, isDebugEnabled } from './logger'

describe('setDebugMode + isDebugEnabled (v5.4.0 — B.2)', () => {
  let originalNodeEnv: string | undefined
  let originalDebugEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    originalDebugEnv = process.env.MCP_UI_DEBUG
    setDebugMode(null) // reset override
    delete (globalThis as any).__MCP_UI_DEBUG__
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    process.env.MCP_UI_DEBUG = originalDebugEnv
    setDebugMode(null)
    delete (globalThis as any).__MCP_UI_DEBUG__
  })

  it('default (NODE_ENV=test, no override): isDebugEnabled returns true', () => {
    // Vitest sets NODE_ENV='test' by default — that's !== 'production' so dev mode is on
    expect(isDebugEnabled()).toBe(true)
  })

  it('NODE_ENV=production silences debug by default', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.MCP_UI_DEBUG
    expect(isDebugEnabled()).toBe(false)
  })

  it('MCP_UI_DEBUG=true re-enables debug in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.MCP_UI_DEBUG = 'true'
    expect(isDebugEnabled()).toBe(true)
  })

  it('globalThis.__MCP_UI_DEBUG__=true re-enables debug in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.MCP_UI_DEBUG
    ;(globalThis as any).__MCP_UI_DEBUG__ = true
    expect(isDebugEnabled()).toBe(true)
  })

  it('setDebugMode(true) overrides NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production'
    setDebugMode(true)
    expect(isDebugEnabled()).toBe(true)
  })

  it('setDebugMode(false) overrides NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development'
    setDebugMode(false)
    expect(isDebugEnabled()).toBe(false)
  })

  it('setDebugMode(null) restores env-based detection', () => {
    process.env.NODE_ENV = 'production'
    setDebugMode(true)
    expect(isDebugEnabled()).toBe(true)
    setDebugMode(null)
    expect(isDebugEnabled()).toBe(false)
  })
})

describe('createLogger respects debug mode (v5.4.0)', () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    setDebugMode(null)
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    setDebugMode(null)
    vi.restoreAllMocks()
  })

  it('info/warn/debug are silent when debug is off', () => {
    process.env.NODE_ENV = 'production'
    setDebugMode(false)

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const logger = createLogger('test')
    logger.info('a')
    logger.warn('b')
    logger.debug('c')

    expect(infoSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('error always logs even when debug is off', () => {
    process.env.NODE_ENV = 'production'
    setDebugMode(false)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const logger = createLogger('test')
    logger.error('boom', { id: 1 })

    expect(errorSpy).toHaveBeenCalledOnce()
    expect(errorSpy.mock.calls[0][0]).toContain('[@seed-ship/mcp-ui-solid:test]')
    expect(errorSpy.mock.calls[0][0]).toContain('boom')
    expect(errorSpy.mock.calls[0][0]).toContain('"id":1')
  })

  it('toggling setDebugMode at runtime affects subsequent calls', () => {
    process.env.NODE_ENV = 'production'
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const logger = createLogger('toggle')
    logger.info('off')
    expect(infoSpy).not.toHaveBeenCalled()

    setDebugMode(true)
    logger.info('on')
    expect(infoSpy).toHaveBeenCalledOnce()
  })
})
