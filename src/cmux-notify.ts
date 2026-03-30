import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { PluginBase, EventType, createEventDispatcher, SIDEBAR_COLORS } from "./lib/plugin-base"
import type { Event, EventHandlerMap } from "./lib/plugin-base"
import { loadConfig, parseConfig } from "./config.js"
import type { Config } from "./config.js"

export class CmuxNotifyPlugin extends PluginBase {
  private hint: string = ""
  private hinted: boolean = false
  private pendingPermissions = new Set<string>()
  private pendingQuestions   = new Set<string>()
  private sessionBusy        = false
  private config!: Config

  // ---------------------------------------------------------------------------
  // Async initialisation (must be called by factory before hooks() is returned)
  // ---------------------------------------------------------------------------

  async init(config?: Config): Promise<void> {
    this.config = config ?? await loadConfig()
    try {
      const helpText = await this.$`cmux help 2>&1`.text()
      this.hint = helpText
        ? `You are running inside cmux. The full CLI reference follows.\n\n\`\`\`\n${helpText.trim()}\n\`\`\``
        : "You are running inside cmux. Run `cmux help` to see available commands."
    } catch {
      this.hint = "You are running inside cmux. Run `cmux help` to see available commands."
    }
  }

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------

  private isWaitingForInput(): boolean {
    return this.pendingPermissions.size > 0 || this.pendingQuestions.size > 0
  }

  private getPermissionId(props: unknown): string | undefined {
    if (!props || typeof props !== "object") return undefined
    const p = props as Record<string, unknown>
    const raw = p["id"] ?? p["requestID"] ?? p["permissionID"]
    if (typeof raw !== "string" || raw.trim() === "") return undefined
    return raw.trim()
  }

  private async isSubagent(sessionID: string): Promise<boolean> {
    try {
      const result = await this.ctx.client.session.get({ path: { id: sessionID } })
      return !!result.data?.parentID
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Sidebar helpers — all no-ops when config.sidebar.enabled is false
  // ---------------------------------------------------------------------------

  private async sidebarSetWorking(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode Working --icon terminal --color ${SIDEBAR_COLORS.working}`.quiet()
  }

  private async sidebarSetWaiting(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode Waiting --icon lock --color ${SIDEBAR_COLORS.waiting}`.quiet()
  }

  private async sidebarSetQuestion(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode Question --icon help-circle --color ${SIDEBAR_COLORS.question}`.quiet()
  }

  private async sidebarSetDone(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode "Conversation Complete" --icon checkmark.circle --color ${SIDEBAR_COLORS.done}`.quiet()
  }

  private async sidebarClear(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux clear-status opencode`.quiet()
  }

  // ---------------------------------------------------------------------------
  // Restore sidebar after a pending input item is cleared
  //
  // Once a permission or question is resolved, if nothing else is pending:
  //   - Session still busy → restore "working"
  //   - Session idle → clear sidebar
  // ---------------------------------------------------------------------------

  private async restoreAfterInputCleared(): Promise<void> {
    if (this.isWaitingForInput()) return
    if (this.sessionBusy) {
      await this.sidebarSetWorking()
    } else {
      await this.sidebarSetDone()
    }
  }

  // ---------------------------------------------------------------------------
  // Typed event handlers — SDK-known event types get full property types,
  // no casts required. Forward-compat events (question.*, permission.asked)
  // not yet in the SDK union are handled via the `extra` map below.
  // ---------------------------------------------------------------------------

  private readonly typedHandlers: EventHandlerMap = {
    // --- session.status (busy / idle state machine) ---
    [EventType.SessionStatus]: async (event) => {
      // event.properties: { sessionID: string; status: SessionStatus }
      const { sessionID, status } = event.properties
      if (await this.isSubagent(sessionID)) return

      if (status.type === "busy") {
        this.sessionBusy = true
        if (!this.isWaitingForInput()) await this.sidebarSetWorking()
        return
      }
      if (status.type === "idle") {
        this.sessionBusy = false
        if (this.isWaitingForInput()) return
        await this.sidebarSetDone()
        if (this.config.notify.sessionDone) {
          await this.$`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
        }
      }
    },

