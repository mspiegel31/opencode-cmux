/**
 * cmux-browser-tools: Exposes cmux browser CLI as opencode plugin tools.
 *
 * Wraps `cmux browser <subcommand>` as registered tool() functions,
 * giving the AI agent direct control over the cmux browser surface
 * visible in the user's workspace.
 *
 * Only active inside a cmux session (CMUX_WORKSPACE_ID must be set).
 * Returns {} if cmux does not support the browser subcommand.
 */
import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { PluginBase } from "./lib/plugin-base.js"
import { loadConfig } from "./config.js"
import type { Config } from "./config.js"

export class CmuxBrowserToolsPlugin extends PluginBase {
  private surfaceId: string | null = null
  private config!: Config

  async init(config?: Config): Promise<void> {
    this.config = config ?? await loadConfig()
  }

  /**
   * Ensure a browser surface exists and is alive.
   * Creates a new surface if none exists or if the current one is dead.
   * Uses about:blank as default URL — the AI navigates after.
   */
  async ensureSurface(url?: string): Promise<string> {
    if (this.surfaceId !== null) {
      // Verify surface is still alive with a lightweight probe
      try {
        await this.$`cmux browser url --surface ${this.surfaceId}`.quiet()
        return this.surfaceId
      } catch {
        // Surface is dead — fall through to re-create
        this.surfaceId = null
      }
    }
    const target = url ?? "about:blank"
    const result = await this.$`cmux browser open ${target}`.text()
    const m = result.match(/surface:(\d+)/)
    if (!m) throw new Error(`cmux browser open did not return a surface ID. Output: ${result}`)
    this.surfaceId = `surface:${m[1]}`
    return this.surfaceId
  }

  hooks(): Hooks {
    return {
      tool: {},  // tools added in subsequent tasks
    }
  }
}

export const CmuxBrowserTools: Plugin = async (ctx) => {
  if (!process.env.CMUX_WORKSPACE_ID) return {}

  const config = await loadConfig()
  if (!config.cmuxBrowserTools.enabled) return {}

  // Capability check — return {} if this cmux version doesn't support browser subcommand
  try {
    const shell = ctx.$
    await shell`cmux browser --help`.quiet()
  } catch {
    return {}
  }

  const plugin = new CmuxBrowserToolsPlugin(ctx)
  await plugin.init(config)
  return plugin.hooks()
}
