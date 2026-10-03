/**
 * Missing table cells (v6.24.0) — "absence is never zero".
 *
 * A cell with no value keeps its slot and is marked visibly (`-`) and
 * accessibly (visually-hidden `strings.missingValue`); one legend under the
 * table explains the glyph; sorting puts missing values last; search never
 * matches them; exports are untouched; a table WITHOUT a missing cell renders
 * exactly the DOM of 6.23.0.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JSX } from 'solid-js'
import { renderCellValue, UIResourceRenderer } from './UIResourceRenderer'
import {
  DEFAULT_MCPUI_STRINGS,
  MCPUIStringsProvider,
  type MCPUIStrings,
} from '../context/MCPUIStringsContext'
import type { UIComponent } from '../types'

// Virtualized mode needs @tanstack/solid-virtual to hand out virtual rows in
// jsdom (no layout): two fixed items, rows 0 and 1.
vi.mock('@tanstack/solid-virtual', () => ({
  createVirtualizer: () => ({
    getVirtualItems: () => [
      { index: 0, key: 0, start: 0, size: 48, end: 48, lane: 0 },
      { index: 1, key: 1, start: 48, size: 48, end: 96, lane: 0 },
    ],
    getTotalSize: () => 96,
  }),
}))

afterEach(cleanup)

const MARK = '[data-mcp-missing-value]'
const LEGEND = '[data-mcp-missing-legend]'

const table = (
  rows: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
  columns = [{ key: 'v', label: 'V' }]
): UIComponent =>
  ({
    id: 't',
    type: 'table',
    position: { colStart: 1, colSpan: 12 },
    params: { columns, rows, ...extra },
  }) as unknown as UIComponent

const view = (content: UIComponent, strings?: MCPUIStrings) =>
  render(() =>
    strings ? (
      <MCPUIStringsProvider strings={strings}>
        <UIResourceRenderer content={content} />
      </MCPUIStringsProvider>
    ) : (
      <UIResourceRenderer content={content} />
    )
  )

const bodyCells = (container: HTMLElement, col = 0) =>
  Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelectorAll('td')[col] as HTMLElement)

/** Column text, with a missing cell reported as `∅`. */
const column = (container: HTMLElement, col = 0) =>
  bodyCells(container, col).map((td) => (td.querySelector(MARK) ? '∅' : (td.textContent ?? '').trim()))

const hiddenText = (mark: Element) => mark.querySelector('span:not([aria-hidden])')?.textContent

describe('missing cells render the marker', () => {
  const missing: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace', '  '],
    ["'undefined'", 'undefined'],
    ["'undefined – undefined'", 'undefined – undefined'],
    ["the literal '-'", '-'],
  ]

  it.each(missing)('%s → <MissingValueMark/> with the accessible wording', (_label, value) => {
    const { container } = view(table([{ v: value }]))
    const marks = container.querySelectorAll(`tbody ${MARK}`)
    expect(marks).toHaveLength(1)
    const mark = marks[0]!
    expect(mark.closest('td')).not.toBeNull()
    expect(mark.querySelector('[aria-hidden="true"]')?.textContent).toBe('-')
    expect(hiddenText(mark)).toBe(DEFAULT_MCPUI_STRINGS.missingValue)
    // The cell no longer goes through the HTML sink.
    expect(mark.closest('td')!.querySelector('[data-mcp-safe-html], div')).toBeNull()
  })

  const present: Array<[string, unknown]> = [
    ['0', 0],
    ['false', false],
    ["'0'", '0'],
    ["'NaN'", 'NaN'],
    ["'X – undefined' (cleans to 'X')", 'X – undefined'],
    ['a normal string', 'alpha'],
  ]

  it.each(present)('%s keeps rendering as before (no marker)', (_label, value) => {
    const { container } = view(table([{ v: value }]))
    expect(container.querySelector(MARK)).toBeNull()
    const td = bodyCells(container)[0]!
    expect(td.textContent).toBe(renderCellValue(value))
  })

  it("'X – undefined' still displays the cleaned 'X'", () => {
    const { container } = view(table([{ v: 'X – undefined' }]))
    expect(bodyCells(container)[0]!.textContent).toBe('X')
  })

  it('marks every missing cell of a mixed row and keeps its slot', () => {
    const { container } = view(
      table(
        [{ a: 'one', b: null, c: 3 }, { a: undefined, b: 'two', c: '' }],
        {},
        [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }]
      )
    )
    const rows = Array.from(container.querySelectorAll('tbody tr'))
    expect(rows).toHaveLength(2)
    expect(rows.map((tr) => tr.querySelectorAll('td').length)).toEqual([3, 3])
    expect(container.querySelectorAll(`tbody ${MARK}`)).toHaveLength(3)
  })

  it('only looks at declared columns for the marker (undeclared keys are not cells)', () => {
    const { container } = view(table([{ v: 'ok', hidden: null }]))
    expect(container.querySelector(MARK)).toBeNull()
    expect(container.querySelector(LEGEND)).toBeNull()
  })

  it('shows the provider-overridden wording', () => {
    const { container } = view(table([{ v: null }]), {
      missingValue: 'Valeur manquante',
      missingValueLegend: '« {marker} » signale une valeur manquante.',
    })
    expect(hiddenText(container.querySelector(MARK)!)).toBe('Valeur manquante')
    expect(container.querySelector(LEGEND)!.textContent).toBe('« - » signale une valeur manquante.')
  })

  it('renders the marker in the virtualized body too', async () => {
    const { container } = view(table([{ v: null }, { v: 'x' }, { v: 'y' }], { virtualize: true }))
    await waitFor(() => expect(container.querySelector('tbody[style]')).not.toBeNull())
    const marks = container.querySelectorAll(`tbody ${MARK}`)
    expect(marks).toHaveLength(1)
    expect(hiddenText(marks[0]!)).toBe(DEFAULT_MCPUI_STRINGS.missingValue)
  })
})

