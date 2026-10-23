import { render, waitFor } from '@solidjs/testing-library'
import { expect, it, vi } from 'vitest'
import { MCPUIConfigProvider } from '../context/MCPUIConfigContext'
import type { UIComponent } from '../types'
import { ChartJSRenderer } from './ChartJSRenderer'

const state = vi.hoisted(() => ({
  register: vi.fn(),
  configs: [] as Array<{ options: { plugins: { zoom?: unknown } } }>,
}))
// Vite's optimized missing-optional-peer module is importable but empty.
vi.mock('chartjs-plugin-zoom', () => ({ default: {} }))
vi.mock('chart.js/auto', () => {
  class Chart {
    static register = state.register
    destroy = vi.fn()
    resize = vi.fn()
    constructor(_canvas: HTMLCanvasElement, config: (typeof state.configs)[number]) {
      state.configs.push(config)
    }
  }
  return { default: Chart }
})

it('treats an empty optional-peer stub as unavailable, not a working zoom plugin', async () => {
  const component: UIComponent = {
    id: 'empty-zoom-stub', type: 'chart', position: { colStart: 1, colSpan: 12 },
    params: { type: 'bar', data: { labels: ['A', 'B'], datasets: [{ data: [2, 4] }] } },
  }
  const view = render(() => <MCPUIConfigProvider config={{ chartZoom: 'always' }}>
    <ChartJSRenderer component={component} />
  </MCPUIConfigProvider>)
  await waitFor(() => expect(state.configs).toHaveLength(1))
  await Promise.resolve()
  await Promise.resolve()
  expect(state.register).not.toHaveBeenCalled()
  expect(state.configs[0].options.plugins.zoom).toBeUndefined()
  expect(view.queryByLabelText('Zoom in')).toBeNull()
  expect(view.queryByLabelText('Reset zoom')).toBeNull()
})
