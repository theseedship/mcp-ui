/**
 * DuckDB WASM Autocomplete Plugin
 * Provides SQL-based suggestions using DuckDB WASM
 *
 * Sprint Autocomplete Feature
 *
 * Note: DuckDB WASM is ~2MB and is lazy-loaded on first use.
 * This plugin requires @duckdb/duckdb-wasm as an optional peer dependency.
 */

import type {
  AutocompletePlugin,
  AutocompleteResult,
  AutocompleteContext,
  AutocompleteOption,
  DuckDBPluginConfig
} from '../types'

// Type for DuckDB connection (lazy loaded)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DuckDBConnection = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DuckDBInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DuckDBModule = any

// Module state for DuckDB (singleton)
let duckdbPromise: Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> | null = null

/**
 * Check if we're in a test environment
 */
function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    typeof (globalThis as any).vitest !== 'undefined'
  )
}

/**
 * Lazy load DuckDB WASM
 */
async function loadDuckDB(): Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> {
  // In test environment, throw early to avoid import issues
  if (isTestEnvironment()) {
    throw new Error('[DuckDB Plugin] DuckDB WASM is not available in test environment')
  }

  if (duckdbPromise) {
    return duckdbPromise
  }

  duckdbPromise = (async () => {
    try {
      // Dynamic import to avoid bundling if not used
      // The import is wrapped to handle missing module gracefully
      let duckdb: DuckDBModule
      try {
        duckdb = await import(/* @vite-ignore */ '@duckdb/duckdb-wasm')
      } catch (importError) {
        throw new Error(
          '[DuckDB Plugin] @duckdb/duckdb-wasm is not installed. ' +
          'Install it with: npm install @duckdb/duckdb-wasm'
        )
      }

      // Get WASM bundles
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()

      // Select best bundle for the browser
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

      // Instantiate worker and database
      const worker = new Worker(bundle.mainWorker!)
      const logger = new duckdb.ConsoleLogger()
      const db = new duckdb.AsyncDuckDB(logger, worker)

      await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

      // Create connection
      const conn = await db.connect()

      return { db, conn }
    } catch (error) {
      console.error('[DuckDB Plugin] Failed to load DuckDB WASM:', error)
      duckdbPromise = null
      throw error
    }
  })()

  return duckdbPromise
}

/**
 * Create a DuckDB WASM autocomplete plugin
 */
export function createDuckDBPlugin(config: DuckDBPluginConfig): AutocompletePlugin {
  const { query, data } = config

  let isReady = false
  let initPromise: Promise<void> | null = null
  let connection: DuckDBConnection | null = null

  /**
   * Initialize DuckDB and load data if provided
   */
  const initialize = async (): Promise<void> => {
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const { conn } = await loadDuckDB()
        connection = conn

        // Load data if provided
        if (data) {
          await loadData(conn, data)
        }

        isReady = true
      } catch (error) {
        console.error('[DuckDB Plugin] Initialization error:', error)
        throw error
      }
    })()

    return initPromise
  }

  /**
   * Load data into DuckDB
   */
  const loadData = async (
    conn: DuckDBConnection,
    dataConfig: NonNullable<DuckDBPluginConfig['data']>
  ): Promise<void> => {
    const { tableName, source, format = 'csv' } = dataConfig

    try {
      if (typeof source === 'string') {
        // URL - fetch and load
        if (source.startsWith('http://') || source.startsWith('https://')) {
          if (format === 'csv') {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS ${tableName} AS
              SELECT * FROM read_csv_auto('${source}')
            `)
          } else if (format === 'json') {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS ${tableName} AS
              SELECT * FROM read_json_auto('${source}')
            `)
          } else if (format === 'parquet') {
            await conn.query(`
              CREATE TABLE IF NOT EXISTS ${tableName} AS
              SELECT * FROM read_parquet('${source}')
            `)
          }
        } else {
          // Inline data (CSV/JSON string)
          // For inline data, we'd need to use DuckDB's data registration
          console.warn('[DuckDB Plugin] Inline data not yet supported, use URL instead')
        }
      }
    } catch (error) {
      console.error('[DuckDB Plugin] Error loading data:', error)
      throw error
    }
  }

  return {
    id: 'duckdb',
    name: 'DuckDB WASM',

    configure(newConfig: Record<string, any>) {
      // Allow runtime reconfiguration
      Object.assign(config, newConfig)
    },

    isReady() {
      return isReady
    },

    async getSuggestions(
      input: string,
      _context?: AutocompleteContext
    ): Promise<AutocompleteResult> {
      // Ensure DuckDB is initialized
      if (!isReady) {
        try {
          await initialize()
        } catch (error) {
          console.error('[DuckDB Plugin] Failed to initialize:', error)
          return { type: 'options', options: [] }
        }
      }

      if (!connection) {
        return { type: 'options', options: [] }
      }

      if (!input.trim()) {
        return { type: 'options', options: [] }
      }

      try {
        // Replace :search placeholder with actual value
        const preparedQuery = query.replace(/:search/g, input.replace(/'/g, "''"))

        const result = await connection.query(preparedQuery)
        const rows = result.toArray()

        // Get column names
        const columns = result.schema.fields.map((f: any) => f.name)
        const valueColumn = columns[0]
        const labelColumn = columns.length > 1 ? columns[1] : columns[0]

        const options: AutocompleteOption[] = rows.map((row: any) => {
          // Convert row to object
          const rowObj: Record<string, any> = {}
          columns.forEach((col: string, idx: number) => {
            rowObj[col] = row[idx] ?? row[col]
          })

          return {
            value: String(rowObj[valueColumn]),
            label: String(rowObj[labelColumn]),
            metadata: rowObj
          }
        })

        return {
          type: 'options',
          options
        }
      } catch (error) {
        console.error('[DuckDB Plugin] Query error:', error)
        return { type: 'options', options: [] }
      }
    },

    async dispose() {
      if (connection) {
        try {
          await connection.close()
        } catch (e) {
          console.error('[DuckDB Plugin] Error closing connection:', e)
        }
        connection = null
      }
      isReady = false
      initPromise = null
    }
  }
}

/**
 * Preload DuckDB WASM (call early to warm cache)
 */
export async function preloadDuckDB(): Promise<void> {
  try {
    await loadDuckDB()
  } catch (error) {
    console.error('[DuckDB Plugin] Preload error:', error)
  }
}

export default createDuckDBPlugin
