/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Optional peer dependency: @duckdb/duckdb-wasm
 * This module declaration allows TypeScript to compile even when the package is not installed.
 * The actual DuckDB WASM module will be dynamically imported at runtime if available.
 */
declare module '@duckdb/duckdb-wasm' {
  export function getJsDelivrBundles(): any
  export function selectBundle(bundles: any): Promise<any>
  export class ConsoleLogger {
    constructor()
  }
  export class AsyncDuckDB {
    constructor(logger: any, worker: Worker)
    instantiate(mainModule: any, pthreadWorker?: any): Promise<void>
    connect(): Promise<any>
  }
}
