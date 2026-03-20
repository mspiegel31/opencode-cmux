# Roadmap: opencode-cmux

**Milestone:** v1.0.0
**Goal:** Publish a working, installable OpenCode plugin to npm with both cmux plugins, per-plugin config, and automated CI/CD publishing.

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | 1/2 | In Progress|  | 5 |
| 2 | Config System | Per-plugin config with bootstrapping | CONF-01 through CONF-04 | 4 |
| 3 | CI/CD & Documentation | Automated publish + README | CICD-01 through CICD-04, DOCS-01 | 4 |

---

## Phase 1: Project Foundation

**Goal:** The project builds cleanly with Bun, exports both plugins from a single entry point, and is ready to be installed as an OpenCode plugin.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06

**Plans:** 1/2 plans executed

Plans:
- [ ] 01-01-PLAN.md — Configure TypeScript build infrastructure (tsconfig.json, package.json, .nvmrc, bun install)
- [ ] 01-02-PLAN.md — Create src/index.ts entry point and verify full build pipeline

**Tasks:**
1. Add `tsconfig.json` (ESNext, bundler module resolution, declaration output to `dist/`, strict mode, bun-types)
2. Update `package.json`: `"type": "module"`, correct `main`/`types`/`exports`, add `@opencode-ai/plugin` to dependencies, add `build`/`typecheck`/`test` scripts
3. Add `.nvmrc` with `24`
4. Create `index.ts` that imports and re-exports `CmuxPlugin` and `CmuxSubagentViewer`
5. Run `bun install` to create lockfile and install deps
6. Verify `bun run build` produces `dist/index.js` and `dist/index.d.ts`

**Success criteria:**
1. `bun run build` exits 0 and produces `dist/index.js` and `dist/index.d.ts`
2. `bun run typecheck` exits 0 with no type errors
3. `package.json` has `"type": "module"`, correct `exports`, and `@opencode-ai/plugin` in dependencies
4. `.nvmrc` contains `24`
5. `index.ts` exports both `CmuxPlugin` and `CmuxSubagentViewer` as named exports

---

## Phase 2: Config System

**Goal:** Both plugins read from a JSON config file that is auto-created on first run, and each plugin can be individually enabled or disabled.

**Requirements:** CONF-01, CONF-02, CONF-03, CONF-04

**Tasks:**
1. Create `src/config.ts` (or `lib/config.ts`) with `ConfigSchema` type, `DEFAULT_CONFIG`, `loadConfig()` function
2. `loadConfig()` reads `~/.config/opencode/opencode-cmux.json`, bootstraps defaults if missing
3. Add env var overrides: `CMUX_NOTIFY_ENABLED`, `CMUX_SUBAGENT_VIEWER_ENABLED`
4. Update `CmuxPlugin` in `lib/cmux-notify.ts` to call `loadConfig()` and check `cmuxNotify.enabled`
5. Update `CmuxSubagentViewer` in `lib/cmux-subagent-viewer.ts` to call `loadConfig()` and check `cmuxSubagentViewer.enabled`
6. Write unit tests for `loadConfig()` using `bun:test`

**Success criteria:**
1. `~/.config/opencode/opencode-cmux.json` is created with defaults when it doesn't exist
2. Setting `cmuxNotify.enabled: false` in the config file prevents `CmuxPlugin` from registering hooks
3. Setting `CMUX_NOTIFY_ENABLED=false` env var overrides the config file value
4. `bun test` passes for config unit tests

---

## Phase 3: CI/CD & Documentation

**Goal:** Merging to main automatically publishes a new version to npm with correct semver, and the README gives users everything they need to install and configure the plugin.

**Requirements:** CICD-01, CICD-02, CICD-03, CICD-04, DOCS-01

**Tasks:**
1. Create `.github/workflows/ci.yml`: runs `bun install`, `bun run typecheck`, `bun run build`, `bun test` on push/PR to main
2. Create `.github/workflows/release.yml`: on push to main, parse commit title for semver bump type (feat→minor, fix/chore→patch, feat!/BREAKING→major), bump version, publish to npm with `--access public`
3. Write `README.md` with installation instructions, `opencode.json` registration, config file reference, env var table
4. Verify publish workflow with a dry run or test against a pre-release tag

**Success criteria:**
1. CI workflow runs on PR and fails fast on type errors or build failures
2. Pushing to main triggers the release workflow and publishes to npm
3. A `feat:` commit title results in a minor version bump; `fix:` results in a patch bump
4. README has install instructions, opencode.json snippet, and config options table

---

## Requirement → Phase Traceability

| Requirement | Phase |
|-------------|-------|
| FOUND-01 | Phase 1 |
| FOUND-02 | Phase 1 |
| FOUND-03 | Phase 1 |
| FOUND-04 | Phase 1 |
| FOUND-05 | Phase 1 |
| FOUND-06 | Phase 1 |
| CONF-01 | Phase 2 |
| CONF-02 | Phase 2 |
| CONF-03 | Phase 2 |
| CONF-04 | Phase 2 |
| CICD-01 | Phase 3 |
| CICD-02 | Phase 3 |
| CICD-03 | Phase 3 |
| CICD-04 | Phase 3 |
| DOCS-01 | Phase 3 |

**Coverage:** 15/15 v1 requirements mapped ✓

---
*Roadmap created: 2026-03-19*
