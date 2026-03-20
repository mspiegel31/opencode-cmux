---
phase: 07-refactor-cmux-notify
plan: "01"
subsystem: api
tags: [typescript, class, dispatch-map, plugin-base, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-event-coverage
    provides: EventType constants and PluginBase class in src/lib/plugin-base.ts
  - phase: 04-config-foundation
    provides: loadConfig() and Config type in src/config.ts
provides:
  - Class-based CmuxNotifyPlugin extending PluginBase
  - Dispatch map replacing if-chain in event handler
  - Behavior tests for dispatch routing and state management
  - CmuxPlugin factory export unchanged (no consumer API changes)
affects: [future-event-additions, plugin-consistency, cmux-subagent-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Class-based plugin pattern: extends PluginBase, implements hooks(), async init() before hooks()"
    - "Dispatch map pattern: Record<EventType, (event: Event) => Promise<void>> replacing if-chain"
    - "TDD: RED commit (failing tests) → GREEN commit (implementation) → no REFACTOR needed"

key-files:
  created:
    - src/cmux-notify.test.ts
  modified:
    - src/cmux-notify.ts

key-decisions:
  - "Used dispatch map (Record<EventType, handler>) to replace if-chain — matches cmux-subagent-viewer.ts pattern"
  - "tui.prompt.append returned via widened type (legacy hook not in current SDK Hooks interface) — using 'hooks as Hooks' cast to preserve runtime behavior"
  - "Reset shellCalls after init() in beforeEach to isolate dispatch routing assertions from init side effects"

patterns-established:
  - "Plugin pattern: class extends PluginBase → async init() sets config → hooks() returns dispatch map"
  - "Dispatch map initialization: private readonly dispatch as class field arrow functions for correct this binding"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 7 Plan 01: Refactor cmux-notify to Class-Based with Dispatch Map Summary

**Class-based CmuxNotifyPlugin extending PluginBase with Record<EventType, handler> dispatch map replacing 10-branch if-chain**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T23:03:54Z
- **Completed:** 2026-03-20T23:08:14Z
- **Tasks:** 2 (1 TDD: 2 commits + 1 verification)
- **Files modified:** 2

## Accomplishments
- Refactored `cmux-notify.ts` from closure-based to class-based `CmuxNotifyPlugin extends PluginBase`
- All closure state (`pendingPermissions`, `pendingQuestions`, `sessionBusy`, `hinted`) migrated to class instance fields
- Event if-chain replaced by dispatch map (`Record<string, (event: Event) => Promise<void>>`)
- 10 behavior tests covering dispatch routing, state transitions, and structure (all green)
- All existing behavior preserved: sidebar state machine, notifications, permission/question tracking, `tui.prompt.append`

## Task Commits

Each task was committed atomically:

1. **RED — Failing tests** - `c448783` (test)
2. **GREEN — Class implementation** - `5e80d69` (feat)

_Task 2 (typecheck + build verification) — no files changed, no commit_

## Files Created/Modified
- `src/cmux-notify.ts` — Refactored to `class CmuxNotifyPlugin extends PluginBase` with dispatch map event router
- `src/cmux-notify.test.ts` — 10 behavior tests: dispatch routing (Tests 1-8), structure (Tests 9-10)

## Decisions Made
- **Dispatch map as class field:** Arrow functions in `private readonly dispatch` ensure correct `this` binding without `.bind()` calls
- **`tui.prompt.append` type workaround:** Legacy hook not in current SDK `Hooks` interface — built hooks object as wider type, returned as `hooks as Hooks` to satisfy TypeScript without altering runtime behavior
- **No REFACTOR commit:** Implementation was already clean coming out of GREEN — no obvious cleanup warranted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test shellCalls isolation after init()**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** Test 8 ("unknown event → no side effects") expected 0 shell calls but got 1 because `init()` calls `cmux help 2>&1` via the Proxy shell — the shellCalls array was not reset after init, contaminating dispatch-only tests
- **Fix:** Added `shellCalls.length = 0` immediately after `p.init()` in `beforeEach` to isolate dispatch routing assertions from init-time side effects
- **Files modified:** `src/cmux-notify.test.ts`
- **Verification:** Test 8 passes (0 shell calls for unknown events)
- **Committed in:** `5e80d69` (combined with GREEN implementation commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug in test isolation)
**Impact on plan:** Minor test fix needed to properly isolate dispatch routing assertions. No scope creep.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 07 complete — both plugins (`cmux-notify.ts` and `cmux-subagent-viewer.ts`) now follow identical class-based `PluginBase` pattern
- Future event type additions: add one handler to the dispatch map in `CmuxNotifyPlugin.dispatch`
- No blockers

## Self-Check: PASSED

- ✅ `src/cmux-notify.ts` — FOUND (`class CmuxNotifyPlugin extends PluginBase`)
- ✅ `src/cmux-notify.test.ts` — FOUND (10 tests all green)
- ✅ `.planning/phases/07-refactor-cmux-notify/07-01-SUMMARY.md` — FOUND
- ✅ Commit `c448783` (RED: failing tests) — FOUND
- ✅ Commit `5e80d69` (GREEN: implementation) — FOUND
- ✅ Dispatch map pattern (`dispatch[event.type]`) — FOUND in src/cmux-notify.ts
- ✅ `npm test` — 26/26 tests pass
- ✅ `npm run typecheck` — 0 errors
- ✅ `npm run build` — dist/ produced cleanly
- ✅ `src/index.ts` unchanged — `CmuxPlugin` still exported from `./cmux-notify.js`

---
*Phase: 07-refactor-cmux-notify*
*Completed: 2026-03-20*
