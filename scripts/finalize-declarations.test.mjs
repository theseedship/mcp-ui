import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { finalizeDeclarations } from './finalize-declarations.mjs'

test('normalizes complete ESM/CJS graphs without touching bare imports or comments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcpui-types-'))
  try {
    await mkdir(join(directory, 'nested'))
    await writeFile(join(directory, 'index.d.ts'), `import type { ZodType } from 'zod';\nexport * from './nested';\nexport type T = import('./value').Value;\n/** Example: import x from './not-a-real-module' */\n//# sourceMappingURL=index.d.ts.map\n`)
    await writeFile(join(directory, 'nested/index.d.ts'), "export { Value } from '../value';\n")
    await writeFile(join(directory, 'value.d.ts'), 'export type Value = string;\n')
    assert.equal(await finalizeDeclarations(directory), 3)
    const esm = await readFile(join(directory, 'index.d.ts'), 'utf8')
    const cjs = await readFile(join(directory, 'index.d.cts'), 'utf8')
    assert.match(esm, /from "\.\/nested\/index\.js"/)
    assert.match(esm, /import\("\.\/value\.js"\)/)
    assert.match(cjs, /from "\.\/nested\/index\.cjs"/)
    assert.match(cjs, /import\("\.\/value\.cjs"\)/)
    for (const output of [esm, cjs]) {
      assert.match(output, /from 'zod'/)
      assert.match(output, /not-a-real-module/)
      assert.doesNotMatch(output, /sourceMappingURL/)
    }
    await finalizeDeclarations(directory)
    assert.equal(await readFile(join(directory, 'index.d.ts'), 'utf8'), esm)
    assert.equal(await readFile(join(directory, 'index.d.cts'), 'utf8'), cjs)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('fails closed when a declaration points at a missing relative module', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcpui-types-'))
  try {
    await writeFile(join(directory, 'index.d.ts'), "export * from './missing';\n")
    await assert.rejects(finalizeDeclarations(directory), /Unresolved emitted declaration/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
