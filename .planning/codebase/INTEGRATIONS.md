# Integrations

## OpenCode Plugin System

- **Package:** `@opencode-ai/plugin`
- **Integration type:** Plugin API — this project exports plugins consumed by the OpenCode AI coding tool
- **Key interfaces:** `Plugin`, `Hooks`, `PluginInput` from `@opencode-ai/plugin`
- **Plugin lifecycle:** Plugins are async factory functions: `Plugin = async (ctx: PluginInput) => Hooks`
- **How plugins are loaded:** By the OpenCode plugin loader at runtime

## OpenCode HTTP API

- **Used in:** `lib/cmux-subagent-viewer.ts`
- **Resolved via:** `createServerUrlResolver()` in `lib/cmux-utils.ts`
- **Purpose:** `opencode attach <serverUrl> --session <sessionID>` — attaches a TUI viewer to a child session
- **Port resolution:** `ctx.serverUrl` from PluginInput (with a fallback to `lsof` parsing when port is 0 due to a known bug)

## cmux CLI

- **Used in:** `lib/cmux-notify.ts`, `lib/cmux-subagent-viewer.ts`
- **Integration type:** Shell CLI invoked via Bun shell template tag (`$`)
- **Commands used:**

| Command | Purpose |
|---------|---------|
| `cmux help` | Fetch CLI reference for injecting into AI context |
| `cmux notify --title ... --subtitle ... --body ...` | macOS-style desktop notification |
| `cmux new-split right --workspace <id>` | Open right split pane |
| `cmux new-split down --workspace <id> --surface <id>` | Open down split pane |
| `cmux rename-tab --surface <id> <name>` | Set tab title |
| `cmux set-status <key> <label> --icon <icon> --color <color>` | Update sidebar status item |
| `cmux clear-status <key>` | Remove sidebar status item |
| `cmux send --surface <id> -- <command>` | Send command text to a pane |
| `cmux send-key --surface <id> <key>` | Send keystroke to a pane |
| `cmux close-surface --surface <id>` | Close a split pane |
| `cmux log -- <message>` | Write to cmux log |

- **Surface ID format:** `surface:<number>` (e.g. `surface:3`)
- **Workspace ID:** Passed in via `CMUX_WORKSPACE_ID` env var at plugin load time

## Bun Shell

- **Used in:** All plugin files via `PluginInput["$"]`
- **Purpose:** Shell command execution (the `$` template tag from Bun runtime)
- **Note:** Although `package.json` uses `"type": "commonjs"`, the plugins use Bun-specific APIs — the runtime environment is effectively Bun, not Node.js

## System Tools

| Tool | Used by | Purpose |
|------|---------|---------|
| `lsof` | `lib/cmux-utils.ts` | Fallback port detection for OpenCode HTTP server |

## No External Network/Database Integrations

This project has no HTTP clients, database drivers, auth providers, or cloud service integrations. All integrations are local process/CLI based.
