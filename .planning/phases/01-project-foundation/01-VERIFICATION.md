---
phase: 01-project-foundation
status: passed
verified_date: "2026-03-20"
verifier: gsd-executor
---

# Phase 1: Project Foundation — Verification

**Goal:** The project builds cleanly with Bun, exports both plugins from a single entry point, and is ready to be installed as an OpenCode plugin.

## Status: PASSED ✓

All 5 success criteria verified against the live codebase.

## Automated Verification

### Criterion 1: bun run build exits 0 and produces dist artifacts

```
$ bun run build
$ tsc
[exit 0]
```

- ✓ `dist/index.js` — exists (111 bytes)
- ✓ `dist/index.d.ts` — exists (146 bytes) with both exports
- ✓ `dist/cmux-notify.js`, `dist/cmux-subagent-viewer.js` — compiled
- ✓ `dist/lib/` — utility modules compiled

### Criterion 2: bun run typecheck exits 0 with no errors

```
$ bun run typecheck
$ tsc --noEmit
[exit 0, no output]
```

- ✓ Zero type errors across all source files

### Criterion 3: package.json — type=module, exports, @opencode-ai/plugin dep

```json
{
  "type": "module",
  "exports": {".": {"types": "./dist/index.d.ts", "import": "./dist/index.js"}},
  "dependencies": {"@opencode-ai/plugin": "^1.2.27"}
}
```

- ✓ `type: module` — ESM-only package
- ✓ `exports` field with types+import — correct dual resolution
- ✓ `@opencode-ai/plugin: ^1.2.27` in dependencies

### Criterion 4: .nvmrc contains 24

```
$ cat .nvmrc
24
```

- ✓ Node.js 24 LTS pinned

### Criterion 5: src/index.ts exports both plugins

```typescript
export { CmuxPlugin } from "./cmux-notify.js"
export { CmuxSubagentViewer } from "./cmux-subagent-viewer.js"
```

- ✓ `CmuxPlugin` — named export from cmux-notify
- ✓ `CmuxSubagentViewer` — named export from cmux-subagent-viewer
- ✓ `.js` extensions for ESM compatibility
- ✓ No default export (OpenCode loader expects named exports)

## Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| FOUND-01 | TypeScript compiles to dist/ with declaration files | ✓ Verified |
| FOUND-02 | package.json type=module with main/types/exports → dist/ | ✓ Verified |
| FOUND-03 | @opencode-ai/plugin in dependencies | ✓ Verified |
| FOUND-04 | .nvmrc pinned to Node.js 24 LTS | ✓ Verified |
| FOUND-05 | bun install, bun test, bun run build all work | ✓ Verified |
| FOUND-06 | index.ts exports CmuxPlugin and CmuxSubagentViewer | ✓ Verified |

**Score: 6/6 must-haves verified** — Phase goal achieved.

## Notable Issues

None — plans executed with one minor deviation: `bun.lockb` (binary format, expected by plan) was replaced by `bun.lock` (text format, Bun v1.3+ changed lockfile format). Functionally equivalent.

Type error in `cmux-notify.ts` (implicit any on `tui.prompt.append` hook) was auto-fixed by adding explicit type annotations.
