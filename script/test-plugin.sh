#!/usr/bin/env bash
# test-plugin.sh — Build and launch a throwaway opencode session in a new cmux workspace.
#
# Usage:
#   script/test-plugin.sh              # build + launch
#   script/test-plugin.sh --no-build   # skip build, just launch
#
# The new opencode instance loads the plugin from this repo's dist/ (local path
# reference in opencode.work.jsonc), so `bun run build` is all that's needed to
# make changes visible.
#
# After testing, find the session from your main opencode via session_list / session_read.

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

skip_build=false
for arg in "$@"; do
  case "$arg" in
    --no-build) skip_build=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ "$skip_build" = false ]; then
  echo "▸ Building plugin…"
  cd "$PLUGIN_DIR"
  bun run build
  echo "✓ Build complete"
fi

echo "▸ Launching test workspace…"
cmux new-workspace \
  --name "🧪 Plugin Test" \
  --cwd "$PLUGIN_DIR" \
  --command "opencode"
