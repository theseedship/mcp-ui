/**
 * Basic CLI module export tests
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistrySchema } from '@seed-ship/mcp-ui-spec';
import * as mcpUiCli from './index';

describe('@seed-ship/mcp-ui-cli', () => {
  it('should export validateCommand', () => {
    expect(mcpUiCli.validateCommand).toBeDefined();
    expect(typeof mcpUiCli.validateCommand).toBe('function');
  });

  it('should export generateTypesCommand', () => {
    expect(mcpUiCli.generateTypesCommand).toBeDefined();
    expect(typeof mcpUiCli.generateTypesCommand).toBe('function');
  });

  it('should export testExamplesCommand', () => {
    expect(mcpUiCli.testExamplesCommand).toBeDefined();
    expect(typeof mcpUiCli.testExamplesCommand).toBe('function');
  });

  it('should export diffCommand', () => {
    expect(mcpUiCli.diffCommand).toBeDefined();
    expect(typeof mcpUiCli.diffCommand).toBe('function');
  });
});

describe('cli accepts new ComponentTypes via spec dep (regression guard)', () => {
  // The cli does not declare its own ComponentType list — it consumes
  // ComponentRegistrySchema from `@seed-ship/mcp-ui-spec`. Whenever the
  // spec adds a new type, the cli picks it up automatically. These tests
  // assert the contract: future spec additions don't silently break the
  // cli's validate / generate-types pipeline.

  function registryWithType(type: string) {
    return {
      version: '1.0.0' as const,
      components: [
        {
          id: 'test-cmp',
          type,
          name: 'Test',
          schema: { type: 'object' as const, properties: {} },
          examples: [{ name: 'Ex', params: {} }],
        },
      ],
    };
  }

  it("validates 'graph' (added in spec v5.0.4)", () => {
    expect(ComponentRegistrySchema.safeParse(registryWithType('graph')).success).toBe(true);
  });

  it("validates 'map' (added in spec v3+)", () => {
    expect(ComponentRegistrySchema.safeParse(registryWithType('map')).success).toBe(true);
  });

  it("rejects an unknown type (typo / future)", () => {
    expect(ComponentRegistrySchema.safeParse(registryWithType('graffiti')).success).toBe(false);
  });
});
