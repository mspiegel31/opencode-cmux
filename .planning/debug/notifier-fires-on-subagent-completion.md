---
status: awaiting_human_verify
trigger: "right now the notifier causes a notification to be fired each time a subagent completes a task. this is not what I want. I only want notifications on the main conversational loop, and the subagents to just be displayed as a 'read-only' or UI concern."
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:02:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED
test: TypeScript type-check (npx tsc --noEmit) and test suite (npx vitest run) both pass
expecting: User confirms subagent completions no longer trigger notifications
next_action: Await human verification

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Notifications only fire when the main conversational loop completes a message (not subagents)
actual: A notification fires each time ANY subagent completes a task
errors: (none reported - behavioral bug)
reproduction: Run a task that spawns subagents; each subagent completion triggers a notification
started: unknown

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-20T00:01:00Z
  checked: src/cmux-notify.ts lines 26-33 (original)
  found: |
    The event handler fires on EventType.SessionIdle and EventType.SessionError unconditionally.
    There is no check for whether the session is a subagent or the main session.
  implication: Every session completion (main loop AND subagents) triggers a notification.

- timestamp: 2026-03-20T00:01:00Z
  checked: EventSessionIdle type in node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts line 413-418
  found: |
    EventSessionIdle = { type: "session.idle"; properties: { sessionID: string } }
    EventSessionError = { type: "session.error"; properties: { sessionID?: string; error?: ... } }
    Neither event carries parentID directly.
  implication: Cannot distinguish subagent from main session purely from the event payload.

- timestamp: 2026-03-20T00:01:00Z
  checked: Session type in SDK types (line 465-486)
  found: |
    Session has `parentID?: string` — present when session is a child/subagent, absent for main sessions.
  implication: We CAN distinguish by fetching session info via client API using sessionID, then checking parentID.

- timestamp: 2026-03-20T00:01:00Z
  checked: sdk.gen.d.ts — ctx.client.session.get({ path: { id: sessionID } }) returns Session
  found: |
    client.session.get takes { path: { id: string } } and returns Session with parentID?: string
  implication: Fix is to call this API and bail out early if parentID is set.

- timestamp: 2026-03-20T00:02:00Z
  checked: npx tsc --noEmit && npx vitest run
  found: Zero type errors, all 8 tests pass.
  implication: Fix is structurally correct and doesn't break anything.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  cmux-notify.ts fired a desktop notification on every `session.idle` and `session.error` event.
  These events only carry `sessionID`, not `parentID`. The plugin had no filtering — it treated all
  sessions identically. When subagents (child sessions with parentID set) complete, the same
  notification fired as for the main conversational loop.

fix: |
  Added an `isSubagent(sessionID)` helper in CmuxPlugin that calls `ctx.client.session.get`
  to fetch the full Session object and checks `parentID`. If parentID is present, the session
  is a subagent and we return early without firing a notification. Applied to both SessionIdle
  and SessionError handlers.

verification: TypeScript type-check clean, all 8 tests pass. Awaiting manual E2E confirmation.
files_changed:
  - src/cmux-notify.ts
