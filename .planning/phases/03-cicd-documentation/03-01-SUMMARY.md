---
phase: 03-cicd-documentation
plan: 01
subsystem: infra
tags: [github-actions, ci-cd, npm, semver, conventional-commits]

# Dependency graph
requires:
  - phase: 02-config-system
    provides: Working TypeScript build with bun:test suite
provides:
  - GitHub Actions CI workflow (typecheck + build + test on push/PR to main)
  - GitHub Actions release workflow (conventional commit semver bump + npm publish)
  - Scoped npm package name @mspiegel31/opencode-cmux
affects: [publishing, versioning, npm-registry]

# Tech tracking
tech-stack:
  added: [github-actions, oven-sh/setup-bun, actions/setup-node]
  patterns: [conventional-commits-semver, skip-ci-loop-prevention, frozen-lockfile-ci]

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
  modified:
    - package.json

key-decisions:
  - "npm version --no-git-tag-version + manual git tag allows post-publish tagging"
  - "[skip ci] in version bump commit message prevents circular release loop"
  - "concurrency group 'release' with cancel-in-progress false queues releases safely"
  - "Build after version bump so dist/ contains correct version if version embedding added later"

patterns-established:
  - "CI steps ordered: typecheck → build → test (fail fast on type errors before expensive build)"
  - "Release workflow: checkout → bun install → semver detect → npm version → build → publish → git tag + push"

requirements-completed: [CICD-01, CICD-02, CICD-03, CICD-04]

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 03-01: CI/CD Workflows Summary

**GitHub Actions CI + release workflows with conventional commit semver (feat→minor, fix→patch, feat!→major) and scoped npm package @mspiegel31/opencode-cmux**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T01:58:13Z
- **Completed:** 2026-03-20T02:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Renamed package from `opencode-cmux` to `@mspiegel31/opencode-cmux` for scoped npm publish
- CI workflow runs typecheck + build + test on every push and PR to main using `--frozen-lockfile`
- Release workflow parses commit title for semver bump type and publishes to npm with `--access public`
- Circular release loop prevention via `[skip ci]` in version bump commit message

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix package name and create CI workflow** - `852cd1a` (feat)
2. **Task 2: Create release workflow with semver bump + npm publish** - `ace6d9f` (feat)

## Files Created/Modified
- `package.json` - Renamed to `@mspiegel31/opencode-cmux` for scoped npm publish
- `.github/workflows/ci.yml` - CI quality gate: typecheck + build + test on push/PR to main
- `.github/workflows/release.yml` - Release: semver detection, npm publish, version tag push-back

## Decisions Made
- **npm version --no-git-tag-version**: Bumps package.json without creating git tag, so we can create the tag after successful npm publish (avoids tagging a failed release)
- **[skip ci] loop prevention**: The workflow's own version bump commit would re-trigger the workflow without this guard, causing infinite publish loop
- **Build after version bump**: Future-proofs against any version embedding in dist artifacts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
**GitHub Secret required before release workflow can publish:**
1. Go to repo Settings → Secrets and variables → Actions
2. Add `NPM_TOKEN` — your npm access token with publish permission for `@mspiegel31` scope
3. Verification: merge a commit to `main` — the Release workflow should trigger and publish

## Next Phase Readiness
- CI/CD infrastructure complete; 03-02 (README) can proceed independently
- NPM_TOKEN secret must be added to repo settings before first publish attempt

---
*Phase: 03-cicd-documentation*
*Completed: 2026-03-20*
