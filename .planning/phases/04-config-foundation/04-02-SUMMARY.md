---
phase: 04-config-foundation
plan: "02"
subsystem: config
tags: [zod, config, refactor, typescript]

requires:
  - phase: 04-01
    provides: "ConfigSchema, Config type, loadConfig() with new notify.* shape"
provides:
  - "cmux-notify.ts using config.notify.sessionDone and config.notify.sessionError"
  - "cmux-subagent-viewer.ts confirmed compatible with new Config type"
  - "Full codebase typechecks and builds cleanly"
affects: [05-event-coverage, 06-schema-hosting]

tech-stack:
  added: []
  patterns:
    - "Per-event config guards instead of single top-level enabled/disabled gate"

key-files:
  created: []
  modified:
    - src/cmux-notify.ts

key-decisions:
  - "Removed top-level config.cmuxNotify.enabled guard — replaced with per-event config.notify.sessionDone / config.notify.sessionError guards"
  - "cmux-subagent-viewer.ts needed no source changes — config.cmuxSubagentViewer.enabled key path unchanged in new schema"

patterns-established:
  - "Each event handler guards on its own specific config.notify.* flag"

requirements-completed: [CONF-V2-CALLSITES]

duration: 5min
completed: 2026-03-20
---

# Plan 04-02: Call-Site Refactor Summary

**Per-event config guards in cmux-notify.ts; zero TypeScript errors; typecheck, test, and build all pass**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 (update cmux-notify.ts, verify full suite)
- **Files modified:** 1

## Accomplishments
- Removed `config.cmuxNotify.enabled` single-guard; replaced with `config.notify.sessionDone` and `config.notify.sessionError` per-event
- `cmux-subagent-viewer.ts` required no changes — `config.cmuxSubagentViewer.enabled` key path identical in new schema
- `npm run typecheck`, `npm test`, and `npm run build` all exit 0

## Files Created/Modified
- `src/cmux-notify.ts` — removed top-level enabled guard, added per-event guards

## Decisions Made
- None beyond the plan spec — mechanical refactor executed as written

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 4 (Config Foundation) is fully complete
- Phase 5 (Event Coverage Expansion) can begin: `cmux-notify.ts` ready for new event handlers (permissionRequest, question, sidebar state machine)
- Phase 6 (Schema Hosting) can begin in parallel: `src/config.ts` exports `ConfigSchema` which the generation script will import

---
*Phase: 04-config-foundation*
*Completed: 2026-03-20*
