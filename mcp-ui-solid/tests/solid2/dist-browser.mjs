#!/usr/bin/env node
/** Local-only browser qualification of compiled public exports, never `solid` source. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)), repositoryRoot = resolve(here, '../../..')
export const PUBLIC_ENTRIES = Object.freeze(['.', './components', './hooks', './types', './validation',
  './types-only', './adapters', './adapters/presentation', './plugins/duckdb', './plugins/katex'])
export const browserConditions = mode => mode === 'dev' ? ['browser', 'development'] : ['browser', 'production']

export function validateConsumerPath(consumer) {
  assert(consumer && isAbsolute(consumer), '--consumer must be an absolute dedicated installed consumer')
  assert(!['/', '/tmp', process.env.HOME].includes(consumer) && !consumer.startsWith('/tmp/'), 'Use a dedicated durable consumer')
  const rel = relative(repositoryRoot, consumer)
  assert(rel.startsWith(`..${sep}`) || isAbsolute(rel), 'Consumer must be outside the library workspace')
}

export function assertCompiledModule(id, packageRoot) {
  const clean = id.split('?')[0].replaceAll('\\', '/')
  const root = packageRoot.replaceAll('\\', '/')
  if (!clean.startsWith(root + '/')) return false
  assert(!clean.startsWith(root + '/src/'), `Compiled-browser gate loaded forbidden MCPUI source: ${clean}`)
  assert(!clean.startsWith(root + '/dist/server/'), `Browser resolved forbidden server distribution: ${clean}`)
  if (clean.startsWith(root + '/dist/')) {
    assert(/\.(?:js|cjs|mjs|css)$/.test(clean), `Non-JavaScript distribution module: ${clean}`)
    return true
  }
  return false
}

export function browserEntrySource() {
  const imports = PUBLIC_ENTRIES.map((entry, index) =>
    `import * as public${index} from ${JSON.stringify('@seed-ship/mcp-ui-solid' + (entry === '.' ? '' : entry.slice(1)))};`).join('\n')
  return `${imports}
import { createComponent } from 'solid-js';
import { render } from '@solidjs/web';
const state = window.__mcpDistProbe = { imports: {}, validation: [], clipboard: [], disposed: false };
${PUBLIC_ENTRIES.map((entry, index) => `state.imports[${JSON.stringify(entry)}] = Object.keys(public${index}).sort();`).join('\n')}
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
  writeText: async text => { state.clipboard.push(text); },
} });
const text = { id:'dist-text-item',type:'text',position:{colStart:1,colSpan:12},params:{content:'Compiled distribution text',markdown:false} };
const table = { id:'dist-table-item',type:'table',position:{colStart:1,colSpan:12},params:{
  title:'Compiled values',columns:[{key:'name',label:'Name'},{key:'value',label:'Value'}],
  rows:[{name:'Beta',value:2},{name:'Alpha',value:1}],virtualize:false,
} };
const invalid = { id:'dist-invalid',type:'metric',position:{colStart:99,colSpan:1},params:{value:42} };
const disposers = [
  render(() => createComponent(public0.UIResourceRenderer,{content:text}),document.getElementById('dist-text')),
  render(() => createComponent(public0.UIResourceRenderer,{content:table}),document.getElementById('dist-table')),
  render(() => createComponent(public0.UIResourceRenderer,{content:invalid,errorMode:'silent',onError:error=>state.validation.push({type:error.type,id:error.componentId})}),document.getElementById('dist-invalid')),
];
window.__disposeDistProbe = () => { for(const dispose of disposers) dispose();state.disposed=true; };
document.documentElement.dataset.distReady = 'true';
`
}

function distributionGuard(packageRoot, loaded) {
  return { name: 'mcpui-compiled-distribution-only', enforce: 'post',
    transform(_code, id) { if (assertCompiledModule(id, packageRoot)) loaded.add(id.split('?')[0]) },
  }
}

async function openBrowser(url, outputRoot, mode, chromium) {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.MCP_THEME_CHROMIUM ? { executablePath: process.env.MCP_THEME_CHROMIUM } : {}) })
  const context = await browser.newContext(), page = await context.newPage(), origin = new URL(url).origin
  const report = { mode, browser: browser.version(), checks: [], pageErrors: [], diagnostics: [], externalRequests: [], status: 'running' }
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => report.pageErrors.push(error.stack || error.message))
  page.on('console', entry => {
    if (['error', 'warning'].includes(entry.type())) report.diagnostics.push({ type: entry.type(), text: entry.text() })
  })
  await page.route('**/*', route => {
    const value = route.request().url()
    if (value.startsWith(origin + '/') || /^(?:blob|data):/.test(value)) return route.continue()
    report.externalRequests.push(value)
    return route.abort('blockedbyclient')
  })
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('html[data-dist-ready="true"]')
    const imported = await page.evaluate(() => window.__mcpDistProbe.imports)
    assert.deepEqual(Object.keys(imported).sort(), [...PUBLIC_ENTRIES].sort())
    assert(imported['.'].includes('UIResourceRenderer'))
    assert(imported['./components'].includes('UIResourceRenderer'))
    assert(imported['./plugins/duckdb'].length > 0 && imported['./plugins/katex'].includes('renderKatexMath'))
    report.imports = imported
    report.checks.push('All ten public default/browser entries imported; optional plugins not initialized')
    assert.equal(await page.locator('#dist-text').innerText(), 'Compiled distribution text')
    assert.equal(await page.locator('#dist-table tbody tr').count(), 2)
    await page.locator('#dist-table th').first().click()
    await page.waitForFunction(() => document.querySelector('#dist-table tbody td')?.textContent === 'Alpha')
    report.checks.push('Compiled text/table render and real delegated sorting work')
    await page.locator('#dist-table [data-mcp-ui-action="copy"]').click()
    await page.waitForFunction(() => window.__mcpDistProbe.clipboard.length === 1)
    assert.equal(await page.evaluate(() => window.__mcpDistProbe.clipboard[0]), 'Name,Value\nBeta,2\nAlpha,1')
    await page.waitForFunction(() => window.__mcpDistProbe.validation.length === 1)
    assert.deepEqual(await page.evaluate(() => window.__mcpDistProbe.validation), [{ type: 'validation', id: 'dist-invalid' }])
    report.checks.push('Exact raw CSV copy and host validation callback execute')
    await page.evaluate(() => window.__disposeDistProbe())
    assert.equal(await page.locator('#dist-table table').count(), 0)
    assert.equal(await page.locator('#dist-text').innerText(), '')
    report.checks.push('Compiled render roots dispose their DOM')
    assert.deepEqual(report.pageErrors, [])
    assert.deepEqual(report.diagnostics, [])
    assert.deepEqual(report.externalRequests, [])
    report.status = 'passed'
    return report
  } catch (error) { report.status = 'failed'; report.error = error.stack || String(error); throw error }
  finally {
    await writeFile(resolve(outputRoot, `${mode}-browser.json`), JSON.stringify(report, null, 2) + '\n')
    await page.screenshot({ path: resolve(outputRoot, `${mode}-browser.png`), fullPage: true }).catch(() => {})
    await browser.close()
  }
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(argv[0], '--consumer', 'Usage: node dist-browser.mjs --consumer /absolute/installed/full-consumer')
  assert.equal(argv.length, 2, 'Only --consumer is accepted')
  const consumer = argv[1]
  validateConsumerPath(consumer)
  const consumerRoot = await realpath(consumer)
  validateConsumerPath(consumerRoot)
  const packageRoot = await realpath(resolve(consumerRoot, 'node_modules/@seed-ship/mcp-ui-solid'))
  assert(packageRoot.startsWith(consumerRoot + sep), 'MCPUI must be installed inside this consumer, never linked to source')
  const input = JSON.parse(await readFile(resolve(consumerRoot, 'qualification-input.json'), 'utf8'))
  assert.equal(input.profile, 'full', 'Use a full-profile consumer so both optional plugin public imports exist')
  assert.equal(createHash('sha256').update(await readFile(input.tarball.path)).digest('hex'), input.tarball.sha256, 'Tarball changed')
  const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  for (const entry of PUBLIC_ENTRIES) {
    const target = manifest.exports[entry]?.import?.default
    assert(target?.startsWith('./dist/') && !target.startsWith('./dist/server/'), `No compiled browser default for ${entry}`)
    await access(resolve(packageRoot, target))
  }
  const req = createRequire(resolve(consumerRoot, 'package.json')), vite = await import(pathToFileURL(req.resolve('vite')).href)
  const deps = process.env.MCP_THEME_BROWSER_DEPS
  assert(deps, 'Set MCP_THEME_BROWSER_DEPS to the existing external node_modules containing playwright')
  const { chromium } = createRequire(resolve(deps, '../package.json'))('playwright')
  const outputRoot = resolve(consumerRoot, 'dist-client-probe', new Date().toISOString().replaceAll(':', '-'))
  const fixtureRoot = resolve(outputRoot, 'input'), buildRoot = resolve(outputRoot, 'production')
  await mkdir(fixtureRoot, { recursive: true })
  await writeFile(resolve(fixtureRoot, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Compiled distribution probe</title></head><body><section id="dist-text"></section><section id="dist-table"></section><section id="dist-invalid"></section><script type="module" src="/entry.js"></script></body></html>', { flag: 'wx' })
  await writeFile(resolve(fixtureRoot, 'entry.js'), browserEntrySource(), { flag: 'wx' })
  const report = { status: 'running', consumer: consumerRoot, packageRoot, tarball: input.tarball,
    node: process.version, vite: JSON.parse(await readFile(req.resolve('vite/package.json'), 'utf8')).version,
    publicDefaults: Object.fromEntries(PUBLIC_ENTRIES.map(entry => [entry, manifest.exports[entry].import.default])), modes: {} }
  try {
    for (const mode of ['dev', 'production']) {
      const loaded = new Set(), common = { root: fixtureRoot, configFile: false, logLevel: 'warn',
        cacheDir: resolve(outputRoot, 'vite-cache'), plugins: [distributionGuard(packageRoot, loaded)],
        resolve: { conditions: browserConditions(mode), dedupe: ['solid-js', '@solidjs/web', '@solidjs/signals'] },
        optimizeDeps: { noDiscovery: true, include: [] },
      }
      let server
      if (mode === 'dev') {
        server = await vite.createServer({ ...common, server: { host: '127.0.0.1', port: 0, watch: null } })
        await server.listen()
      } else {
        const built = await vite.build({ ...common, build: { outDir: buildRoot, emptyOutDir: false, minify: true, sourcemap: true } })
        const outputs = (Array.isArray(built) ? built : [built]).flatMap(result => result.output || [])
        report.productionFiles = outputs.map(file => file.fileName)
        assert(outputs.some(file => file.type === 'chunk'), 'Production emitted no JavaScript')
        server = await vite.preview({ ...common, build: { outDir: buildRoot }, preview: { host: '127.0.0.1', port: 0 } })
      }
      try {
        const port = server.httpServer.address().port
        const modeResult = await openBrowser(`http://127.0.0.1:${port}/`, outputRoot, mode, chromium)
        assert(loaded.size > 0, 'Guard observed no MCPUI compiled modules; provenance not proven')
        modeResult.compiledModules = [...loaded].sort()
        assert(modeResult.compiledModules.some(file => file.endsWith('/dist/index.js')), 'Public root did not resolve compiled client index.js')
        report.modes[mode] = modeResult
      } finally {
        if (mode === 'dev') await server.close()
        else await new Promise((done, reject) => server.httpServer.close(error => error ? reject(error) : done()))
      }
    }
    report.status = 'passed'
  } catch (error) { report.status = 'failed'; report.error = error.stack || String(error); throw error }
  finally {
    await writeFile(resolve(outputRoot, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(`Compiled distribution evidence: ${outputRoot}`)
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error); process.exitCode = 1 })
