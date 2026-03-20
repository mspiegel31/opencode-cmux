# Requirements: opencode-cmux

**Defined:** 2026-03-19
**Core Value:** When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.

## v1 Requirements

### Project Foundation

- [ ] **FOUND-01**: TypeScript compiles to `dist/` via `tsc` with declaration files (`.d.ts`)
- [ ] **FOUND-02**: `package.json` is `"type": "module"`, ESNext target, with correct `main`/`types`/`exports` fields pointing to `dist/`
- [ ] **FOUND-03**: `@opencode-ai/plugin` declared as a dependency in `package.json`
- [ ] **FOUND-04**: `.nvmrc` pinned to Node.js 24 LTS
- [ ] **FOUND-05**: Bun used as package manager — `bun install`, `bun test`, `bun run build` all work
- [ ] **FOUND-06**: `index.ts` entry point that exports both `CmuxPlugin` and `CmuxSubagentViewer`

### Config System

- [ ] **CONF-01**: Per-plugin config loaded from `~/.config/opencode/opencode-cmux.json`
- [ ] **CONF-02**: Config file bootstrapped (auto-created with defaults) on first run if missing
- [ ] **CONF-03**: Each plugin can be individually enabled/disabled via config (`cmuxNotify.enabled`, `cmuxSubagentViewer.enabled`)
- [ ] **CONF-04**: Config values overridable via environment variables (`CMUX_NOTIFY_ENABLED`, `CMUX_SUBAGENT_VIEWER_ENABLED`)

### CI/CD

- [ ] **CICD-01**: GitHub Actions CI workflow runs typecheck + build on push/PR to main
- [ ] **CICD-02**: GitHub Actions publish workflow publishes to npm on merge to main
- [ ] **CICD-03**: Publish workflow bumps package version before publishing
- [ ] **CICD-04**: Semver bump type derived from conventional commit title (`feat:` → minor, `fix:`/`chore:` → patch, `feat!`/`BREAKING` → major)

### Documentation

- [ ] **DOCS-01**: README covers installation, `opencode.json` config registration, per-plugin config options, and environment variables

## v2 Requirements

### Enhanced Config

- **CONF-V2-01**: GUI or CLI helper to edit config interactively
- **CONF-V2-02**: Project-level config override (`.opencode/opencode-cmux.json`)

### Plugin Enhancements

- **PLUG-V2-01**: Configurable pane layout strategy (vertical vs. horizontal splits)
- **PLUG-V2-02**: Custom notification templates for cmux notify events

## Out of Scope

| Feature | Reason |
|---------|--------|
| Linux/Windows cmux support | cmux is macOS-only |
| Tests for cmux CLI interactions | Requires a live cmux process — integration test infra out of scope for v1 |
| Monorepo / multiple packages | Single package; both plugins are small and tightly coupled |
| OpenCode Desktop/Web support | cmux is a terminal multiplexer; irrelevant outside CLI |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| CICD-01 | Phase 3 | Pending |
| CICD-02 | Phase 3 | Pending |
| CICD-03 | Phase 3 | Pending |
| CICD-04 | Phase 3 | Pending |
| DOCS-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
