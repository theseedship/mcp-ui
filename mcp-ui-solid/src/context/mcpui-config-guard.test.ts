// @vitest-environment node
/**
 * Host-config guard — `MCPUIConfig` declares no required field.
 *
 * @since v6.22.0
 *
 * `MCPUIConfig` gains a key in a MINOR release each time the library grows a
 * policy switch (`iframeFallbackLink` in 6.21.0, `chartZoom` in 6.22.0). While
 * its fields were required, every such addition broke the build of a consumer
 * holding a COMPLETE config — a typed constant, or a direct
 * `<MCPUIConfigContext.Provider value={…}>` — over a behaviour change they had
 * not made. `MCPUIConfigContext.test.tsx` pins the consumer-side claim with
 * `satisfies MCPUIConfig`, but `pnpm typecheck` excludes `*.test.tsx`, so this
 * scan is what actually fails when a field loses its `?`.
 *
 * It is the same trade the chrome-strings guard makes next door: the shape of
 * a published type is an invariant, and an AST read of the declaration is the
 * only check that survives the test files being outside the `tsc` program.
 */

import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_MCPUI_CONFIG } from './MCPUIConfigContext'

const CONFIG_FILE = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'MCPUIConfigContext.tsx'
)

/** The `MCPUIConfig` property signatures, read off the interface declaration. */
function readConfigMembers(): Array<{ name: string; optional: boolean }> {
  const source = ts.createSourceFile(
    CONFIG_FILE,
    readFileSync(CONFIG_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const members: Array<{ name: string; optional: boolean }> = []
  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== 'MCPUIConfig') return
    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue
      members.push({ name: member.name.text, optional: member.questionToken !== undefined })
    }
  })
  return members
}

describe('MCPUIConfig shape guard', () => {
  it('finds the interface (the scan below is otherwise vacuous)', () => {
    expect(readConfigMembers().map((m) => m.name)).toContain('chartZoom')
  })

  it('declares every field optional — a required one breaks existing consumers', () => {
    const required = readConfigMembers()
      .filter((m) => !m.optional)
      .map((m) => m.name)
    expect(
      required,
      'Mark these `?`: a required MCPUIConfig field breaks every consumer holding a complete config. The default belongs in DEFAULT_MCPUI_CONFIG, which is Required<MCPUIConfig> and fails to compile without it.'
    ).toEqual([])
  })

  it('gives DEFAULT_MCPUI_CONFIG a value for exactly the declared keys', () => {
    // The runtime half of `Required<MCPUIConfig>`: the annotation catches a
    // missing key at compile time, this catches a stale extra one.
    const declared = readConfigMembers()
      .map((m) => m.name)
      .sort()
    expect(Object.keys(DEFAULT_MCPUI_CONFIG).sort()).toEqual(declared)
    for (const [key, value] of Object.entries(DEFAULT_MCPUI_CONFIG)) {
      expect(value, `${key} must have a default`).toBeDefined()
    }
  })
})
