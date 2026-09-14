# npm token setup

The current token and publication procedure is maintained in
[NPM_SETUP.md](./NPM_SETUP.md#setup). Follow that guide rather than duplicating
credentials or release instructions here.

- Store a granular token with staging write access to the `@seed-ship` packages
  in the GitHub Actions repository secret `NPM_TOKEN`.
- GitHub uploads packages to staging; a maintainer approves them on npmjs.com
  with 2FA before they become public.
- Do not delete/recreate release tags to rotate a token. Follow the recovery
  section of the guide, including manual dispatch on `main` for the CI migration.
- `npm whoami` validates authentication only, not publishing permissions.
