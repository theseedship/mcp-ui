/**
 * DataPreviewSection — paginated data table with export
 * v3.1.0: Replaces LLM-generated markdown tables with exact source data
 *
 * @experimental
 *
 * Features:
 * - Column types (number right-aligned, string left-aligned)
 * - Pagination (configurable page size)
 * - CSV / JSON export buttons
 * - Source attribution + freshness label
 * - Number formatting (FR locale)
 */

import { createSignal, createMemo, For, Show } from 'solid-js'
import type { DataPreviewContent, DataPreviewColumn } from '../types/chat-bus'

export interface DataPreviewSectionProps {
  content: DataPreviewContent
}

/** Format a number for display (French locale) */
function formatNumber(value: unknown, format?: string): string {
  if (typeof value !== 'number' || !isFinite(value)) return String(value ?? '')
  // Simple formatting: use locale
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'currency') return `${value.toLocaleString('fr-FR')} EUR`
  if (Number.isInteger(value)) return value.toLocaleString('fr-FR')
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** Format a cell value based on column type */
function formatCell(value: unknown, col: DataPreviewColumn): string {
  if (value == null) return '—'
  if (col.type === 'number') return formatNumber(value, col.format)
  if (col.type === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString('fr-FR')
    } catch {
      return value
    }
  }
  return String(value)
}

/** Generate CSV from columns + rows */
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

/** Trigger browser download */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataPreviewSection(props: DataPreviewSectionProps) {
  const content = () => props.content
  const pageSize = () => content().pageSize || 25
  const [page, setPage] = createSignal(0)

  const totalRows = () => content().rows.length
  const totalPages = () => Math.max(1, Math.ceil(totalRows() / pageSize()))

  const pagedRows = createMemo(() => {
    const start = page() * pageSize()
    return content().rows.slice(start, start + pageSize())
  })

  const handleExportCSV = () => {
    const csv = toCSV(content().columns, content().rows)
    downloadFile(csv, 'data-export.csv', 'text/csv;charset=utf-8')
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(content().rows, null, 2)
    downloadFile(json, 'data-export.json', 'application/json')
  }

  const columnAlign = (col: DataPreviewColumn) => {
    if (col.align) return col.align
    if (col.type === 'number') return 'right'
    return 'left'
  }

  return (
    <div class="data-preview-section">
      {/* Header with source + export */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Show when={content().source}>
            <span class="font-medium">{content().source}</span>
          </Show>
          <Show when={content().freshness}>
            <span class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
              {content().freshness}
            </span>
          </Show>
        </div>

        <Show when={content().exportable !== false}>
          <div class="flex items-center gap-1">
            <button
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={handleExportCSV}
              title="Export CSV"
            >
              CSV
            </button>
            <button
              class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={handleExportJSON}
              title="Export JSON"
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
              <For each={content().columns}>
                {(col) => (
                  <th
                    class="px-3 py-2 font-medium text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700"
                    style={{ "text-align": columnAlign(col) }}
                  >
                    {col.label}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={pagedRows()}>
              {(row, i) => (
                <tr
                  class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  classList={{ 'bg-gray-25 dark:bg-gray-850': i() % 2 === 1 }}
                >
                  <For each={content().columns}>
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

      {/* Footer: pagination + row count */}
      <div class="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {content().totalRows
            ? `${totalRows()} / ${content().totalRows!.toLocaleString('fr-FR')} rows`
            : `${totalRows()} row${totalRows() !== 1 ? 's' : ''}`}
        </span>

        <Show when={totalPages() > 1}>
          <div class="flex items-center gap-1">
            <button
              class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              disabled={page() === 0}
              onClick={() => setPage(p => p - 1)}
            >
              &laquo;
            </button>
            <span>{page() + 1} / {totalPages()}</span>
            <button
              class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              disabled={page() >= totalPages() - 1}
              onClick={() => setPage(p => p + 1)}
            >
              &raquo;
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
