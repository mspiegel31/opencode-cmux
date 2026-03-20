---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Config, Events, and Schema Hosting
status: complete
last_updated: "2026-03-20T19:15:00.000Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 4
  completed_plans: 4
---

# Project State: opencode-cmux

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-20)

**Core value:** When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.
**Current focus:** v1.2 complete — ready to ship `@mspiegel31/opencode-cmux@1.2.0`.

## Current Position

v1.0 and v1.1 both complete. Plugin fully working — subagent viewer confirmed
working with `server.port: 4096` in opencode.json. v1.2 milestone fully defined
(superseded earlier sketch with richer scope covering three phases).

## Recent Work

- 2026-03-20: Phase 6 (Schema Hosting) complete — script/generate-schema.ts + .github/workflows/pages.yml; schema.json generated via zod/v4 toJSONSchema; Pages deploys on push to main
- 2026-03-20: Phase 5 (Event Coverage) complete — sidebar state machine (working/waiting/question/clear); permission.asked + permission.ask hook; question.asked/replied/rejected; isWaitingForInput() pattern; 4 new EventType constants
- 2026-03-20: Phase 4 (Config Foundation) complete — Zod ConfigSchema + jsonc-parser in src/config.ts; 16/16 tests; per-event notify.* guards in cmux-notify.ts; typecheck + build clean
- 2026-03-20: v1.2 milestone redefined — richer scope covering config foundation
  (Zod + jsonc-parser), event coverage expansion (sidebar state machine, permission
  notify, question research), and schema hosting (GitHub Pages). Wrote full
  `.planning/milestones/v1.2-MILESTONE.md`.
- 2026-03-20: v1.2 milestone first sketched — analyzed `0xCaso/opencode-cmux` and
  `anomalyco/opencode`
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
| v1.2 config shape | `notify.*` per-event flags + `sidebar.enabled` global toggle; Zod schema; JSONC comments in bootstrapped file |
| v1.2 Pages trigger | Push to `main` on every merge |
| v1.2 schema URL | `https://mspiegel31.github.io/opencode-cmux/schema.json` |
| v1.2 schema generation | Zod v4 built-in `toJSONSchema` (from `zod/v4` subpath) — `zod-to-json-schema` library incompatible with Zod v4 |
| v1.2 event detection | `session.status busy/idle` for sidebar; `permission.asked`+`permission.ask` hook; `question.asked/replied/rejected` |

## Open Issues

- None

## Roadmap Evolution

- Phase 7 added: Refactor cmux-notify to class-based with event dispatch map (v1.3)

## Session Continuity

Last session: 2026-03-20
Stopped at: Phase 7 added to roadmap — proceeding to plan
