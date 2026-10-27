import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateReleaseContext, validateStableRelease } from './verify.mjs'

const manifest = (name, version, extra = {}) => ({ name, version, ...extra })
const solid = (version = '7.0.0', peer = '^1.9.0', sections = {}) => manifest('@seed-ship/mcp-ui-solid', version, {
  ...sections, peerDependencies: { 'solid-js': peer, ...sections.peerDependencies },
})
const spec = version => manifest('@seed-ship/mcp-ui-spec', version)
const cli = version => manifest('@seed-ship/mcp-ui-cli', version)
const release = (overrides = {}) => ({
  solid: solid(), spec: spec('6.0.0'), cli: cli('5.0.2'), ...overrides,
})
const ROOT_WORKSPACE = { name: '@mcp-ui/root', devDependencies: { typescript: '^5.3.3' }, pnpm: { overrides: {
  lodash: '>=4.17.23', '@isaacs/brace-expansion': '>=5.0.1', 'brace-expansion': '^5.0.12',
  minimatch: '>=10.2.1', postcss: '^8.5.23', 'fast-uri': '^3.1.9', 'js-yaml': '^4.3.2',
  seroval: '~1.6.8', 'source-map-js': '^1.2.2', '@babel/core': '^7.29.6', ws: '^8.21.0', fflate: '^0.8.3',
} } }

test('accepts stable Solid 7 releases with independent stable Spec and CLI versions', () => {
  for (const version of ['7.0.0', '7.1.0', '7.1.1']) {
    assert.deepEqual(validateStableRelease(release({ solid: solid(version) })), {
      solid: version, spec: '6.0.0', cli: '5.0.2',
    })
  }
})

test('rejects Solid 8 stable and prerelease releases, and prerelease Solid 7', () => {
  for (const version of ['8.0.0', '8.0.0-solid2.0', '7.2.0-solid2.0']) {
    assert.throws(() => validateStableRelease(release({ solid: solid(version) })), /canonical stable semver|stable major 7/)
  }
})

test('requires a canonical Solid 1 peer range and rejects Solid 2 or mixed ranges', () => {
  for (const peer of ['^2.0.0', '^1.9.0 || ^2.0.0', '>=1.9.0 <3', '~1.9.0', '1.9.0']) {
    assert.throws(() => validateStableRelease(release({ solid: solid('7.0.0', peer) })), /solid-js peer/)
  }
})

test('rejects Solid 2 runtime and compiler packages from every dependency section', () => {
  for (const [section, name] of [
    ['dependencies', 'solid-js/web'],
    ['dependencies', 'solid-js'],
    ['devDependencies', '@solidjs/signals'],
    ['peerDependencies', '@solidjs/compiler'],
    ['optionalDependencies', '@solidjs/vite-plugin'],
    ['dependencies', '@solidjs/babel-preset'],
  ]) {
    const candidate = solid('7.0.0', '^1.9.0', { [section]: { [name]: '^2.0.0' } })
    assert.throws(() => validateStableRelease(release({ solid: candidate })), /Solid 2 runtime\/toolchain package/)
  }
})

test('rejects npm aliases that smuggle a Solid 2 package under another dependency name', () => {
  const candidate = solid('7.0.0', '^1.9.0', { dependencies: { runtime: 'npm:solid-js@^2.0.0' } })
  assert.throws(() => validateStableRelease(release({ solid: candidate })), /Solid 2 runtime\/toolchain package/)
})

test('rejects the real @solidjs/web package, direct or aliased, in every dependency section', () => {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const entry of [
      { '@solidjs/web': '2.0.0-rc.19' },
      { webRuntime: 'npm:@solidjs/web@2.0.0-rc.19' },
    ]) {
      const candidate = solid('7.0.0', '^1.9.0', { [section]: entry })
      assert.throws(() => validateStableRelease(release({ solid: candidate })),
        /Solid 2 runtime\/toolchain package/, `${section}: ${Object.keys(entry)[0]}`)
    }
  }
})

test('accepts current unrelated root override floors with a stable Solid 7 workspace', () => {
  assert.deepEqual(validateStableRelease(release({ workspace: ROOT_WORKSPACE })),
    { solid: '7.0.0', spec: '6.0.0', cli: '5.0.2' })
})

test('rejects root overrides targeting Solid, including versioned and parent selectors or aliases', () => {
  for (const [selector, replacement] of [
    ['solid-js', '2.0.0-rc.19'],
    ['solid-js@^1.9.0', '1.9.17'],
    ['some-package>solid-js', '2.0.0-rc.19'],
    ['solid-js>seroval', '~1.6.8'],
    ['@solidjs/web', '2.0.0-rc.19'],
    ['@solidjs/signals@2.0.0-rc.19', '2.0.0-rc.19'],
    ['@solidjs/compiler', '2.0.0-rc.19'],
    ['@solidjs/babel-plugin', '2.0.0-rc.19'],
    ['@solidjs/vite-plugin', '3.0.0-next.51'],
    ['unrelated-runtime', 'npm:solid-js@2.0.0-rc.19'],
    ['unrelated-web', 'npm:@solidjs/web@2.0.0-rc.19'],
  ]) {
    const workspace = { ...ROOT_WORKSPACE, pnpm: { overrides: { ...ROOT_WORKSPACE.pnpm.overrides, [selector]: replacement } } }
    assert.throws(() => validateStableRelease(release({ workspace })),
      /Solid (?:2 runtime\/toolchain package|runtime\/toolchain override) is forbidden/, selector)
  }
})

