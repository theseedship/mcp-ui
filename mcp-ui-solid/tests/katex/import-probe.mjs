import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const input = JSON.parse(await readFile(new URL('./qualification-input.json', import.meta.url), 'utf8'))
const req = createRequire(import.meta.url)
const name = '@seed-ship/mcp-ui-solid'
const report = { version: input.version, checks: [], status: 'running' }
const check = (name, fn) => { fn(); report.checks.push(name) }
const adapterChecks = (render, kind) => {
  const math = (source, displayMode = false) => render(source, { displayMode })
  const cases = [
    ['inline fraction', String.raw`\frac{1}{2}`, false, /<mfrac>/],
    ['subscript', 'x_1', false, /<msub>/],
    ['display fraction', String.raw`\frac{3}{4}`, true, /display="block"/],
    ['matrix', String.raw`\begin{matrix}a&b\\c&d\end{matrix}`, true, /<mtable\b/],
  ]
  for (const [label, source, displayMode, pattern] of cases) check(`${kind}: ${label}`, () => {
    const out = math(source, displayMode)
    assert.equal(typeof out, 'string')
    assert(out.includes('<math') && pattern.test(out), `No MathML ${label}`)
    assert(!/<(?:script|style)\b|\bhref\s*=|\bkatex-html\b/i.test(out), `Unsafe or HTML-layout output: ${label}`)
  })
  check(`${kind}: invalid TeX returns null`, () => assert.equal(math(String.raw`\notARealCommand{`), null))
  check(`${kind}: macro scope does not leak`, () => {
    assert(math(String.raw`\gdef\localprobe{y}\localprobe`))
    assert.equal(math(String.raw`\localprobe`), null)
  })
  check(`${kind}: recursive macro is bounded`, () => assert.equal(math(String.raw`\def\a{\a}\a`), null))
  check(`${kind}: untrusted commands emit no active resource or markup`, () => {
    for (const source of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\htmlClass{evil}{x}`, String.raw`\includegraphics{https://example.test/x.png}`]) {
      const out = math(source)
      assert(out === null || !/<(?:a|img|script|style|foreignObject)\b|\b(?:href|src|on\w+)\s*=|\bclass\s*=\s*["']evil/.test(out.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, '')))
    }
  })
  check(`${kind}: oversized dimensions are clamped`, () => {
    const out = math(String.raw`\rule{500em}{500em}`)
    assert(out && /<mspace\b[^>]*\bwidth="20em"[^>]*\bheight="20em"/.test(out), 'Expected KaTeX maxSize clamp in MathML')
  })
}
try {
  const esm = await import(name), cjs = req(name)
  check('public ESM root', () => { assert.equal(typeof esm.UIResourceRenderer, 'function'); assert.equal(typeof esm.MCPUIMathProvider, 'function') })
  check('public CJS root', () => { assert.equal(typeof cjs.UIResourceRenderer, 'function'); assert.equal(typeof cjs.MCPUIMathProvider, 'function') })
  if (input.version === 'absent') {
    let esmFailure, cjsFailure
    try { await import(`${name}/plugins/katex`) } catch (error) { esmFailure = error }
    try { req(`${name}/plugins/katex`) } catch (error) { cjsFailure = error }
    check('absent peer: only plugin ESM fails for missing katex', () => {
      assert.equal(esmFailure?.code, 'ERR_MODULE_NOT_FOUND')
      assert.match(String(esmFailure), /katex/i)
    })
    check('absent peer: only plugin CJS fails for missing katex', () => {
      assert.equal(cjsFailure?.code, 'MODULE_NOT_FOUND')
      assert.match(String(cjsFailure), /katex/i)
    })
  } else {
    const esmPlugin = await import(`${name}/plugins/katex`), cjsPlugin = req(`${name}/plugins/katex`)
    check('public ESM/CJS plugin exports', () => {
      assert.equal(typeof esmPlugin.renderKatexMath, 'function')
      assert.equal(typeof cjsPlugin.renderKatexMath, 'function')
    })
    adapterChecks(esmPlugin.renderKatexMath, 'ESM')
    adapterChecks(cjsPlugin.renderKatexMath, 'CJS')
  }
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); throw error }
finally {
  await writeFile(new URL('./import-probe-result.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
}
