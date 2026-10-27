/** Run from an independently installed consumer, never from this workspace. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { access, readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const consumer = process.cwd(), profile = process.argv[2] || 'full', name = '@seed-ship/mcp-ui-solid'
const req = createRequire(resolve(consumer, 'package.json'))
const packageRoot = await realpath(resolve(consumer, 'node_modules', name))
assert(packageRoot.startsWith((await realpath(consumer)) + sep), 'Package escaped clean consumer')
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
const report = { profile, packageRoot, version: manifest.version, entries: [], files: [], absentPeers: [], status: 'running' }
let failures = 0
const targets = value => typeof value === 'string' ? [value] : Object.values(value || {}).flatMap(targets)
for (const [entry, configuration] of Object.entries(manifest.exports)) {
  if (entry.includes('*')) continue
  for (const target of new Set(targets(configuration))) {
    try { await access(resolve(packageRoot, target)); report.files.push({ entry, target, exists: true }) }
    catch (error) { failures++; report.files.push({ entry, target, exists: false, error: error.message }) }
  }
  if (entry.endsWith('.css')) continue
  const specifier = name + (entry === '.' ? '' : entry.slice(1))
  for (const format of ['esm', 'cjs']) {
    try {
      const imported = format === 'esm' ? await import(specifier) : req(specifier)
      report.entries.push({ entry, format, status: 'passed', exports: Object.keys(imported).sort() })
    } catch (error) {
      const expected = profile === 'optional-absent' && entry === './plugins/katex' && /katex/.test(error.message) && ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code)
      if (!expected) failures++
      report.entries.push({ entry, format, status: expected ? 'expected-missing-optional-peer' : 'failed', code: error.code, error: error.stack || String(error) })
    }
  }
}
for (const target of ['src/index.ts', 'src/components/SafeHtml.tsx']) {
  try { await access(resolve(packageRoot, target)); report.files.push({ target, exists: true }) }
  catch (error) { failures++; report.files.push({ target, exists: false, error: error.message }) }
}
if (profile === 'optional-absent') {
  for (const [peer, metadata] of Object.entries(manifest.peerDependenciesMeta || {})) {
    if (!metadata.optional) continue
    try { const resolved = req.resolve(peer); failures++; report.absentPeers.push({ peer, absent: false, resolved }) }
    catch (error) {
      if (!['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) failures++
      report.absentPeers.push({ peer, absent: true, code: error.code })
    }
  }
}
report.status = failures ? 'failed' : 'passed'; report.failures = failures
await writeFile(resolve(consumer, 'import-probe-result.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ status: report.status, entries: report.entries.length, files: report.files.length, failures }, null, 2))
process.exitCode = failures ? 1 : 0
