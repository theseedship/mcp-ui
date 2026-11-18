import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Tiny synthetic PNG. It is deliberately not fetched from a provider/CDN.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/wAAAABJRU5ErkJggg==', 'base64')
const markerImages = new Set([
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
])
const mermaidVersion = '12.3.0'
const mermaidPage = 'https://mermaid.live/__mcpui-fixture__/diagram'
const mermaidScript = 'https://mermaid.live/__mcpui-fixture__/mermaid.min.js'

async function readinessSnapshot(page) {
  return page.evaluate(() => {
    const layers = kind => Array.from(document.querySelectorAll(`[data-engine-persistent="${kind}"] canvas`)).map(canvas => {
      const layer = { width: canvas.width, height: canvas.height, painted: false }
      try {
        const pixels = canvas.width && canvas.height ? canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data : null
        layer.painted = pixels?.some((channel, index) => index % 4 === 3 && channel !== 0) === true
      } catch (error) { layer.error = String(error) }
      return layer
    })
    const capturedMap = window.__engineIdentity?.map?.map
    const currentMapSurface = document.querySelector('[data-engine-persistent="map"]')
    const mapByClass = currentMapSurface?.querySelector('.leaflet-container')
    const chartOriginal = window.__engineInnerChartOriginal
    const chartCandidates = Array.from(new Set([
      ...document.querySelectorAll('[data-engine-persistent="chart"] canvas'),
      ...document.querySelectorAll('[data-mcp-ui-portal="dialog"] canvas'),
    ]))
    return {
      chartRegistryId: window.__mcpEngines?.chartInstanceId() ?? null,
      chartZoomReady: window.__mcpEngines?.chartZoomReady() ?? false,
      chartZoomLevel: window.__mcpEngines?.chartZoomLevel() ?? null,
      chartLayers: layers('chart'), graphLayers: layers('graph'),
      chartOriginalCanvas: chartOriginal ? { isConnected: chartOriginal.isConnected,
        inChartSurface: !!chartOriginal.closest('[data-engine-persistent="chart"]'),
        inDialog: !!chartOriginal.closest('[data-mcp-ui-portal="dialog"]'),
        width: chartOriginal.width, height: chartOriginal.height,
        sdk: window.__mcpEngines.inspectChartCanvas(chartOriginal) } : null,
      chartCanvasCandidates: chartCandidates.map(canvas => ({
        sameAsOriginal: canvas === chartOriginal,
        sameAsObserved: canvas === window.__mcpEngines.chartObservedCanvas(),
        isConnected: canvas.isConnected,
        inChartSurface: !!canvas.closest('[data-engine-persistent="chart"]'),
        inDialog: !!canvas.closest('[data-mcp-ui-portal="dialog"]'),
        width: canvas.width, height: canvas.height,
        sdk: window.__mcpEngines.inspectChartCanvas(canvas),
      })),
      mapContainers: document.querySelectorAll('[data-engine-persistent="map"] .leaflet-container').length,
      mapMarkers: document.querySelectorAll('[data-engine-persistent="map"] .leaflet-marker-icon').length,
      mapLoadedTiles: document.querySelectorAll('[data-engine-persistent="map"] .leaflet-tile-loaded').length,
      mapCapturedIdentity: capturedMap ? {
        isConnected: capturedMap.isConnected,
        sameNodeInPersistentSurface: currentMapSurface?.contains(capturedMap) ?? false,
        samePersistentSurface: currentMapSurface === window.__engineIdentity.map.surface,
        classSelectorFindsCapturedNode: mapByClass === capturedMap,
        className: capturedMap.className,
        beforeId: window.__engineIdentity.map.mapId,
        currentId: capturedMap._leaflet_id,
        classSelectorId: mapByClass?._leaflet_id ?? null,
      } : null,
      highlightedKeywords: document.querySelectorAll('[data-engine-persistent="code"] .hljs-keyword').length,
      engineText: document.getElementById('engines-fixture')?.textContent?.slice(0, 1200) ?? '',
    }
  })
}

