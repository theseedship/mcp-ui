# NPM Token Setup for Automated Publishing

The GitHub Actions publish workflow failed with:
```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

This means your npm token requires 2FA, which doesn't work in CI/CD.

## Solution: Create an Automation Token

### Step 1: Create Automation Token in npm

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token"
3. Select **"Automation"** (NOT "Classic" or "Publish")
4. Give it a name like "mcp-ui-github-actions"
5. Click "Generate Token"
6. Copy the token (starts with `npm_`)

### Step 2: Update GitHub Secret

1. Go to https://github.com/theseedship/mcp-ui/settings/secrets/actions
2. Click on `NPM_TOKEN` to edit it
3. Paste the new automation token
4. Save

### Step 3: Re-trigger Publish

After updating the token, re-trigger the publish workflow:

```bash
cd /home/nico/code_source/tss/mcp-ui
git push origin :refs/tags/v1.0.0  # Delete remote tag
git tag -d v1.0.0                   # Delete local tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0              # Push tag to trigger workflow
```

## Alternative: Manual Publish

If you prefer to publish manually:

```bash
cd /home/nico/code_source/tss/mcp-ui
npm login
pnpm publish:all
# Enter your OTP code when prompted
```

## Token Types Comparison

| Token Type | 2FA Required | Use Case |
|------------|--------------|----------|
| Classic    | Yes          | Manual publishing |
| Automation | No           | CI/CD automation ✅ |
| Publish    | Yes          | Limited scope manual |

---

**Important**: Automation tokens bypass 2FA, so keep them secure in GitHub Secrets only.
