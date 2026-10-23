import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  POLICY,
  assertLatestUnchanged,
  validateRequest,
  validateSource,
  verifyQualification,
  verifyTarball,
} from './verify.mjs';

const SOURCE_SHA = '271e92434696f14ba0fdaaa3e91b242819820a16';
const TARBALL_SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const PACKAGE = '@seed-ship/mcp-ui-solid';
const VERSION = '7.0.0-solid2.0';
const PUBLIC_ENTRIES = {
  '.': 'index', './components': 'components', './hooks': 'hooks', './types': 'types',
  './validation': 'validation', './types-only': 'types-export', './adapters': 'adapters',
  './adapters/presentation': 'adapters/presentation', './plugins/duckdb': 'plugins/duckdb', './plugins/katex': 'plugins/katex',
};
const OPTIONAL_PEERS = ['@antv/g6', '@duckdb/duckdb-wasm', '@tanstack/virtual-core', 'chart.js', 'chartjs-plugin-zoom', 'highlight.js', 'katex', 'leaflet', 'leaflet.markercluster', 'protomaps-leaflet'];

function request(overrides = {}) {
  return {
    sourceSha: SOURCE_SHA,
    ciRunId: '123456',
    artifactId: '654321',
    tarballSha256: TARBALL_SHA,
    repository: 'theseedship/mcp-ui',
    ref: 'refs/heads/main',
    eventName: 'workflow_dispatch',
    stage: false,
    approval: '',
    ...overrides,
  };
}

function source() {
  const head = { ref: 'feat/solid2-preview', sha: SOURCE_SHA };
  const repo = { full_name: 'theseedship/mcp-ui' };
  return {
    run: {
      id: 123456,
      head_sha: SOURCE_SHA,
      head_branch: head.ref,
      event: 'pull_request',
      status: 'completed',
      conclusion: 'success',
      run_attempt: 1,
      run_started_at: '2026-10-23T20:00:00Z',
      path: '.github/workflows/ci.yml',
      repository: { ...repo },
      head_repository: { ...repo },
      pull_requests: [{ number: 34, head: { ...head }, base: { ref: 'main' } }],
    },
    pull: {
      number: 34,
      state: 'open',
      draft: false,
      head: { ...head, repo: { ...repo } },
      base: { ref: 'main', repo: { ...repo } },
    },
    artifact: {
      id: 654321,
      name: 'solid2-preview-qualification',
      expired: false,
      created_at: '2026-10-23T20:05:00Z',
      workflow_run: { id: 123456, head_sha: SOURCE_SHA, head_branch: head.ref },
    },
  };
}

function manifest(overrides = {}) {
  return {
    name: PACKAGE,
    version: VERSION,
    type: 'module',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { solid: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs' } },
    peerDependencies: { 'solid-js': '2.0.0-rc.18', '@solidjs/web': '2.0.0-rc.18' },
    dependencies: { '@seed-ship/mcp-ui-spec': '^5.7.0' },
    ...overrides,
  };
}

// Construct real ustar bytes, including hostile names which tar CLIs may sanitize.
// Nothing from these fixtures is ever extracted or executed.
function tarEntry({ name, body = '', type = '0', link = '' }) {
  const data = Buffer.from(body);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100);
  header.write('0000644\0', 100, 8);
  header.write('0000000\0', 108, 8);
  header.write('0000000\0', 116, 8);
  header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 12);
  header.write('00000000000\0', 136, 12);
  header.fill(32, 148, 156);
  header.write(type, 156, 1);
  header.write(link, 157, 100);
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), 'mcpui-preview-verify-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function archive(t, { packageJson = manifest(), extra = [] } = {}) {
  const dir = await temp(t);
  const entries = [
    { name: 'package/package.json', body: JSON.stringify(packageJson) },
    { name: 'package/dist/index.js', body: 'export const fixture = true;' },
    { name: 'package/dist/index.cjs', body: 'exports.fixture = true;' },
    { name: 'package/dist/index.d.ts', body: 'export declare const fixture: boolean;' },
    { name: 'package/src/index.ts', body: 'export const fixture = true;' },
    ...extra,
  ];
  const bytes = gzipSync(Buffer.concat([...entries.map(tarEntry), Buffer.alloc(1024)]));
  const file = join(dir, 'preview.tgz');
  await writeFile(file, bytes);
  return { file, sha: createHash('sha256').update(bytes).digest('hex') };
}