/** Run after the main full-consumer gate; no mocks, engine aliases, or external fetches. */
export async function runEngines(page, { resultDir, mode, browserTools }) {
  const report = { mode, status: 'running', checks: [], syntheticAssetRequests: [], evidence: null, failureReadinessSnapshot: null }
  const origin = new URL(page.url()).origin
  const mermaidRequestCounts = { document: 0, script: 0 }
  let mermaidHtml, mermaidJavaScript
  const routeAssets = async route => {
    const url = route.request().url()
    if (url === mermaidPage && route.request().resourceType() === 'document') {
      mermaidRequestCounts.document++
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: mermaidHtml })
    }
    if (url === mermaidScript && route.request().resourceType() === 'script') {
      mermaidRequestCounts.script++
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: mermaidJavaScript })
    }
    if (url.startsWith(origin + '/__fixture/engine-tiles/') || markerImages.has(url)) {
      report.syntheticAssetRequests.push(url)
      return route.fulfill({ status: 200, contentType: 'image/png', body: pixel })
    }
    return route.fallback()
  }
  // Playwright runs the most recently registered handler first. All unmatched
  // requests fall through to the host's unchanged external-network deny rule.
  await page.route('**/*', routeAssets)
  const check = async (name, run) => { await run(); report.checks.push(name) }
  try {
    const manifest = JSON.parse(await readFile(browserTools.resolve('mermaid/package.json'), 'utf8'))
    assert.equal(manifest.version, mermaidVersion, 'Unexpected isolated Mermaid browser tooling version')
    ;[mermaidHtml, mermaidJavaScript] = await Promise.all([
      readFile(new URL('./mermaid-iframe.html', import.meta.url), 'utf8'),
      readFile(browserTools.resolve('mermaid/dist/mermaid.min.js')),
    ])
    await page.locator('#engine-start').click()
    await check('Actual native engines mounted; no degraded rendering', async () => {
      await page.waitForFunction(() => {
        // G6 owns several native canvas layers; its first/background layer
        // can legitimately be blank while another layer contains the graph.
        const hasPaint = kind => Array.from(document.querySelectorAll(`#engine-${kind} canvas`)).some(canvas => {
          if (!canvas.width || !canvas.height) return false
          const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data
          return pixels?.some((channel, index) => index % 4 === 3 && channel !== 0) === true
        })
        return window.__mcpEngines?.chartInstanceId() !== null && hasPaint('chart') && hasPaint('graph') &&
          document.querySelectorAll('#engine-map .leaflet-marker-icon').length === 2 &&
          document.querySelector('#engine-map .leaflet-tile-loaded') &&
          document.querySelector('#engine-code code .hljs-keyword')
      })
      for (const kind of ['chart', 'graph']) {
        assert(await page.locator(`#engine-${kind} canvas`).evaluateAll(canvases => canvases.some(canvas => {
          const context = canvas.getContext('2d')
          if (!context || !canvas.width || !canvas.height) return false
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) return true
          return false
        })), `${kind} canvases exist but every layer is unpainted`)
      }
      const text = await page.locator('#engines-fixture').innerText()
      assert(!/rendering unavailable|degraded|failed to load|library unavailable/i.test(text), 'A native engine fell back')
      assert(await page.locator('#engine-map .leaflet-tile-loaded').count() > 0, 'Local synthetic map tiles never loaded')
      assert.equal(await page.locator('#engine-map .leaflet-marker-icon').count(), 2)
      assert.equal(await page.locator('#engine-code .hljs-keyword').first().textContent(), 'const')
    })
    await check('Native Chart.js draws the exact updated host series', async () => {
      const canvas = page.locator('#engine-chart canvas')
      const before = await page.evaluate(() => window.__mcpEngines.chartSeries())
      const labels = ['Synthetic A', 'Synthetic B', 'Synthetic C', 'Synthetic D', 'Synthetic E', 'Synthetic F', 'Synthetic G', 'Synthetic H']
      assert.deepEqual(before.labels, labels)
      assert.deepEqual(before.datasets, [{ label: 'Fixture', values: [2, 5, 3, 7, 4, 8, 6, 9] }])
      assert.equal(before.barHeights.length, 8)
      assert(before.barHeights.every(height => Number.isFinite(height) && height > 0))
      const pixelsBefore = await canvas.evaluate(node => node.toDataURL())
      const values = [9, 3, 8, 4, 7, 5, 6, 2]
      await page.locator('#engine-update-chart').click()
      await page.waitForFunction(expected => {
        const series = window.__mcpEngines.chartSeries()
        return series?.datasets.length === 1 && series.datasets[0].label === 'Updated Fixture' &&
          series.datasets[0].values.length === expected.length && series.datasets[0].values.every((value, index) => value === expected[index]) &&
          series.barHeights.length === expected.length && series.barHeights.every(height => Number.isFinite(height) && height > 0)
      }, values)
      const after = await page.evaluate(() => window.__mcpEngines.chartSeries())
      assert.deepEqual(after.labels, labels)
      assert.deepEqual(after.datasets, [{ label: 'Updated Fixture', values }])
      assert(after.barHeights[0] > before.barHeights[0] && after.barHeights[7] < before.barHeights[7],
        'Chart.js bar geometry did not track the changed values')
      const paintChanged = await canvas.evaluate((node, previous) => node.toDataURL() !== previous &&
        node.getContext('2d')?.getImageData(0, 0, node.width, node.height).data
          .some((channel, index) => index % 4 === 3 && channel !== 0) === true, pixelsBefore)
      assert(paintChanged, 'Updated chart did not paint changed pixels')
      report.chartSeriesUpdate = { before, after, paintChanged }
    })
    await check('Native inner Chart.js fullscreen activates zoom; real Zoom in and reset work', async () => {
      report.chartZoom = { policy: 'expanded (default)',
        beforeId: await page.evaluate(() => window.__mcpEngines.chartInstanceId()) }
      report.chartZoom.originalCanvases = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('[data-engine-persistent="chart"] canvas'))
        window.__engineInnerChartOriginal = canvases.length === 1 ? canvases[0] : null
        return canvases.map(canvas => ({ width: canvas.width, height: canvas.height,
          sdk: window.__mcpEngines.inspectChartCanvas(canvas) }))
      })
      assert.equal(report.chartZoom.originalCanvases.length, 1, 'Native chart must have one identifiable canvas before inner fullscreen')
      assert.equal(report.chartZoom.originalCanvases[0].sdk.registryId, report.chartZoom.beforeId,
        'Native chart SDK lookup must agree for the original canvas')
      const trigger = page.locator('#engine-chart [data-engine-persistent="chart"] > .mcp-ui-root > button[data-mcp-ui-action="expand"]')
      assert.equal(await trigger.count(), 1, 'Chart renderer inner expand trigger must be unique')
      await trigger.click()
      const dialog = page.locator('[data-mcp-ui-portal="dialog"]')
      await dialog.waitFor()
      // Read the real plugin API; opening EngineCase's OUTER wrapper would
      // not activate this renderer's default expanded-only zoom policy.
      await page.waitForFunction(() => window.__mcpEngines.chartZoomReady() &&
        Number.isFinite(window.__mcpEngines.chartZoomLevel()))
      report.chartZoom.expandedId = await page.evaluate(() => window.__mcpEngines.chartInstanceId())
      report.chartZoom.initialLevel = await page.evaluate(() => window.__mcpEngines.chartZoomLevel())
      await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await page.waitForFunction(initial => Number.isFinite(window.__mcpEngines.chartZoomLevel()) &&
        window.__mcpEngines.chartZoomLevel() > initial, report.chartZoom.initialLevel)
      report.chartZoom.zoomedLevel = await page.evaluate(() => window.__mcpEngines.chartZoomLevel())
      await dialog.getByRole('button', { name: 'Reset zoom', exact: true }).click()
      await page.waitForFunction(initial => Number.isFinite(window.__mcpEngines.chartZoomLevel()) &&
        Math.abs(window.__mcpEngines.chartZoomLevel() - initial) < 0.0001, report.chartZoom.initialLevel)
      report.chartZoom.resetLevel = await page.evaluate(() => window.__mcpEngines.chartZoomLevel())
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      await page.waitForFunction(() => window.__mcpEngines.chartInstanceId() !== null)
      assert(await trigger.evaluate(element => document.activeElement === element), 'Inner chart trigger focus was not restored')
      report.chartZoom.closedId = await page.evaluate(() => window.__mcpEngines.chartInstanceId())
      // zoomOptions changes can reconstruct the SDK instance by existing
      // design. Archive those IDs rather than treating reconfiguration as a
      // reparent-only identity claim. The strict outer baseline starts below.
    })
    await page.evaluate(() => {
      window.__engineIdentity = Object.fromEntries(['chart', 'map', 'graph', 'code'].map(kind => [kind, {
        surface: document.querySelector(`[data-engine-persistent="${kind}"]`),
        canvases: Array.from(document.querySelectorAll(`#engine-${kind} canvas`)),
        map: document.querySelector('#engine-map .leaflet-container'),
        mapId: document.querySelector('#engine-map .leaflet-container')?._leaflet_id,
        code: document.querySelector('#engine-code code'),
      }]))
      window.__engineChartId = window.__mcpEngines.chartInstanceId()
      window.__engineKeyBaseline = window.__mcpBrowserEvidence.keyListeners.size
    })
    for (const kind of ['chart', 'map', 'graph', 'code']) {
      await check(`${kind}: two fullscreen/citation cycles preserve native DOM and listener counts`, async () => {
        // Select EngineCase's OUTER wrapper explicitly. Inner renderers have
        // their own expand buttons earlier in DOM order, without the citation.
        const trigger = page.locator(`#engine-${kind} > .mcp-ui-root > button[data-mcp-ui-action="expand"]`)
        assert.equal(await trigger.count(), 1, `${kind}: outer wrapper trigger must be unique`)
        for (let cycle = 0; cycle < 2; cycle++) {
          await trigger.click()
          const dialog = page.locator('[data-mcp-ui-portal="dialog"]')
          await dialog.waitFor()
          await page.waitForFunction(kind => {
            const current = document.querySelector(`[data-engine-persistent="${kind}"]`)
            return current && current === window.__engineIdentity[kind].surface && current.closest('[role="dialog"]')
          }, kind)
          const citation = dialog.locator(`[data-engine-citation="${kind}"]`)
          assert.equal(await citation.getAttribute('data-citation-page'), '11')
          assert.equal(await citation.getAttribute('data-citation-doc'), 'synthetic-engine-proof.pdf')
          await citation.click()
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'detached' })
          assert(await trigger.evaluate(element => document.activeElement === element), `${kind}: trigger focus was not restored`)
          assert(await page.evaluate(kind => {
            const before = window.__engineIdentity[kind]
            const current = document.querySelector(`[data-engine-persistent="${kind}"]`)
            const canvases = Array.from(document.querySelectorAll(`#engine-${kind} canvas`))
            return current === before.surface &&
              ((kind !== 'chart' && kind !== 'graph') || (canvases.length === before.canvases.length &&
                canvases.every((canvas, index) => canvas === before.canvases[index]))) &&
              (kind !== 'map' || (document.querySelector('#engine-map .leaflet-container') === before.map && before.map._leaflet_id === before.mapId)) &&
              (kind !== 'code' || document.querySelector('#engine-code code') === before.code)
          }, kind), `${kind}: native engine DOM was replaced`)
        }
        assert(await page.evaluate(kind => window.__mcpEngines.mounts[kind] === 1 &&
          window.__mcpEngines.unmounts[kind] === 0 && window.__mcpEngines.citations[kind] === 2, kind), `${kind}: mount or exactly-once citation mismatch`)
        assert(await page.evaluate(() => window.__mcpBrowserEvidence.keyListeners.size === window.__engineKeyBaseline), `${kind}: Escape listeners leaked`)
      })
    }
    await check('Pinned Mermaid renders a flowchart inline, fullscreen and after close', async () => {
      const iframe = '#engine-mermaid iframe[title="Synthetic Mermaid flowchart"]'
      const iframeInline = page.locator(iframe)
      const trigger = page.locator('#engine-mermaid > .mcp-ui-root > button[data-mcp-ui-action="expand"]')
      const dialog = page.getByRole('dialog', { name: 'Synthetic Mermaid fullscreen' })
      const expandedIframe = '[data-mcp-ui-portal="dialog"] iframe[title="Synthetic Mermaid flowchart"]'
      const readDiagram = async selector => {
        const frame = page.frameLocator(selector)
        await frame.locator('html[data-diagram-ready="true"]').waitFor({ state: 'attached' })
        const svg = frame.locator('#mermaid-diagram svg[aria-roledescription="flowchart-v2"]')
        await svg.waitFor({ state: 'visible' })
        const labels = (await svg.locator('g.node').allTextContents()).map(label => label.trim())
        const edges = await svg.locator('path.flowchart-link').count()
        assert.deepEqual(labels, ['Synthetic start', 'Synthetic end'])
        assert.equal(edges, 1)
        return { labels, edges, iframeWidth: (await page.locator(selector).boundingBox())?.width ?? 0 }
      }
      await iframeInline.scrollIntoViewIfNeeded()
      assert.equal(await iframeInline.getAttribute('src'), mermaidPage)
      assert.equal(await iframeInline.getAttribute('sandbox'), 'allow-scripts allow-popups')
      await iframeInline.evaluate(node => { window.__mermaidFixtureIframe = node })
      const inline = await readDiagram(iframe)
      assert(inline.iframeWidth > 0)
      await trigger.click()
      await dialog.waitFor()
      const expanded = await readDiagram(expandedIframe)
      assert(expanded.iframeWidth > inline.iframeWidth, 'The fullscreen iframe did not gain visible width')
      assert(await page.locator(expandedIframe).evaluate(node => node === window.__mermaidFixtureIframe))
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      const focusRestored = await trigger.evaluate(node => node === document.activeElement)
      assert(focusRestored, 'Mermaid fullscreen did not restore trigger focus')
      const restored = await readDiagram(iframe)
      const iframeElementStable = await iframeInline.evaluate(node => node === window.__mermaidFixtureIframe)
      assert(iframeElementStable, 'Fullscreen replaced the production iframe element')
      assert(mermaidRequestCounts.document >= 1 && mermaidRequestCounts.script >= 1, 'The real local Mermaid script was not loaded')
      // Reparenting can reload the frame document. The proof is real diagram
      // rendering in all three states and iframe element—not document—identity.
      report.mermaid = { version: mermaidVersion, inline, expanded, restored, iframeElementStable, focusRestored, requests: mermaidRequestCounts }
    })
    report.evidence = await page.evaluate(() => ({
      mounts: window.__mcpEngines.mounts, unmounts: window.__mcpEngines.unmounts,
      citations: window.__mcpEngines.citations, chartInstanceId: window.__mcpEngines.chartInstanceId(),
      chartInstanceStable: window.__mcpEngines.chartInstanceId() === window.__engineChartId,
      mapInstanceStable: window.__engineIdentity.map.map._leaflet_id === window.__engineIdentity.map.mapId,
      chartCanvasCount: document.querySelectorAll('#engine-chart canvas').length,
      graphCanvasCount: document.querySelectorAll('#engine-graph canvas').length,
      graphLayerIdentityStable: Array.from(document.querySelectorAll('#engine-graph canvas')).length === window.__engineIdentity.graph.canvases.length &&
        Array.from(document.querySelectorAll('#engine-graph canvas')).every((canvas, index) => canvas === window.__engineIdentity.graph.canvases[index]),
      nativeMapMarkers: document.querySelectorAll('#engine-map .leaflet-marker-icon').length,
      highlightedKeywords: document.querySelectorAll('#engine-code .hljs-keyword').length,
      keyListeners: window.__mcpBrowserEvidence.keyListeners.size,
    }))
    assert(report.evidence.chartInstanceStable, 'Chart.js instance changed after fullscreen cycles')
    assert(report.evidence.mapInstanceStable, 'Leaflet instance changed after fullscreen cycles')
    assert(report.evidence.graphLayerIdentityStable, 'A G6 canvas layer changed after fullscreen cycles')
    assert(report.syntheticAssetRequests.some(url => url.includes('/__fixture/engine-tiles/')), 'Fixture did not exercise Leaflet tiles')
    report.status = 'passed'
    return report
  } catch (error) {
    report.status = 'failed'; report.failure = error.stack || String(error)
    try { report.failureReadinessSnapshot = await readinessSnapshot(page) }
    catch (snapshotError) { report.failureReadinessSnapshot = { error: String(snapshotError) } }
    throw error
  } finally {
    await page.screenshot({ path: resolve(resultDir, `${mode}-engines-browser.png`), fullPage: true }).catch(() => {})
    await writeFile(resolve(resultDir, `${mode}-engines-browser.json`), JSON.stringify(report, null, 2) + '\n')
    await page.unroute('**/*', routeAssets)
  }
}
