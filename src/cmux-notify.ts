import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { PluginBase, EventType } from "./lib/plugin-base"
import type { Event } from "./lib/plugin-base"
import { loadConfig } from "./config.js"
import type { Config } from "./config.js"

// ---------------------------------------------------------------------------
// CmuxNotifyPlugin — class-based refactor of the original closure plugin.
//
// State that was previously held as closure variables is now class instance
// fields. The if-chain event handler is replaced by a dispatch map keyed on
// EventType string values, matching the pattern in cmux-subagent-viewer.ts.
// ---------------------------------------------------------------------------

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

  async init(): Promise<void> {
    this.config = await loadConfig()
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
    await this.$`cmux set-status opencode --icon terminal --color '#f59e0b' --text 'Working'`.quiet()
  }

  private async sidebarSetWaiting(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode --icon lock --color '#ef4444' --text 'Waiting'`.quiet()
  }

  private async sidebarSetQuestion(): Promise<void> {
    if (!this.config.sidebar.enabled) return
    await this.$`cmux set-status opencode --icon help-circle --color '#a855f7' --text 'Question'`.quiet()
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
      await this.sidebarClear()
    }
  }

  // ---------------------------------------------------------------------------
  // Shared permission-request handler (used by PermissionAsked + PermissionUpdated)
  // ---------------------------------------------------------------------------

  private async handlePermissionRequested(event: Event): Promise<void> {
    const e = event as { type: string; properties: Record<string, unknown> }
    const sessionID = e.properties["sessionID"] as string
    if (sessionID && await this.isSubagent(sessionID)) return
    const id = this.getPermissionId(e.properties)
    if (!id) return
    if (this.pendingPermissions.has(id)) return // already registered by permission.ask hook
    this.pendingPermissions.add(id)
    await this.sidebarSetWaiting()
    if (this.config.notify.permissionRequest) {
      await this.$`cmux notify --title "OpenCode" --subtitle "Needs Permission" --body "OpenCode is waiting for your approval"`.quiet()
    }
  }

  // ---------------------------------------------------------------------------
  // Event dispatch map — keyed on EventType string values
  // ---------------------------------------------------------------------------

  private readonly dispatch: Record<string, (event: Event) => Promise<void>> = {
    [EventType.SessionStatus]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const sessionID = e.properties["sessionID"] as string
      const status    = e.properties["status"] as { type: string }
      if (await this.isSubagent(sessionID)) return

      if (status?.type === "busy") {
        this.sessionBusy = true
        // If waiting for input, sidebar already shows waiting/question — leave it
        if (!this.isWaitingForInput()) await this.sidebarSetWorking()
        return
      }
      if (status?.type === "idle") {
        this.sessionBusy = false
        if (this.isWaitingForInput()) return // blocked — don't clear or notify done
        await this.sidebarClear()
        if (this.config.notify.sessionDone) {
          await this.$`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
        }
      }
    },

    // --- SessionIdle (legacy fallback — kept for SDK versions that don't emit session.status) ---
    [EventType.SessionIdle]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const sessionID = e.properties["sessionID"] as string
      if (!this.config.notify.sessionDone) return
      if (await this.isSubagent(sessionID)) return
      if (this.isWaitingForInput()) return
      await this.$`cmux notify --title "OpenCode" --subtitle "Done" --body "Session finished"`.quiet()
    },

    // --- SessionError ---
    [EventType.SessionError]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const sessionID = e.properties["sessionID"] as string
      if (!this.config.notify.sessionError) return
      if (!sessionID || await this.isSubagent(sessionID)) return
      this.pendingPermissions.clear()
      this.pendingQuestions.clear()
      await this.sidebarClear()
      await this.$`cmux notify --title "OpenCode" --subtitle "Error" --body "Session hit an error"`.quiet()
    },

    // --- permission.asked (v2) and permission.updated (v1) ---
    [EventType.PermissionAsked]: async (event) => {
      await this.handlePermissionRequested(event)
    },
    [EventType.PermissionUpdated]: async (event) => {
      await this.handlePermissionRequested(event)
    },

    // --- permission.replied ---
    [EventType.PermissionReplied]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const id = this.getPermissionId(e.properties)
      if (id) this.pendingPermissions.delete(id)
      await this.restoreAfterInputCleared()
    },

    // --- question.asked ---
    [EventType.QuestionAsked]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const sessionID = e.properties["sessionID"] as string
      if (sessionID && await this.isSubagent(sessionID)) return
      const id = this.getPermissionId(e.properties)
      if (!id) return
      if (this.pendingQuestions.has(id)) return
      this.pendingQuestions.add(id)
      const questions = e.properties["questions"] as Array<{ header: string }> | undefined
      const questionText = questions?.[0]?.header ?? "OpenCode has a question"
      await this.sidebarSetQuestion()
      if (this.config.notify.question) {
        await this.$`cmux notify --title "OpenCode" --subtitle "Has a Question" --body ${questionText}`.quiet()
      }
    },

    // --- question.replied / question.rejected ---
    [EventType.QuestionReplied]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const id = this.getPermissionId(e.properties)
      if (id) this.pendingQuestions.delete(id)
      await this.restoreAfterInputCleared()
    },
    [EventType.QuestionRejected]: async (event) => {
      const e = event as { type: string; properties: Record<string, unknown> }
      const id = this.getPermissionId(e.properties)
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
      event: async ({ event }: { event: Event }) => {
        const handler = this.dispatch[event.type]
        await handler?.(event)
      },

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