describe('missing-value legend', () => {
  const manyRows = (n: number, missingAt?: number) =>
    Array.from({ length: n }, (_, i) => ({ v: i === missingAt ? null : `row-${i}` }))

  it('appears exactly once when a cell is missing, with the default wording', () => {
    const { container } = view(table([{ v: 'a' }, { v: null }, { v: null }]))
    const legends = container.querySelectorAll(LEGEND)
    expect(legends).toHaveLength(1)
    expect(legends[0]!.getAttribute('role')).toBe('note')
    expect(legends[0]!.textContent).toBe('“-” marks a missing value.')
  })

  it('is absent when no cell is missing (0, false and "0" are values)', () => {
    const { container } = view(table([{ v: 0 }, { v: false }, { v: '0' }, { v: 'x' }]))
    expect(container.querySelector(LEGEND)).toBeNull()
    expect(container.querySelector(MARK)).toBeNull()
  })

  it('sits after the scroll region and before the pagination controls', () => {
    const { container } = view(table(manyRows(30, 3)))
    const legend = container.querySelector(LEGEND)!
    const region = container.querySelector('[role="region"]')!
    const prev = container.querySelector('[data-mcp-ui-action="page-prev"]')!
    expect(region.contains(legend)).toBe(false)
    expect(region.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(legend.compareDocumentPosition(prev) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('appears when the only missing cell is on page 2, and does not change when paging', () => {
    // 25 rows, chat page size 10: the missing cell (row 15) lives on page 2.
    const { container, getByText } = view(table(manyRows(25, 15)))
    expect(container.querySelector(MARK)).toBeNull() // page 1 shows none
    expect(container.querySelectorAll(LEGEND)).toHaveLength(1)
    fireEvent.click(container.querySelector('[data-mcp-ui-action="page-next"]')!)
    expect(getByText('2 / 3')).toBeTruthy()
    expect(container.querySelectorAll(MARK)).toHaveLength(1)
    expect(container.querySelectorAll(LEGEND)).toHaveLength(1)
    fireEvent.click(container.querySelector('[data-mcp-ui-action="page-next"]')!)
    expect(container.querySelector(MARK)).toBeNull()
    expect(container.querySelectorAll(LEGEND)).toHaveLength(1)
  })

  it('appears in virtualized mode, even when the missing row is not rendered', async () => {
    // The virtualizer mock renders rows 0 and 1; the missing cell is row 2.
    const { container } = view(table([{ v: 'a' }, { v: 'b' }, { v: null }], { virtualize: true }))
    await waitFor(() => expect(container.querySelector('tbody[style]')).not.toBeNull())
    expect(container.querySelector(MARK)).toBeNull()
    const legends = container.querySelectorAll(LEGEND)
    expect(legends).toHaveLength(1)
    expect(container.querySelector('[role="region"]')!.contains(legends[0]!)).toBe(false)
  })

  it('is absent in virtualized mode when nothing is missing', async () => {
    const { container } = view(table([{ v: 'a' }, { v: 'b' }, { v: 'c' }], { virtualize: true }))
    await waitFor(() => expect(container.querySelector('tbody[style]')).not.toBeNull())
    expect(container.querySelector(LEGEND)).toBeNull()
  })

  it('stays while a search hides every missing row', async () => {
    const { container } = view(table([{ v: 'alpha' }, { v: null }]))
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'alpha' } })
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(1))
    expect(container.querySelector(MARK)).toBeNull()
    expect(container.querySelectorAll(LEGEND)).toHaveLength(1)
  })
})

