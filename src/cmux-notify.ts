import type { Plugin } from "@opencode-ai/plugin"
import { EventType } from "./lib/plugin-base"
import { loadConfig } from "./config.js"

export const CmuxPlugin: Plugin = async (ctx) => {
  const { $ } = ctx
  if (!process.env.CMUX_SURFACE_ID) return {}

  const config = await loadConfig()

  // ---------------------------------------------------------------------------
  // cmux help hint (injected once into the first prompt)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Pending-input tracking
  //
  // These Sets hold IDs of in-flight permission requests and questions.
  // isWaitingForInput() guards the idle→done path to prevent spurious "Done"
  // notifications when the session goes idle but is actually blocked waiting
  // for user input.
  // ---------------------------------------------------------------------------

  const pendingPermissions = new Set<string>()
  const pendingQuestions   = new Set<string>()

  function isWaitingForInput(): boolean {
    return pendingPermissions.size > 0 || pendingQuestions.size > 0
  }

  // ---------------------------------------------------------------------------
  // Sidebar helpers
  //
  // All helpers are no-ops when config.sidebar.enabled is false.
  // Sidebar key is "opencode" — distinct from subagent "agent-N" keys.
  // ---------------------------------------------------------------------------

  async function sidebarSetWorking(): Promise<void> {
    if (!config.sidebar.enabled) return
    await $`cmux set-status opencode --icon terminal --color '#f59e0b' --text 'Working'`.quiet()
  }

  async function sidebarSetWaiting(): Promise<void> {
    if (!config.sidebar.enabled) return
    await $`cmux set-status opencode --icon lock --color '#ef4444' --text 'Waiting'`.quiet()
  }

  async function sidebarSetQuestion(): Promise<void> {
    if (!config.sidebar.enabled) return
    await $`cmux set-status opencode --icon help-circle --color '#a855f7' --text 'Question'`.quiet()
  }

  async function sidebarClear(): Promise<void> {
    if (!config.sidebar.enabled) return
    await $`cmux clear-status opencode`.quiet()
  }

  // ---------------------------------------------------------------------------
  // isSubagent helper — skip primary-session events for child sessions
  // ---------------------------------------------------------------------------

  async function isSubagent(sessionID: string): Promise<boolean> {
    try {
      const result = await ctx.client.session.get({ path: { id: sessionID } })
      return !!result.data?.parentID
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Restore sidebar after a pending input item is cleared
  //
  // Once a permission or question is resolved, if nothing else is pending:
  //   - Session still busy → restore "working"
  //   - Session idle → clear sidebar
  // ---------------------------------------------------------------------------

  let sessionBusy = false

  async function restoreAfterInputCleared(): Promise<void> {
    if (isWaitingForInput()) return // other pending items remain
    if (sessionBusy) {
      await sidebarSetWorking()
    } else {
      await sidebarClear()
    }
  }

  // ---------------------------------------------------------------------------
  // Permission ID extraction helper — handles both v1 and v2 property shapes
  // ---------------------------------------------------------------------------

  function getPermissionId(props: unknown): string | undefined {
    if (!props || typeof props !== "object") return undefined
    const p = props as Record<string, unknown>
    const raw = p["id"] ?? p["requestID"] ?? p["permissionID"]
    if (typeof raw !== "string" || raw.trim() === "") return undefined
    return raw.trim()
  }

  return {
    // -------------------------------------------------------------------------
    // Event handler
    // -------------------------------------------------------------------------

    event: async ({ event }) => {
      const e = event as { type: string; properties: Record<string, unknown> }

      // --- session.status (sidebar working/done transitions) ---
      if (e.type === EventType.SessionStatus) {
        const sessionID = e.properties["sessionID"] as string
        const status    = e.properties["status"] as { type: string }
        if (await isSubagent(sessionID)) return

        if (status?.type === "busy") {
          sessionBusy = true
          // If waiting for input, sidebar already shows waiting/question — leave it
          if (!isWaitingForInput()) {
            await sidebarSetWorking()
          }
          return
        }

        if (status?.type === "idle") {
          sessionBusy = false
          if (isWaitingForInput()) return // blocked — don't clear or notify done
          await sidebarClear()
          if (config.notify.sessionDone) {
            await $`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
          }
          return
        }
      }

      // --- SessionIdle (legacy fallback — kept for SDK versions that don't emit session.status) ---
      if (e.type === EventType.SessionIdle) {
        const sessionID = e.properties["sessionID"] as string
        if (!config.notify.sessionDone) return
        if (await isSubagent(sessionID)) return
        if (isWaitingForInput()) return
        await $`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
      }

      // --- SessionError ---
      if (e.type === EventType.SessionError) {
        const sessionID = e.properties["sessionID"] as string
        if (!config.notify.sessionError) return
        if (!sessionID || await isSubagent(sessionID)) return
        pendingPermissions.clear()
        pendingQuestions.clear()
        await sidebarClear()
        await $`cmux notify --title "OpenCode" --subtitle "Error" --body "Session hit an error"`.quiet()
      }

      // --- permission.asked (v2) and permission.updated (v1) ---
      if (
        e.type === EventType.PermissionAsked ||
        e.type === EventType.PermissionUpdated
      ) {
        const sessionID = e.properties["sessionID"] as string
        if (sessionID && await isSubagent(sessionID)) return
        const id = getPermissionId(e.properties)
        if (!id) return
        if (pendingPermissions.has(id)) return // already registered by permission.ask hook
        pendingPermissions.add(id)
        await sidebarSetWaiting()
        if (config.notify.permissionRequest) {
          await $`cmux notify --title "OpenCode" --subtitle "Needs Permission" --body "OpenCode is waiting for your approval"`.quiet()
        }
      }

      // --- permission.replied ---
      if (e.type === EventType.PermissionReplied) {
        const id = getPermissionId(e.properties)
        if (id) pendingPermissions.delete(id)
        await restoreAfterInputCleared()
      }

      // --- question.asked ---
      if (e.type === EventType.QuestionAsked) {
        const sessionID = e.properties["sessionID"] as string
        if (sessionID && await isSubagent(sessionID)) return
        const id = getPermissionId(e.properties)
        if (!id) return
        if (pendingQuestions.has(id)) return
        pendingQuestions.add(id)
        const questions = e.properties["questions"] as Array<{ header: string }> | undefined
        const questionText = questions?.[0]?.header ?? "OpenCode has a question"
        await sidebarSetQuestion()
        if (config.notify.question) {
          await $`cmux notify --title "OpenCode" --subtitle "Has a Question" --body ${questionText}`.quiet()
        }
      }

      // --- question.replied / question.rejected ---
      if (
        e.type === EventType.QuestionReplied ||
        e.type === EventType.QuestionRejected
      ) {
        const id = getPermissionId(e.properties)
        if (id) pendingQuestions.delete(id)
        await restoreAfterInputCleared()
      }
    },

    // -------------------------------------------------------------------------
    // permission.ask hook — fires synchronously BEFORE the permission event
    //
    // Belt-and-suspenders: registers the ID eagerly so that session.status idle
    // (which can fire around the same time) sees the pending permission and
    // doesn't prematurely clear the sidebar or fire a done notification.
    // Desktop notify fires on the event, not here, to avoid double-notification.
    // -------------------------------------------------------------------------

    "permission.ask": async (input: unknown) => {
      const p = input as Record<string, unknown>
      const id = getPermissionId(p)
      const sessionID = p["sessionID"] as string | undefined
      if (sessionID && await isSubagent(sessionID)) return
      if (id) pendingPermissions.add(id)
      await sidebarSetWaiting()
    },

    // -------------------------------------------------------------------------
    // tui.prompt.append — inject cmux help into the first prompt (unchanged)
    // -------------------------------------------------------------------------

    "tui.prompt.append": async (_input: unknown, output: { text?: string }) => {
      if (hinted) return
      hinted = true
      output.text = (output.text || "") + `\n\n[cmux]\n${hint}`
    },
  }
}
