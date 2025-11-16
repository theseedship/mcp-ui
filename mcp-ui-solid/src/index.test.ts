/**
 * Basic module export tests
 */

import { describe, it, expect } from 'vitest';
import * as mcpUiSolid from './index';

describe('@seed-ship/mcp-ui-solid', () => {
  it('should export UIResourceRenderer', () => {
    expect(mcpUiSolid.UIResourceRenderer).toBeDefined();
  });

  it('should export StreamingUIRenderer', () => {
    expect(mcpUiSolid.StreamingUIRenderer).toBeDefined();
  });

  it('should export GenerativeUIErrorBoundary', () => {
    expect(mcpUiSolid.GenerativeUIErrorBoundary).toBeDefined();
  });

  it('should export useStreamingUI hook', () => {
    expect(mcpUiSolid.useStreamingUI).toBeDefined();
    expect(typeof mcpUiSolid.useStreamingUI).toBe('function');
  });

  it('should export validation functions', () => {
    expect(mcpUiSolid.validateComponent).toBeDefined();
    expect(typeof mcpUiSolid.validateComponent).toBe('function');
    expect(mcpUiSolid.validateLayout).toBeDefined();
    expect(typeof mcpUiSolid.validateLayout).toBe('function');
  });

  it('should export ComponentRegistry', () => {
    expect(mcpUiSolid.ComponentRegistry).toBeDefined();
  });
});
