/**
 * Simple internal logger utility
 *
 * Logging is enabled when EITHER:
 *   1. `process.env.NODE_ENV !== 'production'` (dev build), OR
 *   2. `process.env.MCP_UI_DEBUG === 'true'` (server-side opt-in for prod), OR
 *   3. `globalThis.__MCP_UI_DEBUG__ === true` (browser-side runtime toggle), OR
 *   4. `setDebugMode(true)` has been called from app code.
 *
 * `error` always logs regardless of mode.
 *
 * @see setDebugMode, isDebugEnabled — runtime controls (v5.4.0)
 */

declare global {
  // Browser-side runtime flag — settable from devtools console:
  //   `globalThis.__MCP_UI_DEBUG__ = true`
  // eslint-disable-next-line no-var
  var __MCP_UI_DEBUG__: boolean | undefined
}

let debugOverride: boolean | null = null

function readEnvFlag(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.MCP_UI_DEBUG === 'true') return true
    if (process.env.NODE_ENV !== 'production') return true
  }
  if (typeof globalThis !== 'undefined' && globalThis.__MCP_UI_DEBUG__ === true) {
    return true
  }
  return false
}

function isDebugActive(): boolean {
  if (debugOverride !== null) return debugOverride
  return readEnvFlag()
}

/**
 * Programmatically enable/disable verbose logging at runtime.
 *
 * Pass `null` to clear the override and fall back to env-based detection.
 *
 * @example
 * ```ts
 * import { setDebugMode } from '@seed-ship/mcp-ui-solid'
 * setDebugMode(true)   // turn on verbose logs
 * setDebugMode(false)  // turn off (overrides NODE_ENV=development)
 * setDebugMode(null)   // restore env-based behavior
 * ```
 */
export function setDebugMode(enabled: boolean | null): void {
  debugOverride = enabled
}

/**
 * Whether verbose logging is currently active (env + override combined).
 */
export function isDebugEnabled(): boolean {
  return isDebugActive()
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}

function formatLogMessage(
  feature: string,
  message: string,
  context?: Record<string, unknown>
): string {
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `[@seed-ship/mcp-ui-solid:${feature}] ${message}${contextStr}`
}

/**
 * Creates a feature-scoped logger
 *
 * @param feature - Feature name for log prefixing
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('my-component')
 * logger.info('Component mounted', { componentId: '123' })
 * ```
 */
export function createLogger(feature: string): Logger {
  return {
    info(message: string, context?: Record<string, unknown>) {
      if (isDebugActive()) {
        console.info(formatLogMessage(feature, message, context))
      }
    },

    warn(message: string, context?: Record<string, unknown>) {
      if (isDebugActive()) {
        console.warn(formatLogMessage(feature, message, context))
      }
    },

    error(message: string, context?: Record<string, unknown>) {
      // Always log errors, even in production
      console.error(formatLogMessage(feature, message, context))
    },

    debug(message: string, context?: Record<string, unknown>) {
      if (isDebugActive()) {
        console.debug(formatLogMessage(feature, message, context))
      }
    },
  }
}

/**
 * No-op logger for testing or when logging is disabled
 */
export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}
