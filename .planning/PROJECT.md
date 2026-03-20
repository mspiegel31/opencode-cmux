# opencode-cmux

## What This Is

A TypeScript OpenCode plugin package published to npm as `@mspiegel31/opencode-cmux` that integrates OpenCode with the `cmux` terminal multiplexer. It ships two plugins — one for desktop notifications and one for auto-opening TUI viewers for subagent sessions — and lets users enable/disable each plugin via a JSON config file that is bootstrapped on first run inside a cmux session.

## Core Value

When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.

## Requirements

### Validated — v1.0

- ✓ `CmuxPlugin` (notification + prompt hint injection) — v1.0
- ✓ `CmuxSubagentViewer` (auto-open TUI panes for child sessions) — v1.0
- ✓ Shared utilities (`createServerUrlResolver`, `PluginBase`, `EventType`) — v1.0
- ✓ `EventHandlerMap` mapped type + `createEventDispatcher()` factory in `src/lib/plugin-base.ts` — v1.3
- ✓ `parseConfig(overrides?)` in `src/config.ts` for test config injection without filesystem I/O — v1.3
- ✓ TypeScript project setup: `tsconfig.json`, Node.js 24 LTS (`.nvmrc`), `dist/` output — v1.0
- ✓ `package.json` properly configured: `"type": "module"`, `main`/`types`/`exports` pointing to `dist/`, `@opencode-ai/plugin` in dependencies — v1.0
- ✓ `src/index.ts` entry point that exports both `CmuxPlugin` and `CmuxSubagentViewer` — v1.0
- ✓ Build scripts: `build` (tsc), `typecheck` (tsc --noEmit), `test` (vitest) — v1.0
- ✓ Per-plugin config system: `loadConfig()` in `src/config.ts`, JSON at `~/.config/opencode/opencode-cmux.json`, bootstrapped on first run inside cmux, env var overrides (highest priority) — v1.0
- ✓ Both plugins (`CmuxPlugin`, `CmuxSubagentViewer`) respect `enabled` flags from config — v1.0
- ✓ GitHub Actions CI workflow: typecheck + build + test on push/PR — v1.0
- ✓ GitHub Actions release workflow: conventional commit semver bump + npm publish via OIDC trusted publishing — v1.0
- ✓ Semver auto-increment: `feat:` → minor, `fix:`/`chore:` → patch, `feat!`/`BREAKING` → major — v1.0
- ✓ README with installation, registration, and config reference — v1.0

### Active

(None — planning next milestone)

### Out of Scope

- Linux/Windows support for cmux CLI commands — cmux is macOS-only
- Tests for cmux CLI interactions — requires a live cmux process
- Multiple npm packages in a monorepo — single package, all plugins bundled

## Context

- Shipped v1.0 with ~430 LOC TypeScript across `src/`
- Tech stack: TypeScript, Node.js 24, npm, tsc, vitest, semantic-release, GitHub Actions
- Package migrated from Bun to npm/vitest during productionization (Bun shell `$` tag still used at runtime via `@opencode-ai/plugin`)
- OIDC trusted publishing configured on npm — no long-lived token needed in CI
- Config file bootstrapped lazily — only created on first run *inside* a cmux session (not on every OpenCode startup)
- `CmuxSubagentViewer` uses `lsof` fallback to discover the OpenCode server port — no `--port` flag required

## Constraints

- **Runtime**: Must work with Bun shell `$` tag (provided by `@opencode-ai/plugin`)
- **Node.js**: 24 LTS — set in `.nvmrc`, used in CI via `node-version-file`
- **Module system**: ESM (`"type": "module"`)
- **Publishing**: npm scoped package `@mspiegel31/opencode-cmux`, OIDC trusted publishing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `@mspiegel31/opencode-cmux` scoped name | Community norm, no squatting risk, clearly owned | ✓ Good |
| JSON config file over pure env vars | More discoverable, bootstrappable, matches opencode-notifier pattern | ✓ Good |
| Single package (not monorepo) | Simple, both plugins are small and tightly related | ✓ Good |
| `tsc` for build (not `bun build`) | Produces `.d.ts` declaration files needed for consumers | ✓ Good |
| Conventional commits → semver via semantic-release | Standard, machine-parseable, clear intent | ✓ Good |
| npm/vitest over Bun for CI | Bun test runner had CI compatibility issues; vitest is stable | ✓ Good |
| OIDC trusted publishing | No long-lived npm token in secrets; more secure | ✓ Good |
| `node-version-file: .nvmrc` in CI | Single source of truth for Node version | ✓ Good |
| `files` allowlist in `package.json` to exclude test artifacts | Cleaner published package | ✓ Good |
| `EventHandlerMap` + `createEventDispatcher()` for typed event routing | Handlers receive narrowed SDK types via `Extract<Event, {type:K}>`; single `as` cast in factory; `extra` map for forward-compat events not yet in SDK union | ✓ Good |
| `parseConfig()` + `init(config?)` for test injection | Eliminates `vi.mock` — real Zod validation, no filesystem I/O, supports partial overrides | ✓ Good |

## Current State

v1.0 and v1.2 shipped. v1.3 code-quality work (Phase 7) complete on `feature-enhancements` branch. Both plugins follow the class-based `PluginBase` pattern with typed event dispatch. Ready to merge and release v1.3.

---
*Last updated: 2026-03-20 after Phase 7 completion*
