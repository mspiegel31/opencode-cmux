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

Browser (covered by browser-tools plugin):
  browser       Control the browser surface (navigate, snapshot, click, etc.)

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
        "Get cmux terminal multiplexer CLI reference. Call this when the user asks about cmux commands, workspaces, panes, terminals, or browser surfaces. Pass a specific command name for detailed help (flags, defaults, examples), or omit for the full command listing grouped by category.",
      args: {
        command: tool.schema
          .string()
          .optional()
          .describe(
            "Specific cmux command name to get detailed help for (e.g. 'read-screen', 'send', 'new-workspace'). Omit for full command listing."
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
