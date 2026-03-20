---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Port Discovery
status: planning
last_updated: "2026-03-20T14:00:00.000Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
---

# Project State: opencode-cmux

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-20)

**Core value:** When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.
**Current focus:** v1.1 — eliminate `lsof`-based port discovery workaround

## Current Position

Milestone v1.0 shipped. v1.1 goals defined — Port Discovery milestone.

## Recent Work

- 2026-03-20: v1.0 milestone complete — `@mspiegel31/opencode-cmux@1.0.0` published to npm
- 2026-03-20: CI + release workflows operational with OIDC trusted publishing
- 2026-03-19: All 3 phases complete (foundation, config system, CI/CD & docs)

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Package name | `@mspiegel31/opencode-cmux` |
| Module system | ESM (`"type": "module"`) |
| Build tool | `tsc` (produces `.d.ts` declarations) |
| Package manager | npm (migrated from Bun) |
| Test runner | vitest |
| Node.js version | 24 LTS (`.nvmrc`) |
| Config system | JSON file at `~/.config/opencode/opencode-cmux.json`, bootstrapped lazily inside cmux |
| Semver strategy | Conventional commits via semantic-release |
| npm auth | OIDC trusted publishing — no long-lived token |

## Open Issues

- None

## Session Continuity

Last session: 2026-03-20
Next action: Track upstream PR #18417 (anomalyco/opencode). When merged, execute Phase 5 — remove lsof fallback, simplify plugin to use ctx.serverUrl directly, update README to drop --port 0 requirement.
