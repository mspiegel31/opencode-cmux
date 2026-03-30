# opencode-cmux

## Build & Test

```bash
bun run build          # compile TypeScript → dist/
bun run test           # vitest
bun run typecheck      # tsc --noEmit
```

## Plugin Dev Loop

The plugin is loaded via local path in `opencode.work.jsonc`:
```json
"plugin": ["/Users/mike/development/personal/opencode-cmux"]
```

`bun run build` writes to `dist/` — any **new** opencode instance reads the
fresh build. The running instance keeps the old code. No cache sync needed.

**To test changes without restarting your dev session:**

```bash
script/test-plugin.sh            # build + launch throwaway opencode in new cmux workspace
script/test-plugin.sh --no-build # skip build, just launch
```

Then from the dev session, read test results via `session_list` / `session_read`
— all opencode instances share one SQLite DB (`~/.local/share/opencode/opencode.db`).
