# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 3 | **Plans:** 6 | **Sessions:** ~2

### What Was Built

- TypeScript build pipeline with `tsc`, ESM output, and declaration files
- Per-plugin JSON config system with lazy bootstrapping and env var overrides
- GitHub Actions CI + release workflows with OIDC trusted publishing (no long-lived token)
- Published `@mspiegel31/opencode-cmux@1.0.0` to npm

### What Worked

- Migrating from Bun test runner to vitest was straightforward and unblocked CI
- OIDC trusted publishing eliminated the need for a long-lived `NPM_TOKEN` in secrets
- `node-version-file: .nvmrc` pattern keeps Node version as a single source of truth
- `files` allowlist in `package.json` is the correct way to exclude test artifacts (`.npmignore` is ignored when `files` is set)

### What Was Inefficient

- The first release workflow run failed because workflow files introduced via squash merge don't trigger on the merge push — a first-publish bootstrapping issue that cost several debug cycles
- OIDC trusted publishing required the package to already exist on npm before the token exchange works — chicken-and-egg for first publish
- The repository field in npm trusted publisher config must be just the repo name, not the full URL — not obvious from the npm UI

### Patterns Established

- Workflows should use `node-version-file: .nvmrc` rather than hardcoded versions
- First npm publish must be done manually or with a short-lived token; OIDC takes over for all subsequent releases
- Add `workflow_dispatch` to release workflows from the start to enable manual re-triggering

### Key Lessons

1. When introducing GitHub Actions workflows via a squash merge for the first time, the merge commit won't trigger them — expect a silent no-op and follow up with a manual push or `workflow_dispatch`
2. npm OIDC trusted publishing requires the package to exist before the first OIDC exchange — bootstrap with a manual publish using `--tag dev`
3. The npm `files` allowlist takes precedence over `.npmignore` — use `files` with negation patterns (`!dist/**/*.test.js`) to exclude artifacts

### Cost Observations

- Model mix: primarily claude-sonnet-4-6
- Sessions: ~2 sessions across one day
- Notable: productionization work (CI, release pipeline, npm publishing quirks) took longer than the actual feature implementation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0      | ~2       | 3      | First milestone — baseline established |

### Cumulative Quality

| Milestone | Tests | Coverage | Notes |
|-----------|-------|----------|-------|
| v1.0      | 8     | config module | Live cmux tests out of scope |

### Top Lessons (Verified Across Milestones)

1. CI/CD bootstrapping has unavoidable first-publish manual steps — document them, don't fight them
