/**
 * MCP UI Solid - Services
 *
 * Business logic for component validation and registry management
 */

export {
  validateComponent,
  validateLayout,
  validateIframeDomain,
  getIframeSandbox,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_IFRAME_DOMAINS,
  TRUSTED_IFRAME_DOMAINS,
} from './validation'

export { ComponentRegistry } from './component-registry'
