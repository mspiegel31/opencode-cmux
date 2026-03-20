---
phase: 02-config-system
plan: 02
subsystem: config
tags: [bun, typescript, config, plugins, esm]

requires:
  - phase: 02-config-system/02-01
    provides: loadConfig(), ConfigSchema, CMUX_CONFIG_PATH test hook

provides:
  - CmuxPlugin guarded by config.cmuxNotify.enabled
  - CmuxSubagentViewer guarded by config.cmuxSubagentViewer.enabled
  - Both plugins skip all hooks when their enabled flag is false
  - Config system fully wired into both production plugins

affects: [any future plugin, integration tests, end-to-end testing]

tech-stack:
  added: []
  patterns:
    - "Config guard after env var fast-path: CMUX_* env var first, config second"
    - "Early return {} pattern for disabled plugins — no hooks registered"

key-files:
  created: []
  modified:
    - src/cmux-notify.ts
    - src/cmux-subagent-viewer.ts

key-decisions:
  - "Config check placed AFTER existing env var guard — preserves fast-path for non-cmux environments"
  - "import { loadConfig } from './config.js' — value import, not type-only (matches codebase ESM convention)"

patterns-established:
  - "Plugin enable/disable guard: call loadConfig() after env var guard, return {} if disabled"
  - "Both plugins follow identical guard pattern for consistency"

requirements-completed: [CONF-01, CONF-03]

duration: 5min
completed: 2026-03-20
---

# Phase 02-02: Plugin Config Wiring Summary

**Both CmuxPlugin and CmuxSubagentViewer wired to loadConfig(), returning {} when their enabled flag is false — config system fully operational**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T01:53:00Z
- **Completed:** 2026-03-20T01:58:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CmuxPlugin (cmux-notify.ts) checks `config.cmuxNotify.enabled` after CMUX_SURFACE_ID guard
- CmuxSubagentViewer (cmux-subagent-viewer.ts) checks `config.cmuxSubagentViewer.enabled` after CMUX_WORKSPACE_ID guard
- All 16 tests pass (8 config unit tests + 8 pre-existing tests)
- Typecheck clean, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire CmuxPlugin to config (cmux-notify.ts)** - `a009c2e` (feat)
2. **Task 2: Wire CmuxSubagentViewer to config (cmux-subagent-viewer.ts)** - `d0a7b15` (feat)

## Files Created/Modified
- `src/cmux-notify.ts` — Added loadConfig() import and cmuxNotify.enabled guard
- `src/cmux-subagent-viewer.ts` — Added loadConfig() import and cmuxSubagentViewer.enabled guard

## Decisions Made
- Config guard placed AFTER existing env var guard (CMUX_SURFACE_ID / CMUX_WORKSPACE_ID) — preserves fast-path: plugins that aren't in a cmux environment bail out immediately without reading config
- `import { loadConfig }` (value import, not `import type`) — loadConfig is called at runtime

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Config system complete: both plugins respect enable/disable flags from `~/.config/opencode/opencode-cmux.json`
- Users can disable either plugin by setting `cmuxNotify.enabled: false` or `cmuxSubagentViewer.enabled: false`
- Env var overrides (`CMUX_NOTIFY_ENABLED`, `CMUX_SUBAGENT_VIEWER_ENABLED`) work as highest-priority overrides
- Phase 02 complete — no blockers for Phase 03 (if planned)

## Self-Check

- [x] `src/cmux-notify.ts` has `loadConfig` import and `cmuxNotify.enabled` guard: ✓
- [x] `src/cmux-subagent-viewer.ts` has `loadConfig` import and `cmuxSubagentViewer.enabled` guard: ✓
- [x] Commits `a009c2e` and `d0a7b15` exist: ✓
- [x] All 16 tests pass: ✓
- [x] Typecheck clean: ✓
- [x] Build succeeds: ✓

## Self-Check: PASSED

---
*Phase: 02-config-system*
*Completed: 2026-03-20*
