import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal, flush } from 'solid-js'
import { MCPUIConfigProvider, useMCPUIConfig, DEFAULT_MCPUI_CONFIG, type MCPUIConfig } from './MCPUIConfigContext'
import { MCPUIStringsProvider, useMCPUIStrings, DEFAULT_MCPUI_STRINGS, type MCPUIStrings } from './MCPUIStringsContext'
import { useAutocompleteContextSafe } from './AutocompleteContext'
import { useMCPActionSafe } from './MCPActionContext'

afterEach(cleanup)

describe('Solid 2 context defaults', () => {
  it('retains config defaults for explicit undefined and reactive replacement overrides', () => {
    const [config, setConfig] = createSignal<Partial<MCPUIConfig>>({ iframeCredentialless: undefined })
    const Probe = () => {
      const resolved = useMCPUIConfig()
      return <span>{resolved.iframeCredentialless}</span>
    }
    const { getByText } = render(() => <MCPUIConfigProvider config={config()}><Probe /></MCPUIConfigProvider>)
    expect(getByText(DEFAULT_MCPUI_CONFIG.iframeCredentialless)).toBeTruthy()
    setConfig({ iframeCredentialless: 'always' })
    flush()
    expect(getByText('always')).toBeTruthy()
    setConfig({ iframeCredentialless: undefined })
    flush()
    expect(getByText(DEFAULT_MCPUI_CONFIG.iframeCredentialless)).toBeTruthy()
  })

  it('retains English defaults for explicit undefined chrome overrides', () => {
    const strings: Partial<MCPUIStrings> = { retry: undefined, chartView: 'Diagram' }
    const Probe = () => {
      const resolved = useMCPUIStrings()
      return <span>{resolved.retry}|{resolved.chartView}</span>
    }
    const { getByText } = render(() => <MCPUIStringsProvider strings={strings}><Probe /></MCPUIStringsProvider>)
    expect(getByText(`${DEFAULT_MCPUI_STRINGS.retry}|Diagram`)).toBeTruthy()
  })

  it('preserves safe hooks without any optional provider', () => {
    const Probe = () => {
      expect(useAutocompleteContextSafe()).toBeUndefined()
      const action = useMCPActionSafe()
      expect(action.availableTools()).toEqual([])
      expect(action.isExecuting()).toBe(false)
      return <span>Optional contexts available</span>
    }
    const { getByText } = render(() => <Probe />)
    expect(getByText('Optional contexts available')).toBeTruthy()
  })
})
