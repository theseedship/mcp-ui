/** Normalize emitted declaration references for real NodeNext ESM/CJS consumers. */
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

async function declarationFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await declarationFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

export async function finalizeDeclarations(directory) {
  const files = await declarationFiles(resolve(directory))
  assert(files.length > 0, `No declarations in ${directory}`)
  const known = new Set(files)
  for (const file of files) {
    const original = (await readFile(file, 'utf8')).replace(/^\/\/# sourceMappingURL=.*$/gm, '')
    const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true)
    const literals = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        literals.push(node.moduleSpecifier)
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        literals.push(node.argument.literal)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    function output(extension) {
      let text = original
      for (const literal of literals.toSorted((a, b) => b.getStart(source) - a.getStart(source))) {
        const specifier = literal.text
        if (!specifier.startsWith('.') || /\.(?:json|css)$/.test(specifier)) continue
        const base = resolve(dirname(file), specifier.replace(/\.(?:[cm]?js|[cm]?ts)$/, ''))
        const target = [base + '.d.ts', join(base, 'index.d.ts')].find(path => known.has(path))
        assert(target, `Unresolved emitted declaration ${file}: ${specifier}`)
        let path = relative(dirname(file), target).replaceAll('\\', '/').replace(/\.d\.ts$/, extension)
        if (!path.startsWith('.')) path = './' + path
        text = text.slice(0, literal.getStart(source)) + JSON.stringify(path) + text.slice(literal.end)
      }
      return text
    }
    await writeFile(file, output('.js'))
    await writeFile(file.replace(/\.d\.ts$/, '.d.cts'), output('.cjs'))
  }
  return files.length
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 3, 'Usage: node scripts/finalize-declarations.mjs <dist>')
  console.log(`Finalized ${await finalizeDeclarations(process.argv[2])} ESM/CJS declarations`)
}
