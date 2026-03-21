---
phase: 04-config-foundation
plan: "01"
subsystem: config
tags: [zod, jsonc-parser, config, validation]

requires: []
provides:
  - "Zod ConfigSchema with notify.*, sidebar.*, cmuxSubagentViewer.* shape"
  - "Config type (z.infer<typeof ConfigSchema>)"
  - "loadConfig() with jsonc-parser, ZodError fallback, JSONC bootstrap"
affects: [04-02, 05-event-coverage, 06-schema-hosting]

tech-stack:
  added: [zod, jsonc-parser]
  patterns:
    - "Zod .strip() on top-level object to silently drop unknown keys"
    - "jsonc-parser parse() with errors array for malformed input detection"
    - ".default(() => ({...})) factory pattern required for Zod v4 object defaults"

key-files:
  created: []
  modified:
    - src/config.ts
    - src/config.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Used .default(() => ({...})) factory pattern — Zod v4 requires full value or factory for object defaults, not empty {}"
  - "jsonc-parser errors array (second arg) used to detect malformed input — parse() never throws"
  - "DEFAULT_CONFIG export removed; replaced by ConfigSchema.parse({}) and Config type"

patterns-established:
  - "ConfigSchema.parse({}) is the canonical way to get all defaults"
  - "loadConfig() always returns a fully-typed Config — no Partial<> anywhere"
  - "Env var overrides applied after Zod parse, mutate the result object directly"

requirements-completed: [CONF-V2-ZOD, CONF-V2-JSONC]

duration: 15min
completed: 2026-03-20
---

# Plan 04-01: Zod Schema + jsonc-parser Migration Summary

**Zod ConfigSchema with per-event notify.* flags, sidebar.enabled, and jsonc-parser replacing JSON.parse — 16/16 tests passing**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (install deps, write tests RED, implement GREEN)
- **Files modified:** 4

## Accomplishments
- Replaced hand-rolled partial-merge with `ConfigSchema.parse()` — nested defaults handled by Zod
- jsonc-parser enables JSONC comments in user config files
- Bootstrapped config file now includes `$schema` field and `//` comments explaining each field
- ZodError fallback logs structured warning and returns full defaults (no uncaught exceptions)
- `CMUX_NOTIFY_ENABLED` now sets all four `notify.*` flags (sessionDone, sessionError, permissionRequest, question)

## Files Created/Modified
- `src/config.ts` — full rewrite: Zod schema, jsonc-parser, JSONC bootstrap template
- `src/config.test.ts` — full rewrite: 16 tests covering all new behaviors
- `package.json` — zod + jsonc-parser added to dependencies
- `package-lock.json` — lockfile updated

## Decisions Made
- `.default(() => ({...}))` factory pattern required — Zod v4 does not accept `{}` as a default for objects with required-by-type fields; factory avoids the overload mismatch
- jsonc-parser's `parse()` never throws — must inspect the `errors` array (second argument) to detect malformed input
- `DEFAULT_CONFIG` export removed entirely; consumers use `ConfigSchema.parse({})` or the `Config` type

## Deviations from Plan
- Plan showed `.default({})` shorthand — does not compile in Zod v4. Fixed by using factory function pattern.

## Issues Encountered
- Zod v4 `.default({})` type error: the default must satisfy the output type of the schema, which includes all required (but defaulted) fields. Resolution: `.default(() => ({ sessionDone: true, ... }))`.
- jsonc-parser `parse()` does not throw on malformed input — it silently returns `undefined`/`{}` and populates an errors array. The plan's `try/catch` pattern had to be replaced with errors-array inspection.

## Next Phase Readiness
- `src/config.ts` exports `ConfigSchema`, `Config`, `loadConfig()` — all call sites ready for 04-02
- `npm run typecheck` will fail until 04-02 updates `cmux-notify.ts` (expected — `config.cmuxNotify` reference)
- Phase 05 (event coverage) and Phase 06 (schema hosting) can both import from `src/config.ts` after 04-02

---
*Phase: 04-config-foundation*
*Completed: 2026-03-20*
