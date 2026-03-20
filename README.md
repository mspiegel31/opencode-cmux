# opencode-cmux

An [OpenCode](https://opencode.ai) plugin that integrates with [cmux](https://github.com/nicholasgasior/cmux) to give you visibility into subagent sessions running in your terminal.

When OpenCode runs inside cmux, subagent sessions automatically get their own TUI pane so you can see what agents are doing without any manual setup.

## Requirements

- [cmux](https://github.com/nicholasgasior/cmux) installed and running (macOS only)
- [OpenCode](https://opencode.ai) v1.0+
- Node.js 24+

## Installation

```sh
npm install @mspiegel31/opencode-cmux
# or
bun add @mspiegel31/opencode-cmux
```

## OpenCode Registration

Add the plugin to your OpenCode config. For project-level registration, create or edit `opencode.json` in your project root:

```json
{
  "plugins": [
    "@mspiegel31/opencode-cmux"
  ]
}
```

For global registration (all projects), edit `~/.config/opencode/opencode.json`:

```json
{
  "plugins": [
    "@mspiegel31/opencode-cmux"
  ]
}
```

## Plugins

This package includes two plugins:

### CmuxPlugin

Sends cmux notifications when an OpenCode session goes idle or hits an error, and injects a cmux CLI reference hint into your first TUI prompt.

**Activates when:** `CMUX_SURFACE_ID` environment variable is set (automatically set by cmux).

### CmuxSubagentViewer

Automatically opens a new cmux split pane running `opencode attach` for each subagent session spawned by the Task tool. The pane closes automatically when the subagent session completes or errors.

**Activates when:** `CMUX_WORKSPACE_ID` environment variable is set (automatically set by cmux).

## Configuration

Per-plugin config is stored at `~/.config/opencode/opencode-cmux.json`. The file is auto-created with defaults on first run.

**Default config:**

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

| Field                           | Type    | Default | Description                              |
|---------------------------------|---------|---------|------------------------------------------|
| `cmuxNotify.enabled`            | boolean | `true`  | Enable/disable the CmuxPlugin            |
| `cmuxSubagentViewer.enabled`    | boolean | `true`  | Enable/disable the CmuxSubagentViewer    |

## Environment Variables

Environment variable overrides take priority over the config file.

| Variable                       | Overrides                     | Values           | Description                                      |
|--------------------------------|-------------------------------|------------------|--------------------------------------------------|
| `CMUX_NOTIFY_ENABLED`          | `cmuxNotify.enabled`          | `true` / `false` | Override CmuxPlugin enabled state                |
| `CMUX_SUBAGENT_VIEWER_ENABLED` | `cmuxSubagentViewer.enabled`  | `true` / `false` | Override CmuxSubagentViewer enabled state        |
| `CMUX_SURFACE_ID`              | —                             | Set by cmux      | Guards CmuxPlugin activation (set by cmux)       |
| `CMUX_WORKSPACE_ID`            | —                             | Set by cmux      | Guards CmuxSubagentViewer activation (set by cmux)|
| `CMUX_CONFIG_PATH`             | Config file path              | Absolute path    | Override config file location (for testing)      |

## License

ISC
