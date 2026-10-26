import { generateHydrationScript, renderToString } from 'solid-js/web'
import { UIResourceRenderer } from '@seed-ship/mcp-ui-solid'

const table = {
  id: 'packed-table', type: 'table', position: { colStart: 1, colSpan: 12 },
  params: {
    title: 'Packed table',
    columns: [{ key: 'name', label: 'Name' }, { key: 'citation', label: 'Evidence' }],
    rows: [{ name: 'Alpha', citation: '[1]' }],
    citationMap: { 1: { page: 7, file: 'evidence.pdf' } },
  },
} as const

export const html = renderToString(() => <UIResourceRenderer content={table} toolbarVariant="always-visible" />)
export const hydrationScript = generateHydrationScript()
