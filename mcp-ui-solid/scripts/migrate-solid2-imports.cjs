/** One-time, import-only AST migration. Runtime semantics are ported separately. */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const printer = ts.createPrinter({ removeComments: true })
const movedTypes = new Set(['JSX', 'ComponentProps'])
let changed = 0

function visitDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) visitDirectory(file)
    else if (/\.(ts|tsx)$/.test(entry.name)) migrateFile(file)
  }
}

function migrateFile(file) {
  const original = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true)
  const edits = []
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue
    const moduleName = node.moduleSpecifier.text
    let replacement = moduleName
    if (moduleName === 'solid-js/web') replacement = '@solidjs/web'
    if (moduleName === 'solid-js/store') replacement = 'solid-js'
    if (moduleName === 'vite-plugin-solid') replacement = '@solidjs/vite-plugin'
    const bindings = node.importClause?.namedBindings
    const webTypes = moduleName === 'solid-js' && bindings && ts.isNamedImports(bindings)
      ? bindings.elements.filter(element => movedTypes.has(element.propertyName?.text ?? element.name.text))
      : []
    if (replacement === moduleName && !webTypes.length) continue
    const declarations = []
    if (webTypes.length) {
      const remaining = bindings.elements.filter(element => !webTypes.includes(element))
      if (remaining.length || node.importClause.name) {
        declarations.push(ts.factory.updateImportDeclaration(node, node.modifiers,
          ts.factory.updateImportClause(node.importClause, node.importClause.isTypeOnly,
            node.importClause.name, remaining.length ? ts.factory.createNamedImports(remaining) : undefined),
          ts.factory.createStringLiteral(replacement), node.attributes))
      }
      declarations.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(true, undefined, ts.factory.createNamedImports(webTypes.map(element =>
          ts.factory.updateImportSpecifier(element, false, element.propertyName, element.name)))),
        ts.factory.createStringLiteral('@solidjs/web')))
    } else {
      declarations.push(ts.factory.updateImportDeclaration(node, node.modifiers,
        node.importClause, ts.factory.createStringLiteral(replacement), node.attributes))
    }
    edits.push({ start: node.getStart(source), end: node.end,
      text: declarations.map(declaration => printer.printNode(ts.EmitHint.Unspecified, declaration, source)).join('\n') })
  }
  if (!edits.length) return
  let next = original
  for (const edit of edits.reverse()) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)
  fs.writeFileSync(file, next)
  changed++
}

for (const directory of ['src', 'examples', 'test-support']) visitDirectory(path.join(root, directory))
migrateFile(path.join(root, 'tests/theme/fixture.tsx'))
console.log(`Moved package/type imports in ${changed} files; no function bodies transformed.`)
