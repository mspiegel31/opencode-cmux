#!/usr/bin/env bash
# Sets up a minimal opencode environment for VHS demo recordings.
# Loads the opencode-cmux plugin from its built dist/ in the repo root
# with no MCP servers so the TUI boots cleanly.
#
# Usage (inside a .tape file's hidden preamble):
#   source assets/tapes/demo-env.sh

set -euo pipefail

# Resolve the repo root relative to this script
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

DEMO_DIR="$(mktemp -d)/opencode"
mkdir -p "$DEMO_DIR"

cat > "$DEMO_DIR/opencode.jsonc" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "plugin": ["$REPO_ROOT"],
  "mcp": {}
}
EOF

cat > "$DEMO_DIR/tui.jsonc" <<EOF
{
  "\$schema": "https://opencode.ai/tui.json",
  "plugin": ["$REPO_ROOT"]
}
EOF

export XDG_CONFIG_HOME="${DEMO_DIR%/opencode}"
export OPENCODE_DISABLE_PROJECT_CONFIG=1
unset OPENCODE_CONFIG
unset OPENCODE_TUI_CONFIG
unset OPENCODE_CONFIG_DIR
unset OPENCODE_CONFIG_CONTENT
