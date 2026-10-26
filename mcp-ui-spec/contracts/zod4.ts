import { z } from 'zod';
import {
  ActionParamsSchema,
  ComponentSchema,
  ConnectorDynamicResultV1Schema,
  FormFieldSchema,
  GridPositionSchema,
  ImageGalleryColumnsSchema,
  MacroRunOutcomeSchema,
  MacroStepV1Schema,
  SecurityConstraintsSchema,
  type MacroStepV1,
} from '../src/schemas';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Assert<T extends true> = T;

// The transform accepts string literals and emits numeric literals. A broad
// ZodType cast would silently erase this input/output distinction.
type GalleryInput = Assert<Equal<z.input<typeof ImageGalleryColumnsSchema>, '2' | '3' | '4' | '5'>>;
type GalleryOutput = Assert<Equal<z.output<typeof ImageGalleryColumnsSchema>, 2 | 3 | 4 | 5>>;

// Zod 4 defaults ZodType's second generic to unknown; the recursive schema
// must explicitly retain its JSON input and output type.
type StepInput = Assert<Equal<z.input<typeof MacroStepV1Schema>, MacroStepV1>>;
type StepOutput = Assert<Equal<z.output<typeof MacroStepV1Schema>, MacroStepV1>>;

type FormExtraParams = Assert<Equal<NonNullable<z.input<typeof FormFieldSchema>['extraParams']>, Record<string, string>>>;
type ActionParams = Assert<Equal<NonNullable<z.input<typeof ActionParamsSchema>['params']>, Record<string, unknown>>>;
type ConnectorPrimary = Assert<Equal<z.input<typeof ConnectorDynamicResultV1Schema>['primary'], Record<string, unknown>>>;

type OptionalRowSpan = Assert<Equal<{} extends Pick<z.output<typeof GridPositionSchema>, 'rowSpan'> ? true : false, true>>;
type OptionalRequiresAuth = Assert<Equal<{} extends Pick<z.output<typeof SecurityConstraintsSchema>, 'requiresAuth'> ? true : false, true>>;
type OptionalDeprecated = Assert<Equal<{} extends Pick<z.output<typeof ComponentSchema>, 'deprecated'> ? true : false, true>>;
type OptionalMacroContent = Assert<Equal<{} extends Pick<z.input<typeof MacroRunOutcomeSchema>, 'content'> ? true : false, true>>;

export type Zod4SpecContracts = [
  GalleryInput,
  GalleryOutput,
  StepInput,
  StepOutput,
  FormExtraParams,
  ActionParams,
  ConnectorPrimary,
  OptionalRowSpan,
  OptionalRequiresAuth,
  OptionalDeprecated,
  OptionalMacroContent,
];
