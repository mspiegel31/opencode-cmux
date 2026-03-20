# Quick Task: Bun → Node.js/npm Migration

**Date:** 2026-03-19
**Commit:** `037ad0f`
**Status:** Complete ✓

## Summary

Migrated the project from Bun as the runtime/package manager to Node.js 24 + npm. Replaced `bun:test` with Jest + ts-jest for running tests. All 8 existing tests continue to pass.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Removed `bun-types`, added `jest`, `@types/jest`, `ts-jest`; updated `test` script to use `node --experimental-vm-modules` + jest |
| `tsconfig.json` | Replaced `"bun-types"` with `"jest"` and `"node"` in `types` array |
| `jest.config.js` | **Created** — ts-jest ESM preset, `moduleNameMapper` for `.js` → `.ts` rewrites, `dist/` excluded from test paths |
| `src/config.test.ts` | Changed import from `"bun:test"` to `"@jest/globals"` |
| `.github/workflows/ci.yml` | Replaced `oven-sh/setup-bun` + `bun install` with `actions/setup-node` + `npm ci`; replaced `bun test` with `npm test` |
| `.github/workflows/release.yml` | Removed `setup-bun`, consolidated to single `actions/setup-node` step, replaced `bun install` and `bun run build` with npm equivalents |
| `bun.lock` | **Deleted** |
| `package-lock.json` | **Created** via `npm install` |

## Verification

```
npm run build   → clean (tsc, 0 errors)
npm run typecheck → clean (0 errors)
npm test        → 8/8 tests passing

PASS src/config.test.ts
  loadConfig()
    ✓ returns DEFAULT_CONFIG when file does not exist
    ✓ creates config file when it does not exist
    ✓ reads user config values from existing file
    ✓ merges partial config — missing keys use defaults
    ✓ CMUX_NOTIFY_ENABLED=false overrides config file
    ✓ CMUX_SUBAGENT_VIEWER_ENABLED=false overrides config file
    ✓ unset env var does not override config file
    ✓ CMUX_NOTIFY_ENABLED=true overrides config file false value
```

## Technical Notes

- ESM + Jest requires `node --experimental-vm-modules` flag in the test script
- `jest.config.js` must be `.js` (not `.ts`) because Jest reads its config before TypeScript transformation; a `.ts` config would require `ts-node` as an additional dependency
- `ts-jest` transform uses `moduleResolution: "node16"` override because ts-jest's transformer doesn't support `"bundler"` resolution (which is what the main tsconfig uses)
- `moduleNameMapper` strips `.js` extensions from local imports so Jest resolves to `.ts` source files correctly
