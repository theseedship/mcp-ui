// @vitest-environment node
/**
 * Host-config guard — the STRUCTURE of the two published policy types.
 *
 * @since v6.22.0
 *
 * The policy type gains a key in a MINOR release each time the library grows a
 * switch (`iframeFallbackLink` in 6.21.0, `chartZoom` in 6.22.0), and neither
 * side may break when it does. Hence two names, and two invariants:
 *
 *   - `MCPUIConfigInput` (authored) declares NO required field, so a new key
 *     never breaks a consumer who builds a config;
 *   - `MCPUIConfig` (resolved) stays an interface extending
 *     `Required<MCPUIConfigInput>`, so a consumer who only READS one never
 *     meets `undefined`, while interface extension and augmentation remain
 *     compatible with the pre-6.22.0 public contract.
 *
 * 6.22.0 held the first and lost the second, which is why both are pinned here.
 *
 * ## Why an AST scan on top of the type checker
 *
 * `MCPUIConfigContext.test.tsx` states both claims with real annotations, and
 * since 6.22.1 `pnpm typecheck` does check that file, through
 * `tsconfig.contracts.json`. This scan is not a substitute for it: it reads the
 * DECLARATIONS rather than their use, so it still fails when someone adds a
 * required field that no existing annotation happens to exercise, and it names
 * the offending key in the failure message. Same trade the chrome-strings
 * guard makes next door.
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

/** The `MCPUIConfigInput` property signatures, read off the interface declaration. */
function readConfigMembers(): Array<{ name: string; optional: boolean }> {
  const source = ts.createSourceFile(
    CONFIG_FILE,
    readFileSync(CONFIG_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const members: Array<{ name: string; optional: boolean }> = []
  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== 'MCPUIConfigInput') return
    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue
      members.push({ name: member.name.text, optional: member.questionToken !== undefined })
    }
  })
  return members
}

describe('MCPUIConfigInput shape guard', () => {
  it('finds the interface (the scan below is otherwise vacuous)', () => {
    expect(readConfigMembers().map((m) => m.name)).toContain('chartZoom')
  })

  it('declares every field optional — a required one breaks existing consumers', () => {
    const required = readConfigMembers()
      .filter((m) => !m.optional)
      .map((m) => m.name)
    expect(
      required,
      'Mark these `?`: a required MCPUIConfigInput field breaks every consumer authoring a config. The resolved interface MCPUIConfig extends Required<MCPUIConfigInput> is what readers get, and DEFAULT_MCPUI_CONFIG carries that annotation so a key without a default fails to compile.'
    ).toEqual([])
  })

  it('keeps MCPUIConfig the RESOLVED view of that input', () => {
    // The other half of the contract, and the one 6.22.0 lost: a reader doing
    // `const p: IframePolicy = config.iframePolicy` must not meet `undefined`.
    const source = ts.createSourceFile(
      CONFIG_FILE,
      readFileSync(CONFIG_FILE, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    )
    let resolvedBase: string | undefined
    source.forEachChild((node) => {
      if (!ts.isInterfaceDeclaration(node) || node.name.text !== 'MCPUIConfig') return
      resolvedBase = node.heritageClauses
        ?.flatMap((clause) => clause.types)
        .map((type) => type.getText(source).replace(/\s+/g, ''))
        .find((type) => type === 'Required<MCPUIConfigInput>')
    })
    expect(
      resolvedBase,
      'MCPUIConfig must stay an interface extending `Required<MCPUIConfigInput>`. Widening it to the partial input type makes every published field `| undefined`; replacing the interface with an alias breaks declaration merging.'
    ).toBe('Required<MCPUIConfigInput>')
  })

  it('types MCPUIConfigContext with the RESOLVED view', () => {
    // The context is exported, so `useContext(MCPUIConfigContext)` is a public
    // read surface. Typing it with the input view would leave a direct reader
    // on `IframePolicy | undefined` — the regression restored everywhere else.
    // Hosts that want to pass only some keys use `MCPUIConfigProvider`.
    const text = readFileSync(CONFIG_FILE, 'utf8')
    const call = /createContext<([^>]+)>/.exec(text)?.[1]
    expect(
      call,
      'MCPUIConfigContext must be createContext<MCPUIConfig>. With MCPUIConfigInput, a consumer reading the context directly gets every field as `| undefined`.'
    ).toBe('MCPUIConfig')
  })

  it('gives DEFAULT_MCPUI_CONFIG a value for exactly the declared keys', () => {
    // The runtime half of `MCPUIConfig extends Required<MCPUIConfigInput>`:
    // the annotation catches a missing key at compile time, this catches a
    // stale extra one.
    const declared = readConfigMembers()
      .map((m) => m.name)
      .sort()
    expect(Object.keys(DEFAULT_MCPUI_CONFIG).sort()).toEqual(declared)
    for (const [key, value] of Object.entries(DEFAULT_MCPUI_CONFIG)) {
      expect(value, `${key} must have a default`).toBeDefined()
    }
  })
})
