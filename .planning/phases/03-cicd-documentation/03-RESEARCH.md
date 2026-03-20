# Phase 03: CI/CD & Documentation — Research

**Phase:** 3 — CI/CD & Documentation
**Researched:** 2026-03-19

---

## Summary

Phase 3 is well-understood CI/CD territory with two concerns:
1. **GitHub Actions workflows** — CI on PR/push, release on merge to main
2. **README documentation** — install + config reference

Key decision: semver bump strategy. The ROADMAP specifies parsing the commit title directly (not using a release tool like `semantic-release` or `release-it`). This is DIY shell scripting in the workflow.

---

## Standard Stack

### CI Workflow Pattern (Bun)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run build
      - run: bun test
```

`oven-sh/setup-bun@v2` is the official Bun action. `--frozen-lockfile` fails if lockfile is out of sync (good gate for CI).

### Release Workflow Pattern

The release workflow needs to:
1. Parse the latest commit message for conventional commit prefix
2. Read current version from `package.json`
3. Compute new version (semver bump)
4. Update `package.json` version field
5. Publish to npm with `--access public`
6. Create a git tag

**Semver bump logic (per ROADMAP):**
- `feat!:` or `BREAKING CHANGE` in body → major
- `feat:` → minor
- `fix:`, `chore:`, anything else → patch

**Implementation choice: pure shell in the workflow** (no `semantic-release` dependency)

```yaml
# Bump logic (bash)
COMMIT_MSG=$(git log -1 --pretty=%s)
if [[ "$COMMIT_MSG" =~ ^feat!: ]] || [[ "$COMMIT_MSG" =~ BREAKING ]]; then
  BUMP=major
elif [[ "$COMMIT_MSG" =~ ^feat: ]]; then
  BUMP=minor
else
  BUMP=patch
fi
```

Then use `npm version $BUMP --no-git-tag-version` to bump `package.json`.

### npm Publishing

- Package name: `opencode-cmux` (current package.json name — but the decision table says `@mspiegel31/opencode-cmux`)
- Need to reconcile: package.json currently has `"name": "opencode-cmux"` but STATE.md says `@mspiegel31/opencode-cmux`
- Scoped packages require `--access public` for free npm accounts
- **Secret required:** `NPM_TOKEN` as a GitHub Actions secret
- npm provenance (`--provenance`) is best practice for supply chain security but optional

```yaml
- run: npm publish --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Git Tag + Commit Back

After bumping version:
```yaml
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add package.json
git commit -m "chore: bump version to v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main --follow-tags
```

**Important:** Workflow must push back to main AND the tag. Use `GITHUB_TOKEN` with write permissions, or a PAT if branch protection rules are in place.

---

## Architecture Patterns

### Workflow Permissions

```yaml
permissions:
  contents: write  # needed to push tags + version bump commit
  id-token: write  # needed for npm provenance (optional)
```

### Concurrency Guard (recommended)

Prevent parallel release runs on rapid commits:
```yaml
concurrency:
  group: release
  cancel-in-progress: false  # false = queue, not cancel
```

### Conditional Release

Release only on push to main (not PRs, not other branches):
```yaml
on:
  push:
    branches: [main]
```

CI runs on both push to main AND PRs (so PRs get checked before merge).

---

## Don't Hand-Roll

- **`oven-sh/setup-bun@v2`** — use this instead of manual bun install scripts
- **`actions/setup-node@v4` with `registry-url`** — use this for npm auth, sets `NODE_AUTH_TOKEN` plumbing
- **`npm version`** — use this (not manual JSON editing) to bump version; it handles semver validation

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    registry-url: 'https://registry.npmjs.org'
```

---

## Common Pitfalls

1. **`--frozen-lockfile` breaks if lockfile is stale** — keep `bun.lock` committed (already done)
2. **Circular trigger**: pushing the version bump commit back to main re-triggers the release workflow → add `[skip ci]` to the version bump commit message
3. **Branch protection**: if main has push protection, `GITHUB_TOKEN` may not have write access → need `Allow GitHub Actions to create and approve pull requests` in repo settings, or use a PAT
4. **Package name mismatch**: `package.json` has `"name": "opencode-cmux"` but STATE.md decision says `@mspiegel31/opencode-cmux` — this must be reconciled in the plan
5. **`bun run build` before publish**: the `files: ["dist"]` field in package.json means the built dist/ must exist before `npm publish`

---

## README Content Plan

Required sections per DOCS-01 + ROADMAP:

1. **Installation** — `npm install @mspiegel31/opencode-cmux` (or `bun add`)
2. **OpenCode registration** — `opencode.json` snippet with plugin path
3. **Config file reference** — `~/.config/opencode/opencode-cmux.json` with full schema
4. **Environment variables table** — all 4 env vars with descriptions

Additional good-to-have:
- Brief "What is this?" intro (one paragraph)
- Requirements (cmux + OpenCode)
- Per-plugin behavior description

---

## Validation Architecture

No automated validation is practical for GitHub Actions workflows until they run in CI. The "dry run" in ROADMAP task 4 can be implemented as:
- Workflow `workflow_dispatch` trigger with `dry-run: true` input that skips the `npm publish` step
- Or a pre-release tag test (push `v0.0.1-rc.0` to trigger)

For the plan, validation is:
- YAML syntax check (via `yq` or `yamllint` locally)
- Act (local GHA simulator) — optional/nice-to-have, not required

---

## Phase 2 Context

From Phase 2 summaries:
- Package uses ESM (`"type": "module"`)
- Bun is the package manager — use `bun install`, `bun test`, `bun run build`
- `bun.lock` is committed
- `src/` contains the source (not `lib/` — Phase 1 moved it)
- Node.js 24 LTS (`.nvmrc` contains `24`)
- All 16 tests pass currently

---

## Recommended Approach

1. **Plan 01** (Wave 1): Create `.github/workflows/ci.yml` + `.github/workflows/release.yml`
   - Fix package name `opencode-cmux` → `@mspiegel31/opencode-cmux` in package.json (required for scoped publish)
   - CI: bun setup + install + typecheck + build + test
   - Release: parse commit, bump version, build, publish, tag + push back with `[skip ci]`

2. **Plan 02** (Wave 1, parallel): Write `README.md`
   - All 5 sections from DOCS-01
   - Can run in parallel with workflows (independent files)

Plans are independent — README and workflow files touch no shared files.
