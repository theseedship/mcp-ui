/**
 * v6.22.1 — two names: `MCPUIConfigInput` (authored, every field optional) and
 * `MCPUIConfig` (resolved, every field present).
 *
 * The policy type gains a key in a minor release each time the library grows a
 * switch (`iframeFallbackLink` in 6.21.0, `chartZoom` in 6.22.0), and neither
 * side may break when it does. One name could not serve both: required fields
 * broke AUTHORS holding a complete config, optional fields broke READERS
 * assigning `const p: IframePolicy = config.iframePolicy`. 6.22.0 shipped the
 * second of those regressions; this file pins both directions so neither can
 * come back.
 *
 * Coverage:
 *   1. A partial literal type-checks as `MCPUIConfigInput`
 *   2. A reader of `MCPUIConfig` gets non-optional fields
 *   3. Readers always see a resolved config at runtime: no provider, partial
 *      provider, and a bare `MCPUIConfigContext.Provider` fed a partial value
 *
 * `pnpm typecheck` excludes `*.test.tsx`, so (1) and (2) would not fail CI on
 * their own: `mcpui-config-guard.test.ts` re-states them as an AST scan.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import type { IframePolicy } from '../types'
import {
  MCPUIConfigContext,
  MCPUIConfigProvider,
  useMCPUIConfig,
  DEFAULT_MCPUI_CONFIG,
  type MCPUIConfig,
  type MCPUIConfigInput,
} from './MCPUIConfigContext'

/**
 * (1) The AUTHOR's claim, written the way a consumer writes it.
 *
 * Under the 6.21.0 shape — every field required — each of these literals was a
 * `tsc` error, and so was any config written before a later key existed.
 * `satisfies` checks assignability without widening the literal types.
 */
const EMPTY_CONFIG = {} satisfies MCPUIConfigInput
const ONE_KEY_CONFIG = { chartZoom: 'never' } satisfies MCPUIConfigInput
/** The 6.20.0-era complete value: still valid two policy keys later. */
const PRE_6_21_CONFIG = {
  iframeCredentialless: 'auto',
  customTrustedIframeDomains: [],
  iframePolicy: 'strict',
  customIframeDomains: [],
} satisfies MCPUIConfigInput
/** A resolved config is valid input too — `Required<T>` is assignable to `T`. */
const RESOLVED_AS_INPUT: MCPUIConfigInput = DEFAULT_MCPUI_CONFIG

/**
 * (2) The READER's claim, which 6.22.0 broke by making every field optional.
 *
 * These annotations are the regression: under that shape each right-hand side
 * was `… | undefined` and none of them compiled under `strictNullChecks`.
 */
const RESOLVED_CONFIG: MCPUIConfig = DEFAULT_MCPUI_CONFIG
const READ_POLICY: IframePolicy = RESOLVED_CONFIG.iframePolicy
const READ_CREDENTIALLESS: 'auto' | 'always' | 'never' = RESOLVED_CONFIG.iframeCredentialless
const READ_DOMAINS: string[] = RESOLVED_CONFIG.customIframeDomains

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

describe('the policy type — adding a key breaks neither side', () => {
  it('lets an author omit any key (MCPUIConfigInput)', () => {
    // The runtime assertions are trivial; the `satisfies` annotations are the test.
    expect(EMPTY_CONFIG).toEqual({})
    expect(ONE_KEY_CONFIG.chartZoom).toBe('never')
    expect(PRE_6_21_CONFIG.iframePolicy).toBe('strict')
    expect(RESOLVED_AS_INPUT).toEqual(DEFAULT_MCPUI_CONFIG)
  })

  it('hands a reader every key, non-optional (MCPUIConfig)', () => {
    // Same shape: the annotations above are what would fail to compile if the
    // resolved view ever went partial again, as it did in 6.22.0.
    expect(RESOLVED_CONFIG).toEqual(DEFAULT_MCPUI_CONFIG)
    expect(READ_POLICY).toBe('strict')
    expect(READ_CREDENTIALLESS).toBe('auto')
    expect(READ_DOMAINS).toEqual([])
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
