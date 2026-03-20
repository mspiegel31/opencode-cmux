import type { Plugin } from "@opencode-ai/plugin"
import { EventType } from "./plugin-base"

export const CmuxPlugin: Plugin = async ({ $ }) => {
  if (!process.env.CMUX_SURFACE_ID) return {}

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

  return {
    event: async ({ event }) => {
      if (event.type === EventType.SessionIdle) {
        await $`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
      }
      if (event.type === EventType.SessionError) {
        await $`cmux notify --title "OpenCode" --subtitle "Error" --body "Session hit an error"`.quiet()
      }
    },

    "tui.prompt.append": async (_input, output) => {
      if (hinted) return
      hinted = true
      output.text = (output.text || "") + `\n\n[cmux]\n${hint}`
    },
  }
}
