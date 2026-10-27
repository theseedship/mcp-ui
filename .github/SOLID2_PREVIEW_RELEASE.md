# Solid 2 preview: review first, npm staging only after approval

> 2026-10-27: source/test preparation is resumed, not release operations. This
> workflow/policy remains unchanged and must not be dispatched for the new
> source without separate review of version, Spec fixture and artifact bindings.
> Stable npm 7.0.0 remains Solid 1; the historical preview version is not a
> newly approved candidate. See the [current handoff](../mcp-ui-solid/docs/SOLID2-DEPOSIUM-HANDOFF-2026-10-27.md).

> **Paused by the maintainer — 2026-10-24.** Keep `feat/solid2-preview` and
> PR #34 open as a draft. No review-only dispatch, staging, publication,
> migration or deployment is scheduled or authorized during this pause.
> Begin with the [canonical pause/resumption handoff](../mcp-ui-solid/docs/SOLID2-PREVIEW-HANDOFF-2026-10-23.md)
> after a new explicit go; do not copy historical candidate inputs below.

This channel is separate from the Solid 1 stable release. Merging this
infrastructure PR does **not** stage, publish or deploy anything. No package
version or lockfile changes are needed here: the reviewed source branch already
contains `@seed-ship/mcp-ui-solid@7.0.0-solid2.0`.

## What stays separate

| Consumer | Package | npm channel |
| --- | --- | --- |
| Existing Solid 1 application | `6.25.1` (or a later approved stable 6.x) | `latest`, unchanged |
| Isolated Solid 2 pilot | exact `7.0.0-solid2.0`, Solid/Web/compiler RC.18 | `solid2`, only after staging and npm approval |

The workflow `publish-solid2-preview.yml` was merged into main through #35.
After explicit resumption and a separately approved operation, dispatch it on
**main**, never on the preview branch.
It checks out only the trusted infrastructure commit, not the preview source.
It promotes the exact archive already tested in successful PR CI, rather than
rebuilding a different package while npm credentials are available.

Do **not** use `publish.yml`, `publish:all`, or a `v7.0.0-solid2.0` Git tag.
The existing stable workflows match prerelease tags and hardcode `latest` /
`prerelease: false`. They are intentionally unchanged by this PR. This channel
creates neither a Git tag nor a GitHub release, so it cannot trigger them.
Do not merge the Solid 2 runtime PR into stable main just to obtain an npm build.

## Historical first candidate: not reusable dispatch inputs

The following initial candidate passed CI on 2026-10-23 but was superseded by
later source updates, including #38. It is preserved as historical provenance,
not a candidate to dispatch now. The last functional snapshot at the pause is
`96715b9`; the canonical handoff records its separate CI/archive binding. Neither
snapshot may be staged after resumption without rechecking the actual PR head,
security, successful first-attempt CI and artifact availability.

- Source PR: [#34](https://github.com/theseedship/mcp-ui/pull/34),
  `feat/solid2-preview`, SHA `271e92434696f14ba0fdaaa3e91b242819820a16`.
- [CI run 40021680995](https://github.com/theseedship/mcp-ui/actions/runs/40021680995),
  first attempt, successful preview tests and independent Solid 1 baseline.
- Source artifact ID `12529744972`, name `solid2-preview-qualification`.
- **Solid tarball inside that CI artifact:**
  `seed-ship-mcp-ui-solid-7.0.0-solid2.0.tgz`, SHA-256
  `d5b8c60b74696eca65a2f1aa2f51b05691139b746076b539c8d73460722348cd`.

That checksum is not the ZIP digest and not the separately built local Node 24
tarball (`f4fed9b4…`). The CI tarball was built and qualified on Node 22.23.3.
Never substitute the local checksum into this workflow.

The policy initially permits only PR #34, its canonical branch/repository,
`7.0.0-solid2.0`, and the fixed `solid2` tag. Other versions/PRs and rerun attempts
require a separately reviewed policy update. Expired artifacts, advanced PR
heads and merged/closed PRs fail closed; do not bypass those checks to retry.

## 1. Review-only workflow

Not during the pause. After explicit resumption, policy revalidation and a new
maintainer-authorized review dispatch, use **Review or stage Solid 2 preview**
on main with freshly verified inputs. The table below is historical only:

| Input | Historical first-candidate value — do not reuse |
| --- | --- |
| `source_sha` | `271e92434696f14ba0fdaaa3e91b242819820a16` |
| `ci_run_id` | `40021680995` |
| `artifact_id` | `12529744972` |
| `tarball_sha256` | `d5b8c60b74696eca65a2f1aa2f51b05691139b746076b539c8d73460722348cd` |
| `stage` | `false` (default) |
| `staging_approval` | empty |

This mode has no npm token. It binds the source PR, SHA, successful first-attempt
CI run and immutable artifact; verifies the checksum and safe tar headers;
checks name/version/RC.18 peers and rejects lifecycle scripts, unresolved
workspace dependencies and unsafe npm configuration. Both real-tarball
consumer profiles, imports/targets, lockfiles and compiled-browser results are
required. It does not execute package contents or extract the npm tarball.

The retained `solid2-reviewed-input` contains the one verified Solid `.tgz`,
`delivery.json`, and the observed stable `latest` tag. Spec is a fixture in the
source artifact only: it and CLI are never copied into the staging delivery.
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
npm view @seed-ship/mcp-ui-solid@7.0.0-solid2.0 version
npm view @seed-ship/mcp-ui-solid dist-tags --json
```

`solid2` should identify the reviewed preview; `latest` must remain the stable
version observed before staging. Check again after npm approval, not just after
the upload. The staging tag is immutable; an incorrectly tagged stage needs
maintainer rejection and correct restaging, not automatic tag repair.

## 3. Handoff to the ongoing Deposium migration

This is a conditional future integration procedure, not an active migration
task. Deposium readiness and maintainer approval determine the resumption date.

Do not install the preview into the existing Solid 1 root application.
The current target is the private isolated package `experiments/solid2-server`
on Deposium branch `feat/solid2-server-integration`. At inspection it used
Solid/Web RC.17 and Vite 8.2.4: align the pilot runtime, compiler and tooling
coherently with the qualified RC.18 workbench before installing this package.
Pin the exact preview version and commit that pilot's independent lockfile.

The source preview includes `mcp-ui-solid/docs/SOLID2-PREVIEW.md` and
`SOLID2-PREVIEW-HANDOFF-2026-10-23.md`. The real Deposium chat, bus, sources and
visualizations still need integration qualification. A local identified `.tgz`
can be used without waiting for npm. Application staging is a later, separately
authorized step; production is not authorized here. Rollback means the old
application and its matching lockfile, not a mixed Solid 1/2 reactive tree.

## Local checks and limits

```sh
node --test scripts/solid2-preview/verify.test.mjs
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
