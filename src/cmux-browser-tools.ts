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
import { tool } from "@opencode-ai/plugin"
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

  private browserNavigate() {
    return tool({
      description: "Navigate the browser to a URL, or go back/forward/reload. Use this to load pages. Returns the page snapshot after navigation.",
      args: {
        type: tool.schema.enum(["url", "back", "forward", "reload"]),
        url: tool.schema.string().optional().describe("Required when type is 'url'"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          let result: string
          if (args.type === "url") {
            if (!args.url) return "Error: url is required when type is 'url'"
            result = await this.$`cmux browser goto ${args.url} --snapshot-after --surface ${surface}`.text()
          } else if (args.type === "back") {
            result = await this.$`cmux browser back --snapshot-after --surface ${surface}`.text()
          } else if (args.type === "forward") {
            result = await this.$`cmux browser forward --snapshot-after --surface ${surface}`.text()
          } else {
            result = await this.$`cmux browser reload --snapshot-after --surface ${surface}`.text()
          }
          return `Navigated\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserSnapshot() {
    return tool({
      description: "Get the accessibility tree snapshot of the current page. Use this to understand page structure before interacting. Use find_element for precise targeting.",
      args: {
        interactive: tool.schema.boolean().optional().describe("Only show interactive elements"),
        compact: tool.schema.boolean().optional(),
        maxDepth: tool.schema.number().optional(),
        selector: tool.schema.string().optional().describe("CSS selector to scope snapshot"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const flags: string[] = []
          if (args.interactive) flags.push("--interactive")
          if (args.compact) flags.push("--compact")
          if (args.maxDepth !== undefined) flags.push("--max-depth", String(args.maxDepth))
          if (args.selector) flags.push("--selector", args.selector)
          const result = await this.$`cmux browser snapshot ${flags} --surface ${surface}`.text()
          return result
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserScreenshot() {
    return tool({
      description: "Take a screenshot of the current browser page.",
      args: {
        filePath: tool.schema.string().optional().describe("Path to save screenshot. If omitted, saves to a temp file."),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const outPath = args.filePath ?? `/tmp/cmux-screenshot-${Date.now()}.png`
          await this.$`cmux browser screenshot --out ${outPath} --surface ${surface}`.text()
          return `Screenshot saved to: ${outPath}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserFind() {
    return tool({
      description: "Find an element by semantic locator (role, text, label, etc.). This is the PRIMARY way to target elements — prefer this over CSS selectors. Returns the element reference to use in other tools.",
      args: {
        by: tool.schema.enum(["role", "text", "label", "placeholder", "alt", "title", "testid", "first", "last", "nth"]),
        value: tool.schema.string().describe("The value to find"),
        index: tool.schema.number().optional().describe("For nth: the zero-based index"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const flags: string[] = []
          if (args.index !== undefined) flags.push("--index", String(args.index))
          const result = await this.$`cmux browser find ${args.by} ${args.value} ${flags} --surface ${surface}`.text()
          return result
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserUrl() {
    return tool({
      description: "Get the current page URL.",
      args: {},
      execute: async (_args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser url --surface ${surface}`.text()
          return result
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  hooks(): Hooks {
    return {
      tool: {
        browser_navigate: this.browserNavigate(),
        browser_snapshot: this.browserSnapshot(),
        browser_screenshot: this.browserScreenshot(),
        browser_find: this.browserFind(),
        browser_url: this.browserUrl(),
      },
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
