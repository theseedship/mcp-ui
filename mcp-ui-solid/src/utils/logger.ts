/**
 * Simple internal logger utility
 *
 * Provides basic logging functionality for the package.
 * Consumers can disable logging by setting NODE_ENV=production
 * or by implementing their own logging solution.
 */

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

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
      if (isDev) {
        console.info(formatLogMessage(feature, message, context))
      }
    },

    warn(message: string, context?: Record<string, unknown>) {
      if (isDev) {
        console.warn(formatLogMessage(feature, message, context))
      }
    },

    error(message: string, context?: Record<string, unknown>) {
      // Always log errors, even in production
      console.error(formatLogMessage(feature, message, context))
    },

    debug(message: string, context?: Record<string, unknown>) {
      if (isDev) {
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
