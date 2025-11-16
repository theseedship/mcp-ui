/**
 * Basic CLI module export tests
 */

import { describe, it, expect } from 'vitest';
import * as mcpUiCli from './index';

describe('@mcp-ui/cli', () => {
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
