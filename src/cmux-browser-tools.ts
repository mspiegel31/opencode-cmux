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

  private browserClick() {
    return tool({
      description: "Click an element. Use browser_find to locate elements first, then pass the selector here.",
      args: {
        selector: tool.schema.string().describe("CSS selector targeting the element to click"),
        doubleClick: tool.schema.boolean().optional().describe("If true, double-click instead of single click"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const cmd = args.doubleClick ? "dblclick" : "click"
          const result = await this.$`cmux browser ${cmd} --selector ${args.selector} --snapshot-after --surface ${surface}`.text()
          return `Clicked\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserHover() {
    return tool({
      description: "Hover over an element to reveal tooltips or trigger hover states.",
      args: {
        selector: tool.schema.string().describe("CSS selector targeting the element to hover"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser hover --selector ${args.selector} --snapshot-after --surface ${surface}`.text()
          return `Hovered\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserFill() {
    return tool({
      description: "Fill an input field with a value. Clears existing content and sets the new value.",
      args: {
        selector: tool.schema.string().describe("CSS selector targeting the input element"),
        value: tool.schema.string().describe("The value to fill in"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser fill --selector ${args.selector} --text ${args.value} --snapshot-after --surface ${surface}`.text()
          return `Filled\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserType() {
    return tool({
      description: "Type text into the currently focused input. Optionally press a key after typing (e.g. Enter to submit).",
      args: {
        text: tool.schema.string().describe("The text to type"),
        submitKey: tool.schema.string().optional().describe("Key to press after typing, e.g. 'Enter', 'Tab'"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          await this.$`cmux browser type --text ${args.text} --surface ${surface}`.quiet()
          if (args.submitKey) {
            const result = await this.$`cmux browser press --key ${args.submitKey} --snapshot-after --surface ${surface}`.text()
            return `Typed and pressed ${args.submitKey}\n\n--- Page Snapshot ---\n${result}`
          }
          const result = await this.$`cmux browser snapshot --surface ${surface}`.text()
          return `Typed text\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserPressKey() {
    return tool({
      description: "Press a keyboard key or key combination on the currently focused element.",
      args: {
        key: tool.schema.string().describe("Key or combination, e.g. 'Enter', 'Tab', 'Control+A', 'Escape'"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser press --key ${args.key} --snapshot-after --surface ${surface}`.text()
          return `Pressed ${args.key}\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserSelect() {
    return tool({
      description: "Select an option from a <select> dropdown element.",
      args: {
        selector: tool.schema.string().describe("CSS selector targeting the <select> element"),
        value: tool.schema.string().describe("The option value to select"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser select --selector ${args.selector} --value ${args.value} --snapshot-after --surface ${surface}`.text()
          return `Selected\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserScroll() {
    return tool({
      description: "Scroll the page or a specific element. Provide deltaX/deltaY in pixels.",
      args: {
        selector: tool.schema.string().optional().describe("CSS selector of element to scroll. Omit to scroll the page."),
        deltaX: tool.schema.number().optional().describe("Horizontal scroll amount in pixels"),
        deltaY: tool.schema.number().optional().describe("Vertical scroll amount in pixels"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const flags: string[] = []
          if (args.selector) flags.push("--selector", args.selector)
          if (args.deltaX !== undefined) flags.push("--dx", String(args.deltaX))
          if (args.deltaY !== undefined) flags.push("--dy", String(args.deltaY))
          const result = await this.$`cmux browser scroll ${flags} --snapshot-after --surface ${surface}`.text()
          return `Scrolled\n\n--- Page Snapshot ---\n${result}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserNewPage() {
    return tool({
      description: "Open a new browser tab. Optionally provide a URL to navigate to immediately.",
      args: {
        url: tool.schema.string().optional().describe("URL to open in the new tab. If omitted, opens a blank tab."),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const cmdArgs: string[] = []
          if (args.url) cmdArgs.push(args.url)
          await this.$`cmux browser tab new ${cmdArgs} --surface ${surface}`.quiet()
          return "New tab opened"
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserClosePage() {
    return tool({
      description: "Close a browser tab. If no tab index is provided, closes the current tab.",
      args: {
        tabIndex: tool.schema.number().optional().describe("Zero-based index of the tab to close. Omit to close the current tab."),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const flags: string[] = []
          if (args.tabIndex !== undefined) flags.push("--index", String(args.tabIndex))
          await this.$`cmux browser tab close ${flags} --surface ${surface}`.quiet()
          return "Tab closed"
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserListPages() {
    return tool({
      description: "List all open browser tabs.",
      args: {},
      execute: async (_args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const result = await this.$`cmux browser tab list --surface ${surface}`.text()
          return result
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserSelectPage() {
    return tool({
      description: "Switch to a specific browser tab by its index.",
      args: {
        tabIndex: tool.schema.number().describe("Zero-based index of the tab to switch to"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          await this.$`cmux browser tab switch ${String(args.tabIndex)} --surface ${surface}`.quiet()
          return `Switched to tab ${args.tabIndex}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserResize() {
    return tool({
      description: "Resize the browser viewport to the specified dimensions.",
      args: {
        width: tool.schema.number().describe("Viewport width in pixels"),
        height: tool.schema.number().describe("Viewport height in pixels"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          await this.$`cmux browser viewport ${String(args.width)} ${String(args.height)} --surface ${surface}`.quiet()
          return `Viewport resized to ${args.width}x${args.height}`
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserWaitFor() {
    return tool({
      description: "Wait for a condition to be met on the current page. At least one of selector, text, or urlContains must be provided.",
      args: {
        selector: tool.schema.string().optional().describe("Wait for an element matching this CSS selector to appear"),
        text: tool.schema.string().optional().describe("Wait for this text to appear on the page"),
        urlContains: tool.schema.string().optional().describe("Wait for the page URL to contain this string"),
        timeoutMs: tool.schema.number().optional().describe("Maximum wait time in milliseconds"),
      },
      execute: async (args, _ctx): Promise<string> => {
        if (!args.selector && !args.text && !args.urlContains) {
          return "Error: at least one of selector, text, or urlContains must be provided"
        }
        try {
          const surface = await this.ensureSurface()
          const flags: string[] = []
          if (args.selector) flags.push("--selector", args.selector)
          if (args.text) flags.push("--text", args.text)
          if (args.urlContains) flags.push("--url-contains", args.urlContains)
          if (args.timeoutMs !== undefined) flags.push("--timeout-ms", String(args.timeoutMs))
          const result = await this.$`cmux browser wait ${flags} --surface ${surface}`.text()
          return result
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  private browserHandleDialog() {
    return tool({
      description: "Accept or dismiss a browser dialog (alert, confirm, prompt).",
      args: {
        action: tool.schema.enum(["accept", "dismiss"]),
        promptText: tool.schema.string().optional().describe("Text to enter into a prompt dialog (only for accept action)"),
      },
      execute: async (args, _ctx): Promise<string> => {
        try {
          const surface = await this.ensureSurface()
          const promptArgs: string[] = args.promptText ? [args.promptText] : []
          await this.$`cmux browser dialog ${args.action} ${promptArgs} --surface ${surface}`.quiet()
          return `Dialog ${args.action}ed`
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
        browser_click: this.browserClick(),
        browser_hover: this.browserHover(),
        browser_fill: this.browserFill(),
        browser_type: this.browserType(),
        browser_press_key: this.browserPressKey(),
        browser_select: this.browserSelect(),
        browser_scroll: this.browserScroll(),
        browser_new_page: this.browserNewPage(),
        browser_close_page: this.browserClosePage(),
        browser_list_pages: this.browserListPages(),
        browser_select_page: this.browserSelectPage(),
        browser_resize: this.browserResize(),
        browser_wait_for: this.browserWaitFor(),
        browser_handle_dialog: this.browserHandleDialog(),
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
