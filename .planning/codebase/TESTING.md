# Testing

## Test Runner

**Vitest v4.1.0** via `bun run test` (`vitest run`). Config at `vitest.config.ts` excludes `dist/` and `node_modules/`.

## Test Files

| File | Tests | Type | What's covered |
|------|-------|------|----------------|
| `src/config.test.ts` | 14 | Unit | Zod schema defaults, partial merges, JSONC parsing, file bootstrap, env var overrides |
| `src/cmux-notify.test.ts` | 16 | Unit | Event dispatch routing, busy/idle/permission/question state machine, focus-gating, v1+v2 SDK event shapes |
| `src/cmux-browser-tools.test.ts` | 19 | Unit | Tool registration, guard behavior, command construction, surface caching, error handling |
| `src/cmux-notify.integration.test.ts` | 8 | Integration | Real cmux sidebar status set/read/clear lifecycle via `cmux list-status` |

**Total: 57 tests.** Unit tests run everywhere (~200ms). Integration tests require a running cmux session and are gated by `CMUX_SURFACE_ID`.

## Mocking Approach

All unit tests use the same pattern:

- **Shell (`$`)** — mocked via `Proxy` on the tagged template. Captures command strings in a `shellCalls: string[]` array, returns configurable fake responses.
- **`ctx.client.session.get`** — `vi.fn()` returning `{ data: { parentID: null } }` (non-subagent by default).
- **Config** — injected via `parseConfig()` (bypasses filesystem).
- **No `vi.mock()` module mocking** anywhere.

## Integration Tests

`src/cmux-notify.integration.test.ts` uses real cmux commands instead of mocks:

- **Lifecycle**: `beforeAll` creates a dedicated cmux workspace, `afterAll` closes it.
- **Shell**: `child_process.execSync`-backed tagged template adapter (vitest VM doesn't expose `Bun.$`).
- **Assertions**: `cmux list-status --workspace <ref>` reads actual sidebar state.
- **Gating**: `describe.runIf(!!process.env.CMUX_SURFACE_ID)` — skipped outside cmux.
- **Isolation**: fresh plugin instance per test, status cleared in `beforeEach`.

## Manual E2E

`script/test-plugin.sh` builds the plugin and opens a throwaway opencode session in a new cmux workspace. No assertions — inspect results via `session_list` / `session_read` from the dev session.

## Untested Components

| Component | Notes |
|-----------|-------|
| `src/cmux-subagent-viewer.ts` | Most complex stateful code: pane lifecycle, serialized queue, surface parsing |
| `src/lib/cmux-utils.ts` | `createServerUrlResolver` caching, `lsof` fallback |
| `src/lib/plugin-base.ts` | `createEventDispatcher` (tested indirectly via cmux-notify tests) |
