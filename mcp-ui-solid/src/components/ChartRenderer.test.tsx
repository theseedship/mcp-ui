/**
 * Tests for ChartRenderer reactivity fix
 * Verifies the <Show> pattern is used instead of synchronous if
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as ts from 'typescript'

describe('ChartRenderer reactivity', () => {
  const source = readFileSync(
    resolve(__dirname, 'UIResourceRenderer.tsx'),
    'utf-8'
  )

  it('does NOT use synchronous if(useNative()) for rendering', () => {
    // The bug was: if (useNative()) { return <ChartJSRenderer /> }
    // This pattern evaluates once at mount — useNative() is always false
    const hasSyncIf = /if\s*\(useNative\(\)\)\s*\{[\s\S]*?return\s*\(?\s*<ChartJSRenderer/.test(source)
    expect(hasSyncIf).toBe(false)
  })

  it('uses reactive <Show when={useNative()}> pattern', () => {
    // The fix: <Show when={useNative()}> ... <ChartJSRenderer /> ... </Show>
    const hasReactiveShow = /Show[\s\S]*?when=\{useNative\(\)\}/.test(source)
    expect(hasReactiveShow).toBe(true)
  })

  it('has ChartJSRenderer as Show children (not in fallback)', () => {
    // Parse structure rather than a character window: fallback class names can
    // grow without moving the native renderer out of the reactive branch.
    const ast = ts.createSourceFile('UIResourceRenderer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const nativeShows: ts.JsxElement[] = []
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Show' &&
        node.openingElement.attributes.properties.some((attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'when' &&
          attribute.initializer && ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression?.getText(ast) === 'useNative()')) {
        nativeShows.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
    expect(nativeShows).toHaveLength(1)
    const show = nativeShows[0]!
    expect(show.children.some((child) =>
      ts.isJsxSelfClosingElement(child) && child.tagName.getText(ast) === 'ChartJSRenderer')).toBe(true)
    const fallback = show.openingElement.attributes.properties.find((attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'fallback')
    expect(fallback).toBeDefined()
    expect(fallback!.getText(ast)).not.toContain('<ChartJSRenderer')
  })

  it('has quickchart.io URL in the iframe fallback', () => {
    // The fallback should build a quickchart URL
    expect(source).toContain('quickchart.io')
  })
})