    // --- session.idle (legacy fallback for older SDK versions) ---
    [EventType.SessionIdle]: async (event) => {
      // event.properties: { sessionID: string }
      const { sessionID } = event.properties
      if (!this.config.notify.sessionDone) return
      if (await this.isSubagent(sessionID)) return
      if (this.isWaitingForInput()) return
      await this.$`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
    },

    // --- session.error ---
    [EventType.SessionError]: async (event) => {
      // event.properties: { sessionID?: string; error?: ... }
      const { sessionID } = event.properties
      if (!this.config.notify.sessionError) return
      if (!sessionID || await this.isSubagent(sessionID)) return
      this.pendingPermissions.clear()
      this.pendingQuestions.clear()
      await this.sidebarClear()
      await this.$`cmux notify --title "OpenCode" --subtitle "Error" --body "Session hit an error"`.quiet()
    },

    // --- permission.updated (v1 SDK name — properties is the full Permission object) ---
    [EventType.PermissionUpdated]: async (event) => {
      // event.properties: Permission — has .id and .sessionID directly
      const { id, sessionID } = event.properties
      if (await this.isSubagent(sessionID)) return
      if (this.pendingPermissions.has(id)) return
      this.pendingPermissions.add(id)
      await this.sidebarSetWaiting()
      if (this.config.notify.permissionRequest) {
        await this.$`cmux notify --title "OpenCode" --subtitle "Needs Permission" --body "OpenCode is waiting for your approval"`.quiet()
      }
    },

    // --- permission.replied ---
    [EventType.PermissionReplied]: async (event) => {
      // event.properties: { sessionID: string; permissionID: string; response: string }
      const { permissionID } = event.properties
      this.pendingPermissions.delete(permissionID)
      await this.restoreAfterInputCleared()
    },
  }

  // ---------------------------------------------------------------------------
  // Extra handlers — forward-compat event types not yet in the SDK Event union.
  // These receive the base Event type; casts are confined here.
  // ---------------------------------------------------------------------------

  private readonly extraHandlers: Record<string, (event: Event) => Promise<void>> = {
    // --- permission.asked (v2 event name — not yet in SDK union) ---
    [EventType.PermissionAsked]: async (event) => {
      const props = (event as { properties: Record<string, unknown> }).properties
      const sessionID = props["sessionID"] as string | undefined
      if (sessionID && await this.isSubagent(sessionID)) return
      const id = this.getPermissionId(props)
      if (!id || this.pendingPermissions.has(id)) return
      this.pendingPermissions.add(id)
      await this.sidebarSetWaiting()
      if (this.config.notify.permissionRequest) {
        await this.$`cmux notify --title "OpenCode" --subtitle "Needs Permission" --body "OpenCode is waiting for your approval"`.quiet()
      }
    },

    // --- question.asked ---
    [EventType.QuestionAsked]: async (event) => {
      const props = (event as { properties: Record<string, unknown> }).properties
      const sessionID = props["sessionID"] as string | undefined
      if (sessionID && await this.isSubagent(sessionID)) return
      const id = this.getPermissionId(props)
      if (!id || this.pendingQuestions.has(id)) return
      this.pendingQuestions.add(id)
      const questions = props["questions"] as Array<{ header: string }> | undefined
      const questionText = questions?.[0]?.header ?? "OpenCode has a question"
      await this.sidebarSetQuestion()
      if (this.config.notify.question) {
        await this.$`cmux notify --title "OpenCode" --subtitle "Has a Question" --body ${questionText}`.quiet()
      }
    },

    // --- question.replied / question.rejected ---
    [EventType.QuestionReplied]: async (event) => {
      const props = (event as { properties: Record<string, unknown> }).properties
      const id = this.getPermissionId(props)
      if (id) this.pendingQuestions.delete(id)
      await this.restoreAfterInputCleared()
    },
    [EventType.QuestionRejected]: async (event) => {
      const props = (event as { properties: Record<string, unknown> }).properties
      const id = this.getPermissionId(props)
      if (id) this.pendingQuestions.delete(id)
      await this.restoreAfterInputCleared()
    },
  }

  // ---------------------------------------------------------------------------
  // Hooks — returned to the plugin loader
  // ---------------------------------------------------------------------------

  hooks(): Hooks {
    // "tui.prompt.append" is not in the SDK Hooks interface (legacy hook).
    // It is attached at runtime and the SDK plugin loader calls it if present.
    // We build the hooks object as a wider type and return as Hooks.
    const hooks = {
      event: createEventDispatcher(this.typedHandlers, this.extraHandlers),

      // -----------------------------------------------------------------------
      // permission.ask hook — fires BEFORE the permission event
      //
      // Belt-and-suspenders: registers the ID eagerly so that session.status
      // idle (which can fire around the same time) sees the pending permission
      // and doesn't prematurely clear the sidebar or fire a done notification.
      // Desktop notify fires on the event, not here, to avoid double-notification.
      // -----------------------------------------------------------------------

      "permission.ask": async (input: unknown) => {
        const p = input as Record<string, unknown>
        const id = this.getPermissionId(p)
        const sessionID = p["sessionID"] as string | undefined
        if (sessionID && await this.isSubagent(sessionID)) return
        if (id) this.pendingPermissions.add(id)
        await this.sidebarSetWaiting()
      },

      // -----------------------------------------------------------------------
      // tui.prompt.append — inject cmux help into the first prompt (unchanged)
      // -----------------------------------------------------------------------

      "tui.prompt.append": async (_input: unknown, output: { text?: string }) => {
        if (this.hinted) return
        this.hinted = true
        output.text = (output.text || "") + `\n\n[cmux]\n${this.hint}`
      },
    }
    return hooks as Hooks
  }
}

// ---------------------------------------------------------------------------
// Plugin export — same public API as before (no consumer changes)
// ---------------------------------------------------------------------------

export const CmuxPlugin: Plugin = async (ctx) => {
  if (!process.env.CMUX_SURFACE_ID) return {}
  const plugin = new CmuxNotifyPlugin(ctx)
  await plugin.init()
  return plugin.hooks()
}
