/**
 * v6.22.0 — `MCPUIConfig` is a PARTIAL type, resolved on read.
 *
 * `MCPUIConfig` gains a key in a minor release each time the library grows a
 * policy switch (`iframeFallbackLink` in 6.21.0, `chartZoom` in 6.22.0). While
 * its fields were required, every such addition broke the build of a consumer
 * holding a complete config — a typed constant, or a direct
 * `<MCPUIConfigContext.Provider value={…}>` — over a behaviour change they had
 * not made. The fields are optional now, and completeness is guaranteed by the
 * values instead: `DEFAULT_MCPUI_CONFIG` is `Required<MCPUIConfig>`, and
 * `useMCPUIConfig()` returns `Required<MCPUIConfig>`.
 *
 * Coverage:
 *   1. A partial literal type-checks as `MCPUIConfig` (the `satisfies` below)
 *   2. Readers always see a resolved config: no provider, partial provider,
 *      and a bare `MCPUIConfigContext.Provider` fed a partial value
 *
 * `pnpm typecheck` excludes `*.test.tsx`, so (1) would not fail CI on its own:
 * `mcpui-config-guard.test.ts` re-states it as an AST scan of the declaration.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import {
  MCPUIConfigContext,
  MCPUIConfigProvider,
  useMCPUIConfig,
  DEFAULT_MCPUI_CONFIG,
  type MCPUIConfig,
} from './MCPUIConfigContext'

/**
 * (1) The compile-time claim, written the way a consumer writes it.
 *
 * Under the 6.21.0 shape — every field required — each of these literals was a
 * `tsc` error, and so was any config written before a later key existed.
 * `satisfies` checks assignability without widening the literal types.
 */
const EMPTY_CONFIG = {} satisfies MCPUIConfig
const ONE_KEY_CONFIG = { chartZoom: 'never' } satisfies MCPUIConfig
/** The 6.20.0-era complete value: still valid two policy keys later. */
const PRE_6_21_CONFIG = {
  iframeCredentialless: 'auto',
  customTrustedIframeDomains: [],
  iframePolicy: 'strict',
  customIframeDomains: [],
} satisfies MCPUIConfig
/** A resolved config is a config too — `Required<T>` is assignable to `T`. */
const RESOLVED_CONFIG: MCPUIConfig = DEFAULT_MCPUI_CONFIG

/** Renders `ui` and hands back the config the renderer underneath reads. */
function captureConfig(ui: (probe: () => JSX.Element) => JSX.Element) {
  let captured: ReturnType<typeof useMCPUIConfig> | undefined
  const Probe = () => {
    captured = useMCPUIConfig()
    return <span>probe</span>
  }
  render(() => ui(() => <Probe />))
  return captured!
}

describe('MCPUIConfig — adding a key stays backward compatible', () => {
  it('accepts an empty literal, a one-key literal and a pre-6.21.0 config', () => {
    // The runtime assertions are trivial; the `satisfies` annotations are the test.
    expect(EMPTY_CONFIG).toEqual({})
    expect(ONE_KEY_CONFIG.chartZoom).toBe('never')
    expect(PRE_6_21_CONFIG.iframePolicy).toBe('strict')
    expect(RESOLVED_CONFIG).toEqual(DEFAULT_MCPUI_CONFIG)
  })
})

describe('useMCPUIConfig — always returns a resolved config', () => {
  beforeEach(() => cleanup())

  it('returns the defaults with no provider mounted', () => {
    expect(captureConfig((probe) => probe())).toEqual(DEFAULT_MCPUI_CONFIG)
  })

  it('merges a partial override over the defaults', () => {
    const config = captureConfig((probe) => (
      <MCPUIConfigProvider config={{ chartZoom: 'always' }}>{probe()}</MCPUIConfigProvider>
    ))
    expect(config.chartZoom).toBe('always')
    expect(config.iframeCredentialless).toBe(DEFAULT_MCPUI_CONFIG.iframeCredentialless)
    expect(config.iframeFallbackLink).toBe(DEFAULT_MCPUI_CONFIG.iframeFallbackLink)
  })

  it('resolves a partial value fed straight to MCPUIConfigContext.Provider', () => {
    // The path the required-field shape rejected at compile time: a host that
    // bypasses MCPUIConfigProvider still passes only the keys it cares about.
    const partial: MCPUIConfig = { iframeFallbackLink: 'always' }
    const config = captureConfig((probe) => (
      <MCPUIConfigContext.Provider value={partial}>{probe()}</MCPUIConfigContext.Provider>
    ))
    expect(config.iframeFallbackLink).toBe('always')
    expect(config.chartZoom).toBe(DEFAULT_MCPUI_CONFIG.chartZoom)
    expect(config.customTrustedIframeDomains).toEqual([])
  })
})
