#!/usr/bin/env node
/** Real Chromium / Solid 1 gate against the installed tarball, never repo source. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = new Map()
const allowed = new Set(['--consumer', '--browser-deps', '--profile'])
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1]
  assert(allowed.has(key) && value && !value.startsWith('--'), `Expected --consumer, --browser-deps, or --profile value; got ${key ?? '<end>'}`)
  assert(!args.has(key), `Duplicate argument ${key}`)
  args.set(key, value)
}
const consumerArg = args.get('--consumer'), externalArg = args.get('--browser-deps')
const profile = args.get('--profile')
assert(consumerArg && externalArg && ['full', 'optional-absent'].includes(profile), 'Pass --consumer, --browser-deps and --profile')
const consumer = resolve(consumerArg)
const external = resolve(externalArg)
const installedConsumer = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'))
assert.equal(installedConsumer.name, 'mcpui-zod4-independent-consumer', 'Browser gate requires a verifier-created independent consumer')
const consumerRequire = createRequire(join(consumer, 'package.json'))
const externalRequire = createRequire(join(external, '../package.json'))
const load = path => import(pathToFileURL(path).href)
const { createServer } = await load(consumerRequire.resolve('vite'))
const solidPlugin = (await load(consumerRequire.resolve('vite-plugin-solid'))).default
const playwright = await load(externalRequire.resolve('playwright'))
const { chromium } = playwright.default ?? playwright
const fixtureRoot = join(consumer, 'browser-fixture')
await mkdir(fixtureRoot, { recursive: true })
const source = await readFile(join(here, 'browser-fixture.tsx'), 'utf8')
await writeFile(join(fixtureRoot, 'ssr.tsx'), await readFile(join(here, 'ssr-fixture.tsx')))
// A local transparent tile prevents the map fixture from contacting OpenStreetMap.
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6O0sAAAAASUVORK5CYII='
await writeFile(join(fixtureRoot, 'tile.png'), Buffer.from(pixel, 'base64'))
const resolutions = []
const errors = [], warnings = [], blocked = []
const server = await createServer({
  configFile: false, root: fixtureRoot, plugins: [{
    name: 'packed-resolution-evidence', enforce: 'pre',
    async resolveId(id, importer) {
      if (!id.startsWith('@seed-ship/mcp-ui-')) return null
      const result = await this.resolve(id, importer, { skipSelf: true })
      if (result) resolutions.push({ environment: this.environment?.name ?? 'unknown', request: id, id: result.id })
      return null
    },
  }, solidPlugin({ ssr: true }), {
    name: 'packed-dist-conditions', enforce: 'post',
    configEnvironment(name, config) {
      // Vite 6's Solid plugin prepends this in configEnvironment, after the
      // ordinary config hook. Client tests emitted dist; SSR uses the packed
      // package's declared `solid` source condition and SSR transform.
      if (name === 'client' && config.resolve?.conditions) config.resolve.conditions = config.resolve.conditions.filter(value => value !== 'solid')
    },
  }],
  resolve: { conditions: ['browser', 'module', 'import', 'default'], dedupe: ['solid-js'] },
  ssr: { noExternal: ['@seed-ship/mcp-ui-solid', '@seed-ship/mcp-ui-spec'], resolve: { conditions: ['solid', 'node', 'import', 'default'] } },
  server: { host: '127.0.0.1', port: 0, hmr: false, strictPort: false, fs: { strict: true, allow: [consumer] } },
  optimizeDeps: { include: profile === 'full' ? [
    '@seed-ship/mcp-ui-solid > leaflet',
    '@seed-ship/mcp-ui-solid > leaflet.markercluster',
    '@seed-ship/mcp-ui-solid > @antv/g6',
    '@seed-ship/mcp-ui-solid > katex',
  ] : [] },
})
let browser
const report = { profile, browser: null, solid: null, ssr: null, checks: {}, resolutions, conditions: null, consoleErrors: errors, consoleWarnings: warnings, blockedExternal: blocked }
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  let ssrHtml = '', hydrationScript = ''
  try {
    const ssr = await server.ssrLoadModule('/ssr.tsx')
    assert(typeof ssr.html === 'string' && ssr.html.includes('Alpha'), 'Packed Solid SSR did not render the table')
    ssrHtml = ssr.html
    hydrationScript = ssr.hydrationScript
    report.ssr = { status: 'passed', chars: ssrHtml.length, tableText: 'Alpha' }
  } catch (error) {
    report.ssr = { status: 'failed', error: error.stack ?? String(error) }
  }
  const mathImport = profile === 'full'
    ? "import { renderKatexMath as renderMath } from '@seed-ship/mcp-ui-solid/plugins/katex'"
    : 'const renderMath = undefined'
  const mount = ssrHtml
    ? 'hydrate(() => <UIResourceRenderer content={table} toolbarVariant="always-visible" />, ssrHost)'
    : 'render(() => <UIResourceRenderer content={table} toolbarVariant="always-visible" />, ssrHost)'
  await writeFile(join(fixtureRoot, 'client.tsx'), source.replace('__MATH_IMPORT__', mathImport).replace('__SSR_MOUNT__', mount))
  await writeFile(join(fixtureRoot, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">${hydrationScript}</head><body><div id="ssr">${ssrHtml}</div><div id="app"></div><script type="module" src="/client.tsx"></script></body></html>`)
  browser = await chromium.launch({ headless: true, ...(process.env.MCPUI_CHROMIUM ? { executablePath: process.env.MCPUI_CHROMIUM } : {}) })
  report.browser = browser.version()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue()
    blocked.push(url.href)
    if (url.hostname === 'unpkg.com' && /leaflet.*marker.*\.png$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(pixel, 'base64') })
    }
    return route.abort('blockedbyclient')
  })
  page.on('pageerror', error => errors.push(`pageerror: ${error.stack ?? error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    if (message.type() === 'warning') warnings.push(message.text())
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => (window).__mcpuiReady === true)
  await page.locator('#ssr table').waitFor()
  await page.locator('#table table').waitFor()
  assert.equal(await page.locator('#ssr tbody tr').count(), 1, 'Hydration duplicated SSR table rows')
  assert.equal(await page.locator('#table [data-citation-page="7"]').count(), 1, 'Citation chip missing from packed table')
  report.checks.table = ssrHtml ? 'rendered-and-hydrated' : 'client-rendered-ssr-failed'
  await page.locator('#table [data-mcp-ui-action="expand"]').click()
  await page.locator('[data-mcp-ui-portal="dialog"]').waitFor()
  assert.equal(await page.locator('[data-mcp-ui-portal="dialog"] tbody tr').count(), 1, 'Fullscreen reparenting duplicated table rows')
  await page.locator('[data-mcp-ui-portal="dialog"] [data-mcp-ui-action="copy"]').first().click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  assert(copied.includes('Alpha') && copied.includes('[1]'), 'Fullscreen table copy lost row/citation data')
  await page.locator('[data-mcp-ui-portal="dialog"] [data-mcp-ui-action="close"]').click()
  assert.equal(await page.locator('[data-mcp-ui-portal="dialog"]').count(), 0, 'Fullscreen portal survived close')
  report.checks.copyFullscreen = 'passed'
  if (profile === 'full') {
    report.checks.engines = {}
    try {
      await page.locator('#map .leaflet-marker-icon').waitFor({ timeout: 12_000 })
      await page.locator('#map .leaflet-marker-icon').hover()
      await page.locator('#map .leaflet-tooltip').waitFor({ timeout: 5_000 })
      const tooltip = await page.locator('#map .leaflet-tooltip').innerHTML()
      assert(!tooltip.includes('<img'), 'Marker tooltip rendered untrusted HTML')
      assert(tooltip.includes('&lt;img'), 'Marker tooltip did not escape untrusted HTML')
      report.checks.engines.map = 'leaflet-marker-and-escaped-tooltip'
    } catch (error) { report.checks.engines.map = { status: 'failed', error: error.message } }
    try {
      await page.locator('#graph canvas').first().waitFor({ timeout: 12_000 })
      const canvases = await page.locator('#graph canvas').count()
      assert(canvases >= 1, 'G6 graph emitted no canvas')
      report.checks.engines.graph = `G6-${canvases}-canvases`
    } catch (error) { report.checks.engines.graph = { status: 'failed', error: error.message } }
    try {
      await page.locator('#math math').waitFor({ timeout: 5_000 })
      report.checks.engines.math = 'KaTeX-MathML'
    } catch (error) { report.checks.engines.math = { status: 'failed', error: error.message } }
  } else {
    await page.locator('#map table').waitFor()
    await page.getByText('Install @antv/g6', { exact: false }).waitFor()
    assert.equal(await page.locator('#math math').count(), 0, 'Math rendered despite optional KaTeX absence')
    report.checks.engines = { map: 'coordinate-table-fallback', graph: 'missing-peer-fallback', math: 'source-token-preserved' }
  }
  await page.evaluate(() => (window).__mcpuiDispose())
  assert.equal(await page.locator('[data-mcp-ui-portal]').count(), 0, 'Portal remained after Solid disposal')
  assert.equal(await page.locator('#app').innerHTML(), '', 'Solid render tree remained after disposal')
  report.checks.cleanup = 'passed'
  if (profile === 'full') assert(Object.values(report.checks.engines).every(value => typeof value === 'string'), 'One or more installed optional engines failed their browser gate')
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`)
  assert(blocked.every(url => /unpkg\.com\/leaflet.*marker.*\.png$/.test(url)), `Unexpected external requests: ${blocked.join(', ')}`)
  for (const required of ['@seed-ship/mcp-ui-solid', '@seed-ship/mcp-ui-spec']) {
    const resolved = resolutions.filter(item => item.request === required)
    assert(resolved.length, `${required} was not resolved by Vite`)
    for (const item of resolved) {
      assert(item.id.includes(`${sep}node_modules${sep}`) && item.id.startsWith(consumer + sep), `${required} resolved outside installed consumer: ${item.id}`)
      if (item.environment === 'client') assert(item.id.includes(`${sep}dist${sep}`) && !item.id.includes(`${sep}src${sep}`), `${required} client resolved source instead of dist: ${item.id}`)
      if (item.environment === 'ssr' && required === '@seed-ship/mcp-ui-solid') assert(item.id.includes(`${sep}src${sep}`), `${required} SSR did not use declared installed solid condition: ${item.id}`)
    }
  }
  assert(resolutions.some(item => item.environment === 'client' && item.request === '@seed-ship/mcp-ui-solid'), 'No packed Solid client dist resolution was observed')
  assert(resolutions.some(item => item.environment === 'ssr' && item.request === '@seed-ship/mcp-ui-solid'), 'No packed Solid SSR source-condition resolution was observed')
  report.solid = JSON.parse(await readFile(consumerRequire.resolve('solid-js/package.json'), 'utf8')).version
  assert(/^1\./.test(report.solid), `Not a Solid 1 browser: ${report.solid}`)
  report.status = report.ssr.status === 'passed' ? 'passed' : 'partial-ssr-failed'
  if (report.status !== 'passed') process.exitCode = 1
} catch (error) {
  report.status = 'failed'
  report.failure = error.stack ?? String(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  await server.close()
  console.log(`MCPUI_BROWSER_REPORT=${JSON.stringify(report)}`)
}
