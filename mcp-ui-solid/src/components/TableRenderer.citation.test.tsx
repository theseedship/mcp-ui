/**
 * Citation chip rendering inside `<TableRenderer>` cells (v5.7.0).
 *
 * Spec: `mcp-ui-solid/docs/briefs/BRIEF-citations-in-table-cells.md`.
 *
 * Tests are split between the pure `renderCellValue(value, citationCtx)`
 * helper (fast, no DOM) and a couple of integration assertions on a real
 * `<UIResourceRenderer>` mount to catch wiring bugs.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { renderCellValue, UIResourceRenderer } from './UIResourceRenderer'
import type { CitationCtx } from './UIResourceRenderer'
import type { UIComponent, TableComponentParams } from '../types'

const baseMap: CitationCtx['map'] = {
  '1': { page: 5, file: 'A.pdf' },
  '2': { page: 12, file: 'B.pdf' },
}

describe('renderCellValue — citation transform (v5.7.0)', () => {
  it('NO citationCtx → cell text is unchanged (regression)', () => {
    expect(renderCellValue('[1] ; [4]')).toBe('[1] ; [4]')
  })

  it('citationCtx with mapped id → cell HTML carries data-citation-page + data-citation-doc', () => {
    const html = renderCellValue('[1]', { map: baseMap })
    expect(html).toContain('data-citation-page="5"')
    expect(html).toContain('data-citation-doc="A.pdf"')
    expect(html).toContain('data-citation-verified="true"')
    expect(html).toContain('class="citation-ref')
  })

  it('multi-citation cell → multiple chips emitted', () => {
    const html = renderCellValue('[1] ; [2]', { map: baseMap })
    const matches = html.match(/data-citation-page="(\d+)"/g) ?? []
    expect(matches).toHaveLength(2)
    expect(html).toContain('data-citation-page="5"')
    expect(html).toContain('data-citation-page="12"')
  })

  it('unresolved id with NON-EMPTY map → marker dropped silently (likely hallucination)', () => {
    const html = renderCellValue('[99]', { map: baseMap })
    expect(html).not.toContain('99')
    expect(html).not.toContain('citation-ref')
    expect(html).not.toContain('réf')
  })

  it('unresolved id with EMPTY map → human-visible `[réf. N]` placeholder', () => {
    const html = renderCellValue('[99]', { map: {} })
    expect(html).toContain('[réf. 99]')
  })

  it('citationRender override → wins over default chip shape', () => {
    const html = renderCellValue('[1]', {
      map: baseMap,
      render: (id, mapping) => `<a class="custom-chip" data-id="${id}">${mapping?.file ?? '?'}</a>`,
    })
    expect(html).toContain('class="custom-chip"')
    expect(html).toContain('data-id="1"')
    expect(html).not.toContain('data-citation-verified')
  })

  it('`[p.5]` page form → NOT touched (negative lookbehind)', () => {
    const html = renderCellValue('See [p.5]', { map: baseMap })
    expect(html).toContain('[p.5]')
    expect(html).not.toContain('data-citation-page')
  })

  it('`[text](url)` markdown link → NOT touched (citation regex skips parens)', () => {
    const html = renderCellValue('[click](https://example.com)', { map: baseMap })
    expect(html).toContain('href="https://example.com"')
    expect(html).not.toContain('data-citation-page')
  })

  it('mixed `**bold** [1]` → bold becomes <strong> AND chip is rendered (compose)', () => {
    const html = renderCellValue('**MSP** [1]', { map: baseMap })
    expect(html).toContain('<strong>MSP</strong>')
    expect(html).toContain('data-citation-page="5"')
  })

  it('canonical `[📄 CITATION 1]` marker → chip emitted directly (no normalize step needed)', () => {
    const html = renderCellValue('[📄 CITATION 1]', { map: baseMap })
    expect(html).toContain('data-citation-page="5"')
  })

  it('all 3 data-citation-* attrs survive DOMPurify (whitelist intact)', () => {
    const html = renderCellValue('[1]', { map: baseMap })
    expect(html).toContain('data-citation-page')
    expect(html).toContain('data-citation-doc')
    expect(html).toContain('data-citation-verified')
  })

  it('chip emits a button element (host click delegation target)', () => {
    const html = renderCellValue('[1]', { map: baseMap })
    expect(html).toContain('<button')
    expect(html).toMatch(/<button[^>]*data-citation-page="5"/)
  })
})

describe('<TableRenderer> — citationMap wiring (v5.7.0)', () => {
  beforeEach(() => {
    cleanup()
  })

  function tableComponent(params: Partial<TableComponentParams>): UIComponent {
    return {
      id: 'tbl-cit',
      type: 'table',
      position: { colStart: 1, colSpan: 12 },
      params: {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'cites', label: 'Citations' },
        ],
        rows: [
          { name: 'MSP', cites: '[1] ; [2]' },
          { name: 'Other', cites: '[1]' },
        ],
        ...params,
      } as TableComponentParams,
    }
  }

  it('NO citationMap → cells render plain text (regression)', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={tableComponent({})} />
    ))
    const buttons = container.querySelectorAll('[data-citation-page]')
    expect(buttons.length).toBe(0)
    expect(container.textContent).toContain('[1] ; [2]')
  })

  it('with citationMap → DOM has clickable chips per resolved marker', () => {
    const { container } = render(() => (
      <UIResourceRenderer content={tableComponent({ citationMap: baseMap })} />
    ))
    const buttons = container.querySelectorAll('button[data-citation-page]')
    // Row 1 has 2 markers, row 2 has 1 → 3 chips total
    expect(buttons.length).toBe(3)
    const pages = Array.from(buttons).map((b) => b.getAttribute('data-citation-page'))
    expect(pages.sort()).toEqual(['12', '5', '5'])
  })

  it('with citationRender override → custom chips replace defaults', () => {
    const customRender = (id: number) => `<a class="my-chip" data-id="${id}">x</a>`
    const { container } = render(() => (
      <UIResourceRenderer
        content={tableComponent({ citationMap: baseMap, citationRender: customRender })}
      />
    ))
    const customs = container.querySelectorAll('a.my-chip')
    expect(customs.length).toBe(3)
    expect(container.querySelector('[data-citation-page]')).toBeNull()
  })
})
