# NPM Publishing Setup

This document explains how to set up automated npm publishing for the mcp-ui monorepo.

## Prerequisites

1. **npm Account**: You need an npm account with publishing rights
2. **GitHub Repository**: Admin access to the repository
3. **Packages on npm**: Create organization scope `@mcp-ui` on npm

## Step 1: Create npm Access Token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to **Account Settings** → **Access Tokens**
3. Click **Generate New Token** → **Classic Token**
4. Select **Automation** token type (for CI/CD)
5. Copy the token (it won't be shown again)

## Step 2: Add Token to GitHub Secrets

1. Go to GitHub repository settings
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste the npm token from Step 1
6. Click **Add secret**

## Step 3: Configure npm Packages

Before publishing, ensure all packages have correct configuration:

### Package Access

All packages should be public. In each `package.json`:

```json
{
  "name": "@mcp-ui/solid",
  "publishConfig": {
    "access": "public"
  }
}
```

### Package Versions

Update versions in all packages before tagging:

```bash
# Patch version (1.0.0 → 1.0.1)
pnpm version:patch

# Minor version (1.0.0 → 1.1.0)
pnpm version:minor

# Major version (1.0.0 → 2.0.0)
pnpm version:major
```

## Step 4: Publishing Process

### Automated Publishing (Recommended)

1. **Update CHANGELOG.md** with changes for the new version
2. **Commit all changes**:
   ```bash
   git add .
   git commit -m "chore: prepare release v1.0.1"
   git push
   ```

3. **Create and push a version tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. **Wait for GitHub Actions**:
   - The `publish.yml` workflow will trigger automatically
   - It will build, test, and publish all packages
   - Check the **Actions** tab for progress

5. **Verify publication**:
   - Check [npmjs.com](https://www.npmjs.com/search?q=%40mcp-ui)
   - Verify all 3 packages published successfully
   - Check GitHub Releases for auto-generated release notes

### Manual Publishing (Emergency Only)

If automated publishing fails:

```bash
# Login to npm
npm login

# Build all packages
pnpm build

# Publish manually
pnpm publish:all

# Or publish specific package
pnpm --filter @mcp-ui/spec publish --access public
```

## Step 5: Verify Workflows

### Publish Workflow

**Triggers**: Push to version tag (e.g., `v1.0.1`)
**Steps**:
1. Checkout code
2. Setup Node.js 20 with npm registry
3. Install pnpm and dependencies
4. Build all packages
5. Run tests
6. Type check
7. Publish to npm with provenance

**File**: `.github/workflows/publish.yml`

### CI Workflow

**Triggers**: Push to main/develop, Pull Requests
**Steps**:
1. Test on Node 18 and 20
2. Lint (non-blocking)
3. Type check
4. Build
5. Test

**File**: `.github/workflows/ci.yml`

### Release Workflow

**Triggers**: Push to version tag (e.g., `v1.0.1`)
**Steps**:
1. Extract changelog for version
2. Create GitHub Release with notes
3. Attach built artifacts

**File**: `.github/workflows/release.yml`

## Troubleshooting

### Token Expiration

npm tokens don't expire by default (Automation type), but if publishing fails:

1. Generate new token on npmjs.com
2. Update `NPM_TOKEN` secret in GitHub
3. Re-run failed workflow or push new tag

### Permission Denied

If you see `403 Forbidden` errors:

1. Verify npm token has **Automation** scope
2. Check you have publish rights to `@mcp-ui` scope
3. Ensure `publishConfig.access` is set to `public`

### Build Failures

If builds fail in CI but work locally:

1. Check Node.js versions match (20.x)
2. Verify pnpm-lock.yaml is committed
3. Look for platform-specific dependencies
4. Check workflow logs for specific errors

### Version Conflicts

If npm rejects version already published:

1. Update versions in all packages
2. Delete old git tag: `git tag -d v1.0.1 && git push origin :v1.0.1`
3. Create new tag with correct version
4. Push new tag

## Best Practices

### Version Synchronization

Keep all packages in sync:

```bash
# Update all package versions at once
pnpm version:patch  # or minor/major
```

### Changelog Management

Always update CHANGELOG.md before releasing:

```markdown
## [1.0.1] - 2025-11-16

### Added
- New feature X

### Fixed
- Bug Y in @mcp-ui/solid

### Changed
- Updated dependencies
```

### Pre-release Testing

Before tagging:

```bash
# Test dry-run publish
pnpm publish:dry

# Verify all builds
pnpm build

# Run all tests
pnpm test

# Check types
pnpm typecheck
```

### Release Checklist

- [ ] CHANGELOG.md updated
- [ ] All tests passing locally
- [ ] Versions updated in all packages
- [ ] Breaking changes documented
- [ ] Migration guide written (if needed)
- [ ] All changes committed and pushed
- [ ] Tag created with `v` prefix
- [ ] CI passes on GitHub
- [ ] Packages published to npm
- [ ] GitHub Release created
- [ ] Documentation updated

## Package URLs

After publishing, packages will be available at:

- [@mcp-ui/solid](https://www.npmjs.com/package/@mcp-ui/solid)
- [@mcp-ui/spec](https://www.npmjs.com/package/@mcp-ui/spec)
- [@mcp-ui/cli](https://www.npmjs.com/package/@mcp-ui/cli)

## Support

If you encounter issues:

1. Check workflow logs in GitHub Actions
2. Review npm audit log
3. Open an issue with logs and error messages
4. Contact repository maintainers

---

**Last Updated**: 2025-11-16
**Maintained By**: The Seed Ship Team
