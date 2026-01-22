/**
 * Autocomplete Plugins Index
 * Re-exports all available autocomplete plugins
 *
 * Sprint Autocomplete Feature
 */

export { createGroqPlugin } from './groq'
export { createSupabasePlugin } from './supabase'
export { createRestPlugin } from './rest'

// DuckDB plugin is exported separately due to WASM dependencies
// Import directly from './duckdb' when needed:
// import { createDuckDBPlugin, preloadDuckDB } from '@seed-ship/mcp-ui-solid/plugins/duckdb'
