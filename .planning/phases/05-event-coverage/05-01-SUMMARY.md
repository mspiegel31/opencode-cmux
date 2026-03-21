---
phase: 05-event-coverage
plan: "01"
subsystem: events
tags: [sidebar, notifications, permission, question, state-machine]

requires:
  - phase: 04-config-foundation
    provides: "Config type with notify.* and sidebar.enabled flags"
provides:
  - "Sidebar state machine (working/waiting/question/clear) in cmux-notify.ts"
  - "Permission request desktop notify + sidebar status"
  - "Question event desktop notify + sidebar status"
  - "Pending-input Sets gating idle→done path"
  - "4 new EventType constants in plugin-base.ts"
affects: [06-schema-hosting]

tech-stack:
  added: []
  patterns:
    - "pendingPermissions/pendingQuestions Set<string> for ID-based deduplication"
    - "isWaitingForInput() guard pattern preventing spurious done notifications"
    - "sessionBusy flag for correct sidebar restore after input is cleared"
    - "permission.ask hook for eager ID registration before event fires"
    - "getPermissionId() helper for v1/v2 property shape normalization"

key-files:
  created: []
  modified:
    - src/lib/plugin-base.ts
    - src/cmux-notify.ts

key-decisions:
  - "Cast event to { type: string; properties: Record<string, unknown> } — plugin SDK union type is too loose for narrowing"
  - "getPermissionId() helper handles id/requestID/permissionID property name variants across SDK versions"
  - "Desktop notify fires on the event (not in permission.ask hook) to avoid double-notification"
  - "SessionError clears both pending Sets — error state terminates all pending input"
  - "SessionIdle kept as legacy fallback alongside session.status for SDK version compatibility"

patterns-established:
  - "isWaitingForInput() is the canonical guard before any idle→done transition"
  - "All sidebar calls routed through named helpers (sidebarSetWorking/Waiting/Question/Clear) — never inline"
  - "config.sidebar.enabled checked once inside each helper, not at call sites"

requirements-completed: [EVT-01, EVT-02, EVT-03, EVT-04]

duration: 15min
completed: 2026-03-20
---

# Plan 05-01: Sidebar State Machine + Permission/Question Handlers Summary

**Full sidebar state machine with pending-input Sets, permission and question event handlers, and `permission.ask` hook — 16/16 tests, typecheck and build clean**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (EventType additions, cmux-notify.ts rewrite)
- **Files modified:** 2

## Accomplishments
- Sidebar tracks primary session state in real-time: working (amber) → waiting (red) → question (purple) → cleared
- `pendingPermissions` and `pendingQuestions` Sets prevent "Done" notify while session is blocked
- `permission.ask` hook registers ID eagerly before event, closing race condition with `session.status idle`
- `getPermissionId()` normalizes id/requestID/permissionID across SDK versions
- `sessionBusy` flag enables correct sidebar restore: after permission/question clears, restores "working" if session still active
- SessionError clears all pending state and sidebar immediately
- 4 new EventType constants: PermissionAsked, QuestionAsked, QuestionReplied, QuestionRejected

## Files Created/Modified
- `src/lib/plugin-base.ts` — 4 new EventType constants (PermissionAsked, QuestionAsked, QuestionReplied, QuestionRejected)
- `src/cmux-notify.ts` — extended with sidebar state machine, permission/question handlers, permission.ask hook

## Decisions Made
- Event properties cast via `as { type: string; properties: Record<string, unknown> }` — the plugin SDK's union type doesn't narrow cleanly without it
- `getPermissionId()` helper created to handle `id`/`requestID`/`permissionID` variants — Caso's analysis showed multiple property names used across SDK versions
- Desktop notify for permissions fires on the event (not the hook) to avoid double-notification when both fire
- SessionError clears all pending Sets — an error terminates all in-flight input requests

## Deviations from Plan
- Plan showed cmux CLI args as positional (`cmux set-status opencode Working --icon ...`). Actual CLI uses `--text` flag. Fixed by using `--text 'Working'` flag form.

## Issues Encountered
None — TypeScript accepted the implementation without errors on first pass.

## Next Phase Readiness
- Phase 5 complete — sidebar state machine operational
- Phase 6 (Schema Hosting) can proceed immediately — depends on Phase 4 (config.ts) which is complete; no Phase 5 dependency

---
*Phase: 05-event-coverage*
*Completed: 2026-03-20*
