---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Port Discovery
status: complete
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
**Current focus:** Planning v1.2

## Current Position

v1.0 and v1.1 both complete. Plugin fully working — subagent viewer confirmed working with `server.port: 4096` in opencode.json.

## Recent Work

- 2026-03-20: v1.1 resolved — server.port config workaround confirmed working via live test
- 2026-03-20: README updated with server.port instructions, upstream PR #18417 closed
- 2026-03-20: v1.0 milestone complete — `@mspiegel31/opencode-cmux@1.0.0` published to npm

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
Next action: Define v1.2 goals.
