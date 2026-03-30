/**
 * config: Loads and bootstraps per-plugin configuration for opencode-cmux.
 *
 * Config file path: ~/.config/opencode/opencode-cmux.jsonc
 * If the file does not exist, it is created with defaults and JSONC comments.
 * Environment variables CMUX_NOTIFY_ENABLED, CMUX_SUBAGENT_VIEWER_ENABLED,
 * and CMUX_BROWSER_TOOLS_ENABLED override config file values (highest priority).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname } from "node:path"
import { z } from "zod"
import { parse as parseJsonc } from "jsonc-parser"

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const NotifySchema = z.object({
  sessionDone:          z.boolean().default(true),
  sessionError:         z.boolean().default(true),
  permissionRequest:    z.boolean().default(true),
  question:             z.boolean().default(true),
  onlyWhenUnfocused:    z.boolean().default(true),
}).default(() => ({
  sessionDone: true, sessionError: true, permissionRequest: true,
  question: true, onlyWhenUnfocused: true,
}))

const SidebarSchema = z.object({
  enabled: z.boolean().default(true),
}).default(() => ({ enabled: true }))

const SubagentViewerSchema = z.object({
  enabled: z.boolean().default(true),
}).default(() => ({ enabled: true }))

const BrowserToolsSchema = z.object({
  enabled: z.boolean().default(true),
}).default(() => ({ enabled: true }))

export const ConfigSchema = z.object({
  $schema:            z.string().optional(),
  notify:             NotifySchema,
  sidebar:            SidebarSchema,
  cmuxSubagentViewer: SubagentViewerSchema,
  cmuxBrowserTools:   BrowserToolsSchema,
}).strip()

export type Config = z.infer<typeof ConfigSchema>

/**
 * Build a Config from a plain object, filling in defaults for any missing fields.
 * Intended for tests — avoids filesystem I/O and module mocking.
 *
 * @example
 * const cfg = parseConfig()                        // all defaults
 * const cfg = parseConfig({ sidebar: { enabled: false } })  // override one field
 */
export function parseConfig(overrides: Record<string, unknown> = {}): Config {
  return ConfigSchema.parse(overrides)
}

// ---------------------------------------------------------------------------
// Bootstrap template (written to disk on first run)
// ---------------------------------------------------------------------------

const SCHEMA_URL = "https://raw.githubusercontent.com/mspiegel31/opencode-cmux/main/schema.json"

const BOOTSTRAP_CONTENT = `{
  // JSON Schema for editor validation and autocomplete
  "$schema": "${SCHEMA_URL}",

  // Desktop notification settings
  "notify": {
    "sessionDone": true,        // notify when primary session goes idle
    "sessionError": true,       // notify when primary session errors
    "permissionRequest": true,  // notify when OpenCode is blocked waiting for permission
    "question": true,           // notify when agent asks the user a question
    "onlyWhenUnfocused": true   // suppress notifications when cmux surface is focused
  },

  // Sidebar status bar settings (cmux set-status / clear-status)
  "sidebar": {
    "enabled": true // master switch; set false if you have no sidebar space
  },

  // Subagent TUI pane viewer
  "cmuxSubagentViewer": {
    "enabled": true
  },

  // cmux Browser Tools — wraps cmux browser CLI as AI tools
  "cmuxBrowserTools": {
    "enabled": true // set false to disable browser tools
  }
}
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  if (process.env.CMUX_CONFIG_PATH) return process.env.CMUX_CONFIG_PATH
  return `${homedir()}/.config/opencode/opencode-cmux.jsonc`
}

function applyEnvOverrides(config: Config): Config {
  const notify = process.env.CMUX_NOTIFY_ENABLED
  const viewer = process.env.CMUX_SUBAGENT_VIEWER_ENABLED
  if (notify !== undefined) {
    const val = notify.toLowerCase() !== "false"
    config.notify.sessionDone      = val
    config.notify.sessionError     = val
    config.notify.permissionRequest = val
    config.notify.question         = val
  }
  if (viewer !== undefined) {
    config.cmuxSubagentViewer.enabled = viewer.toLowerCase() !== "false"
  }
  const browserTools = process.env.CMUX_BROWSER_TOOLS_ENABLED
  if (browserTools !== undefined) {
    config.cmuxBrowserTools.enabled = browserTools.toLowerCase() !== "false"
  }
  return config
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath()

  let config: Config
  if (!existsSync(configPath)) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, BOOTSTRAP_CONTENT, "utf-8")
    config = ConfigSchema.parse({})
  } else {
    const raw = await readFile(configPath, "utf-8")
    const parseErrors: { error: number; offset: number; length: number }[] = []
    const parsed: unknown = parseJsonc(raw, parseErrors)
    if (parseErrors.length > 0) {
      console.error("[opencode-cmux] Config parse error — falling back to defaults:", parseErrors)
      config = ConfigSchema.parse({})
    } else {
      try {
        config = ConfigSchema.parse(parsed)
      } catch (err) {
        if (err instanceof z.ZodError) {
          console.error("[opencode-cmux] Config validation error — falling back to defaults:", JSON.stringify(err.issues))
        } else {
          console.error("[opencode-cmux] Config parse error — falling back to defaults:", err)
        }
        config = ConfigSchema.parse({})
      }
    }
  }

  return applyEnvOverrides(config)
}