describe('sorting', () => {
  const clickHeader = (container: HTMLElement) => fireEvent.click(container.querySelector('thead th')!)

  it('puts missing values last, ascending and descending', () => {
    const { container } = view(table([{ v: 5 }, { v: null }, { v: 3 }, { v: undefined }, { v: '' }, { v: 4 }], { chatPageSize: 50 }))
    clickHeader(container) // asc
    expect(column(container)).toEqual(['3', '4', '5', '∅', '∅', '∅'])
    clickHeader(container) // desc
    expect(column(container)).toEqual(['5', '4', '3', '∅', '∅', '∅'])
  })

  it("never lets '' or '-' sort as 0 in a numeric column", () => {
    const { container } = view(table([{ v: '' }, { v: -2 }, { v: '-' }, { v: 7 }, { v: 0 }], { chatPageSize: 50 }))
    clickHeader(container)
    expect(column(container)).toEqual(['-2', '0', '7', '∅', '∅'])
    clickHeader(container)
    expect(column(container)).toEqual(['7', '0', '-2', '∅', '∅'])
  })

  it('sorts a numeric column numerically when its FIRST row is missing (9 before 10)', () => {
    for (const first of [null, undefined, '']) {
      const { container, unmount } = view(table([{ v: first }, { v: 10 }, { v: 9 }, { v: 100 }], { chatPageSize: 50 }))
      clickHeader(container)
      expect(column(container)).toEqual(['9', '10', '100', '∅'])
      unmount()
    }
  })

  it('still honours an explicit numeric column type', () => {
    const { container } = view(
      table([{ v: '10' }, { v: '9' }, { v: null }], { chatPageSize: 50 }, [{ key: 'v', label: 'V', type: 'number' } as never])
    )
    clickHeader(container)
    expect(column(container)).toEqual(['9', '10', '∅'])
  })

  it('keeps string order for a text column (missing first row included)', () => {
    const { container } = view(table([{ v: null }, { v: 'banana' }, { v: 'apple' }], { chatPageSize: 50 }))
    clickHeader(container)
    expect(column(container)).toEqual(['apple', 'banana', '∅'])
    clickHeader(container)
    expect(column(container)).toEqual(['banana', 'apple', '∅'])
  })
})

describe('search', () => {
  const search = async (container: HTMLElement, query: string) => {
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: query } })
    await new Promise((r) => setTimeout(r, 260)) // 200ms debounce
  }

  it('never matches a missing cell', async () => {
    const { container } = view(table([{ v: null }, { v: '' }, { v: 'undefined' }, { v: '-' }, { v: undefined }, { v: 'alpha' }], { chatPageSize: 50 }))
    await search(container, 'undefined')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0)
    await search(container, '-')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0)
    await search(container, 'alpha')
    expect(column(container)).toEqual(['alpha'])
  })

  it('still matches a real value that merely contains a dash', async () => {
    const { container } = view(table([{ v: '2026-10-03' }, { v: null }], { chatPageSize: 50 }))
    await search(container, '-10-')
    expect(column(container)).toEqual(['2026-10-03'])
  })
})

describe('exports are unchanged', () => {
  const rows = [{ name: 'A', qty: null }, { name: 'B', qty: undefined }, { name: 'C', qty: '' }, { name: 'D', qty: '-' }, { name: 'E', qty: 0 }]
  const columns = [{ key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty' }]
  const writeText = vi.fn(async (_t: string) => {})

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  it("copy CSV writes '' for null/undefined/'' (no marker, no 'Missing value')", async () => {
    const { container } = view(table(rows, {}, columns))
    fireEvent.click(container.querySelector(`button[aria-label="${DEFAULT_MCPUI_STRINGS.tableCopyCsv}"]`)!)
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(writeText).toHaveBeenCalledWith('Name,Qty\nA,\nB,\nC,\nD,-\nE,0')
  })

  it('TSV copy is unchanged', async () => {
    const { container } = view(table(rows, { exportable: { formats: ['tsv'] } }, columns))
    fireEvent.click(container.querySelector(`button[aria-label="${DEFAULT_MCPUI_STRINGS.tableExport}"]`)!)
    fireEvent.click(await waitFor(() => {
      const el = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === DEFAULT_MCPUI_STRINGS.tableCopyTsv)
      if (!el) throw new Error('menu not open')
      return el
    }))
    expect(writeText).toHaveBeenCalledWith('Name\tQty\nA\t\nB\t\nC\t\nD\t-\nE\t0')
  })

  it('JSON download keeps null as null', async () => {
    let blob: Blob | undefined
    const createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:x'))
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { container } = view(table(rows, { exportable: { formats: ['json'] } }, columns))
    fireEvent.click(container.querySelector(`button[aria-label="${DEFAULT_MCPUI_STRINGS.tableExport}"]`)!)
    fireEvent.click(await waitFor(() => {
      const el = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === DEFAULT_MCPUI_STRINGS.tableDownloadJson)
      if (!el) throw new Error('menu not open')
      return el
    }))
    expect(click).toHaveBeenCalled()
    const text = await new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onload = () => res(String(reader.result))
      reader.readAsText(blob!)
    })
    const parsed = JSON.parse(text)
    expect(parsed.rows[0]).toEqual({ name: 'A', qty: null })
    expect(parsed.rows[2]).toEqual({ name: 'C', qty: '' })
    click.mockRestore()
  })
})

