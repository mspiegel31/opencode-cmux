# opencode-cmux

## What This Is

A TypeScript OpenCode plugin package published to npm as `@mspiegel31/opencode-cmux` that integrates OpenCode with the `cmux` terminal multiplexer. It ships two plugins — one for desktop notifications and one for auto-opening TUI viewers for subagent sessions — and lets users enable/disable each plugin via a JSON config file that is bootstrapped on first run.

## Core Value

When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.

## Requirements

### Validated

- ✓ `CmuxPlugin` (notification + prompt hint injection) — existing in `lib/cmux-notify.ts`
- ✓ `CmuxSubagentViewer` (auto-open TUI panes for child sessions) — existing in `lib/cmux-subagent-viewer.ts`
- ✓ Shared utilities (`createServerUrlResolver`, `PluginBase`, `EventType`) — existing in `lib/`

### Validated

- ✓ TypeScript project setup: `tsconfig.json`, Bun as package manager, Node.js 24 LTS (`.nvmrc`), `dist/` output — Validated in Phase 1: Project Foundation
- ✓ `package.json` properly configured: `"type": "module"`, `main`/`types`/`exports` pointing to `dist/`, `@opencode-ai/plugin` in dependencies — Validated in Phase 1: Project Foundation
- ✓ `src/index.ts` entry point that exports both `CmuxPlugin` and `CmuxSubagentViewer` — Validated in Phase 1: Project Foundation
- ✓ Build scripts: `build` (tsc), `typecheck` (tsc --noEmit), `test` (bun test) — Validated in Phase 1: Project Foundation

### Active

- [ ] Per-plugin config system: JSON config file at `~/.config/opencode/opencode-cmux.json`, bootstrapped on first run if missing, with env var overrides as secondary option
- [ ] GitHub Actions CI workflow: typecheck + build on push/PR
- [ ] GitHub Actions publish workflow: publish to npm on merge to main
- [ ] Semver auto-increment from conventional commit titles (feat: → minor, fix:/chore: → patch, feat!/BREAKING → major) — stretch goal
- [ ] `.nvmrc` set to Node.js 24
- [ ] README with installation and config docs

### Out of Scope

- Linux/Windows support for cmux CLI commands — cmux is macOS-only
- Tests for cmux CLI interactions — requires a live cmux process
- Multiple npm packages in a monorepo — single package, all plugins bundled
- Bun-specific runtime features beyond the shell `$` tag — keep Node.js compatibility where possible

## Context

- Existing code is TypeScript in `lib/` but has no build setup, no `tsconfig.json`, no entry point, and `@opencode-ai/plugin` is not in `package.json` yet
- Runtime is Bun (uses Bun shell `$` tag from `@opencode-ai/plugin`), though package.json currently says CommonJS — needs to switch to `"type": "module"` and ESNext target
- Prior art: `opencode-morph-plugin` uses `tsc` + Bun for testing, single flat `index.ts`, env-var feature flags. `opencode-notifier` uses `src/` structure, `bun build --outdir dist`, separate JSON config via hand-rolled loader
- OpenCode does not have a native per-plugin enable/disable config system — the JSON config file pattern (like opencode-notifier) is the right approach
- Config bootstrapping inspiration: look at npx-based install from `gsd-build/get-shit-done` for how to auto-create config on first run
- User is experienced in TypeScript but new to Bun — bun is straightforward, main differences are shell `$` tag, `bun:test`, and `bun build`/`bun install` commands
- `.nvmrc` → Node.js 24 (current Active LTS as of March 2026)

## Constraints

- **Runtime**: Must work with Bun (plugin system uses Bun shell `$` tag)
- **Package manager**: Bun — may need `bun install` step in CI and local setup docs
- **Node.js**: 24 LTS (Active LTS) — set in `.nvmrc`
- **Module system**: ESM (`"type": "module"`) — matches both prior art packages and OpenCode plugin requirements
- **Publishing**: npm with `--access public` (scoped package)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `@mspiegel31/opencode-cmux` scoped name | Community norm, no squatting risk, clearly owned | — Pending |
| JSON config file over pure env vars | More discoverable, bootstrappable, matches opencode-notifier pattern | — Pending |
| Single package (not monorepo) | Simple, both plugins are small and tightly related | — Pending |
| `tsc` for build (not `bun build`) | Produces `.d.ts` declaration files needed for consumers; morph-plugin precedent | — Pending |
| Conventional commits → semver | Standard, machine-parseable, clear intent | — Pending |

## Current State

Phase 1 complete — project builds cleanly. `bun run build` produces `dist/index.js` and `dist/index.d.ts` with both plugin exports. `bun run typecheck` passes with zero errors. Ready for Phase 2 (config system).

---
*Last updated: 2026-03-20 after Phase 1: Project Foundation*
