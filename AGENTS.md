# opencode-cmux

## Build & Test

```bash
bun run build          # compile TypeScript → dist/
bun run test           # vitest (unit + integration if inside cmux)
bun run typecheck      # tsc --noEmit
```

Integration tests in `src/cmux-notify.integration.test.ts` require a running
cmux session (`CMUX_SURFACE_ID` must be set). They create a throwaway workspace,
fire events through the plugin with a real Bun shell, and assert on
`cmux list-status` output. Skipped automatically outside cmux.

## Plugin Dev Loop

The plugin is loaded via local path in `opencode.work.jsonc`:
```json
"plugin": ["/Users/<user>/development/personal/opencode-cmux"]
```

`bun run build` writes to `dist/` — any **new** opencode instance reads the
fresh build. The running instance keeps the old code. No cache sync needed.

**To test changes without restarting your dev session:**

```bash
script/test-plugin.sh            # build + launch throwaway opencode in new cmux workspace
script/test-plugin.sh --no-build # skip build, just launch
```

Then from the dev session, read test results via `session_list` / `session_read`
— all opencode instances share one SQLite DB (`~/.local/share/opencode/opencode.db`).

## Code Style

**Classes over plain functions** — all plugin logic lives in classes injected via Awilix DI. Plain functions are only for pure utilities with no dependencies.

**Colocated dependency interfaces** — each class defines its own `FooDeps` interface in the same file, not in a shared `types.ts`. Examples: `CmuxNotifyPluginDeps`, `CmuxBrowserToolsPluginDeps`, `SubagentPaneManagerDeps`.

```typescript
// ✅ correct — deps interface lives next to the class
interface SubagentPaneManagerDeps {
  shell: Shell;
  logger: Logger;
}

export class SubagentPaneManager {
  constructor(private deps: SubagentPaneManagerDeps) {}
}
```

**`private` keyword for encapsulation** — use `private foo` not `#foo`. The `#` syntax is reserved for cases where true runtime privacy is required (it isn't here).

**Functional iteration** — prefer `map`/`filter`/`reduce` over `for`/`while`/`forEach`. Use `Promise.all()` for parallel async operations.

**Config with zod** — config schemas use `z.object({...}).strip()` so unknown keys are silently dropped. Export `ConfigSchema` and a `loadConfig(raw: unknown): Config` function from the config module.

## Conventions

**Build step** — TypeScript compiles to `dist/` via `tsc`. Always run `bun run build` before testing with a real opencode instance. Import paths use `.js` extensions (ESM convention — Bun resolves `.js` → `.ts` at dev time, `tsc` emits `.js`).

```typescript
// ✅ correct
import { SubagentPaneManager } from "./subagent-pane-manager.js";

// ❌ wrong
import { SubagentPaneManager } from "./subagent-pane-manager";
```

**Tests colocated** — `*.test.ts` files live next to the source file they test, not in a separate `__tests__/` directory.

**Barrel exports** — each subdirectory exposes a single `index.ts` that re-exports its public surface. Consumers import from the directory, not from individual files.

**DI container** — `src/container.ts` defines the `Cradle` interface (all registered names + types) and builds the Awilix container with `InjectionMode.PROXY` and `strict: true`. Strict mode catches missing registrations at startup rather than at call time.

## Anti-Patterns

- **No `as any` or `@ts-ignore`** — fix the types. If a third-party type is wrong, use a local type assertion with a comment explaining why.
- **No retry logic for cmux commands** — cmux commands are local process calls; they either succeed or fail fast. Retries add latency and mask real errors.
- **No network I/O in plugin factory functions** — factory functions run at container construction time. Guard with an env check and return immediately; let the container create instances lazily.
- **No `defaultDeps()` factories** — Awilix resolves dependencies automatically via proxy injection. Don't create manual default-dep factories; register everything in the container.
- **No slow async work in factory functions** — factory functions must be synchronous. Defer any async initialization to the plugin's `init()` lifecycle hook.

## Testing

**Framework**: vitest

**`makeDeps` pattern** — each test file defines its own `makeDeps(overrides?: Partial<FooDeps>): FooDeps` factory. This keeps tests self-contained and makes the happy-path default explicit.

```typescript
function makeDeps(overrides?: Partial<SubagentPaneManagerDeps>): SubagentPaneManagerDeps {
  return {
    shell: makeShellMock(),
    logger: makeLoggerMock(),
    ...overrides,
  };
}
```

**Shell mock via Proxy** — the shell mock captures template string parts using a `Proxy` so tests can assert on the exact command string without spawning a real process.

**Integration test guard** — integration tests check `process.env.CMUX_SURFACE_ID` at the top of the file and skip automatically when not running inside cmux. No manual `skip` calls needed in individual tests.

**No shared test utility files** — each test file gets its own `makeDeps`. Don't extract shared test helpers into a `test-utils.ts`; the duplication is intentional and keeps tests readable in isolation.

## OpenCode Plugin SDK

For TUI slot system internals, plugin lifecycle hooks, and event bus details, see:

`.claude/skills/opencode-plugin-sdk/SKILL.md`
