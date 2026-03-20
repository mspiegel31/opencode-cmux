# opencode-cmux

An [OpenCode](https://opencode.ai) plugin that integrates with [cmux](https://github.com/nicholasgasior/cmux) to give you visibility into subagent sessions running in your terminal.

When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.

> **macOS only** — cmux is a macOS terminal multiplexer.

---

## Get started

Add the plugin to your OpenCode config. For global registration (all projects), edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "@mspiegel31/opencode-cmux"
  ]
}
```

For project-level registration only, create or edit `opencode.json` in your project root with the same content.

OpenCode installs the plugin automatically at startup — no `npm install` required.

---

## Configuration

Per-plugin config lives at `~/.config/opencode/opencode-cmux.json`. The file is created the first time you run OpenCode inside a cmux session.

```json
{
  "cmuxNotify": {
    "enabled": true
  },
  "cmuxSubagentViewer": {
    "enabled": true
  }
}
```

Set `enabled` to `false` to disable a plugin.

---

## Reference

### Plugins

#### CmuxPlugin

Sends a cmux notification when an OpenCode session goes idle or hits an error, and injects a cmux CLI reference hint into your first TUI prompt.

Only active inside a cmux session.

#### CmuxSubagentViewer

Automatically opens a new cmux split pane running `opencode attach` for each subagent session spawned by the Task tool. The pane closes automatically when the subagent completes or errors.

Only active inside a cmux session.

---

### Requirements

- [cmux](https://github.com/nicholasgasior/cmux) installed and running
- [OpenCode](https://opencode.ai) v1.0+
- Node.js 24+

---

## License

ISC
