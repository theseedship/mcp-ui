import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function qualifyBrowser({ url, mode, version, resultDir }) {
  const deps = process.env.MCP_THEME_BROWSER_DEPS
  assert(deps, 'Set MCP_THEME_BROWSER_DEPS to external node_modules containing playwright')
  const req = createRequire(resolve(deps, '../package.json'))
  const { chromium } = req('playwright')
  const browser = await chromium.launch({ headless: true,
    ...(process.env.MCP_THEME_CHROMIUM ? { executablePath: process.env.MCP_THEME_CHROMIUM } : {}) })
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const page = await context.newPage(), origin = new URL(url).origin
  const report = { mode, version, browser: browser.version(), checks: [], counts: {}, console: [], pageErrors: [], externalRequests: [], status: 'running' }
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.pageErrors.push(error.stack || error.message))
  page.on('console', entry => { if (['error', 'warning'].includes(entry.type())) report.console.push({ type: entry.type(), text: entry.text() }) })
  await page.route('**/*', route => {
    const requestUrl = route.request().url()
    if (requestUrl.startsWith(origin + '/') || /^(?:data|blob):/.test(requestUrl)) return route.continue()
    report.externalRequests.push(requestUrl); return route.abort('blockedbyclient')
  })
  await page.addInitScript(() => {
    window.__katexEvidence = { ssrNode: null }
    const observer = new MutationObserver(() => {
      const node = document.getElementById('ssr-sentinel')
      if (node) { window.__katexEvidence.ssrNode = node; observer.disconnect() }
    })
    observer.observe(document, { childList: true, subtree: true })
  })
  const check = async (name, action) => { await action(); report.checks.push(name) }
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('html[data-fixture-hydrated="true"]')
    await check('SSR sentinel preserved across hydration', async () => {
      assert(await page.evaluate(() => window.__katexEvidence.ssrNode === document.getElementById('ssr-sentinel')))
    })
    if (version === 'absent') {
      await check('root renderer works without KaTeX and leaves source literal', async () => {
        assert.equal(await page.locator('math').count(), 0)
        assert((await page.locator('#math-text').innerText()).includes('$x_1$'))
      })
    } else {
      await check('client upgrades text and table to sanitized MathML', async () => {
        await page.waitForFunction(() => document.querySelectorAll('#math-text math, #math-table math').length >= 6)
        const metrics = await page.evaluate(() => {
          const math = [...document.querySelectorAll('#math-text math, #math-table math')]
          return { total: math.length, text: document.querySelectorAll('#math-text math').length,
            table: document.querySelectorAll('#math-table math').length,
            block: math.filter(node => node.getAttribute('display') === 'block').length,
            fraction: document.querySelectorAll('math mfrac').length,
            subscript: document.querySelectorAll('math msub').length,
            matrix: document.querySelectorAll('math mtable').length,
            positiveGeometry: math.filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).length,
            annotations: document.querySelectorAll('math annotation').length,
            htmlLayout: document.querySelectorAll('.katex-html').length,
            forbidden: document.querySelectorAll('math [style], math [href], math script, math style, math [onclick]').length }
        })
        report.counts = metrics
        assert(metrics.text >= 3 && metrics.table >= 3 && metrics.block >= 1)
        assert(metrics.fraction >= 2 && metrics.subscript >= 2 && metrics.matrix >= 2)
        assert.equal(metrics.positiveGeometry, metrics.total, 'MathML geometry was not rendered')
        assert.equal(metrics.annotations, 0, 'TeX annotation was duplicated into DOM')
        assert.equal(metrics.htmlLayout, 0, 'KaTeX HTML layout tree leaked')
        assert.equal(metrics.forbidden, 0, 'Unsafe MathML attribute or element survived')
        await page.screenshot({ path: resolve(resultDir, `${mode}-math.png`), fullPage: true })
      })
      await check('malformed TeX, currency, and hostile source remain inert', async () => {
        const text = await page.locator('#math-text').innerText()
        assert(text.includes(String.raw`$\notARealCommand{$`))
        assert(text.includes('$5 and $10'))
        assert.equal(await page.locator('#math-text img, #math-text script, #math-text [onclick], #math-text [onerror], #math-text a[href^="javascript:"]').count(), 0)
        assert.equal(await page.evaluate(() => window.__mcpUnsafe), undefined)
      })
      await check('browser preserves expansion and dimension limits', async () => {
        assert.equal(await page.locator('#math-bounds math mspace[width="20em"][height="20em"]').count(), 1)
        assert((await page.locator('#math-bounds').innerText()).includes(String.raw`$\def\a{\a}\a$`), 'Recursive expression lost its complete source')
      })
      await check('reactive source update and unmount', async () => {
        await page.locator('#update').click()
        await page.waitForFunction(() => document.querySelector('#math-text')?.textContent?.includes('Updated') && document.querySelector('#math-text math mfrac'))
        assert((await page.locator('#math-text').innerText()).includes('Updated'))
        await page.locator('#unmount').click()
        await page.locator('#math-text math').waitFor({ state: 'detached' })
        assert.equal(await page.locator('#math-table math').count(), 0)
        assert.equal(await page.locator('#math-bounds math').count(), 0)
      })
    }
    assert.deepEqual(report.externalRequests, [], 'External network request')
    assert.deepEqual(report.pageErrors, [], 'Browser runtime error')
    assert.deepEqual(report.console, [], 'Browser diagnostics (warnings and errors)')
    report.status = 'passed'
    return report
  } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); throw error }
  finally {
    await writeFile(resolve(resultDir, `${mode}-dom.html`), await page.content()).catch(() => {})
    await page.screenshot({ path: resolve(resultDir, `${mode}-browser.png`), fullPage: true }).catch(() => {})
    await writeFile(resolve(resultDir, `${mode}-browser.json`), JSON.stringify(report, null, 2) + '\n')
    await context.close(); await browser.close()
  }
}