function mode(profile, compiled = false) {
  return {
    status: 'passed',
    errors: [],
    pageErrors: [],
    diagnostics: [],
    console: [],
    externalRequests: [],
    ...(profile === 'full' ? { engines: { status: 'passed', errors: [] } } : {}),
    ...(compiled ? { compiledModules: ['/fixture/node_modules/@seed-ship/mcp-ui-solid/dist/index.js'] } : {}),
  };
}

function report(profile) {
  return {
    status: 'passed',
    version: VERSION,
    input: { profile, tarball: { sha256: TARBALL_SHA } },
    modes: { dev: mode(profile), production: mode(profile) },
  };
}

async function json(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

function probe(profile) {
  return {
    status: 'passed', version: VERSION, profile, failures: 0,
    entries: Object.keys(PUBLIC_ENTRIES).flatMap((entry) => ['esm', 'cjs'].map((format) => ({
      entry, format,
      ...(profile === 'optional-absent' && entry === './plugins/katex'
        ? { status: 'expected-missing-optional-peer', code: 'MODULE_NOT_FOUND', error: 'Cannot find module katex' }
        : { status: 'passed' }),
    }))),
    files: Object.entries(PUBLIC_ENTRIES).flatMap(([entry, stem]) => {
      const source = ['components', 'hooks', 'types', 'adapters'].includes(stem) ? `${stem}/index` : stem;
      return [`./src/${source}.ts`, ...['.d.ts', '.d.cts', '.js', '.cjs'].map((ext) => `./dist/${stem}${ext}`),
        `./dist/server/${stem}.js`, `./dist/server/${stem}.cjs`].map((target) => ({ entry, target, exists: true }));
    }).concat(['src/index.ts', 'src/components/SafeHtml.tsx'].map((target) => ({ target, exists: true }))),
    absentPeers: profile === 'full' ? [] : OPTIONAL_PEERS.map((peer) => ({ peer, absent: true, code: 'MODULE_NOT_FOUND' })),
  };
}

async function qualification(t, change = () => {}) {
  const dir = await temp(t);
  const evidence = {
    full: report('full'),
    absent: report('optional-absent'),
    compiled: {
      status: 'passed',
      tarball: { sha256: TARBALL_SHA },
      publicDefaults: Object.fromEntries(Object.entries(PUBLIC_ENTRIES).map(([entry, stem]) => [entry, `./dist/${stem}.js`])),
      modes: { dev: mode('full', true), production: mode('full', true) },
    },
  };
  change(evidence);
  for (const [key, profile] of [['full', 'full'], ['absent', 'optional-absent']]) {
    if (!evidence[key]) continue;
    const consumer = join(dir, `mcpui-solid2-${profile}`);
    await json(join(consumer, 'qualification-results', 'fixture', 'report.json'), evidence[key]);
    await json(join(consumer, 'qualification-input.json'), evidence[key].input);
    await json(join(consumer, 'import-probe-result.json'), probe(profile));
    await writeFile(join(consumer, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  }
  if (evidence.compiled) {
    await json(join(dir, 'mcpui-solid2-full', 'dist-client-probe', 'fixture', 'report.json'), evidence.compiled);
  }
  return dir;
}

test('policy fixes one package, prerelease, source PR and non-latest channel', () => {
  assert.equal(POLICY.repository, 'theseedship/mcp-ui');
  assert.equal(POLICY.sourcePr, 34);
  assert.equal(POLICY.sourceBranch, 'feat/solid2-preview');
  assert.equal(POLICY.packageName, PACKAGE);
  assert.equal(POLICY.version, VERSION);
  assert.equal(POLICY.tag, 'solid2');
  assert.notEqual(POLICY.tag, 'latest');
});

test('accepts a fully pinned main manual request; CLI rejects unsafe input before metadata/API access', () => {
  const result = validateRequest(request());
  for (const [key, expected] of Object.entries(request())) assert.equal(result[key], expected);
  const env = {
    SOURCE_SHA, CI_RUN_ID: '123456', ARTIFACT_ID: '654321', TARBALL_SHA256: TARBALL_SHA,
    GITHUB_REPOSITORY: 'theseedship/mcp-ui', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
    STAGE: 'false',
  };
  const cli = (overrides) => spawnSync(process.execPath, [new URL('./verify.mjs', import.meta.url).pathname, 'request'], {
    env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000,
  });
  const valid = cli({});
  assert.equal(valid.error, undefined);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).sourceSha, SOURCE_SHA);
  for (const invalid of [{ GITHUB_REF: 'refs/heads/unsafe' }, { STAGE: 'true' }, { STAGE: 'yes' }]) {
    const failed = cli(invalid);
    assert.equal(failed.error, undefined);
    assert.notEqual(failed.status, 0);
  }
});

test('staging requires explicit approval bound to the package, source, bytes and non-latest channel', () => {
  const approval = `STAGE ${PACKAGE}@${VERSION} FROM ${SOURCE_SHA} SHA256 ${TARBALL_SHA} AS solid2`;
  assert.doesNotThrow(() => validateRequest(request({ stage: true, approval })));
  for (const invalid of ['', approval.replace(SOURCE_SHA, 'c'.repeat(40)), approval.replace('AS solid2', 'AS latest')]) {
    assert.throws(() => validateRequest(request({ stage: true, approval: invalid })));
  }
});

for (const [name, overrides] of [
  ['wrong repository or untrusted fork', { repository: 'attacker/mcp-ui' }],
  ['non-main workflow ref', { ref: 'refs/heads/feat/solid2-preview' }],
  ['automatic or pull-request event', { eventName: 'pull_request' }],
  ['noncanonical source SHA', { sourceSha: '271e924' }],
  ['nonpositive artifact ID', { artifactId: '0' }],
]) {
  test(`request rejects ${name}`, () => assert.throws(() => validateRequest(request(overrides))));
}

test('request rejects malformed artifact digests and CI IDs independently', () => {
  for (const overrides of [{ tarballSha256: 'xyz' }, { ciRunId: '12; echo unsafe' }]) {
    assert.throws(() => validateRequest(request(overrides)));
  }
});

test('binds successful CI, current PR head, first attempt and artifact chronology', () => {
  assert.doesNotThrow(() => validateSource(source(), request()));
  for (const mutate of [
    (s) => { s.run.run_attempt = 2; },
    (s) => { s.artifact.created_at = '2026-10-23T19:00:00Z'; },
    (s) => { s.artifact.workflow_run.head_sha = 'c'.repeat(40); },
  ]) {
    const value = source();
    mutate(value);
    assert.throws(() => validateSource(value, request()));
  }
});

for (const [name, mutate] of [
  ['failed CI', (s) => { s.run.conclusion = 'failure'; }],
  ['another workflow', (s) => { s.run.path = '.github/workflows/release.yml'; }],
  ['forked CI head', (s) => { s.run.head_repository.full_name = 'attacker/mcp-ui'; }],
  ['PR advanced since qualification', (s) => { s.pull.head.sha = 'c'.repeat(40); }],
  ['another PR', (s) => { s.pull.number = 35; }],
  ['expired artifact', (s) => { s.artifact.expired = true; }],
  ['artifact from another run', (s) => { s.artifact.workflow_run.id = 987654; }],
]) {
  test(`source rejects ${name}`, () => {
    const value = source();
    mutate(value);
    assert.throws(() => validateSource(value, request()));
  });
}

test('draft PR is reviewable without staging but cannot be staged', () => {
  const value = source();
  value.pull.draft = true;
  assert.doesNotThrow(() => validateSource(value, request()));
  const staged = request({
    stage: true,
    approval: `STAGE ${PACKAGE}@${VERSION} FROM ${SOURCE_SHA} SHA256 ${TARBALL_SHA} AS solid2`,
  });
  assert.doesNotThrow(() => validateSource(source(), staged));
  assert.throws(() => validateSource(value, staged));
  delete value.pull.draft;
  assert.throws(() => validateSource(value, staged));
});

test('verifies the exact gzip tar bytes and returns the fixed package identity', async (t) => {
  const { file, sha } = await archive(t);
  const result = await verifyTarball(file, sha);
  assert.equal(result.name, PACKAGE);
  assert.equal(result.version, VERSION);
  assert.equal(result.sha256, sha);
});

test('rejects a correctly formed archive with the wrong expected digest', async (t) => {
  const { file } = await archive(t);
  await assert.rejects(() => verifyTarball(file, OTHER_SHA));
});

for (const [name, entry] of [
  ['parent traversal', { name: 'package/../../escape', body: 'unsafe' }],
  ['absolute path', { name: '/tmp/escape', body: 'unsafe' }],
  ['duplicate package manifest', { name: 'package/package.json', body: JSON.stringify(manifest({ name: 'attacker' })) }],
]) {
  test(`archive rejects ${name} even when its digest is correct`, async (t) => {
    const { file, sha } = await archive(t, { extra: [entry] });
    await assert.rejects(() => verifyTarball(file, sha));
  });
}

test('archive rejects both symbolic and hard links with correct digests', async (t) => {
  for (const type of ['1', '2']) {
    const { file, sha } = await archive(t, { extra: [{ name: 'package/link', type, link: 'package/package.json' }] });
    await assert.rejects(() => verifyTarball(file, sha));
  }
});

for (const [name, packageJson] of [
  ['wrong package', manifest({ name: '@seed-ship/mcp-ui-spec' })],
  ['stable or different version', manifest({ version: '6.25.1' })],
  ['Solid1 peer', manifest({ peerDependencies: { 'solid-js': '^1.9.0', '@solidjs/web': '2.0.0-rc.18' } })],
  ['workspace runtime dependency', manifest({ dependencies: { '@seed-ship/mcp-ui-spec': 'workspace:^5.7.0' } })],
  ['publishConfig latest override', manifest({ publishConfig: { tag: 'latest' } })],
  ['foreign registry override', manifest({ publishConfig: { registry: 'https://registry.attacker.invalid' } })],
]) {
  test(`manifest rejects ${name}`, async (t) => {
    const { file, sha } = await archive(t, { packageJson });
    await assert.rejects(() => verifyTarball(file, sha));
  });
}

test('requires successful source and compiled-browser qualification of the same archive', async (t) => {
  await verifyQualification(await qualification(t), TARBALL_SHA);
});

for (const [name, mutate] of [
  ['missing optional-absent profile', (e) => { delete e.absent; }],
  ['failed production source mode', (e) => { e.full.modes.production.status = 'failed'; }],
  ['source report bound to different archive', (e) => { e.absent.input.tarball.sha256 = OTHER_SHA; }],
  ['missing real engine qualification', (e) => { delete e.full.modes.dev.engines; }],
  ['missing compiled-browser report', (e) => { delete e.compiled; }],
  ['compiled-browser diagnostic', (e) => { e.compiled.modes.production.diagnostics = ['STRICT_READ_UNTRACKED']; }],
  ['compiled-browser source substitution', (e) => { e.compiled.modes.dev.compiledModules = ['/fixture/src/index.ts']; }],
]) {
  test(`qualification rejects ${name}`, async (t) => {
    const dir = await qualification(t, mutate);
    await assert.rejects(() => verifyQualification(dir, TARBALL_SHA));
  });
}

test('qualification does not follow evidence symlinks outside its directory', async (t) => {
  const dir = await qualification(t);
  await symlink('/etc/passwd', join(dir, 'escaped-report.json'));
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA));
});

