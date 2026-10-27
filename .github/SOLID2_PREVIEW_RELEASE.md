# Solid 2 preview: review first, npm staging only after approval

This channel is separate from the Solid 1 stable release. Merging this
infrastructure PR does **not** stage, publish or deploy anything. No package
version or lockfile changes are needed here: the reviewed source branch already
prepares `@seed-ship/mcp-ui-solid@8.0.0-solid2.0` independently of stable main.

## What stays separate

| Consumer | Package | npm channel |
| --- | --- | --- |
| Existing Solid 1 application | `7.x`, including future `7.1.x` | `latest` |
| Isolated Solid 2 pilot | exact `8.0.0-solid2.0`, Solid/Web/compiler RC.19 | `solid2`, only after staging and npm approval |

The major number of MCPUI is not the framework's major: MCPUI 7 is Solid 1;
MCPUI 8 is Solid 2. Keep stable work on main while the port remains on
`feat/solid2-preview`. A future `7.1.x` release still uses bump + reviewed stable
Git tag + the existing staged-publishing/2FA procedure. Spec 6.0.0 and CLI 5.0.2
remain independently versioned; neither is published by this preview workflow.
No preview upload is needed while the host migration is unfinished.

The workflow `publish-solid2-preview.yml` must first be reviewed and merged
into the default branch. Dispatch it on **main**, never on the preview branch.
It checks out only the trusted infrastructure commit, not the preview source.
It promotes the exact archive already tested in successful PR CI, rather than
rebuilding a different package while npm credentials are available.

Do **not** use `publish.yml`, `publish:all`, or a `v8.0.0-solid2.0` Git tag.
The existing stable workflows match prerelease tags and hardcode `latest` /
`prerelease: false`; a new offline guard rejects preview/8.x workspaces before
installation and accepts stable Solid 7 / Solid 1 instead. This channel
also leaves Spec/CLI version numbers independent. Stable tag runs must use a
canonical stable tag matching one of the three workspace manifests; a preview
tag cannot accidentally stage stable packages or create a stable GitHub release.
The preview workflow
creates neither a Git tag nor a GitHub release, so it cannot trigger them.
Do not merge the Solid 2 runtime PR into stable main just to obtain an npm build.

## Candidate identities, not execution authorization

