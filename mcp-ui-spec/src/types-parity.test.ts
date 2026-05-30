/**
 * v5.5.0 — audit P1.4.
 *
 * Guards against the legacy `ComponentType` (from `./types`) drifting from the
 * canonical `ComponentTypeSchema` (in `./schemas`). The compile-time `_parity`
 * assertion fails `tsc` if the two unions ever diverge; the runtime checks make
 * an accidental enum trim visible in the test report too.
 */

import { describe, it, expect } from 'vitest'
import { ComponentTypeSchema } from './schemas/index'
import type { ComponentType } from './types'
import type { ComponentType as SchemaComponentType } from './schemas/index'

// Compile-time: the two unions must be mutually assignable (i.e. equal).
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _parity: Equal<ComponentType, SchemaComponentType> = true
void _parity

describe('ComponentType ↔ ComponentTypeSchema parity (P1.4)', () => {
  it('every schema option is assignable to the public ComponentType', () => {
    // If `./types` re-exports the schema-inferred union this is exact; the
    // assignment would not compile otherwise.
    const all: ComponentType[] = [...ComponentTypeSchema.options]
    expect(all.length).toBe(ComponentTypeSchema.options.length)
  })

  it('the schema still enumerates the modern renderer types (no silent trim)', () => {
    for (const t of ['chart', 'table', 'metric', 'text', 'graph', 'map', 'grid', 'form']) {
      expect(ComponentTypeSchema.options).toContain(t)
    }
  })
})
