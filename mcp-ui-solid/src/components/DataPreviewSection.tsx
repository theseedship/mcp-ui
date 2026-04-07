/**
 * DataPreviewSection — paginated, sortable data table with export
 * v4.0.4: Full pagination spec (auto-activate, pageSize=0 disable, showPageInfo, onPageChange)
 *
 * @experimental
 */

import { createSignal, createMemo, createEffect, For, Show } from 'solid-js'
import type { DataPreviewContent, DataPreviewColumn } from '../types/chat-bus'

export interface DataPreviewSectionProps {
  content: DataPreviewContent
}

type SortDir = 'asc' | 'desc' | null

// ─── Formatting helpers ─────────────────────────────────────

function formatNumber(value: unknown, format?: string): string {
  if (typeof value !== 'number' || !isFinite(value)) return String(value ?? '')
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'currency') return `${value.toLocaleString('fr-FR')} EUR`
  if (Number.isInteger(value)) return value.toLocaleString('fr-FR')
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function formatCell(value: unknown, col: DataPreviewColumn): string {
  if (value == null) return '\u2014'
  if (col.type === 'number') return formatNumber(value, col.format)
  if (col.type === 'date' && typeof value === 'string') {
    try { return new Date(value).toLocaleDateString('fr-FR') } catch { return value }
  }
  return String(value)
}

function compareValues(a: unknown, b: unknown, type?: string): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (type === 'number') {
    const na = typeof a === 'number' ? a : Number(a)
    const nb = typeof b === 'number' ? b : Number(b)
    if (isNaN(na) && isNaN(nb)) return 0
    if (isNaN(na)) return 1
    if (isNaN(nb)) return -1
    return na - nb
  }
  if (type === 'date') {
    const da = new Date(String(a)).getTime()
    const db = new Date(String(b)).getTime()
    if (isNaN(da) && isNaN(db)) return 0
    if (isNaN(da)) return 1
    if (isNaN(db)) return -1
    return da - db
  }
  return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' })
}

// ─── Export helpers ─────────────────────────────────────────