The candidate is source PR [#34](https://github.com/theseedship/mcp-ui/pull/34),
`feat/solid2-preview`. A bump from the historical 7.x preview to
`8.0.0-solid2.0` requires a **new successful first-attempt CI run** on the exact
new head, including its independent Solid 1 baseline. Record that run's source
SHA, run ID, artifact ID and the SHA-256 of
`seed-ship-mcp-ui-solid-8.0.0-solid2.0.tgz` inside its
`solid2-preview-qualification` artifact. Use neither the ZIP digest nor a
separately built local tarball's hash.

Older RC.18/RC.19 evidence under `7.0.0-solid2.0` is historical qualification,
not a reusable 8.x package. See the source branch's
`mcp-ui-solid/docs/SOLID2-DEPOSIUM-HANDOFF-2026-10-27.md` for the RC.19 handoff.

The policy permits only PR #34, its canonical branch/repository,
`8.0.0-solid2.0`, the coherent RC.19 cohort, Spec 6.0.0 / CLI 5.0.2 fixtures,
and the fixed `solid2` tag. Other versions/PRs and rerun attempts
require a separately reviewed policy update. Expired artifacts, advanced PR
heads and merged/closed PRs fail closed; do not bypass those checks to retry.

## 1. Review-only workflow

After the infrastructure PR is merged, and when a maintainer authorizes a
review dispatch, run **Review or stage Solid 2 preview** on main with:

| Input | Value from the newly qualified 8.x candidate |
| --- | --- |
| `source_sha` | exact current PR #34 head, 40 lowercase hex characters |
| `ci_run_id` | successful first-attempt PR CI run for that head |
| `artifact_id` | its unexpired `solid2-preview-qualification` artifact |
| `tarball_sha256` | SHA-256 of the Solid **8.x `.tgz`**, not the artifact ZIP |
| `stage` | `false` (default) |
| `staging_approval` | empty |

This mode has no npm token. It binds the source PR, SHA, successful first-attempt
CI run and immutable artifact; verifies the checksum and safe tar headers;
checks name/version/RC.19 peers and rejects lifecycle scripts, unresolved
workspace dependencies and unsafe npm configuration. Both real-tarball
consumer profiles, imports/targets, lockfiles and compiled-browser results are
required. Runtime, web, signals, compiler and Babel plugin must all be exactly
`2.0.0-rc.19`; the Vite plugin must be `3.0.0-next.51`. The packed Solid package
must depend on Spec `^6.0.0`. The exact Spec fixture hash must match both
consumer reports. The CLI fixture and its passing packed fast-uri report must
match the Spec/CLI archive hashes. It does not execute package contents or
extract the npm tarball.

The retained `solid2-reviewed-input` contains the one verified Solid `.tgz`,
`delivery.json`, and the observed stable `latest` tag. Spec and CLI are fixtures
in the three-tarball source artifact only: neither is copied into the staging
delivery. Extra or missing tarballs are refused.
The summary supplies an exact approval sentence; it is not a command.

## 2. Optional npm staging — new explicit approval required

Before any staging dispatch:

1. Finish source review and mark PR #34 ready for review; a draft PR is allowed
   for review-only but refused for staging. Do not merge it into stable main.
2. Obtain explicit maintainer approval for the exact source SHA, version,
   tarball checksum and `solid2` channel. The approval that created this
   infrastructure PR is **not** approval to stage a package.
3. Configure GitHub environment **`npm-solid2-preview`** with required reviewers
   and at least one actual reviewer; disable administrator bypass where possible.
   Restrict deployment branches to main. Prefer an environment-scoped
   stage-only `NPM_TOKEN`, limited to this existing package and with an expiry
   policy. A repository token is a fallback, not a proof of validity.
   The workflow refuses staging if the environment/reviewer rule is absent;
   this PR does not create or reconfigure any environment or secret.
4. Inspect npm **Staged Packages** for an already pending version. A stage
   reserves its version but is not visible through public `npm view`.
   Reuse a correct pending stage, or reject an incorrect one with maintainer
   2FA before retrying. Never bump or create duplicate stages as a recovery trick.

Only then dispatch on main with `stage=true` and paste the exact approval
sentence from the reviewed summary into `staging_approval`. The protected
environment requires a human decision before the token-bearing job starts.
Source metadata and tarball bytes are rechecked after that decision.

The only token-bearing command stages this single tarball, from an otherwise
empty directory, with fixed `--tag solid2 --ignore-scripts`, the public npm
registry and npm 11.15.0 / Node 22.23.3. No preview source is checked out,
installed, built or executed in that job. Stable and preview workflows share
the existing `npm-release` concurrency lock. `latest` is compared before/after;
the workflow never attempts an automatic corrective dist-tag mutation.

Inspect the workflow run, `solid2-stage-result` artifact and npm stage ID.
Successful staging is **not** a public release. A maintainer must inspect the
exact package/checksum/tag and approve it on npmjs.com with 2FA. That npm approval
publishes the package; the workflow never performs it automatically.

After approval, verify the public state (these are read-only commands):

```sh
npm view @seed-ship/mcp-ui-solid@8.0.0-solid2.0 version
npm view @seed-ship/mcp-ui-solid dist-tags --json
```

`solid2` should identify the reviewed preview; `latest` must remain the stable
version observed before staging. Check again after npm approval, not just after
the upload. The staging tag is immutable; an incorrectly tagged stage needs
maintainer rejection and correct restaging, not automatic tag repair.

## 3. Handoff to the ongoing Deposium migration

Do not install the preview into the existing Solid 1 root application.
The current target is the private isolated package `experiments/solid2-server`
on Deposium branch `feat/solid2-server-integration`. Align the pilot runtime,
compiler and tooling coherently with the qualified RC.19 cohort before
installing this package; the application team's migration is independent and
is not declared complete by MCPUI qualification.
Pin the exact preview version and commit that pilot's independent lockfile.

The source preview includes `mcp-ui-solid/docs/SOLID2-PREVIEW.md` and
`SOLID2-DEPOSIUM-HANDOFF-2026-10-27.md`. The real Deposium chat, bus, sources and
visualizations still need integration qualification. A local identified `.tgz`
can be used without waiting for npm. Application staging is a later, separately
authorized step; production is not authorized here. Rollback means the old
application and its matching lockfile, not a mixed Solid 1/2 reactive tree.

## Local checks and limits

```sh
node --test scripts/solid2-preview/verify.test.mjs scripts/stable-release/verify.test.mjs
```

CI runs these offline guards in its own credential-free job. Actual GitHub
dispatch/environment approval and npm staging are not executed by unit tests.
CLI `request`, `source`, `archive`, `tarball` and `latest` can inspect local
metadata/artifacts without npm credentials; see the workflow for their arguments.

Workflow syntax was checked with actionlint 1.7.12. Its schema does not yet know
GitHub's documented `concurrency.queue: max`; only that exact unsupported-key
diagnostic is ignored during the local lint, not other workflow errors.

References: [GitHub manual workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch),
[GitHub concurrency queue](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency#example-queueing-multiple-pending-runs),
[npm staged publishing](https://docs.npmjs.com/staged-publishing/),
[npm stage tag behavior](https://docs.npmjs.com/cli/v11/commands/npm-stage/#tag-behavior).
