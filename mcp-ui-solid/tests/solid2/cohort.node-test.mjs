/** Offline Solid 2 toolchain-cohort guard. Reads manifests and pnpm-lock only. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const solidRoot = resolve(repoRoot, 'mcp-ui-solid')
// Stable Solid 2 split cohort: the runtime ships as 2.0.4, but the compiler
// and Babel plugin were last published as 2.0.3 (no 2.0.4 exists on npm).
const runtimeCohort = ['solid-js', '@solidjs/web', '@solidjs/signals']
const toolchainCohort = ['@solidjs/compiler', '@solidjs/babel-plugin']
const cohort = [...runtimeCohort, ...toolchainCohort]
const pinFor = name => (toolchainCohort.includes(name) ? targetToolchain : targetRuntime)
const rc19 = '2.0.0-rc.19'
const rc20 = '2.0.0-rc.20'
const rc21 = '2.0.0-rc.21'
const staleStable = '2.0.0'
const targetRuntime = '2.0.4'
const targetToolchain = '2.0.3'
const nonexistentToolchain = '2.0.4'
const plugin = '@solidjs/vite-plugin'
const pluginVersion = '3.0.1'
const virtualCore = '@tanstack/virtual-core'
const virtualCoreVersion = '3.13.18'

function packageName(line) {
  const match = line.match(/^\s{6}(?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/)
  return match?.[1] ?? match?.[2] ?? match?.[3]?.trim()
}

/** Read the small, stable importer subset emitted by pnpm v6 lockfiles. */
function importerEntries(lockText, importer = 'mcp-ui-solid') {
  const lines = lockText.split(/\r?\n/)
  const start = lines.findIndex(line => line === `  ${importer}:`)
  assert.notEqual(start, -1, `pnpm lock importer missing: ${importer}`)
  let end = start + 1
  while (end < lines.length && !/^  [^\s#][^:]*:\s*$/.test(lines[end])) end++
  const result = new Map()
  let group
  for (let index = start + 1; index < end; index++) {
    const line = lines[index]
    const groupMatch = line.match(/^    (dependencies|devDependencies|optionalDependencies|peerDependencies):\s*$/)
    if (groupMatch) { group = groupMatch[1]; continue }
    if (/^    [^\s#][^:]*:\s*$/.test(line)) { group = undefined; continue }
    if (!group) continue
    const name = packageName(line)
    if (!name) continue
    const fields = {}
    for (let fieldIndex = index + 1; fieldIndex < end && /^        /.test(lines[fieldIndex]); fieldIndex++) {
      const field = lines[fieldIndex].match(/^        (specifier|version):\s*(.*?)\s*$/)
      if (field) fields[field[1]] = field[2].replace(/^['"]|['"]$/g, '')
    }
    if (!result.has(group)) result.set(group, new Map())
    result.get(group).set(name, fields)
  }
  return result
}

function allImporterResolutions(importers, name) {
  return [...importers.values()].map(entries => entries.get(name)).filter(Boolean)
}

function resolutionVersion(value) {
  return typeof value === 'string' ? value.split('(')[0] : undefined
}

/** Read package records without interpreting YAML beyond indentation/keys. */
function lockPackageRecords(lockText, name) {
  const lines = lockText.split(/\r?\n/)
  const prefix = `  /${name}@`
  const records = []
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index]
    if (!header.startsWith(prefix) || !header.endsWith(':')) continue
    const resolution = header.slice(prefix.length, -1)
    const version = resolutionVersion(resolution)
    let end = index + 1
    while (end < lines.length && !/^  \/[^\s]+:\s*$/.test(lines[end]) && !/^snapshots:\s*$/.test(lines[end])) end++
    const sections = new Map()
    let section
    for (let cursor = index + 1; cursor < end; cursor++) {
      const line = lines[cursor]
      const sectionMatch = line.match(/^    (dependencies|peerDependencies):\s*$/)
      if (sectionMatch) { section = sectionMatch[1]; sections.set(section, new Map()); continue }
      if (/^    [^\s#][^:]*:\s*$/.test(line)) { section = undefined; continue }
      if (!section) continue
      const nameMatch = line.match(/^      (?:'([^']+)'|"([^"]+)"|([^:]+)):\s*(.*?)\s*$/)
      if (nameMatch) sections.get(section).set(nameMatch[1] ?? nameMatch[2] ?? nameMatch[3].trim(), nameMatch[4].replace(/^['"]|['"]$/g, ''))
    }
    records.push({ resolution, version, sections })
  }
  return records
}

function versionsFor(lockText, name) {
  return new Set(lockPackageRecords(lockText, name).map(record => record.version))
}

function hasForcedOverride(object, sought) {
  if (!object || typeof object !== 'object') return false
  for (const [key, value] of Object.entries(object)) {
    if (['overrides', 'resolutions'].includes(key) && value && typeof value === 'object' && Object.hasOwn(value, sought)) return true
    if (key === 'pnpm' && value && typeof value === 'object' && hasForcedOverride({ overrides: value.overrides }, sought)) return true
  }
  return false
}

function lockOverrides(lockText) {
  const lines = lockText.split(/\r?\n/)
  const start = lines.findIndex(line => line === 'overrides:')
  if (start < 0) return new Set()
  const names = new Set()
  for (let index = start + 1; index < lines.length && !/^\S/.test(lines[index]); index++) {
    const match = lines[index].match(/^  (?:'([^']+)'|"([^"]+)"|([^:]+)):\s*/)
    if (match) names.add(match[1] ?? match[2] ?? match[3].trim())
  }
  return names
}

function assertSolid2Cohort({ producer, workspace, lockText }) {
  const peers = producer.peerDependencies ?? {}
  const peerMeta = producer.peerDependenciesMeta ?? {}
  const dev = producer.devDependencies ?? {}
  assert.equal(peers['solid-js'], targetRuntime, `solid-js must remain a required ${targetRuntime} peer`)
  assert.equal(peers['@solidjs/web'], targetRuntime, `@solidjs/web must remain a required ${targetRuntime} peer`)
  for (const name of ['solid-js', '@solidjs/web']) {
    assert.notEqual(peerMeta[name]?.optional, true, `${name} cannot be optional`)
    assert.equal(dev[name], targetRuntime, `${name} dev dependency must match its peer pin`)
  }
  assert.equal(dev['@solidjs/signals'], targetRuntime, `@solidjs/signals must use the same ${targetRuntime} runtime cohort`)
  for (const name of toolchainCohort) {
    assert.equal(dev[name], targetToolchain, `${name} must use the ${targetToolchain} toolchain cohort`)
  }
  assert.equal(dev[plugin], pluginVersion, `${plugin} must stay on the reviewed compatible plugin pin`)

  const deps = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
  for (const group of deps) {
    assert(!Object.hasOwn(producer[group] ?? {}, '@tanstack/solid-virtual'), `Solid 1 adapter is forbidden in ${group}`)
  }
  assert.equal(peers[virtualCore], virtualCoreVersion, 'The Solid 2 virtual-core peer pin must be preserved')
  assert(!hasForcedOverride(producer, '@tanstack/solid-virtual'), 'Solid 1 adapter cannot be forced by producer override')
  assert(!hasForcedOverride(workspace, '@tanstack/solid-virtual'), 'Solid 1 adapter cannot be forced by workspace override')
  assert(!hasForcedOverride(producer, 'seroval') && !hasForcedOverride(producer, 'seroval-plugins'), 'Seroval is renderer-owned; producer overrides are forbidden')
  assert(!hasForcedOverride(workspace, 'seroval') && !hasForcedOverride(workspace, 'seroval-plugins'), 'Workspace cannot force renderer Seroval versions')

  const importers = importerEntries(lockText)
  for (const name of cohort) {
    const locations = allImporterResolutions(importers, name)
    assert(locations.length > 0, `${name} missing from mcp-ui-solid lock importer`)
    const pin = pinFor(name)
    assert(locations.every(entry => resolutionVersion(entry.version) === pin), `${name} importer resolution is outside ${pin}`)
    assert.deepEqual(versionsFor(lockText, name), new Set([pin]), `${name} lock package versions must be one ${pin} cohort`)
  }
  const pluginResolutions = allImporterResolutions(importers, plugin)
  assert(pluginResolutions.length > 0, `${plugin} missing from mcp-ui-solid lock importer`)
  assert(pluginResolutions.every(entry => resolutionVersion(entry.version) === pluginVersion &&
    entry.version.includes(`(@solidjs/web@${targetRuntime})`) && entry.version.includes(`(solid-js@${targetRuntime})`)), `${plugin} lock resolution must bind to exact ${targetRuntime} runtime peers`)
  assert.deepEqual(versionsFor(lockText, plugin), new Set([pluginVersion]), `${plugin} lock version drifted`)
  const pluginRecords = lockPackageRecords(lockText, plugin)
  assert(pluginRecords.length > 0, `${plugin} package record missing from lock`)
  for (const record of pluginRecords) {
    const resolved = record.sections.get('dependencies')
    for (const name of ['@solidjs/babel-plugin', '@solidjs/compiler', '@solidjs/web', 'solid-js']) {
      assert.equal(resolutionVersion(resolved?.get(name)), pinFor(name), `${plugin} must resolve ${name} from the ${pinFor(name)} cohort`)
    }
  }
  const virtualResolutions = allImporterResolutions(importers, virtualCore)
  assert(virtualResolutions.length > 0 && virtualResolutions.every(entry => resolutionVersion(entry.version) === virtualCoreVersion), `${virtualCore} lock resolution changed`)
  assert.deepEqual(versionsFor(lockText, virtualCore), new Set([virtualCoreVersion]), `${virtualCore} lock package versions must stay pinned`)
  assert.equal(allImporterResolutions(importers, '@tanstack/solid-virtual').length, 0, 'Solid 1 adapter leaked into pnpm importer')
  assert(!lockOverrides(lockText).has('@tanstack/solid-virtual'), 'Lockfile cannot force the Solid 1 adapter')
  assert(!lockOverrides(lockText).has('seroval') && !lockOverrides(lockText).has('seroval-plugins'), 'Lockfile cannot force Seroval')

  const webRecords = lockPackageRecords(lockText, '@solidjs/web').filter(record => record.version === targetRuntime)
  assert(webRecords.length > 0, '@solidjs/web package record missing from lock')
  for (const web of webRecords) {
    const runtimeDeps = web.sections.get('dependencies')
    assert(runtimeDeps, '@solidjs/web must own its serialization dependencies')
    const serovalResolution = runtimeDeps.get('seroval')
    const pluginsResolution = runtimeDeps.get('seroval-plugins')
    const serovalVersion = resolutionVersion(serovalResolution)
    const pluginsVersion = resolutionVersion(pluginsResolution)
    assert(serovalVersion && pluginsVersion, '@solidjs/web lock record must declare both Seroval packages')
    assert(pluginsResolution.includes(`(seroval@${serovalVersion})`), 'seroval-plugins lock peer context must match web-owned seroval')
    assert(versionsFor(lockText, 'seroval').has(serovalVersion), 'web-owned seroval package is absent from lock')
    const pluginsRecord = lockPackageRecords(lockText, 'seroval-plugins').find(record => record.resolution === pluginsResolution)
    assert(pluginsRecord, 'web-owned seroval-plugins package context is absent from lock')
    assert.equal(resolutionVersion(pluginsRecord.sections.get('dependencies')?.get('seroval')), serovalVersion,
      'seroval-plugins must resolve the same seroval peer as Solid Web')
  }
  return true
}

function syntheticCase() {
  const producer = {
    peerDependencies: { 'solid-js': targetRuntime, '@solidjs/web': targetRuntime, [virtualCore]: virtualCoreVersion },
    devDependencies: { 'solid-js': targetRuntime, '@solidjs/web': targetRuntime, '@solidjs/signals': targetRuntime,
      '@solidjs/compiler': targetToolchain, '@solidjs/babel-plugin': targetToolchain, [plugin]: pluginVersion },
  }
  const workspace = {}
  const entries = [...cohort.map(name => `      '${name}':\n        specifier: ${pinFor(name)}\n        version: ${name === '@solidjs/web' ? `${targetRuntime}(solid-js@${targetRuntime})` : pinFor(name)}`),
    `      '${plugin}':\n        specifier: ${pluginVersion}\n        version: ${pluginVersion}(@solidjs/web@${targetRuntime})(solid-js@${targetRuntime})(vite@8.3.5)`,
    `      '${virtualCore}':\n        specifier: ${virtualCoreVersion}\n        version: ${virtualCoreVersion}`].join('\n')
  const packages = [...cohort.filter(name => name !== '@solidjs/web').map(name => `  /${name}@${pinFor(name)}:\n    resolution: {integrity: fixture}\n`),
    `  /${plugin}@${pluginVersion}(@solidjs/web@${targetRuntime})(solid-js@${targetRuntime})(vite@8.3.5):\n    resolution: {integrity: fixture}\n    dependencies:\n      '@solidjs/babel-plugin': ${targetToolchain}(@babel/core@7.29.7)\n      '@solidjs/compiler': ${targetToolchain}\n      '@solidjs/web': ${targetRuntime}(solid-js@${targetRuntime})\n      solid-js: ${targetRuntime}\n`,
    `  /${virtualCore}@${virtualCoreVersion}:\n    resolution: {integrity: fixture}\n`,
    `  /@solidjs/web@${targetRuntime}(solid-js@${targetRuntime}):\n    resolution: {integrity: fixture}\n    dependencies:\n      seroval: 99.1.0\n      seroval-plugins: 99.2.0(seroval@99.1.0)\n`,
    `  /seroval@99.1.0:\n    resolution: {integrity: fixture}\n`,
    `  /seroval-plugins@99.2.0(seroval@99.1.0):\n    resolution: {integrity: fixture}\n    dependencies:\n      seroval: 99.1.0\n`].join('\n')
  const lockText = `lockfileVersion: '6.0'\n\nimporters:\n  mcp-ui-solid:\n    dependencies:\n${entries}\n\npackages:\n${packages}\nsnapshots:\n`
  return { producer, workspace, lockText }
}

test('current producer and lockfile use one split Solid 2.0.4 runtime / 2.0.3 toolchain cohort and renderer-owned Seroval pair', async () => {
  const [producer, workspace, lockText] = await Promise.all([
    readFile(resolve(solidRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
  ])
  assertSolid2Cohort({ producer, workspace, lockText })
})

test('validator accepts a stable lock whose renderer-owned Seroval packages share a peer despite different package versions', () => {
  assert.equal(assertSolid2Cohort(syntheticCase()), true)
})

for (const rc of [rc19, rc20, rc21]) {
  test(`validator rejects a ${rc}/stable producer mixture`, () => {
    const input = syntheticCase()
    input.producer.devDependencies['@solidjs/compiler'] = rc
    assert.throws(() => assertSolid2Cohort(input), /@solidjs\/compiler must use the 2\.0\.3 toolchain cohort/)
  })
}

test('validator rejects an RC.20 compiler importer and a second RC.21 runtime record', () => {
  const lock = syntheticCase()
  const oldEntry = `'@solidjs/compiler':\n        specifier: ${targetToolchain}\n        version: ${targetToolchain}`
  const mixedEntry = `'@solidjs/compiler':\n        specifier: ${rc20}\n        version: ${rc20}`
  assert(lock.lockText.includes(oldEntry), 'Synthetic compiler importer entry missing')
  lock.lockText = lock.lockText.replace(oldEntry, mixedEntry)
  assert.throws(() => assertSolid2Cohort(lock), /@solidjs\/compiler importer resolution is outside 2\.0\.3/)
  const duplicate = syntheticCase()
  duplicate.lockText = duplicate.lockText.replace('snapshots:\n',
    `  /solid-js@${rc21}:\n    resolution: {integrity: fixture}\nsnapshots:\n`)
  assert.throws(() => assertSolid2Cohort(duplicate), /solid-js lock package versions must be one 2\.0\.4 cohort/)
})

test('validator rejects RC.21 peers in an otherwise stable Vite plugin importer', () => {
  const input = syntheticCase()
  for (const name of ['solid-js', '@solidjs/web']) {
    const stableContext = `(@solidjs/web@${targetRuntime})(solid-js@${targetRuntime})`
    const mixedContext = stableContext.replace(`${name}@${targetRuntime})`, `${name}@${rc21})`)
    const lockText = input.lockText.replace(stableContext, mixedContext)
    assert.notEqual(lockText, input.lockText, 'Synthetic plugin importer context missing')
    assert.throws(() => assertSolid2Cohort({ ...input, lockText }), /lock resolution must bind to exact 2\.0\.4 runtime peers/)
  }
})

test('validator rejects a Solid 1 virtual adapter even when the stable cohort is otherwise coherent', () => {
  const input = syntheticCase()
  input.producer.dependencies = { '@tanstack/solid-virtual': '^3.0.0' }
  assert.throws(() => assertSolid2Cohort(input), /Solid 1 adapter is forbidden/)
})

test('validator rejects an incoherent renderer-owned Seroval pair and forced override', () => {
  const input = syntheticCase()
  input.lockText = input.lockText.replace('seroval-plugins: 99.2.0(seroval@99.1.0)', 'seroval-plugins: 99.2.0(seroval@99.1.0-rc.1)')
  assert.throws(() => assertSolid2Cohort(input), /lock peer context must match web-owned seroval/)
  const missingContext = syntheticCase()
  missingContext.lockText = missingContext.lockText.replace('/seroval-plugins@99.2.0(seroval@99.1.0):', '/seroval-plugins@99.2.0(seroval@99.9.0):')
  assert.throws(() => assertSolid2Cohort(missingContext), /package context is absent from lock/)
  const mixedDependency = syntheticCase()
  const pluginRecord = '/seroval-plugins@99.2.0(seroval@99.1.0):\n    resolution: {integrity: fixture}\n    dependencies:\n      seroval: '
  assert(mixedDependency.lockText.includes(pluginRecord + '99.1.0'), 'Synthetic plugin record is missing')
  mixedDependency.lockText = mixedDependency.lockText.replace(pluginRecord + '99.1.0', pluginRecord + '99.9.0')
  assert.throws(() => assertSolid2Cohort(mixedDependency), /same seroval peer as Solid Web/)
  const override = syntheticCase()
  override.workspace = { pnpm: { overrides: { seroval: '1.0.0' } } }
  assert.throws(() => assertSolid2Cohort(override), /Workspace cannot force renderer Seroval/)
})

test('validator rejects a runtime/toolchain mismatch in either direction', () => {
  // Compiler/Babel plugin forced onto the runtime version (2.0.4 was never published for them).
  for (const name of toolchainCohort) {
    const input = syntheticCase()
    input.producer.devDependencies[name] = nonexistentToolchain
    assert.throws(() => assertSolid2Cohort(input), new RegExp(`${name.replace('/', '\\/')} must use the 2\\.0\\.3 toolchain cohort`))
  }
  // Runtime packages left behind on the previous stable 2.0.0 cohort.
  for (const name of ['solid-js', '@solidjs/web', '@solidjs/signals']) {
    const input = syntheticCase()
    input.producer.devDependencies[name] = staleStable
    assert.throws(() => assertSolid2Cohort(input), /dev dependency must match its peer pin|must use the same 2\.0\.4 runtime cohort/)
  }
  for (const name of ['solid-js', '@solidjs/web']) {
    const input = syntheticCase()
    input.producer.peerDependencies[name] = staleStable
    assert.throws(() => assertSolid2Cohort(input), /must remain a required 2\.0\.4 peer/)
  }
  // Lock side: a toolchain importer at the runtime version, and a runtime importer left on 2.0.0.
  const toolchainLock = syntheticCase()
  const toolchainEntry = `'@solidjs/babel-plugin':\n        specifier: ${targetToolchain}\n        version: ${targetToolchain}`
  assert(toolchainLock.lockText.includes(toolchainEntry), 'Synthetic babel-plugin importer entry missing')
  toolchainLock.lockText = toolchainLock.lockText.replace(toolchainEntry,
    `'@solidjs/babel-plugin':\n        specifier: ${nonexistentToolchain}\n        version: ${nonexistentToolchain}`)
  assert.throws(() => assertSolid2Cohort(toolchainLock), /@solidjs\/babel-plugin importer resolution is outside 2\.0\.3/)
  const runtimeLock = syntheticCase()
  const runtimeEntry = `'@solidjs/signals':\n        specifier: ${targetRuntime}\n        version: ${targetRuntime}`
  assert(runtimeLock.lockText.includes(runtimeEntry), 'Synthetic signals importer entry missing')
  runtimeLock.lockText = runtimeLock.lockText.replace(runtimeEntry,
    `'@solidjs/signals':\n        specifier: ${staleStable}\n        version: ${staleStable}`)
  assert.throws(() => assertSolid2Cohort(runtimeLock), /@solidjs\/signals importer resolution is outside 2\.0\.4/)
  // Vite plugin transitive resolution must keep the split: compiler 2.0.4 or web 2.0.0 are both rejected.
  const pluginCompiler = syntheticCase()
  pluginCompiler.lockText = pluginCompiler.lockText.replace(`'@solidjs/compiler': ${targetToolchain}\n      '@solidjs/web'`, `'@solidjs/compiler': ${nonexistentToolchain}\n      '@solidjs/web'`)
  assert.throws(() => assertSolid2Cohort(pluginCompiler), /vite-plugin must resolve @solidjs\/compiler from the 2\.0\.3 cohort/)
  const pluginWeb = syntheticCase()
  pluginWeb.lockText = pluginWeb.lockText.replace(`'@solidjs/web': ${targetRuntime}(solid-js@${targetRuntime})\n      solid-js: ${targetRuntime}\n`,
    `'@solidjs/web': ${staleStable}(solid-js@${staleStable})\n      solid-js: ${targetRuntime}\n`)
  assert.throws(() => assertSolid2Cohort(pluginWeb), /vite-plugin must resolve @solidjs\/web from the 2\.0\.4 cohort/)
})
