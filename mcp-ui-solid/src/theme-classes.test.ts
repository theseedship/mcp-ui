// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

const migrated = [
  'ChatPrompt', 'ScratchpadPanel', 'UIResourceRenderer', 'FormFieldRenderer',
  'AutocompleteFormField', 'ComponentToolbar', 'ExpandableWrapper',
  'PortalDropdownMenu', 'ChartJSRenderer', 'GraphRenderer', 'FormRenderer',
  'ActionGroupRenderer', 'ModalRenderer', 'MissingValue', 'DegradedFallback',
]

describe('Tailwind theme class scanning', () => {
  it.each(migrated)('%s keeps every themed utility in a complete static literal', (component) => {
    const path = resolve(__dirname, `components/${component}.tsx`)
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let count = 0
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        // String-rendered HTML also carries classes; ignore its quote/tag delimiters.
        for (const part of node.text.split(/[\s"'<>]+/)) {
          if (!/(?:bg|text|border|ring|divide|shadow|fill|stroke)-\[/.test(part) || !part.includes('--mcp-ui-')) continue
          count++
          expect(part, `${path}: themed utility crosses an interpolation or concatenation`).toMatch(/\]$/)
          expect(part, `${path}: balanced utility brackets`).toSatisfy(
            (value: string) => [...value].filter((char) => char === '[').length === [...value].filter((char) => char === ']').length,
          )
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    expect(count).toBeGreaterThan(0)
  })
})
