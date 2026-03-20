# Conventions

## Code Style

- **TypeScript** throughout — no plain JS source files
- `import type` used for type-only imports (avoids runtime import cost)
  ```ts
  import type { Hooks, Plugin } from "@opencode-ai/plugin"
  import type { Event } from "./plugin-base"
  ```
- Explicit type annotations on all class fields, method parameters, and return types
- `readonly` used for immutable fields and constructor parameters:
  ```ts
  protected readonly $: BunShell
  constructor(protected readonly ctx: PluginInput) { ... }
  ```

## Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `cmux-subagent-viewer.ts` |
| Classes | PascalCase | `SubagentPaneManager`, `PluginBase` |
| Exported plugin constants | PascalCase | `CmuxPlugin`, `CmuxSubagentViewer` |
| Enums | PascalCase | `EventType` |
| Enum values | PascalCase | `SessionCreated`, `TuiPromptAppend` |
| Types / interfaces | PascalCase | `BunShell`, `PaneInfo`, `StatusName` |
| Private class fields | camelCase | `activePanes`, `paneCount` |
| Functions | camelCase | `createServerUrlResolver`, `enqueueCreatePane` |
| Constants (module-level) | `SCREAMING_SNAKE_CASE` | `PANE_LINGER_MS` |

## Plugin Pattern

All plugins follow the same factory shape:

```ts
export const MyPlugin: Plugin = async (ctx) => {
  if (!process.env.GUARD_VAR) return {}   // early exit guard
  // setup
  return {
    event: async ({ event }) => { ... },
    "tui.prompt.append": async (_input, output) => { ... },
  }
}
```

Class-based plugins use `PluginBase`:
```ts
class MyManager extends PluginBase {
  hooks(): Hooks { return { event: async ({ event }) => { ... } } }
}
export const MyPlugin: Plugin = async (ctx) => new MyManager(ctx).hooks()
```

## Error Handling

- Shell commands use `.quiet()` to suppress output when the result doesn't matter:
  ```ts
  await $`cmux notify ...`.quiet()
  ```
- Shell commands use `.nothrow()` when failures are expected/acceptable:
  ```ts
  const out = await $`lsof ...`.nothrow().text()
  ```
- `try/catch` with empty catch blocks for optional operations:
  ```ts
  try {
    helpText = await $`cmux help 2>&1`.text()
  } catch {
    helpText = null
  }
  ```
- `try { ... } catch {}` in `createPane` / `closePane` — all cmux CLI failures are silently swallowed (best-effort)

## State Management

- Module-level `let` for cached values that survive across event handler calls:
  ```ts
  let helpText: string | null = null
  let hinted = false
  ```
- Class fields for shared state within a manager class:
  ```ts
  private activePanes = new Map<string, PaneInfo>()
  private paneCount = 0
  private firstViewerSurface: string | null = null
  ```
- Promise chain for serializing concurrent async work:
  ```ts
  private queue: Promise<void> = Promise.resolve()
  private enqueueCreatePane(...): Promise<void> {
    this.queue = this.queue.then(() => this.createPane(...))
    return this.queue
  }
  ```

## Comments

- File-level JSDoc comment block explaining the module's purpose
- Inline section dividers using `// ----` for readability in larger files
- Key decisions and non-obvious behavior explained in comments:
  ```ts
  // `ctx.serverUrl` may report port 0 when `--port 0` is used (a known bug).
  ```
  ```ts
  // Serializes createPane calls so concurrent session.created events
  // don't race on shared state
  ```

## TypeScript Config

No `tsconfig.json` exists. Strict mode settings are inferred from code style (explicit types, readonly, etc.) but not enforced by a config file.
