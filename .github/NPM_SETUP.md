# npm releases: staging and approval

The `Stage npm release` workflow builds, tests, typechecks, and uploads packages
to npm staging. **A green workflow does not mean a version is public.** A
maintainer must approve each uploaded package on npmjs.com with 2FA.

## Setup

- Use an npm account with write access to the existing `@seed-ship` packages
  and 2FA enabled. Staging cannot create a brand-new package.
- Create a granular access token granting **Read and write (stage only)** to
  the relevant packages/scope. Store it as the GitHub Actions repository
  secret `NPM_TOKEN`. Monitor its expiration; never commit or log the token.
- CI uses Node 22 and explicitly installs npm 11.15.0 for `npm stage publish`.
  It runs `pnpm pack` first to convert `workspace:` dependencies to normal
  version ranges, then stages the resulting tarball.
- The optional `check_auth_only` workflow input only runs `npm whoami`.
  Success proves authentication, not permission to upload or publish.

## Normal release

1. Bump the changed packages and dependent workspace ranges as needed; update
   the lockfile, changelogs, and README. Package versions need not be identical.
2. Merge the reviewed PR and verify CI on the release commit.
3. Push a new `v*.*.*` tag pointing to that commit. Alternatively, run the
   workflow manually on the intended branch with `check_auth_only` disabled.
4. Check the workflow summary and upload logs. Versions already public are
   skipped; new versions are staged with the `latest` dist-tag.
5. Open **Staged Packages** on npmjs.com, inspect the uploads, and click
   **Approve**, confirming with 2FA. Approve `@seed-ship/mcp-ui-spec` first,
   then Solid/CLI versions that depend on it. Approval publishes immediately.
6. Verify the exact versions with `npm view <package>@<version> version`.

CLI approval is also possible with an interactive npm login:
`npm stage approve <stage-id>`. Do not send OTP codes to GitHub or an agent.
See the [official staged publishing guide](https://docs.npmjs.com/staged-publishing/).

## Recovering the 6.18.0 release

The existing `v6.18.0` tag points to the old direct-publish workflow. After
merging this CI fix, **manually run `publish.yml` on `main`**, with
`check_auth_only` disabled. Re-running the old failed tag run would still use
the old workflow. Do not move the tag or bump versions just to retry.

The intended uploads are Solid 6.18.0 and Spec 5.6.0; CLI 5.0.0 is skipped if
already public. They become installable only after approval.

## Failures and retries

- `E_STAGE_REQUIRED`: a direct publish was attempted with a stage-only token.
  Use this staging workflow, not `pnpm publish:all` (still a direct-publish helper).
- Authentication/permission errors: check token expiration and package access,
  replace `NPM_TOKEN` if needed, then retry. No version bump is needed if that
  version was never uploaded.
- Partial upload or version conflict: inspect **Staged Packages** before
  retrying. A pending stage reserves its version and is not returned as a
  public version by `npm view`. Approve the reviewed pending upload first;
  the retry will then skip it. Alternatively, explicitly reject an incorrect
  stage before retrying. The workflow deliberately fails on conflicts rather
  than silently treating an unknown upload as success or replacing it.
- Release runs are serialized with `queue: max` (up to 100 pending runs;
  additional runs are cancelled when full), so a new run does not replace an
  earlier pending release below that limit. Pending stages still require the handling
  above. Do not repeatedly retry while an earlier upload awaits approval.
- This workflow targets stable releases (`latest`), not prerelease channels.

The `queue` option is documented in GitHub's
[concurrency reference](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency#example-queueing-multiple-pending-runs).
`queue: max` is compatible with `cancel-in-progress: false`, not `true`.

## Packages

- [@seed-ship/mcp-ui-spec](https://www.npmjs.com/package/@seed-ship/mcp-ui-spec)
- [@seed-ship/mcp-ui-solid](https://www.npmjs.com/package/@seed-ship/mcp-ui-solid)
- [@seed-ship/mcp-ui-cli](https://www.npmjs.com/package/@seed-ship/mcp-ui-cli)
