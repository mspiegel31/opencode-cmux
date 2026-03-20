# Architecture

## Pattern

**Plugin library** — a collection of OpenCode plugins that integrate the OpenCode AI coding tool with the `cmux` terminal multiplexer. Each plugin is a self-contained module exported as a named constant.

## Plugin Architecture

Each plugin follows the OpenCode plugin contract:

```ts
type Plugin = async (ctx: PluginInput) => Hooks
```

- `PluginInput` provides: Bun shell `$`, `serverUrl`, and other runtime context
- `Hooks` is an object with optional handler keys (`event`, `tui.prompt.append`, etc.)
- Plugins guard themselves using env vars — if not running in the right environment, they return `{}`

## Layers

```
┌────────────────────────────────────────────────────┐
│              OpenCode Plugin Loader                │
│         (loads plugins, calls them with ctx)       │
└────────────────┬───────────────────────────────────┘
                 │ PluginInput (ctx)
┌────────────────▼───────────────────────────────────┐
│              Plugin Factories                      │
│  CmuxPlugin (cmux-notify.ts)                       │
│  CmuxSubagentViewer (cmux-subagent-viewer.ts)      │
└────────────────┬───────────────────────────────────┘
                 │ uses
┌────────────────▼───────────────────────────────────┐
│              Shared Utilities / Base               │
│  PluginBase (plugin-base.ts) — abstract class      │
│  EventType enum (plugin-base.ts)                   │
│  createServerUrlResolver (cmux-utils.ts)           │
└────────────────────────────────────────────────────┘
                 │ calls
┌────────────────▼───────────────────────────────────┐
│              External Processes                    │
│  cmux CLI commands (via Bun $ shell tag)           │
│  lsof (port detection fallback)                    │
│  OpenCode HTTP API (attach sessions)               │
└────────────────────────────────────────────────────┘
```

## Data Flow: Notification Plugin (cmux-notify.ts)

1. Plugin loads → checks `CMUX_SURFACE_ID` env var (guard)
2. Runs `cmux help` once to cache CLI reference text
3. On `tui.prompt.append` hook → appends cmux hint to first AI prompt (once only)
4. On `session.idle` event → runs `cmux notify` with "Done" message
5. On `session.error` event → runs `cmux notify` with "Error" message

## Data Flow: Subagent Viewer Plugin (cmux-subagent-viewer.ts)

1. Plugin loads → checks `CMUX_WORKSPACE_ID` env var (guard)
2. Instantiates `SubagentPaneManager` with origin workspace ID
3. On `session.created` event with `parentID` → enqueues pane creation (serialized via promise queue)
4. Pane creation:
   - First pane: `cmux new-split right` from origin workspace
   - Subsequent panes: `cmux new-split down` from first viewer surface
   - Runs `opencode attach <serverUrl> --session <id>` in new pane
   - Sets status indicator (Running / Done / Error)
5. On `session.idle` or `session.error` → updates status, then after 4s delay closes the pane
6. When all panes closed → resets `paneCount` and `firstViewerSurface`

## Concurrency Model

- Pane creation is **serialized** via a promise chain (`this.queue`) to avoid race conditions when multiple `session.created` events fire simultaneously
- Plugin event handlers are otherwise async and independent
- Server URL resolution is **cached** after first successful call

## Abstractions

| Abstraction | File | Purpose |
|------------|------|---------|
| `PluginBase` | `lib/plugin-base.ts` | Abstract class with `$` and `ctx` — avoids passing context around manually |
| `EventType` enum | `lib/plugin-base.ts` | Typed string constants for all event types (avoids magic strings) |
| `createServerUrlResolver` | `lib/cmux-utils.ts` | Factory returning a cached, lazy resolver for OpenCode server URL |
| `SubagentPaneManager` | `lib/cmux-subagent-viewer.ts` | Class encapsulating all pane lifecycle state and operations |

## Entry Points

No `index.ts` or `index.js` exists yet. `package.json` references `"main": "index.js"` which is missing — **this is a gap**.

Individual plugins are imported directly:
- `lib/cmux-notify.ts` → exports `CmuxPlugin`
- `lib/cmux-subagent-viewer.ts` → exports `CmuxSubagentViewer`
