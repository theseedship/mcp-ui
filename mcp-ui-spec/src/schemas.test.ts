/**
 * Basic schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  ComponentRegistrySchema,
  ComponentSchema,
  GridPositionSchema,
} from './schemas';

describe('ComponentRegistrySchema', () => {
  it('should validate a minimal valid registry', () => {
    const registry = {
      version: '1.0.0' as const,
      components: [],
    };

    const result = ComponentRegistrySchema.safeParse(registry);
    expect(result.success).toBe(true);
  });

  it('should reject invalid version', () => {
    const registry = {
      version: '2.0.0',
      components: [],
    };

    const result = ComponentRegistrySchema.safeParse(registry);
    expect(result.success).toBe(false);
  });
});

describe('ComponentSchema', () => {
  it('should validate a minimal component', () => {
    const component = {
      id: 'test-component',
      type: 'chart' as const,
      name: 'Test Component',
      schema: {
        type: 'object' as const,
        properties: {},
      },
      examples: [],
    };

    const result = ComponentSchema.safeParse(component);
    expect(result.success).toBe(true);
  });
});

describe('GridPositionSchema', () => {
  it('should validate grid position', () => {
    const position = {
      colStart: 1,
      colSpan: 2,
    };

    const result = GridPositionSchema.safeParse(position);
    expect(result.success).toBe(true);
  });
});
