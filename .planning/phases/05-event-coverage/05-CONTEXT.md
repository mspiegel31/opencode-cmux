# Phase 5: Event Coverage Expansion — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Extends `src/cmux-notify.ts` with:
1. A sidebar state machine (`cmux set-status`/`cmux clear-status`) tracking primary session state (working → waiting → question → idle)
2. Desktop notification for `permission.asked`/`permission.updated` events
3. Desktop notification + sidebar status for `question.asked`/`question.replied`/`question.rejected` events
4. Pending-input tracking (`pendingPermissions: Set<string>`, `pendingQuestions: Set<string>`) that gates the idle→done path to prevent spurious "Done" notifications while blocked

Does NOT include: subagent pane changes, config schema changes (done in Phase 4), schema hosting (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Infrastructure — Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase adding event handlers to an existing plugin file.

### Key confirmed facts (from Caso's plugin full source analysis)
- `session.status` fires with `status.type: "busy" | "idle"` — use for sidebar working/done transitions
- `permission.asked` (v2) and `permission.updated` (v1) both need handling — use `||` check
- `permission.ask` hook fires synchronously before the event — register pending ID eagerly
- `question.asked` fires with `properties.questions[0].header` as the question text
- `question.replied` and `question.rejected` both clear the pending question state
- `pendingPermissions: Set<string>` and `pendingQuestions: Set<string>` — ID-based deduplication
- `isWaitingForInput()` returns `pendingPermissions.size > 0 || pendingQuestions.size > 0`
- Sidebar status key: `"opencode"` (distinct from subagent `agent-N` keys)

### Sidebar state transitions
- `session.status busy` + `!isWaitingForInput()` → set-status "working" (amber, terminal icon)
- `session.status idle` + `!isWaitingForInput()` + primary session → clear-status + done notify
- `permission.asked`/`permission.updated` (new ID) → set-status "waiting" (red, lock icon) + notify
- `permission.replied` → delete from set; if !isWaitingForInput() restore "working" or clear
- `question.asked` (new ID) → set-status "question" (purple, help-circle icon) + notify
- `question.replied`/`question.rejected` → delete from set; if !isWaitingForInput() restore or clear

### Config gates
- `config.notify.sessionDone` — already wired in 04-02, keep
- `config.notify.sessionError` — already wired in 04-02, keep
- `config.notify.permissionRequest` — gate desktop notify for permission events
- `config.notify.question` — gate desktop notify for question events
- `config.sidebar.enabled` — gate ALL set-status/clear-status calls

### EventType additions needed in plugin-base.ts
- `SessionStatus = "session.status"` (if not present)
- `PermissionAsked = "permission.asked"` (v2 alias)
- `QuestionAsked = "question.asked"`
- `QuestionReplied = "question.replied"`
- `QuestionRejected = "question.rejected"`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isSubagent()` helper in `cmux-notify.ts` — reuse for filtering primary-only events
- `EventType` enum in `src/lib/plugin-base.ts` — add new event types here
- `config.notify.*` and `config.sidebar.*` from Phase 4 — fully typed, use directly
- `CMUX_SURFACE_ID` guard at top of `CmuxPlugin` — already guards sidebar calls

### Established Patterns
- All cmux CLI calls use `await $\`cmux ...\`.quiet()` with `.nothrow()` or try/catch
- Plugin returns early with `{}` if not in cmux context
- `config` loaded once at plugin init via `loadConfig()`

### Integration Points
- `src/cmux-notify.ts` `CmuxPlugin` — all new event handlers go here
- `src/lib/plugin-base.ts` `EventType` enum — new event type string constants
- `permission.ask` hook — add alongside existing `event` handler in the returned hooks object

</code_context>

<specifics>
## Specific Ideas

- Sidebar state colors: working=#f59e0b (amber), waiting=#ef4444 (red), question=#a855f7 (purple)
- Sidebar icons: working=terminal, waiting=lock, question=help-circle
- Notify titles: permission="OpenCode needs permission", question="OpenCode has a question"
- Subagent sessions: skip all sidebar/notify for primary-session events; subagents handled by CmuxSubagentViewer
- No new test file for cmux-notify.ts integration (cmux CLI calls can't be unit tested without mocks; integration is tested manually)

</specifics>

<deferred>
## Deferred Ideas

- Exposing sidebar helpers (setStatus, clearStatus, notify, log) as a public API — v1.3
- Exposing `isInCmux()` as public export — v1.3
- Linux support — cmux is macOS-only for now

</deferred>
