/**
 * config: Loads and bootstraps per-plugin configuration for opencode-cmux.
 *
 * Config file path: ~/.config/opencode/opencode-cmux.json
 * If the file does not exist, it is created with DEFAULT_CONFIG on first run.
 * Environment variables CMUX_NOTIFY_ENABLED and CMUX_SUBAGENT_VIEWER_ENABLED
 * override config file values (highest priority).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname } from "node:path"

export type ConfigSchema = {
  cmuxNotify: {
    enabled: boolean
  }
  cmuxSubagentViewer: {
    enabled: boolean
  }
}

export const DEFAULT_CONFIG: ConfigSchema = {
  cmuxNotify: { enabled: true },
  cmuxSubagentViewer: { enabled: true },
}

function getConfigPath(): string {
  if (process.env.CMUX_CONFIG_PATH) return process.env.CMUX_CONFIG_PATH
  return `${homedir()}/.config/opencode/opencode-cmux.json`
}

function applyEnvOverrides(config: ConfigSchema): ConfigSchema {
  const notify = process.env.CMUX_NOTIFY_ENABLED
  const viewer = process.env.CMUX_SUBAGENT_VIEWER_ENABLED
  if (notify !== undefined) {
    config.cmuxNotify.enabled = notify.toLowerCase() !== "false"
  }
  if (viewer !== undefined) {
    config.cmuxSubagentViewer.enabled = viewer.toLowerCase() !== "false"
  }
  return config
}

export async function loadConfig(): Promise<ConfigSchema> {
  const configPath = getConfigPath()

  let config: ConfigSchema
  if (!existsSync(configPath)) {
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8")
    config = structuredClone(DEFAULT_CONFIG)
  } else {
    const raw = await readFile(configPath, "utf-8")
    const parsed = JSON.parse(raw) as Partial<ConfigSchema>
    config = {
      cmuxNotify: { ...DEFAULT_CONFIG.cmuxNotify, ...parsed.cmuxNotify },
      cmuxSubagentViewer: { ...DEFAULT_CONFIG.cmuxSubagentViewer, ...parsed.cmuxSubagentViewer },
    }
  }

  return applyEnvOverrides(config)
}
