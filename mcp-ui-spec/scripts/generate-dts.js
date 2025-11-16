#!/usr/bin/env node
/**
 * Generate TypeScript declaration files
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = resolve(__dirname, '../dist');

// Generate .d.ts files manually since tsc can't emit with allowImportingTsExtensions
const indexDts = `export * from './schemas';
`;

const schemasDts = `import { z } from 'zod';

export declare const GridPositionSchema: z.ZodObject<{
  colStart: z.ZodNumber;
  colSpan: z.ZodNumber;
  rowStart: z.ZodOptional<z.ZodNumber>;
  rowSpan: z.ZodOptional<z.ZodNumber>;
}>;

export declare const ComponentTypeSchema: z.ZodEnum<['chart', 'table', 'metric', 'text', 'composite']>;
export declare const SandboxFlagSchema: z.ZodEnum<['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-modals']>;

export declare const SecurityConstraintsSchema: z.ZodObject<{
  requiresAuth: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
  allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
  maxIframeDepth: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
  sandboxFlags: z.ZodOptional<z.ZodArray<typeof SandboxFlagSchema>>;
}>;

export declare const PerformanceConstraintsSchema: z.ZodObject<{
  maxRenderTime: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
  maxDataSize: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}>;

export declare const ComponentSchemaSchema: z.ZodObject<{
  type: z.ZodLiteral<'object'>;
  required: z.ZodOptional<z.ZodArray<z.ZodString>>;
  properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  additionalProperties: z.ZodOptional<z.ZodBoolean>;
}>;

export declare const ComponentExampleSchema: z.ZodObject<{
  name: z.ZodString;
  description: z.ZodOptional<z.ZodString>;
  params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  position: z.ZodOptional<typeof GridPositionSchema>;
}>;

export declare const ComponentSchema: z.ZodObject<{
  id: z.ZodString;
  type: typeof ComponentTypeSchema;
  name: z.ZodString;
  description: z.ZodOptional<z.ZodString>;
  schema: typeof ComponentSchemaSchema;
  examples: z.ZodArray<typeof ComponentExampleSchema>;
  security: z.ZodOptional<typeof SecurityConstraintsSchema>;
  performance: z.ZodOptional<typeof PerformanceConstraintsSchema>;
  tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
  version: z.ZodOptional<z.ZodString>;
  deprecated: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
  deprecationMessage: z.ZodOptional<z.ZodString>;
}>;

export declare const RegistryMetadataSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
  author: z.ZodOptional<z.ZodString>;
  repository: z.ZodOptional<z.ZodString>;
}>;

export declare const ComponentRegistrySchema: z.ZodObject<{
  version: z.ZodLiteral<'1.0.0'>;
  metadata: z.ZodOptional<typeof RegistryMetadataSchema>;
  components: z.ZodArray<typeof ComponentSchema>;
}>;

export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type ComponentExample = z.infer<typeof ComponentExampleSchema>;
export type ComponentSchema = z.infer<typeof ComponentSchemaSchema>;
export type GridPosition = z.infer<typeof GridPositionSchema>;
export type SecurityConstraints = z.infer<typeof SecurityConstraintsSchema>;
export type PerformanceConstraints = z.infer<typeof PerformanceConstraintsSchema>;
export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type SandboxFlag = z.infer<typeof SandboxFlagSchema>;
export type RegistryMetadata = z.infer<typeof RegistryMetadataSchema>;
`;

writeFileSync(resolve(distDir, 'index.d.ts'), indexDts);
writeFileSync(resolve(distDir, 'schemas.d.ts'), schemasDts);

console.log('✅ Generated index.d.ts');
console.log('✅ Generated schemas.d.ts');