for (const missing of ['qualification-input.json', 'import-probe-result.json', 'pnpm-lock.yaml']) {
  test(`qualification rejects a missing ${missing} even with passed browser reports`, async (t) => {
    const dir = await qualification(t);
    await rm(join(dir, 'mcpui-solid2-full', missing));
    await assert.rejects(() => verifyQualification(dir, TARBALL_SHA));
  });
}

test('compiled proof rejects forged ten-key exports rather than trusting their count', async (t) => {
  const dir = await qualification(t, (e) => {
    delete e.compiled.publicDefaults['./types-only'];
    e.compiled.publicDefaults['./forged-entry'] = './dist/types-export.js';
  });
  await assert.rejects(() => verifyQualification(dir, TARBALL_SHA));
});

test('preview workflow is manual/main-only and never checks out untrusted source', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/publish-solid2-preview.yml', import.meta.url), 'utf8');
  const triggerBlock = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1];
  assert.ok(triggerBlock, 'Explicit workflow triggers are required');
  assert.deepEqual([...triggerBlock.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1]), ['workflow_dispatch']);
  assert.match(triggerBlock, /stage:\n[\s\S]*?type: boolean\n\s+default: false/);
  const checkouts = workflow.split(/(?=^      - )/m).filter((block) => /uses: actions\/checkout@/.test(block));
  assert.equal(checkouts.length, 2);
  for (const block of checkouts) {
    assert.match(block, /ref: \$\{\{ github\.sha \}\}/);
    assert.match(block, /persist-credentials: false/);
    assert.doesNotMatch(block, /inputs\.source_sha|SOURCE_SHA/);
  }
  assert.equal((workflow.match(/if: .*github\.repository == 'theseedship\/mcp-ui' && github\.ref == 'refs\/heads\/main'/g) || []).length, 2);
  assert.ok(workflow.indexOf('verify.mjs request') < workflow.indexOf('gh api '), 'Validate inputs before constructing API paths');
  assert.doesNotMatch(workflow, /\bnpm publish\b|\bnpm dist-tag\b|\bnpm stage approve\b/);
});

