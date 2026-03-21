---
phase: 07-refactor-cmux-notify
plan: "01"
subsystem: api
tags: [typescript, class, dispatch-map, plugin-base, vitest, tdd, mapped-types, typed-dispatcher]

# Dependency graph
requires:
  - phase: 05-event-coverage
    provides: EventType constants and PluginBase class in src/lib/plugin-base.ts
  - phase: 04-config-foundation
    provides: loadConfig() and Config type in src/config.ts
provides:
  - Class-based CmuxNotifyPlugin extending PluginBase
  - EventHandlerMap mapped type + createEventDispatcher() factory in plugin-base.ts
  - Typed event handlers (SDK-known events get full property types, no casts)
  - parseConfig() export in config.ts for test use without filesystem I/O
  - Behavior tests using real config instead of vi.mock
  - CmuxPlugin factory export unchanged (no consumer API changes)
affects: [future-event-additions, plugin-consistency, cmux-subagent-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Class-based plugin pattern: extends PluginBase, implements hooks(), async init() before hooks()"
    - "Typed dispatch: EventHandlerMap mapped type routes each event type to a handler receiving the narrowed SDK variant via Extract<Event, {type: K}>"
    - "createEventDispatcher(typed, extra) — typed map for SDK-known events, extra map for forward-compat events not yet in SDK union"
    - "TDD: RED commit (failing tests) → GREEN commit (implementation) → no REFACTOR needed"
    - "parseConfig() for tests — real Zod schema validation, no filesystem I/O, no vi.mock"

key-files:
  created:
    - src/cmux-notify.test.ts
  modified:
    - src/cmux-notify.ts
    - src/lib/plugin-base.ts
    - src/config.ts

key-decisions:
  - "EventHandlerMap mapped type: [K in Event['type']]?: (event: Extract<Event, {type: K}>) => Promise<void> — handlers receive narrowed SDK variants, no manual casts in typed handlers"
  - "createEventDispatcher(typed, extra): typed map for SDK-known events (full property types); extra map for forward-compat events not yet in SDK union (question.*, permission.asked) — isolates all casts to one place"
  - "No Backstage EventRouter analogy: Backstage's pattern is topic-based pub/sub re-routing (different problem); the mapped type approach is purpose-built for discriminated union dispatch"
  - "parseConfig(overrides?) added to config.ts: wraps ConfigSchema.parse({}), no filesystem I/O — replaces vi.mock in tests"
  - "init(config?: Config): optional Config param lets tests inject parseConfig() result, bypassing loadConfig() entirely"
  - "PermissionReplied fixture corrected: SDK field is permissionID (not id) — typed handler made the mismatch immediately visible"
  - "tui.prompt.append returned via widened type (legacy hook not in current SDK Hooks interface) — using 'hooks as Hooks' cast to preserve runtime behavior"

patterns-established:
  - "Plugin pattern: class extends PluginBase → async init(config?) sets config → hooks() returns createEventDispatcher result"
  - "Typed event dispatch: EventHandlerMap + createEventDispatcher() in plugin-base.ts — reusable by any future plugin"
  - "Test config injection: parseConfig() + init(config?) replaces vi.mock for config-dependent plugin tests"

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
- Added `EventHandlerMap` mapped type + `createEventDispatcher()` factory to `plugin-base.ts` — reusable by any future plugin
- SDK-typed handlers (`typedHandlers`) access `.properties` with full types (e.g. `permissionID` from `EventPermissionReplied`) — no casts
- Forward-compat events not yet in SDK union (`question.*`, `permission.asked`) isolated in `extraHandlers` with casts confined there
- `parseConfig(overrides?)` added to `config.ts`; `init(config?)` accepts optional injection — eliminates `vi.mock` from tests
- `PermissionReplied` test fixture corrected to use SDK field name `permissionID` (typed handler caught the mismatch)
- 10 behavior tests all green; typecheck + build clean
- All existing behavior preserved: sidebar state machine, notifications, permission/question tracking, `tui.prompt.append`

## Task Commits

Each task was committed atomically:

1. **RED — Failing tests** — `c448783` (test)
2. **GREEN — Class implementation** — `5e80d69` (feat)
3. **Typed dispatcher abstraction** — `24237f3` (feat) — `EventHandlerMap` + `createEventDispatcher()` in plugin-base; typedHandlers/extraHandlers split in cmux-notify
4. **Test improvements + parseConfig** — `832de62` (test) — removes `vi.mock`, adds `parseConfig()`, fixes `PermissionReplied` fixture

_Task 2 (typecheck + build verification) — no files changed, no commit_

## Files Created/Modified
- `src/lib/plugin-base.ts` — Added `EventHandlerMap` mapped type + `createEventDispatcher()` factory
- `src/config.ts` — Added `parseConfig(overrides?)` export
- `src/cmux-notify.ts` — `typedHandlers: EventHandlerMap` (SDK-typed) + `extraHandlers` (forward-compat); `init(config?)` optional param
- `src/cmux-notify.test.ts` — 10 behavior tests; `vi.mock` removed; uses `parseConfig()` + `init(TEST_CONFIG)`

## Decisions Made
- **`EventHandlerMap` mapped type:** `[K in Event["type"]]?: (event: Extract<Event, { type: K }>) => Promise<void>` — each key constrains its handler's argument to the matching SDK event variant; TypeScript enforces this at definition time
- **`createEventDispatcher(typed, extra)`:** Single `as` cast confined to the factory's call site; all handlers receive correct types. `extra` map handles forward-compat events not yet in the SDK `Event` union
- **Backstage research finding:** Backstage's `EventRouter`/`SubTopicEventRouter` solves topic-based pub/sub re-routing (different problem); no reusable library exists for typed discriminated-union dispatch — the mapped type approach is the right solution
- **`parseConfig()` over `vi.mock`:** Real Zod validation, no filesystem I/O, supports overrides — strictly more correct than mocking the module
- **`init(config?)` injection:** Keeps `loadConfig()` as the production path; tests pass a real config object without touching the filesystem
- **Typed handlers caught a real bug:** `PermissionReplied` test fixture used `id` but SDK field is `permissionID` — invisible with `Record<string, unknown>` casts, immediately flagged with typed handlers
- **`tui.prompt.append` type workaround:** Legacy hook not in current SDK `Hooks` interface — built hooks object as wider type, returned as `hooks as Hooks` to preserve runtime behavior
- **No REFACTOR commit on initial GREEN:** Implementation was already clean; subsequent typed-dispatcher work is a separate, intentional improvement

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
- `createEventDispatcher()` is in `plugin-base.ts` and ready for use in any future plugin
- Future event type additions: add a handler to `typedHandlers` (if in SDK union) or `extraHandlers` (if forward-compat)
- When `question.*` / `permission.asked` land in the SDK `Event` union, move their handlers from `extraHandlers` to `typedHandlers` and drop the casts
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
