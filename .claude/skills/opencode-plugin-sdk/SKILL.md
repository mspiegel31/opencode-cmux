---
name: opencode-plugin-sdk
description: >
  OpenCode plugin system reference — the authoritative source for how OpenCode plugins work in this
  project. Use for: How do I build a plugin? How do TUI slots work? How do I add UI to the
  sidebar/footer/prompt? How do I register slots with append/replace/single_winner modes? How do I
  register TUI slash commands or command palette entries? Why aren't toasts showing during init?
  Where's the bus/pubsub code? Covers @opencode-ai/plugin SDK, TUI slot registration and ordering,
  TUI command system (slash commands via api.command.register, TuiCommand type, command palette),
  plugin lifecycle (server() init, sequential loading), showToast() timing, and upstream source file
  locations. ALWAYS consult this skill when the user asks about OpenCode internals, wants to read
  OpenCode docs, or has any question about how OpenCode's plugin architecture, TUI system, command
  system, or event bus works — even if you think you already know the answer.
---

# OpenCode Plugin SDK Reference

---

## Plugin Lifecycle

The `server()` function is the plugin init. OpenCode awaits it with **no timeout** and loads plugins **sequentially** — a slow plugin blocks all subsequent plugins.

Key upstream source files in [sst/opencode](https://github.com/sst/opencode):

| File | What it does |
|---|---|
| `packages/opencode/src/plugin/index.ts` | `applyPlugin()` calls `server()` via `Effect.tryPromise` — no timeout, errors published to `Session.Event.Error` |
| `packages/opencode/src/plugin/loader.ts` | `PluginLoader` — resolves npm/file targets, imports modules, `Promise.all` for resolution but sequential for `applyPlugin` |
| `packages/opencode/src/plugin/shared.ts` | `readV1Plugin()` — validates module shape (`PluginModule.server`), resolves entrypoint |
| `packages/opencode/src/server/routes/tui.ts` | `POST /tui/show-toast` → `Bus.publish(TuiEvent.ToastShow, ...)` |
| `packages/opencode/src/bus/index.ts` | Effect PubSub — **unbounded but not buffered**: events only reach existing subscribers |
| `packages/opencode/src/cli/cmd/tui/app.tsx` | `sdk.event.on(TuiEvent.ToastShow.type, ...)` wires bus events to toast store |
| `packages/opencode/src/cli/cmd/tui/ui/toast.tsx` | Toast store is **single-slot** (no queue) with 5s auto-dismiss |

### Why toasts fail during `server()` init

`client.tui.showToast()` hits an HTTP route that publishes to the bus, but the TUI's SSE subscriber hasn't connected yet (TUI mounts ~3s after server plugins load). The bus has no replay/buffering, so the event is lost. Fire toasts from the `event` hook instead — the first bus event is a reliable signal that the TUI is subscribed.

---

## TUI Slot System

OpenCode's TUI uses a slot system (`@opentui/solid` `SolidPlugin`) for plugin-injected UI. There is no official documentation — this reference is derived from the `TuiHostSlotMap` type in `@opencode-ai/plugin/tui` and verified against the upstream render sites. The canonical type source is `packages/plugin/src/tui.ts` in `anomalyco/opencode`.

### Slot modes (`SlotMode` from `@opentui/core`)

The host sets the mode at the render site — plugins cannot choose it.

| Mode | Behavior |
|---|---|
| `append` | **Default** (when `mode` is omitted). All registered plugins render in `order` sequence after the host's `children` fallback. |
| `replace` | All registered plugins render. If any plugin registers, the host's `children` fallback is suppressed. Falls back to `children` only if no plugin registers. |
| `single_winner` | Only the plugin with the **lowest `order` value** renders. All others are ignored. Falls back to `children` if no plugin registers. |

### Registration

```tsx
api.slots.register({
  order: 150,                               // lower = higher priority; internal plugins use 100
  slots: {
    sidebar_content(_ctx, props) {           // (ctx: TuiSlotContext, props: SlotProps) => JSX.Element
      return <MyPanel session_id={props.session_id} />
    },
  },
})
```

- `id` is injected by runtime — do **not** set it on the plugin object (`TuiSlotPlugin` has `id?: never`)
- Registration is auto-scoped to plugin lifecycle (cleaned up on dispose)
- A single `register()` call can claim multiple slots in the same `slots` object
- `TuiSlotContext` provides `{ theme: TuiTheme }` — but closing over `api` is more practical

### Available slots

| Slot | Props | Mode | Location | Default content |
|---|---|---|---|---|
| `app` | `{}` | `append` | `app.tsx` — after route switcher | _none_ (global overlay/HUD) |
| `home_logo` | `{}` | `replace` | `routes/home.tsx` — centered above prompt | `<Logo />` |
| `home_prompt` | `{ workspace_id?, ref? }` | `replace` | `routes/home.tsx` — main prompt box | `<Prompt />` |
| `home_prompt_right` | `{ workspace_id? }` | `append` | Inside home `<Prompt right={…} />` | _empty_ |
| `home_bottom` | `{}` | `append` | `routes/home.tsx` — below prompt | Tips view (order 100) |
| `home_footer` | `{}` | `single_winner` | `routes/home.tsx` — bottom of screen | Dir + MCP + version (order 100) |
| `session_prompt` | `{ session_id, visible?, disabled?, on_submit?, ref? }` | `replace` | `routes/session/index.tsx` — bottom of session | `<Prompt />` |
| `session_prompt_right` | `{ session_id }` | `append` | Inside session `<Prompt right={…} />` | _empty_ |
| `sidebar_title` | `{ session_id, title, share_url? }` | `single_winner` | `routes/session/sidebar.tsx` — top | Session title + share URL |
| `sidebar_content` | `{ session_id }` | `append` | `routes/session/sidebar.tsx` — scrollable body | Context (100), MCP (200), LSP (300), Todo (400), Files (500) |
| `sidebar_footer` | `{ session_id }` | `single_winner` | `routes/session/sidebar.tsx` — bottom | Dir + branch + version (order 100) |

### Internal plugin ordering for `sidebar_content`

The only slot with multiple built-in registrations — all others have at most one:

| Order | Internal plugin | Content |
|---|---|---|
| 100 | `internal:sidebar-context` | Token count, % used, cost |
| 200 | `internal:sidebar-mcp` | MCP server status |
| 300 | `internal:sidebar-lsp` | LSP server status |
| 400 | `internal:sidebar-todo` | Todo items |
| 500 | `internal:sidebar-files` | Changed files diff summary |

Our plugin registers `sidebar_content` at `order: 150` (between Context and MCP).

### Not a slot: the prompt status bar

The area below the text input showing token count, cost, and "ctrl+p commands" is **hardcoded inside the `<Prompt>` component** (`component/prompt/index.tsx`). It is not exposed as a slot. The `<Prompt>` component also has a `hint` prop (rendered when idle, below the input) but this is only passed by internal code, not exposed via slots.

```
┌─ Prompt Component ──────────────────────────────────────────────┐
│  [model name]  [provider]                   [*_prompt_right]    │  ← model bar
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ text input area                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│  79.3K (8%) · $0.50                       ctrl+p commands       │  ← NOT a slot
└─────────────────────────────────────────────────────────────────┘
```

---

## TUI Command System (Slash Commands & Command Palette)

OpenCode's TUI has a unified command system that powers both slash commands (typed as `/name` in the prompt) and the command palette (`ctrl+p`). Plugins register commands via `api.command.register()` in the TUI entry point.

### TuiCommand type

```typescript
type TuiCommand = {
  title: string            // Display name in command palette (e.g. "List gateway models")
  value: string            // Unique command ID (e.g. "spoton.models")
  description?: string     // Shown below title in palette
  category?: string        // Grouping in palette (e.g. "Provider", "Session", "System")
  keybind?: string         // Keybind name from TuiKeybindSet
  suggested?: boolean      // Show in suggested commands
  hidden?: boolean         // Hide from command palette
  enabled?: boolean        // Grey out if false
  slash?: {
    name: string           // Slash command name — "/models" if name is "models"
    aliases?: string[]     // Alternative names (e.g. ["list-models"])
  }
  onSelect?: () => void    // Called when user selects the command
}
```

### Registration via `api.command.register()`

```typescript
api.command.register(() => [
  {
    title: "List gateway models",
    value: "spoton.models",
    description: "Show all models available on the SpotOn AI Gateway",
    category: "Provider",
    slash: {
      name: "models",
    },
    onSelect: () => {
      // Show a dialog, navigate to a route, trigger an action, etc.
      api.ui.dialog.replace(() => <ModelsDialog api={api} />)
    },
  },
])
```

Key details:
- The callback is a **factory function** `() => TuiCommand[]` — it's re-evaluated each time the command palette opens, so commands can be dynamic (e.g. conditionally `enabled` or `suggested` based on current state)
- `api.command.register()` returns an unsubscribe function — the TUI runtime auto-cleans up on plugin dispose via `scope.track()`
- A command can appear in **both** the slash menu and the command palette simultaneously — `slash` makes it available as `/name`, while `title`/`category` make it findable in `ctrl+p`
- `onSelect` receives no arguments — close over `api` and any state you need
- Multiple `register()` calls are allowed; each adds to the global command list

### `api.command` full API

```typescript
command: {
  register: (cb: () => TuiCommand[]) => () => void  // Register commands, returns unsubscribe
  trigger: (value: string) => void                    // Programmatically trigger a command by value
  show: () => void                                    // Open the command palette
}
```

### How slash commands work in the prompt

When the user types `/` at the start of the prompt input, the TUI filters all registered commands that have a `slash` field and shows them in a popover. Selecting one calls `onSelect()`. The `slash.name` is what appears after `/` — if `name: "models"`, the user types `/models`.

Internal OpenCode commands using slash (for reference):

| Slash name | Value | Category | What it does |
|---|---|---|---|
| `connect` | `provider.connect` | Provider | Opens provider auth dialog |
| `sessions` | `session.list` | Session | Lists/switches sessions |
| `share` | `session.share` | Session | Shares current session |
| `rename` | `session.rename` | Session | Renames current session |
| `editor` | `prompt.editor` | Session | Opens external editor |
| `skills` | `prompt.skills` | Prompt | Shows available skills |
| `workspaces` | `workspace.list` | Workspace | Manages workspaces |

### Upstream source files

| File | What it does |
|---|---|
| `packages/opencode/src/cli/cmd/tui/plugin/runtime.ts` | `command.register()` wraps `api.command.register()` with `scope.track()` for lifecycle cleanup |
| `packages/opencode/src/cli/cmd/tui/app.tsx` | Internal commands registered here (connect, sessions, workspaces, etc.) |
| `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx` | Slash popover rendering — filters commands with `slash` field when input starts with `/` |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` | Session-scoped commands (share, rename, compact, clear) |

---

## TUI UI Components (api.ui)

The `api.ui` object provides dialogs, toasts, and core UI components for TUI plugins.

### api.ui shape

```typescript
api.ui: {
  dialog: TuiDialogStack
  Dialog: Component<{ size?: "medium" | "large" | "xlarge"; onClose: () => void; children?: JSX.Element }>
  DialogAlert: Component<{ title: string; message: string; onConfirm?: () => void }>
  DialogConfirm: Component<{ title: string; message: string; onConfirm?: () => void; onCancel?: () => void }>
  DialogPrompt: Component<DialogPromptProps>
  DialogSelect: Component<DialogSelectProps<Value>>
  Slot: Component<{ name: string }>
  Prompt: Component<PromptProps>
  toast: (opts: ToastOptions) => void
}
```

### Dialog stack (`api.ui.dialog`)

| Method | Signature | Description |
|---|---|---|
| `replace` | `(component: () => JSX.Element) => void` | Push a dialog onto the stack (replaces current) |
| `clear` | `() => void` | Close all dialogs |
| `setSize` | `(size: "medium" \| "large" \| "xlarge") => void` | Resize the current dialog |

Dialog widths: `medium` = 60 cols, `large` = 88 cols, `xlarge` = 116 cols.

### Dialog components

| Component | Key props | Description |
|---|---|---|
| `DialogAlert` | `title`, `message`, `onConfirm?` | Simple OK dialog |
| `DialogConfirm` | `title`, `message`, `onConfirm?`, `onCancel?` | Two-button confirm/cancel |
| `DialogPrompt` | `title`, `description?` (() → JSX), `placeholder?`, `value?`, `busy?`, `busyText?`, `onConfirm?` ((value: string) → void), `onCancel?` | Text input with optional spinner |
| `DialogSelect<V>` | `title`, `placeholder?`, `options` (TuiDialogSelectOption[]), `flat?`, `onMove?`, `onFilter?`, `onSelect?`, `skipFilter?`, `current?` | Searchable list picker with fuzzy search and categories |

`TuiDialogSelectOption<V>`: `{ title: string; value: V; description?: string; footer?: string; category?: string; disabled?: boolean; onSelect?: () => void }`

### Toast (`api.ui.toast`)

```typescript
api.ui.toast({
  variant?: "info" | "success" | "warning" | "error",
  title?: string,
  message: string,
  duration?: number,  // default 5000ms
})
```

Single-slot, auto-dismiss. New toast replaces the previous one (no queue).

### Other components on api.ui

| Component | Description |
|---|---|
| `Dialog` | Raw dialog frame — `size?`, `onClose`, `children?`. Usually used implicitly via `dialog.replace()`. |
| `Slot` | Renders a named slot for custom routes. |
| `Prompt` | Full prompt component with autocomplete/history. Props: `sessionID?`, `workspaceID?`, `visible?`, `disabled?`, `onSubmit?`, `ref?`, `hint?`, `right?`, `showPlaceholder?`, `placeholders?`. |

### Usage pattern

```tsx
api.ui.dialog.replace(() => (
  <api.ui.DialogAlert title="Done" message="Operation completed." onConfirm={() => api.ui.dialog.clear()} />
))
```

> **Not on `api.ui`:** Internal components like `DialogHelp`, `Logo`, `Tips`, etc. exist in the codebase but are not exposed on the plugin API.

---

## @opentui/solid JSX Primitives

TUI plugins use `@opentui/solid` for JSX rendering — a SolidJS-based terminal UI framework (Yoga flexbox layout).

### JSX setup

```tsx
/** @jsxImportSource @opentui/solid */
```

### Intrinsic elements

| Element | Description |
|---|---|
| `box` | Flexbox container (div equivalent) |
| `text` | Block-level text with color/attributes |
| `span` | Inline text segment |
| `input` | Single-line text input |
| `textarea` | Multi-line text input |
| `select` | Selection list |
| `tab_select` | Tabbed selector |
| `scrollbox` | Scrollable container |
| `code` | Syntax-highlighted code block |
| `markdown` | Markdown renderer |
| `ascii_font` | FIGlet-style large text |
| `b`/`strong` | Bold text |
| `i`/`em` | Italic text |
| `u` | Underlined text |
| `br` | Line break |
| `a` | Link (rendered as underlined text with URL) |

### Universal layout props (Yoga flexbox)

All elements inherit these. Values are number (cells) or string (e.g. `"50%"`).

`flexDirection`, `flexGrow`, `flexShrink`, `alignItems`, `justifyContent`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `position` (`"relative"` | `"absolute"`), `overflow` (`"hidden"` | `"scroll"`), `visible`, `zIndex`, `opacity`

### Box props

| Prop | Type | Description |
|---|---|---|
| `backgroundColor` | `string` | Background color |
| `border` | `boolean` | Draw border |
| `borderStyle` | `"single"` \| `"double"` \| `"round"` \| `"bold"` \| `"none"` | Border line style |
| `borderColor` | `string` | Border color |
| `title` | `string` | Title rendered in the border |
| `titleAlignment` | `"left"` \| `"center"` \| `"right"` | Title position |
| `gap` / `rowGap` / `columnGap` | `number` | Spacing between children |
| `focused` | `boolean` | Focus state |
| `children` | `JSX.Element` | Child elements |

### Text props

| Prop | Type | Description |
|---|---|---|
| `content` | `string` | Text content (alternative to children) |
| `fg` / `bg` | `string` | Foreground/background color |
| `attributes` | `number` | TextAttributes bitmask |
| `wrapMode` | `"word"` \| `"char"` \| `"none"` | Text wrapping |
| `truncate` | `boolean` | Truncate with ellipsis |
| `selectable` | `boolean` | Allow text selection |

**TextAttributes bitmask:** `BOLD = 1`, `DIM = 2`, `ITALIC = 4`, `UNDERLINE = 8`, `STRIKETHROUGH = 128`

### Hooks

| Hook | Description |
|---|---|
| `useRenderer()` | Access the renderer instance |
| `useTerminalDimensions()` | Returns `[width, height]` signal |
| `onResize(cb)` | Terminal resize callback |
| `onFocus(cb)` / `onBlur(cb)` | Element focus/blur lifecycle |
| `useKeyboard(handler)` | Keyboard input handler |
| `usePaste(handler)` | Paste event handler |

### SolidJS re-exports

Standard SolidJS primitives work in TUI plugins — import from `"solid-js"`:

`Show`, `For`, `Switch`/`Match`, `createSignal`, `createMemo`, `createEffect`, `onCleanup`, `onMount`

### Theme access

```typescript
const theme = api.theme.current  // TuiThemeCurrent
```

Key color tokens: `primary`, `secondary`, `accent`, `error`, `warning`, `success`, `info`, `text`, `textMuted`, `background`, `backgroundPanel`, `backgroundElement`, `border`, `borderActive`, `borderSubtle`

---

## Building and Publishing TUI Plugins

### Why a build step is needed for TUI

OpenCode's server-side Bun runtime loads raw `.ts` from `node_modules` without issues — `.js` import extensions are rewritten to `.ts` automatically. The TUI runtime uses a different code path (`collectNodeModulesRuntimeRewritePaths`) that does a literal `readFileSync` on `.js` import paths. If only `.ts` files exist, loading fails with `ENOENT`.

**Raw `.tsx` works for file-path plugins** (e.g., `tui.json` pointing to a local repo) because Bun treats those as project source with full `tsconfig.json`-aware resolution. Once the same code is installed into `node_modules` via npm, the stricter resolution kicks in.

### TUI build with `@opentui/solid/bun-plugin`

The `@opentui/solid` package (maintained by the OpenCode team) ships a Bun build plugin that:

1. Transforms JSX via `babel-preset-solid` in `"universal"` mode (not DOM) — produces SolidJS reactive `createComponent()` calls targeting `@opentui/solid` as the runtime
2. Strips TypeScript types via `@babel/preset-typescript`
3. Redirects `solid-js/dist/server.js` → `solid-js/dist/solid.js` to prevent SSR code in TUI bundles

Build script pattern (from [`timrichardson/opencode-btw`](https://github.com/timrichardson/opencode-btw)):

```typescript
// scripts/build-tui.ts
import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["./src/tui/index.tsx"],
  outdir: "./dist",
  naming: "tui.js",
  format: "esm",
  target: "bun",
  packages: "external",    // all node_modules stay as bare imports
  external: ["solid-js"],  // provided by OpenCode's TUI runtime
  plugins: [solidPlugin],
})

if (!result.success) {
  for (const item of result.logs) console.error(item)
  process.exit(1)
}
```

Key settings:
- `packages: "external"` — keeps all `node_modules` imports as bare specifiers (not bundled)
- `external: ["solid-js"]` — explicitly external because OpenCode's TUI runtime provides it
- Shared code imported from `src/` by the TUI entry gets inlined into the single output bundle
- Server entry (`src/index.ts`) is **not touched** — stays as raw `.ts`

### Package.json exports for joint server + TUI plugins

```jsonc
{
  "exports": {
    ".":        { "import": "./src/index.ts" },   // server — raw .ts, Bun loads natively
    "./server": { "import": "./src/index.ts" },
    "./tui":    { "import": "./dist/tui.js" }     // TUI — built by Bun.build
  },
  "files": ["src", "!src/**/*.test.ts", "dist", "README.md"]
}
```

### CI pattern

Validate on PRs (typecheck + lint + test + build + `npm pack --dry-run`), build before publish. The `npm pack --dry-run` step catches `files` field misconfigurations before they reach a release. Reference: [`opencode-btw` CI workflow](https://github.com/timrichardson/opencode-btw/blob/main/.github/workflows/ci.yml).
