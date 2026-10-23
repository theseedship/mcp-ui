import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runEngines } from './engines-browser.mjs'

// The fixture intentionally delivers exactly one nonrecoverable SSE error.
// Preserve its real logger output as evidence, without allowing any other error.
export const EXPECTED_STREAM_ERROR = '[@seed-ship/mcp-ui-solid:useStreamingUI] Stream error received {"error":"fixture-error","message":"Local fixture failed","recoverable":false}'
export const isExpectedStreamError = entry => entry.type === 'error' && entry.text === EXPECTED_STREAM_ERROR

export async function qualifyBrowser({ url, resultDir, mode, profile = 'full' }) {
  const deps = process.env.MCP_THEME_BROWSER_DEPS
  assert(deps, 'Set MCP_THEME_BROWSER_DEPS to the existing external node_modules containing playwright')
  const req = createRequire(resolve(deps, '../package.json')), { chromium } = req('playwright')
  const browser = await chromium.launch({ headless: true,
    ...(process.env.MCP_THEME_CHROMIUM ? { executablePath: process.env.MCP_THEME_CHROMIUM } : {}) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage(), origin = new URL(url).origin
  const report = { browser: browser.version(), mode, profile, checks: [], console: [], errors: [], externalRequests: [], status: 'running' }
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.errors.push(error.stack || error.message))
  page.on('console', entry => {
    if (['error', 'warning'].includes(entry.type())) report.console.push({ type: entry.type(), text: entry.text() })
  })
  await page.route('**/*', route => {
    const requestUrl = route.request().url()
    if (requestUrl.startsWith(origin + '/') || /^(?:data|blob):/.test(requestUrl)) return route.continue()
    report.externalRequests.push(requestUrl); return route.abort('blockedbyclient')
  })
  await page.addInitScript(() => {
    const state = { clipboard: [], fetchStarted: 0, fetchAborted: 0, keyListeners: new Set(), ssrNode: null }
    window.__mcpBrowserEvidence = state
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { state.clipboard.push(text) }, readText: async () => state.clipboard.at(-1) || '',
    } })
    const fetchOriginal = window.fetch.bind(window)
    window.fetch = (input, init) => {
      if (String(input).includes('/api/mcp/generative-ui-stream')) {
        state.fetchStarted++
        init?.signal?.addEventListener('abort', () => { state.fetchAborted++ }, { once: true })
      }
      return fetchOriginal(input, init)
    }
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (this === document && type === 'keydown') state.keyListeners.add(listener)
      return add.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (this === document && type === 'keydown') state.keyListeners.delete(listener)
      return remove.call(this, type, listener, options)
    }
    // Capture the parser-created node before the generated client module runs.
    const observer = new MutationObserver(() => {
      const node = document.getElementById('ssr-sentinel')
      if (node) { state.ssrNode = node; observer.disconnect() }
    })
    observer.observe(document, { childList: true, subtree: true })
  })
  const check = async (name, fn) => { await fn(); report.checks.push(name) }
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('html[data-fixture-hydrated="true"]')
    if (profile === 'optional-absent') {
      await check('Real optional-absent browser graph: text/table/source and missing G6 fallback', async () => {
        assert(await page.evaluate(() => window.__mcpBrowserEvidence.ssrNode === document.getElementById('ssr-sentinel')))
        assert(await page.locator('#optional-text').innerText() === 'Optional consumer text')
        assert(await page.locator('#source-fixture').innerText() === 'Optional source entry')
        await page.waitForFunction(() => document.getElementById('optional-graph').textContent.includes('Graph rendering unavailable'))
        assert((await page.locator('#optional-graph').innerText()).includes('@antv/g6'))
        await page.locator('#optional-table th').first().click()
        await page.waitForFunction(() => document.querySelector('#optional-table tbody td')?.textContent.includes('Alpha'))
        assert.equal(await page.locator('#optional-table tbody tr').count(), 2)
        assert.equal(await page.locator('canvas').count(), 0, 'Absent G6 unexpectedly created an engine canvas')
        assert.deepEqual(report.externalRequests, [])
        assert.deepEqual(report.errors, [])
        assert.deepEqual(report.console.filter(entry => entry.type === 'error' || /\[[A-Z][A-Z_]+\]|hydration|mismatch/i.test(entry.text)), [])
      })
      report.status = 'passed'
      return report
    }
    await check('SSR node identity, public/source imports, text/KaTeX, sanitizer and table IDs', async () => {
      assert(await page.evaluate(() => window.__mcpBrowserEvidence.ssrNode === document.getElementById('ssr-sentinel')), 'Hydration replaced the SSR sentinel')
      assert(await page.locator('#source-fixture').innerText() === 'Exported source entry fixture')
      assert(await page.locator('#text-fixture math').count() > 0, 'Explicit KaTeX peer did not render MathML')
      assert.equal(await page.locator('#text-fixture [onclick]').count(), 0, 'Untrusted event attribute survived sanitation')
      assert.equal(await page.evaluate(() => window.__mcpUnsafe), undefined)
      assert(await page.locator('#table-fixture button[data-citation-page="7"][data-citation-doc="proof.pdf"]').count() > 0)
      assert(await page.evaluate(() => {
        const table = document.querySelector('#table-fixture table'), id = table.getAttribute('aria-labelledby')
        return !!id && !!document.getElementById(id)
      }), 'Hydrated table aria-labelledby does not resolve')
    })
    await check('Table sorting, clipboard payload and real CSV download', async () => {
      await page.locator('#table-fixture th').first().click()
      await page.waitForFunction(() => document.querySelector('#table-fixture tbody td')?.textContent.includes('Alpha'))
      await page.locator('#table-fixture [aria-haspopup="menu"]').click()
      await page.getByRole('button', { name: 'Copy TSV', exact: true }).click()
      await page.waitForFunction(() => window.__mcpBrowserEvidence.clipboard.length === 1)
      const copied = await page.evaluate(() => window.__mcpBrowserEvidence.clipboard[0])
      assert(copied.includes('Name\tValue') && copied.includes('Beta\t2') && copied.includes('Alpha [1]\t1'), 'TSV changed the raw values or citation marker')
      await page.locator('#table-fixture [aria-haspopup="menu"]').click()
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download CSV', exact: true }).click()
      const download = await downloadPromise
      assert.equal(download.suggestedFilename(), 'fixture-values.csv')
      const path = resolve(resultDir, `${mode}-fixture-values.csv`)
      await download.saveAs(path)
      const csv = await readFile(path, 'utf8')
      assert(csv.includes('Name,Value') && csv.includes('Beta,2') && csv.includes('Alpha [1],1'), 'CSV did not preserve source values')
    })
    await check('Virtualized real 100-row viewport scroll inside the default validation limit', async () => {
      await page.waitForFunction(() => {
        const region = document.querySelector('#virtual-fixture [role="region"]')
        return region && region.scrollHeight > region.clientHeight * 2 && region.querySelectorAll('tbody tr').length < 50
      })
      const region = page.locator('#virtual-fixture [role="region"]')
      await region.evaluate(element => { element.scrollTop = 2100; element.dispatchEvent(new Event('scroll')) })
      await page.waitForFunction(() => Array.from(document.querySelectorAll('#virtual-fixture tbody td')).some(cell => /^Virtual row [4-9]\d$/.test(cell.textContent.trim())))
      report.virtualRenderedRows = await page.locator('#virtual-fixture tbody tr').count()
      assert(report.virtualRenderedRows < 50, 'Virtual path rendered the entire data set')
    })
    await check('Open/close, live host theme, citations, focus and visual DOM identity', async () => {
      await page.evaluate(() => {
        window.__mcpCanvas = document.getElementById('persistent-canvas')
        window.__mcpKeyBaseline = window.__mcpBrowserEvidence.keyListeners.size
        document.getElementById('fixture-host').style.setProperty('--mcp-ui-surface', 'rgb(23, 37, 53)')
      })
      const expand = page.locator('#persistent-fixture [data-mcp-ui-action="expand"]')
      for (let cycle = 0; cycle < 2; cycle++) {
        await expand.click()
        const portal = page.locator('[data-mcp-ui-portal="dialog"]')
        await portal.waitFor()
        await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'dialog')
        assert(await page.evaluate(() => window.__mcpCanvas === document.getElementById('persistent-canvas')))
        assert.equal(await portal.locator(':scope > div').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(23, 37, 53)')
        await page.evaluate(() => document.getElementById('fixture-host').style.setProperty('--mcp-ui-surface', 'rgb(61, 43, 29)'))
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-mcp-ui-portal="dialog"] > div')).backgroundColor === 'rgb(61, 43, 29)')
        await page.locator('#persistent-citation').click()
        await page.keyboard.press('Escape')
        await portal.waitFor({ state: 'detached' })
        assert(await page.evaluate(() => document.activeElement === document.querySelector('#persistent-fixture [data-mcp-ui-action="expand"]')), 'Expand trigger focus was not restored')
        await page.evaluate(() => document.getElementById('fixture-host').style.setProperty('--mcp-ui-surface', 'rgb(23, 37, 53)'))
      }
      assert(await page.evaluate(() => window.__mcpBrowserEvidence.keyListeners.size === window.__mcpKeyBaseline), 'Escape listeners leaked after portal cycles')
      assert(await page.evaluate(() => window.__mcpFixture.mounts.visual === 1 && window.__mcpFixture.unmounts.visual === 0))
      assert(await page.evaluate(() => window.__mcpFixture.callbacks.citation === 2 && window.__mcpFixture.citations.every(c => c.page === '7' && c.file === 'proof.pdf')))
      await page.evaluate(() => document.getElementById('fixture-host').style.removeProperty('--mcp-ui-surface'))
      const light = await page.locator('#table-fixture table').evaluate(element => getComputedStyle(element.closest('.group')).backgroundColor)
      await page.locator('#toggle-dark').click()
      await page.waitForFunction(() => document.getElementById('fixture-host').classList.contains('dark'))
      const dark = await page.locator('#table-fixture table').evaluate(element => getComputedStyle(element.closest('.group')).backgroundColor)
      assert.notEqual(dark, light, 'Tailwind light/dark utilities did not apply')
    })
    await check('Two isolated bus instances, exactly-once callbacks and disposal/remount counts', async () => {
      await page.locator('#emit-a').click()
      await page.waitForFunction(() => document.getElementById('bus-A').textContent === 'A')
      assert.equal(await page.locator('#bus-B').textContent(), '')
      await page.locator('#emit-b').click()
      await page.waitForFunction(() => document.getElementById('bus-B').textContent === 'B')
      await page.locator('#toggle-b').click()
      await page.waitForSelector('#bus-B', { state: 'detached' })
      await page.locator('#emit-b').click()
      assert(await page.evaluate(() => window.__mcpFixture.listeners.B === 0 && window.__mcpFixture.callbacks.B === 1))
      await page.locator('#toggle-b').click()
      await page.waitForSelector('#bus-B', { state: 'attached' })
      await page.waitForFunction(() => window.__mcpFixture.listeners.B === 1)
      await page.locator('#emit-b').click()
      await page.waitForFunction(() => window.__mcpFixture.callbacks.B === 2)
      assert(await page.evaluate(() => {
        const m = window.__mcpFixture
        return m.listeners.A === 1 && m.listeners.B === 1 && m.mounts.B === 2 && m.unmounts.B === 1 && m.callbacks.A === 1
      }))
    })
    await check('SSE fragments, success, explicit stop, unmount abort, remount and error', async () => {
      await page.locator('#stream-success').click()
      await page.waitForFunction(() => document.getElementById('stream-count')?.textContent === '2' && document.getElementById('stream-complete')?.textContent === 'fixture-stream')
      assert(await page.evaluate(() => window.__mcpFixture.callbacks.stream === 2 && window.__mcpFixture.callbacks.complete === 1))
      await page.locator('#unmount-stream').click()
      await page.waitForSelector('#stream-probe', { state: 'detached' })
      await page.locator('#stream-slow').click()
      await page.waitForFunction(() => document.getElementById('stream-count')?.textContent === '1')
      const before = await page.evaluate(() => window.__mcpFixture.callbacks.stream)
      await page.locator('#stop-stream').click()
      await page.waitForFunction(() => window.__mcpBrowserEvidence.fetchAborted >= 1)
      await page.waitForTimeout(800)
      assert.equal(await page.evaluate(() => window.__mcpFixture.callbacks.stream), before, 'Late callback after explicit stop')
      await page.locator('#unmount-stream').click()
      await page.locator('#stream-slow').click()
      await page.waitForFunction(() => document.getElementById('stream-count')?.textContent === '1')
      const beforeUnmount = await page.evaluate(() => window.__mcpFixture.callbacks.stream)
      await page.locator('#unmount-stream').click()
      await page.waitForSelector('#stream-probe', { state: 'detached' })
      await page.waitForTimeout(800)
      assert.equal(await page.evaluate(() => window.__mcpFixture.callbacks.stream), beforeUnmount, 'Late callback after unmount')
      await page.locator('#stream-error-button').click()
      await page.waitForFunction(() => document.getElementById('stream-error')?.textContent === 'fixture-error')
      assert.equal(await page.evaluate(() => window.__mcpFixture.callbacks.error), 1)
      await page.locator('#unmount-stream').click()
      await page.waitForSelector('#stream-probe', { state: 'detached' })
      assert(await page.evaluate(() => {
        const m = window.__mcpFixture, b = window.__mcpBrowserEvidence
        return m.mounts.stream === 4 && m.unmounts.stream === 4 && b.fetchStarted === 4 && b.fetchAborted >= 2
      }))
      report.serverStreamStats = await (await page.request.get(origin + '/__fixture/stats')).json()
    })
    report.expectedConsoleErrors = report.console.filter(isExpectedStreamError)
    assert.equal(report.expectedConsoleErrors.length, 1, 'The intentional fixture SSE error must log exactly once')
    report.engines = await runEngines(page, { resultDir, mode })
    report.metrics = await page.evaluate(() => ({ fixture: window.__mcpFixture, browser: {
      fetchStarted: window.__mcpBrowserEvidence.fetchStarted, fetchAborted: window.__mcpBrowserEvidence.fetchAborted,
      keyListeners: window.__mcpBrowserEvidence.keyListeners.size, clipboardWrites: window.__mcpBrowserEvidence.clipboard.length,
    } }))
    assert.deepEqual(report.metrics.fixture.duplicateMounts, [], 'Duplicate package mount notifications')
    assert.deepEqual(report.externalRequests, [], 'Fixture attempted external network access')
    assert.deepEqual(report.errors, [], 'Browser runtime/hydration error')
    const diagnostics = report.console.filter(entry => !isExpectedStreamError(entry) && (entry.type === 'error' || /\[[A-Z][A-Z_]+\]|hydration|mismatch/i.test(entry.text)))
    assert.deepEqual(diagnostics, [], 'Browser migration diagnostics; see console evidence')
    report.status = 'passed'
    return report
  } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); throw error }
  finally {
    report.finalSnapshot = await page.evaluate(() => ({
      activeElement: document.activeElement ? { tag: document.activeElement.tagName, id: document.activeElement.id,
        action: document.activeElement.getAttribute('data-mcp-ui-action') } : null,
      mathNodes: document.querySelectorAll('#text-fixture math').length,
      renderedVirtualRows: document.querySelectorAll('#virtual-fixture tbody tr').length,
      dialogCount: document.querySelectorAll('[data-mcp-ui-portal="dialog"]').length,
      fixture: window.__mcpFixture ?? null,
      browser: window.__mcpBrowserEvidence ? {
        fetchStarted: window.__mcpBrowserEvidence.fetchStarted, fetchAborted: window.__mcpBrowserEvidence.fetchAborted,
        keyListeners: window.__mcpBrowserEvidence.keyListeners.size,
      } : null,
    })).catch(error => ({ unavailable: error.message }))
    await writeFile(resolve(resultDir, `${mode}-dom.html`), await page.content()).catch(() => {})
    await page.screenshot({ path: resolve(resultDir, `${mode}-browser.png`), fullPage: true }).catch(() => {})
    await writeFile(resolve(resultDir, `${mode}-browser.json`), JSON.stringify(report, null, 2) + '\n')
    await context.close(); await browser.close()
  }
}
