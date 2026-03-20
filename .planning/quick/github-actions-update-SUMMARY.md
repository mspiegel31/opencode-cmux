# Quick Task: GitHub Actions Version Update

**Date:** 2026-03-19
**Type:** Maintenance / chore

## Summary

Updated GitHub Actions workflow files to use the latest stable action versions. Two actions were upgraded to new major versions; one remained on its current major (already up-to-date).

## Actions Audited

| Action | Was | Now | Latest Patch | Notes |
|--------|-----|-----|-------------|-------|
| `actions/checkout` | `@v4` | `@v6` | v6.0.2 | v6 = Node.js 24 runner, improved credential handling |
| `oven-sh/setup-bun` | `@v2` | `@v2` | v2.2.0 | No change — v2 major is still current |
| `actions/setup-node` | `@v4` | `@v6` | v6.3.0 | v6 = Node.js 24 runner, `devEngines` support |

## Files Changed

- `.github/workflows/ci.yml` — updated `actions/checkout` v4 → v6
- `.github/workflows/release.yml` — updated `actions/checkout` v4 → v6, `actions/setup-node` v4 → v6

## setup-node vs setup-bun: Can They Replace Each Other?

**No.** They serve different purposes and both are needed in the release workflow:

- **`oven-sh/setup-bun`** — Installs the Bun runtime and package manager. Required to run `bun install`, `bun run build`, `bun test`, etc.
- **`actions/setup-node`** — Installs Node.js and configures the npm registry authentication context (via `registry-url`). Required for `npm publish` and `npm version` commands used in the release pipeline.

The two actions coexist fine: bun handles the dev/build toolchain, Node.js handles npm publishing. Removing either would break its respective step.

## Version Bump Notes

- `actions/checkout@v4 → v6`: Two major versions were skipped (v4→v5→v6). Both v5 and v6 require Actions Runner ≥ v2.327.1 (released mid-2024; `ubuntu-latest` runs a current runner). Key changes: Node.js 20 runner (v5), Node.js 24 runner + credential isolation to separate file (v6).
- `actions/setup-node@v4 → v6`: Same runner version requirement. Key v6 changes: Node.js 24 runner, `devEngines` field support in `package.json`, removed `always-auth` config handling.
- `oven-sh/setup-bun@v2`: Already on the latest major; the floating `@v2` tag automatically resolves to v2.2.0 (latest patch).
