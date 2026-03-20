# Testing

## Current State

**No tests exist.** The project has zero test files, no test framework installed, and the default test script exits with an error:

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

Running `npm test` will fail immediately.

## Test Framework

None configured. Given:
- Bun runtime is the effective execution environment (uses Bun shell `$`)
- TypeScript source
- Plugin-based architecture

**Likely candidates:**
- `bun:test` — Bun's built-in Jest-compatible test runner (no install needed if using Bun)
- `vitest` — Common for TS projects, Jest-compatible API

## What Would Need to Be Tested

Given the plugin architecture, testing would likely focus on:

### Unit Tests (pure logic)

| Target | What to test |
|--------|-------------|
| `createServerUrlResolver` in `lib/cmux-utils.ts` | Returns cached URL, falls back to `lsof` output, handles port 0 |
| `SubagentPaneManager.parseSurface` in `lib/cmux-subagent-viewer.ts` | Parses `surface:N` from `cmux` output |
| `EventType` enum values | Correct string values for all event types |

### Integration / E2E Tests (harder)

Plugin behavior requires:
- Bun shell `$` (cmux CLI calls)
- `CMUX_SURFACE_ID` / `CMUX_WORKSPACE_ID` env vars
- A running `cmux` process
- A running OpenCode server

These would require mocking or a test environment with cmux installed.

## Mocking Strategy (if tests are added)

- Mock the Bun `$` shell tag to capture commands without executing them
- Use env var injection per test to control plugin guard behavior
- Mock `ctx.serverUrl` for URL resolver tests

## Coverage

No coverage tooling configured. `package.json` has no nyc, c8, or similar entries.
