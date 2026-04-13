import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { BunShell } from "../lib/event-utils.js"
import { loadConfig } from "../config/index.js"
import { createAppContainer } from "../container.js"
import { asClass } from "awilix"

export interface CmuxHelpToolDeps {
  shell: BunShell
}

const CATEGORY_PREAMBLE = `cmux commands by category:

Terminal I/O:
  read-screen   Capture the current terminal screen content
  send          Send text input to a pane
  send-key      Send a key sequence to a pane

Layout:
  tree          Show the workspace/pane tree
  list-workspaces  List all workspaces
  list-panes    List panes in the current workspace
  new-workspace Create a new workspace
  new-pane      Create a new pane
  split-pane    Split an existing pane

Window Management:
  new-window    Create a new window
  list-windows  List all windows

Notifications:
  notify        Send a desktop notification
  set-status    Update the cmux sidebar status bar

Browser Automation (run via bash — use "cmux browser <subcommand>"):
  browser open [url]           Open a new browser surface (returns surface ID)
  browser goto <url>           Navigate to URL
  browser back/forward/reload  History navigation
  browser snapshot             Get page accessibility tree
  browser screenshot           Capture page image
  browser click/hover/fill     DOM interaction (use --selector <css>)
  browser type/press           Keyboard input
  browser find <by> <value>    Semantic element locator (role, text, label, etc.)
  browser eval --script <js>   Execute JavaScript in page context
  browser tab new/list/switch  Tab management
  browser wait                 Wait for selector/text/URL condition
  browser console list         Get console messages
  browser network requests     Get network log
  browser get <prop>           Extract element properties (text, html, value, attr, etc.)
  browser is <state>           Check element state (visible, enabled, checked)
  browser dialog accept/dismiss  Handle browser dialogs

  IMPORTANT: Most browser subcommands accept --surface <id> to target a specific
  browser surface. Many action commands accept --snapshot-after to return an
  accessibility tree snapshot after the action completes — use this to avoid
  separate snapshot calls. Run "cmux browser --help" for the full reference,
  or "cmux browser <subcommand> --help" for detailed flags and examples.

Markdown:
  markdown open Open a markdown file in the viewer

Session Info:
  info          Show session information
  capabilities  List available cmux capabilities`

export class CmuxHelpTool {
  constructor(private readonly deps: CmuxHelpToolDeps) {}

  private cmuxHelp() {
    return tool({
      description:
        "Look up cmux CLI reference — commands, flags, and examples for the cmux terminal multiplexer. " +
        "Call this tool BEFORE running any cmux command you haven't used recently. " +
        "Covers: terminal I/O (read-screen, send, send-key), layout (workspaces, panes, split-pane), " +
        "browser automation (navigate, click, fill, screenshot, snapshot, eval, network, console), " +
        "notifications, markdown viewer, and session info. " +
        "Pass a command name for detailed help, or omit for the full command listing.",
      args: {
        command: tool.schema
          .string()
          .optional()
          .describe(
            "Specific cmux command name (e.g. 'read-screen', 'send', 'new-workspace', 'browser'). Omit for full command listing."
          ),
      },
      execute: async (args): Promise<string> => {
        try {
          if (args.command) {
            return await this.deps.shell`cmux ${args.command} --help 2>&1`.text()
          }
          const rawOutput = await this.deps.shell`cmux help 2>&1`.text()
          return CATEGORY_PREAMBLE + "\n\n" + rawOutput
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })
  }

  hooks(): Hooks {
    return {
      tool: {
        cmux_help: this.cmuxHelp(),
      },
    }
  }
}

export const CmuxHelp: Plugin = async (ctx) => {
  if (!process.env.CMUX_SURFACE_ID) return {}
  const config = await loadConfig()
  const container = createAppContainer(config, ctx)
  container.register({ cmuxHelpTool: asClass(CmuxHelpTool).singleton() })
  return container.resolve("cmuxHelpTool").hooks()
}
