# Structure

## Directory Layout

```
opencode-cmux/
├── lib/                          # TypeScript source — all plugin code
│   ├── plugin-base.ts            # Shared base class, EventType enum, derived types
│   ├── cmux-utils.ts             # Server URL resolver utility
│   ├── cmux-notify.ts            # CmuxPlugin: notifications + prompt hint injection
│   └── cmux-subagent-viewer.ts   # CmuxSubagentViewer: auto-open TUI panes for subagents
├── .planning/                    # GSD planning artifacts (this codebase map)
│   └── codebase/                 # Codebase map documents
├── package.json                  # Package metadata (no deps declared yet)
├── .gitignore                    # Standard Node/TS gitignore (npm-generated)
└── README.md                     # Stub (only contains project name)
```

## Key File Locations

| Path | What it does |
|------|-------------|
| `lib/plugin-base.ts` | The foundation — all other files import from here |
| `lib/cmux-utils.ts` | Standalone utility, imported by `cmux-subagent-viewer.ts` |
| `lib/cmux-notify.ts` | First plugin: desktop notifications + cmux hint injection |
| `lib/cmux-subagent-viewer.ts` | Second plugin: automatic TUI pane management for child sessions |
| `package.json` | Package identity; `"main": "index.js"` (file doesn't exist yet) |

## Missing Files / Gaps

| Missing | Impact |
|---------|--------|
| `index.js` / `index.ts` | `package.json` `"main"` points here — entry point is broken |
| `tsconfig.json` | No TypeScript compiler config — TS cannot be compiled |
| `node_modules/` | Dependencies not installed |
| `@opencode-ai/plugin` in `package.json` | Imported everywhere but not listed as dependency |
| Build script | No way to compile TS → JS currently |
| Tests | No test files exist |

## Naming Conventions

- Files: `kebab-case` with descriptive prefix (`cmux-*`) for plugin files
- Classes: `PascalCase` (`PluginBase`, `SubagentPaneManager`)
- Exported plugin constants: `PascalCase` (`CmuxPlugin`, `CmuxSubagentViewer`)
- Enums: `PascalCase` (`EventType`)
- Enum values: `PascalCase` (`SessionCreated`, `MessageUpdated`)
- Types/interfaces: `PascalCase` (`BunShell`, `Event`, `PaneInfo`, `StatusName`)
- Private class fields: `camelCase` (`activePanes`, `paneCount`, `firstViewerSurface`)
- Functions: `camelCase` (`createServerUrlResolver`, `enqueueCreatePane`)
