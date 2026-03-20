# Stack

## Language & Runtime

- **Language:** TypeScript (`lib/*.ts`)
- **Runtime:** Node.js (package.json `"type": "commonjs"`) — though the plugin files import Bun-specific APIs (`PluginInput["$"]` which is the Bun shell tag)
- **Module system:** CommonJS (`"type": "commonjs"` in package.json, `main: "index.js"`)

## Package Manager

- No lock file present; npm is the implied package manager (`.gitignore` includes `.yarn-integrity`, `jspm_packages`, etc.)
- No `node_modules/` — dependencies not yet installed

## Dependencies

Declared in `package.json` (no `dependencies` or `devDependencies` keys present yet — only `scripts`, metadata, and package identity fields):

| Package | Role | Notes |
|---------|------|-------|
| `@opencode-ai/plugin` | Plugin API types | Used via `import type` across all `lib/*.ts` files — provides `Plugin`, `Hooks`, `PluginInput` |

No other dependencies are declared. The `@opencode-ai/plugin` package is referenced but not yet listed in `package.json` — **it needs to be added**.

## Build / Compilation

- No build tooling configured (no `tsconfig.json`, no bundler config, no build script)
- Source is TypeScript but `package.json` points `"main"` to `index.js` (which does not exist)
- **Gap:** TypeScript compilation pipeline is missing

## Scripts

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

No build, dev, lint, or type-check scripts defined.

## Key Source Files

| File | Purpose |
|------|---------|
| `lib/plugin-base.ts` | Abstract base class + `EventType` enum + derived types |
| `lib/cmux-utils.ts` | Server URL resolver utility |
| `lib/cmux-notify.ts` | Notification plugin (`CmuxPlugin`) |
| `lib/cmux-subagent-viewer.ts` | Subagent pane manager plugin (`CmuxSubagentViewer`) |

## Environment Variables Used

| Variable | Used In | Purpose |
|----------|---------|---------|
| `CMUX_SURFACE_ID` | `lib/cmux-notify.ts` | Guard: skip if not running inside cmux |
| `CMUX_WORKSPACE_ID` | `lib/cmux-subagent-viewer.ts` | Guard + origin workspace for pane splits |
| `OPENCODE_PID` | `lib/cmux-utils.ts` | Fallback for resolving the OpenCode server port |