describe('a table without missing cells is byte-identical to 6.23.0', () => {
  // `table-dom-6.23.0.json` was captured from the 6.23.0 renderer (before this
  // change) with the three payloads below; random ids are normalised.
  const baseline = JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../test-support/fixtures/table-dom-6.23.0.json'), 'utf8')
  ) as Record<'plain' | 'paged' | 'virt', string>
  const norm = (html: string) => html.replace(/table-[a-z0-9]{7}/g, 'table-ID')
  const cols = [
    { key: 'name', label: 'Name' }, { key: 'n', label: 'N' }, { key: 'ok', label: 'Ok' },
    { key: 'link', label: 'Link' }, { key: 'md', label: 'Md' },
  ]
  const rows = [
    { name: 'Alpha', n: 0, ok: false, link: { url: 'https://x.test', name: 'Doc' }, md: '**b** `c`' },
    { name: 'Beta <b>x</b>', n: 12.5, ok: true, link: 'plain', md: 'X' },
    { name: 'Γ', n: -3, ok: '0', link: 'NaN', md: 'z' },
  ]
  const mk = (extra: Record<string, unknown>, r: Array<Record<string, unknown>> = rows) =>
    ({ id: 't', type: 'table', position: { colStart: 1, colSpan: 12 }, params: { title: 'T', columns: cols, rows: r, ...extra } }) as unknown as UIComponent

  it('plain table', () => {
    const { container } = view(mk({}))
    expect(norm(container.innerHTML)).toBe(baseline.plain)
  })

  it('paginated table', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `row-${i}`, n: i, ok: true, link: 'a', md: 'b' }))
    const { container } = view(mk({ chatPageSize: 10 }, many))
    expect(norm(container.innerHTML)).toBe(baseline.paged)
  })

  it('virtualized table', async () => {
    const { container } = view(mk({ virtualize: true }))
    await waitFor(() => expect(container.querySelector('tbody[style]')).not.toBeNull())
    expect(norm(container.innerHTML)).toBe(baseline.virt)
  })
})

// ─── Pseudo-locale: no hardcoded Latin chrome around a missing cell ─────────

const PSEUDO = Object.fromEntries(
  Object.entries(DEFAULT_MCPUI_STRINGS).map(([key, value]) => {
    if (key === 'locale') return [key, 'fr-FR']
    const placeholders = value.match(/\{\w+\}/g) ?? []
    return [key, `⟦${[key, ...placeholders].join(' ')}⟧`]
  })
) as Required<MCPUIStrings>

function latinLeaks(root: ParentNode): string[] {
  const strip = (text: string) => {
    let out = text
    while (/⟦[^⟦⟧]*⟧/.test(out)) out = out.replace(/⟦[^⟦⟧]*⟧/g, ' ')
    return out
  }
  const leaks: string[] = []
  const check = (where: string, raw: string | null) => {
    const runs = raw ? strip(raw).match(/[A-Za-z]{2,}/g) : null
    if (runs) leaks.push(`${where}: ${JSON.stringify(raw)} → ${runs.join(', ')}`)
  }
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      check(`text in <${node.parentElement?.tagName.toLowerCase()}>`, node.nodeValue)
      continue
    }
    const el = node as Element
    for (const name of ['aria-label', 'aria-description', 'title', 'alt', 'placeholder']) {
      check(`@${name} of <${el.tagName.toLowerCase()}>`, el.getAttribute(name))
    }
  }
  return leaks
}

describe('pseudo-locale', () => {
  it('a table with missing cells shows only provider wording around CJK data', () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({ 名称: `数据${i + 1}`, 数量: i === 2 ? null : i * 1000 + 1 }))
    const { container } = render(() => (
      <MCPUIStringsProvider strings={PSEUDO}>
        <UIResourceRenderer
          content={table(rows, { title: '数据表' }, [{ key: '名称', label: '名称' }, { key: '数量', label: '数量' }])}
        />
      </MCPUIStringsProvider>
    ) as JSX.Element)
    const mark = container.querySelector(MARK)!
    expect(hiddenText(mark)).toBe('⟦missingValue⟧')
    expect(container.querySelector(LEGEND)!.textContent).toBe('⟦missingValueLegend -⟧')
    expect(latinLeaks(document.body)).toEqual([])
  })
})