test('only the protected stage step receives the npm token, with fixed bytes/tag and script/config guards', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/publish-solid2-preview.yml', import.meta.url), 'utf8');
  const blocks = workflow.split(/(?=^      - )/m);
  const tokenBlocks = blocks.filter((block) => /NODE_AUTH_TOKEN|secrets\.NPM_TOKEN/.test(block));
  assert.equal(tokenBlocks.length, 1);
  const stage = tokenBlocks[0];
  assert.equal((workflow.match(/^\s+NODE_AUTH_TOKEN:/gm) || []).length, 1);
  assert.equal((workflow.match(/npm stage publish /g) || []).length, 1);
  assert.match(workflow, /environment: npm-solid2-preview/);
  assert.match(workflow, /if: inputs\.stage && github\.repository/);
  assert.match(stage, /working-directory: \$\{\{ runner\.temp \}\}\/solid2-stage-empty/);
  assert.match(stage, /NPM_CONFIG_IGNORE_SCRIPTS: 'true'/);
  assert.match(stage, /NPM_CONFIG_GLOBALCONFIG: \/dev\/null/);
  assert.match(stage, /npm stage publish "\$RUNNER_TEMP\/solid2-reviewed\/seed-ship-mcp-ui-solid-7\.0\.0-solid2\.0\.tgz" --access public --tag solid2 --ignore-scripts --registry=https:\/\/registry\.npmjs\.org --json/);
  assert.doesNotMatch(stage, /--tag\s+["']?\$|\bnpm (?:install|ci|run|exec)\b|\bpnpm\b/);
  const latestGuard = blocks.find((block) => block.includes('Verify latest even when the staging command failed'));
  assert.ok(latestGuard);
  assert.match(latestGuard, /if: always\(\) && steps\.npm_stage\.outcome != 'skipped'/);
  assert.match(latestGuard, /verify\.mjs latest "\$RUNNER_TEMP\/solid2-stage-before\.json" "\$RUNNER_TEMP\/solid2-stage-after\.json"/);
});

test('CI executes preview guards in a dedicated credential-free job', async () => {
  const ci = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const guardJob = ci.match(/^  preview-channel-guards:\r?\n([\s\S]*?)(?=^  [a-z][\w-]*:)/m)?.[1];
  assert.ok(guardJob);
  assert.match(guardJob, /run: node --test scripts\/solid2-preview\/verify\.test\.mjs/);
  assert.doesNotMatch(guardJob, /NPM_TOKEN|NODE_AUTH_TOKEN/);
});

test('allows preview tag movement only while latest remains the exact stable version', () => {
  assert.doesNotThrow(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: '6.25.1', solid2: VERSION }));
  assert.throws(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: VERSION }));
  assert.throws(() => assertLatestUnchanged({ latest: '6.25.1' }, { latest: '6.25.2' }));
  assert.throws(() => assertLatestUnchanged({}, { solid2: VERSION }));
});