test('rejects Solid 2 direct dependencies at the workspace root', () => {
  for (const [section, entry] of [
    ['dependencies', { 'solid-js': '2.0.0-rc.19' }],
    ['devDependencies', { 'solid-js': '2.0.0-rc.19' }],
    ['devDependencies', { '@solidjs/web': '2.0.0-rc.19' }],
  ]) {
    const workspace = { ...ROOT_WORKSPACE, [section]: entry }
    assert.throws(() => validateStableRelease(release({ workspace })), /Solid 2 runtime\/toolchain package/)
  }
})

test('tag pushes may release independently versioned Solid, Spec or CLI; manual dispatch stays on main', () => {
  const versions = validateStableRelease(release())
  for (const version of ['7.0.0', '6.0.0', '5.0.2']) {
    assert.deepEqual(validateReleaseContext({ eventName: 'push', ref: `refs/tags/v${version}` }, versions),
      { eventName: 'push', ref: `refs/tags/v${version}`, version })
  }
  assert.deepEqual(validateReleaseContext({ eventName: 'workflow_dispatch', ref: 'refs/heads/main' }, versions),
    { eventName: 'workflow_dispatch', ref: 'refs/heads/main' })
})

test('release context rejects preview, build, noncanonical, unrelated and nonrelease refs/events', () => {
  const versions = validateStableRelease(release())
  for (const context of [
    { eventName: 'push', ref: 'refs/tags/v8.0.0-solid2.0' },
    { eventName: 'push', ref: 'refs/tags/v7.0.0+build.1' },
    { eventName: 'push', ref: 'refs/tags/v07.0.0' },
    { eventName: 'push', ref: 'refs/tags/v7.1.0' },
    { eventName: 'push', ref: 'refs/heads/main' },
    { eventName: 'workflow_dispatch', ref: 'refs/heads/feat/solid2-preview' },
    { eventName: 'workflow_dispatch', ref: 'refs/tags/v7.0.0' },
    { eventName: 'pull_request', ref: 'refs/heads/main' },
  ]) assert.throws(() => validateReleaseContext(context, versions), undefined, JSON.stringify(context))
})

test('hosted CLI enforces release context while ordinary local invocation remains available', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'mcpui-stable-release-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const fixtures = release()
  for (const [directory, value] of [
    ['mcp-ui-solid', fixtures.solid], ['mcp-ui-spec', fixtures.spec], ['mcp-ui-cli', fixtures.cli],
  ]) {
    await mkdir(join(root, directory))
    await writeFile(join(root, directory, 'package.json'), JSON.stringify(value))
  }
  await writeFile(join(root, 'package.json'), JSON.stringify(ROOT_WORKSPACE))
  const run = overrides => spawnSync(process.execPath, [new URL('./verify.mjs', import.meta.url).pathname, root], {
    env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v7.0.0', ...overrides },
    encoding: 'utf8', timeout: 5000,
  })
  const valid = run({})
  assert.equal(valid.error, undefined)
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(JSON.parse(valid.stdout).solid, '7.0.0')
  for (const overrides of [
    { GITHUB_REF: 'refs/tags/v8.0.0-solid2.0' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/feat/solid2-preview' },
  ]) assert.notEqual(run(overrides).status, 0)
  assert.equal(run({ GITHUB_ACTIONS: 'false', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v8.0.0-solid2.0' }).status, 0)
  const unsafeRoot = { ...ROOT_WORKSPACE, pnpm: { overrides: { ...ROOT_WORKSPACE.pnpm.overrides, 'solid-js': '2.0.0-rc.19' } } }
  await writeFile(join(root, 'package.json'), JSON.stringify(unsafeRoot))
  assert.notEqual(run({}).status, 0, 'Hosted CLI must reject a root override before installation')
})

test('stable publish and release workflows run the guard before their first install', async () => {
  for (const name of ['publish', 'release']) {
    const workflow = await readFile(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8')
    const guard = workflow.indexOf('run: node scripts/stable-release/verify.mjs')
    const install = workflow.search(/^\s*run: (?:pnpm|npm) install\b/m)
    assert(guard >= 0 && install >= 0 && guard < install, `${name}.yml must guard before install`)
  }
})

test('CI includes stable release guard tests before dependency installation', async () => {
  const ci = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const guard = ci.search(/^\s*run: node --test [^\r\n]*scripts\/stable-release\/verify\.test\.mjs/m)
  const install = ci.search(/^\s*run: pnpm install\b/m)
  assert(guard >= 0 && install >= 0 && guard < install, 'CI must test stable release policy before install')
})

test('requires the expected package names and independent stable Spec and CLI versions', () => {
  assert.throws(() => validateStableRelease(release({ spec: spec('6.1.0-beta.1') })), /canonical stable semver/)
  assert.throws(() => validateStableRelease(release({ cli: cli('5.1.0-rc.1') })), /canonical stable semver/)
  assert.throws(() => validateStableRelease(release({ spec: manifest('@seed-ship/other', '6.0.0') })), /package name mismatch/)
  assert.throws(() => validateStableRelease(release({ cli: manifest('@seed-ship/other', '5.0.2') })), /package name mismatch/)
})
