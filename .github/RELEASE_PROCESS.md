# Release Process

This document outlines the complete release process for MCP UI packages.

## Release Types

### Patch Release (1.0.0 → 1.0.1)

Bug fixes and minor improvements that don't break existing APIs.

**When to use:**
- Bug fixes
- Documentation updates
- Performance improvements
- Dependency updates (patch versions)

### Minor Release (1.0.0 → 1.1.0)

New features that are backward compatible.

**When to use:**
- New features
- New optional parameters
- Deprecations (with backward compatibility)
- Dependency updates (minor versions)

### Major Release (1.0.0 → 2.0.0)

Breaking changes that require user action.

**When to use:**
- Breaking API changes
- Removed deprecated features
- Major architecture changes
- Dependency updates (major versions)

## Pre-release Checklist

Before creating a release:

- [ ] All PRs merged to main
- [ ] All CI checks passing
- [ ] Manual testing completed
- [ ] Breaking changes documented
- [ ] Migration guides written (for majors)
- [ ] CHANGELOG.md updated
- [ ] Dependencies updated and audited

## Release Steps

### 1. Update Version Numbers

```bash
# From repository root
cd /home/nico/code_source/tss/mcp-ui

# For patch release
pnpm version:patch

# For minor release
pnpm version:minor

# For major release
pnpm version:major
```

This will update `version` in:
- `mcp-ui-solid/package.json`
- `mcp-ui-spec/package.json`
- `mcp-ui-cli/package.json`

### 2. Update CHANGELOG.md

Add a new section at the top of CHANGELOG.md:

```markdown
## [1.0.1] - 2025-11-16

### Added
- Description of new features

### Changed
- Description of changes

### Fixed
- Description of bug fixes

### Breaking Changes (for majors only)
- Description of breaking changes
- Migration steps
```

### 3. Commit Changes

```bash
# Add all version changes and changelog
git add .

# Commit with version number
git commit -m "chore: release v1.0.1"

# Push to main
git push origin main
```

### 4. Create Git Tag

```bash
# Create annotated tag
git tag -a v1.0.1 -m "Release v1.0.1"

# Push tag to trigger workflows
git push origin v1.0.1
```

### 5. Monitor GitHub Actions

Go to: https://github.com/theseedship/mcp-ui/actions

Watch for:
1. **CI Workflow** - Builds and tests
2. **Publish Workflow** - Publishes to npm
3. **Release Workflow** - Creates GitHub release

### 6. Verify Publication

Check npm packages:
- https://www.npmjs.com/package/@mcp-ui/solid/v/1.0.1
- https://www.npmjs.com/package/@mcp-ui/spec/v/1.0.1
- https://www.npmjs.com/package/@mcp-ui/cli/v/1.0.1

Verify:
- [ ] Correct version number
- [ ] All files included (check file list)
- [ ] README displayed correctly
- [ ] Installation works: `npm install @mcp-ui/solid@1.0.1`

### 7. Verify GitHub Release

Check: https://github.com/theseedship/mcp-ui/releases/tag/v1.0.1

Verify:
- [ ] Release notes extracted from CHANGELOG
- [ ] Tag points to correct commit
- [ ] Release marked as latest (not pre-release)

### 8. Announce Release

After successful release:

1. **Update documentation** if needed
2. **Notify users** via:
   - GitHub Discussions
   - Discord/Slack (if applicable)
   - Social media
3. **Update dependent projects**:
   - deposium_solid
   - deposium_MCPs (remove local packages)

## Hotfix Process

For urgent fixes on released versions:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/v1.0.2 v1.0.1

# Make fixes
git commit -m "fix: critical bug"

# Update version
pnpm version:patch

# Update CHANGELOG
git commit -am "chore: release v1.0.2"

# Merge to main
git checkout main
git merge hotfix/v1.0.2

# Tag and push
git tag -a v1.0.2 -m "Hotfix v1.0.2"
git push origin main --tags

# Delete hotfix branch
git branch -d hotfix/v1.0.2
```

## Rollback Process

If a release has critical issues:

### Option 1: Deprecate on npm

```bash
# Deprecate the broken version
npm deprecate @mcp-ui/solid@1.0.1 "Critical bug - use 1.0.2 instead"
npm deprecate @mcp-ui/spec@1.0.1 "Critical bug - use 1.0.2 instead"
npm deprecate @mcp-ui/cli@1.0.1 "Critical bug - use 1.0.2 instead"

# Release fixed version
pnpm version:patch
# ... follow release steps
```

### Option 2: Unpublish (within 72 hours)

```bash
# Only possible within 72 hours of publication
npm unpublish @mcp-ui/solid@1.0.1
npm unpublish @mcp-ui/spec@1.0.1
npm unpublish @mcp-ui/cli@1.0.1
```

⚠️ **Warning**: Unpublishing is discouraged by npm. Use deprecation instead.

## Post-Release Tasks

After successful release:

- [ ] Update roadmap with completed features
- [ ] Close related GitHub issues
- [ ] Update project board
- [ ] Review and address feedback
- [ ] Plan next release

## Version Compatibility

Maintain compatibility matrix in README.md:

| @mcp-ui/solid | @mcp-ui/spec | @mcp-ui/cli | Node.js | SolidJS |
|---------------|--------------|-------------|---------|---------|
| 1.0.x         | 1.0.x        | 1.0.x       | ≥18     | ≥1.8.0  |

## Emergency Contacts

If automated publishing fails:

1. **Repository Maintainers**:
   - Nicolas GEYSSE (@your-github-username)
   - Gabriel Brument (@brument)

2. **npm Organization Owners**:
   - Check https://www.npmjs.com/settings/@mcp-ui/members

## Tools and Scripts

Useful commands:

```bash
# Check what would be published
pnpm publish:dry

# View current versions
pnpm list --depth=0

# Check for outdated dependencies
pnpm outdated

# Audit for vulnerabilities
pnpm audit

# Update dependencies
pnpm update
```

---

**Note**: Always follow semantic versioning (semver) principles. See https://semver.org for details.
