# Project State: opencode-cmux

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-19)

**Core value:** When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.
**Current focus:** Phase 1 — Project Foundation (not started)

## Current Position

- **Milestone:** v1.0.0
- **Phase:** Not started — ready for Phase 1
- **Phases complete:** 0 / 3

## Recent Work

- 2026-03-19: Codebase mapped (`.planning/codebase/` — 7 documents)
- 2026-03-19: Project initialized — PROJECT.md, config.json, REQUIREMENTS.md, ROADMAP.md created

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Package name | `@mspiegel31/opencode-cmux` |
| Module system | ESM (`"type": "module"`) |
| Build tool | `tsc` (produces `.d.ts` declarations) |
| Package manager | Bun |
| Node.js version | 24 LTS (`.nvmrc`) |
| Config system | JSON file at `~/.config/opencode/opencode-cmux.json`, bootstrapped on first run |
| Semver strategy | Conventional commits parsed in release workflow |

## Open Issues

- None at initialization

## Session Continuity

Last session: 2026-03-19 — Project initialized, ready to plan Phase 1.
Next action: `/gsd-plan-phase 1`