function toCSV(columns: DataPreviewColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(';')
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key]
      if (val == null) return ''
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`
      return String(val)
    }).join(';')
  ).join('\n')
  return `${header}\n${body}`
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Content resolver ───────────────────────────────────────

function resolveContent(raw: unknown): DataPreviewContent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.columns) && Array.isArray(obj.rows)) {
    return obj as unknown as DataPreviewContent
  }
  if (obj.content && typeof obj.content === 'object') {
    const inner = obj.content as Record<string, unknown>
    if (Array.isArray(inner.columns) && Array.isArray(inner.rows)) {
      return inner as unknown as DataPreviewContent
    }
  }
  return null
}

// ─── Component ──────────────────────────────────────────────

export function DataPreviewSection(props: DataPreviewSectionProps) {
  const content = createMemo(() => {
    const resolved = resolveContent(props.content)
    if (!resolved) {
      console.warn('[MCP-UI] DataPreviewSection: invalid content — expected { columns, rows }', props.content)
    }
    return resolved
  })

  const columns = () => content()?.columns || []
  const rawRows = () => content()?.rows || []
  const pageSizeVal = () => content()?.pageSize ?? 25
  const showPageInfo = () => content()?.showPageInfo !== false

  const [page, setPage] = createSignal(content()?.initialPage ?? 0)
  const [sortKey, setSortKey] = createSignal<string | null>(null)
  const [sortDir, setSortDir] = createSignal<SortDir>(null)

  // Notify parent on page change
  createEffect(() => {
    const p = page()
    content()?.onPageChange?.(p)
  })

  const handleSort = (key: string) => {
    if (sortKey() === key) {
      if (sortDir() === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sortedRows = createMemo(() => {
    const r = rawRows()
    const key = sortKey()
    const dir = sortDir()
    if (!key || !dir) return r
    const col = columns().find(c => c.key === key)
    return [...r].sort((a, b) => {
      const cmp = compareValues(a[key], b[key], col?.type)
      return dir === 'desc' ? -cmp : cmp
    })
  })

  // Pagination: auto-enabled when rows > pageSize, disabled when pageSize=0
  const isPaginated = () => pageSizeVal() > 0 && sortedRows().length > pageSizeVal()
  const totalPages = () => isPaginated() ? Math.ceil(sortedRows().length / pageSizeVal()) : 1

  const visibleRows = createMemo(() => {
    if (!isPaginated()) return sortedRows()
    const start = page() * pageSizeVal()
    return sortedRows().slice(start, start + pageSizeVal())
  })

  const rangeStart = () => isPaginated() ? page() * pageSizeVal() + 1 : 1
  const rangeEnd = () => isPaginated()
    ? Math.min((page() + 1) * pageSizeVal(), sortedRows().length)
    : sortedRows().length

  // Export ALL rows (not just page)
  const handleExportCSV = () => {
    const c = content()
    if (!c) return
    downloadFile(toCSV(c.columns, sortedRows()), 'data-export.csv', 'text/csv;charset=utf-8')
  }
  const handleExportJSON = () => {
    downloadFile(JSON.stringify(sortedRows(), null, 2), 'data-export.json', 'application/json')
  }

  const columnAlign = (col: DataPreviewColumn) => {
    if (col.align) return col.align
    if (col.type === 'number') return 'right'
    return 'left'
  }

  const sortIndicator = (key: string) => {
    if (sortKey() !== key) return '\u2195'
    return sortDir() === 'asc' ? '\u2191' : '\u2193'
  }

  return (
    <Show when={content()} fallback={
      <div class="text-xs text-amber-600 dark:text-amber-400 p-2">
        [DataPreviewSection] Invalid content format
      </div>
    }>
      {(c) => (
        <div class="data-preview-section">
          {/* Header: source + export */}
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Show when={c().source}>
                <span class="font-medium">{c().source}</span>
              </Show>
              <Show when={c().freshness}>
                <span class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  {c().freshness}
                </span>
              </Show>
            </div>
            <Show when={c().exportable !== false}>
              <div class="flex items-center gap-1">
                <button
                  class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleExportCSV}
                  title={`Export CSV (${sortedRows().length} rows)`}
                >
                  CSV
                </button>
                <button
                  class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleExportJSON}
                  title={`Export JSON (${sortedRows().length} rows)`}
                >
                  JSON
                </button>
              </div>
            </Show>
          </div>

          {/* Table */}
          <div class="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-800">
                  <For each={columns()}>
                    {(col) => (
                      <th
                        class="px-3 py-2 font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                        style={{ "text-align": columnAlign(col) }}
                        onClick={() => handleSort(col.key)}
                        title={`Sort by ${col.label}`}
                      >
                        <span class="inline-flex items-center gap-1">
                          {col.label}
                          <span
                            class="text-[10px] leading-none"
                            classList={{
                              'opacity-30': sortKey() !== col.key,
                              'opacity-100 text-blue-600 dark:text-blue-400': sortKey() === col.key,
                            }}
                          >
                            {sortIndicator(col.key)}
                          </span>
                        </span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={visibleRows()}>
                  {(row, i) => (
                    <tr
                      class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      classList={{ 'bg-gray-25 dark:bg-gray-850': i() % 2 === 1 }}
                    >
                      <For each={columns()}>
                        {(col) => (
                          <td
                            class="px-3 py-2 text-gray-800 dark:text-gray-200"
                            style={{ "text-align": columnAlign(col) }}
                          >
                            {formatCell(row[col.key], col)}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Footer: pagination + page info */}
          <div class="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Show when={showPageInfo()}>
              <span>
                {isPaginated()
                  ? `Showing ${rangeStart()}\u2013${rangeEnd()} of ${sortedRows().length.toLocaleString('fr-FR')}`
                  : `${sortedRows().length} row${sortedRows().length !== 1 ? 's' : ''}`
                }
                {c().totalRows && c().totalRows! > sortedRows().length
                  ? ` (${c().totalRows!.toLocaleString('fr-FR')} total)`
                  : ''
                }
              </span>
            </Show>
            <Show when={!showPageInfo()}><span /></Show>

            <Show when={isPaginated()}>
              <div class="flex items-center gap-1">
                <button
                  class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page() === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  &#x25C0; Prev
                </button>
                <span class="px-2">Page {page() + 1} / {totalPages()}</span>
                <button
                  class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  disabled={page() >= totalPages() - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next &#x25B6;
                </button>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  )
}
