# Concerns

## Critical Gaps (Blockers)

### 1. Missing `index.js` entry point
- **File:** `package.json` → `"main": "index.js"`
- **Problem:** The file does not exist. Any consumer trying to `require('opencode-cmux')` will get a module-not-found error.
- **Fix needed:** Create `index.ts` (or `index.js`) that exports the plugins, and compile it.

### 2. Missing TypeScript compilation pipeline
- **Problem:** Source is TypeScript but there is no `tsconfig.json`, no build script, and no compiled output.
- **Fix needed:** Add `tsconfig.json`, install `typescript` (or use `bun build`), add a `build` script.

### 3. `@opencode-ai/plugin` not listed in `package.json` dependencies
- **File:** `package.json`
- **Problem:** All source files import from `@opencode-ai/plugin`, but it is not in `dependencies` or `devDependencies`. The package will fail to install/compile for any consumer.
- **Fix needed:** Run `npm install @opencode-ai/plugin` (or `bun add @opencode-ai/plugin`) and commit the updated `package.json`.

### 4. No `node_modules/` — dependencies not installed
- **Problem:** Immediately follows from #3. Nothing can be compiled or tested without installing deps first.

## Technical Debt

### 5. Empty catch blocks hide errors
- **Files:** `lib/cmux-subagent-viewer.ts` (in `createPane`, `closePane`), `lib/cmux-utils.ts`
- **Problem:** cmux CLI failures are silently swallowed. If a `cmux` command fails for an unexpected reason (wrong surface ID, cmux bug, version mismatch), there is no logging or recovery path.
- **Risk:** Debugging will be very hard if cmux commands silently fail.
- **Suggestion:** At minimum, log failures to `cmux log` or `console.error` in development mode.

### 6. `firstViewerSurface` reset logic may be incorrect
- **File:** `lib/cmux-subagent-viewer.ts:155-158`
- **Problem:** `paneCount` and `firstViewerSurface` are reset when `activePanes.size === 0`. However, pane removal happens in a `setTimeout` (after PANE_LINGER_MS). If new panes are created while lingering panes are closing, the reset could clear state for still-needed values.
- **Risk:** Edge case race condition — likely rare but possible with rapid session creation/destruction.

### 7. README is a stub
- **File:** `README.md`
- **Problem:** Contains only `# opencode-cmux`. No installation instructions, usage examples, required environment variables, or cmux version requirements documented.
- **Risk:** Low (developer experience only), but critical for anyone trying to use or contribute to this project.

## Security

### 8. No secrets detected
- No API keys, tokens, or credentials in source files (verified).
- Env vars (`CMUX_SURFACE_ID`, `CMUX_WORKSPACE_ID`, `OPENCODE_PID`) are runtime-only — not hardcoded.

### 9. Shell injection surface
- **File:** `lib/cmux-subagent-viewer.ts`
- **Risk:** Session titles (`info.title`) are passed directly to `cmux rename-tab` via the Bun `$` template tag. The Bun shell tag does NOT automatically escape arguments passed as template expressions.
- **Example:** `await $\`cmux rename-tab --surface ${surface} ${shortTitle}\``
- **Mitigation needed:** Verify that cmux's `rename-tab` handles special characters, or sanitize titles before passing them.

## Missing Features / Incomplete Work

### 10. No tests
- Covered in TESTING.md. Zero test coverage.

### 11. No linting or formatting config
- No `.eslintrc`, `biome.json`, `.prettier` config, or similar.
- Code style is consistent by convention only.

### 12. `package.json` version is `1.0.0` but project is clearly pre-release
- Version implies stability that the project does not yet have (no build, no tests, no entry point).

## Fragile Areas

### 13. `lsof` fallback for port detection (macOS-only)
- **File:** `lib/cmux-utils.ts:33`
- **Code:** `await $\`lsof -a -p ${pid} -i TCP -P -s TCP:LISTEN\``
- **Problem:** `lsof` with these flags is macOS-specific. On Linux, the flags differ. This plugin will silently return `null` on Linux if `ctx.serverUrl` has port 0.

### 14. Regex for surface ID parsing is fragile
- **File:** `lib/cmux-subagent-viewer.ts:167`
- **Code:** `text.match(/surface:(\d+)/)`
- **Problem:** If cmux changes its output format, parsing will silently return `null` and the viewer pane will not open (no error thrown).

### 15. `OPENCODE_PID` env var undocumented
- **File:** `lib/cmux-utils.ts:31`
- **Problem:** Falls back to `process.ppid || process.pid` if not set. This is a heuristic that may resolve to the wrong process in some environments.
