/**
 * Public package-root contract for consumer module augmentation.
 *
 * Keep this separate from MCPUIConfigContext.test.tsx: importing the private
 * relative module there cannot prove that an augmentation written against the
 * published package name reaches MCPUIConfigProvider's public `config` prop.
 * Its annotations are checked by tsconfig.contracts.json; the small runtime
 * suite also keeps the fixture valid when Vitest discovers `*.test.tsx`.
 */

import type { ComponentProps } from 'solid-js'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MCPUI_CONFIG,
  MCPUIConfigContext,
  MCPUIConfigProvider,
  type MCPUIConfig,
} from '@seed-ship/mcp-ui-solid'

declare module '@seed-ship/mcp-ui-solid' {
  interface MCPUIConfig {
    publicConsumerExtension?: string
  }
}

const AUGMENTED_CONFIG: MCPUIConfig = {
  ...DEFAULT_MCPUI_CONFIG,
  publicConsumerExtension: 'resolved',
}

const PROVIDER_CONFIG: NonNullable<
  ComponentProps<typeof MCPUIConfigProvider>['config']
> = {
  publicConsumerExtension: 'partial',
}

describe('public package-root config contract', () => {
  it('accepts an augmented config through the public provider and context', () => {
    const providerElement = (
      <MCPUIConfigProvider config={{ publicConsumerExtension: 'inline' }}>
        consumer
      </MCPUIConfigProvider>
    )
    const contextElement = (
      <MCPUIConfigContext.Provider value={AUGMENTED_CONFIG}>
        consumer
      </MCPUIConfigContext.Provider>
    )

    expect(PROVIDER_CONFIG.publicConsumerExtension).toBe('partial')
    expect(AUGMENTED_CONFIG.publicConsumerExtension).toBe('resolved')
    expect(providerElement).toBeDefined()
    expect(contextElement).toBeDefined()
  })
})
