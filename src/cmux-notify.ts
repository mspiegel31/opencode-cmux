import type { Plugin } from "@opencode-ai/plugin"
import { EventType } from "./lib/plugin-base"
import { loadConfig } from "./config.js"

export const CmuxPlugin: Plugin = async (ctx) => {
  const { $ } = ctx
  if (!process.env.CMUX_SURFACE_ID) return {}

  const config = await loadConfig()
  if (!config.cmuxNotify.enabled) return {}

  // Cache cmux help at plugin load (once per OpenCode session).
  let helpText: string | null = null
  try {
    helpText = await $`cmux help 2>&1`.text()
  } catch {
    helpText = null
  }

  const hint = helpText
    ? `You are running inside cmux. The full CLI reference follows.\n\n\`\`\`\n${helpText.trim()}\n\`\`\``
    : "You are running inside cmux. Run `cmux help` to see available commands."

  let hinted = false

  /**
   * Returns true if the given sessionID belongs to a subagent (child session).
   * Subagents have a parentID set on their Session object. We skip notifications
   * for subagents — they are a UI concern handled by CmuxSubagentViewer.
   */
  async function isSubagent(sessionID: string): Promise<boolean> {
    try {
      const result = await ctx.client.session.get({ path: { id: sessionID } })
      return !!result.data?.parentID
    } catch {
      return false
    }
  }

  return {
    event: async ({ event }) => {
      if (event.type === EventType.SessionIdle) {
        const { sessionID } = event.properties
        if (await isSubagent(sessionID)) return
        await $`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
      }
      if (event.type === EventType.SessionError) {
        const { sessionID } = event.properties
        if (!sessionID || await isSubagent(sessionID)) return
        await $`cmux notify --title "OpenCode" --subtitle "Error" --body "Session hit an error"`.quiet()
      }
    },

    "tui.prompt.append": async (_input: unknown, output: { text?: string }) => {
      if (hinted) return
      hinted = true
      output.text = (output.text || "") + `\n\n[cmux]\n${hint}`
    },
  }
}
