import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"
import { EventType, createEventDispatcher, SIDEBAR_COLORS } from "../lib/event-utils.js"
import type { BunShell, Event, EventHandlerMap } from "../lib/event-utils.js"
import { loadConfig } from "../config/index.js"
import type { Config } from "../config/index.js"
import { asClass } from "awilix"
import { createAppContainer } from "../container.js"

const noop = async (): Promise<void> => {}

export interface CmuxNotifyPluginDeps {
  shell: BunShell
  client: PluginInput["client"]
  config: Config
  surfaceId: string | undefined
}

export class CmuxNotifyPlugin {
  private hint: string = ""
  private hinted: boolean = false
  private pendingPermissions = new Set<string>()
  private pendingQuestions   = new Set<string>()
  private activeSubagents    = new Set<string>()
  private sessionBusy        = false

  constructor(private readonly deps: CmuxNotifyPluginDeps) {
    const { notify } = deps.config
    this.notifyDone       = notify.sessionDone      ? this.makeSender("Done", "Session finished")                                  : noop
    this.notifyError      = notify.sessionError      ? this.makeSender("Error", "Session hit an error")                             : noop
    this.notifyPermission = notify.permissionRequest ? this.makeSender("Needs Permission", "OpenCode is waiting for your approval") : noop
    this.notifyQuestion   = notify.question
      ? async (body: string) => {
          if (notify.onlyWhenUnfocused && await this.isSurfaceFocused()) return
          await deps.shell`cmux notify --title "OpenCode" --subtitle "Has a Question" --body ${body}`.quiet()
        }
      : noop
  }

  // ---------------------------------------------------------------------------
  // Async initialisation (must be called by factory before hooks() is returned)
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    try {
      const helpText = await this.deps.shell`cmux help 2>&1`.text()
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

  private hasActiveSubagents(): boolean {
    return this.activeSubagents.size > 0
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
      const result = await this.deps.client.session.get({ path: { id: sessionID } })
      return !!result.data?.parentID
    } catch {
      return false
    }
  }

  private async isSurfaceFocused(): Promise<boolean> {
    try {
      const out = await this.deps.shell`cmux identify`.text()
      const data = JSON.parse(out) as { caller?: { surface_ref?: string }; focused?: { surface_ref?: string } }
      const callerRef = data?.caller?.surface_ref
      const focusedRef = data?.focused?.surface_ref
      if (!callerRef || !focusedRef) return false
      return callerRef === focusedRef
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Sidebar helpers — all no-ops when config.sidebar.enabled is false
  // ---------------------------------------------------------------------------

  private async sidebarSetWorking(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Working --icon terminal --color ${SIDEBAR_COLORS.working}`.quiet()
  }

  private async sidebarSetWaiting(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Waiting --icon lock --color ${SIDEBAR_COLORS.waiting}`.quiet()
  }

  private async sidebarSetQuestion(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Question --icon help-circle --color ${SIDEBAR_COLORS.question}`.quiet()
  }

  private async sidebarSetDone(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode "Conversation Complete" --icon checkmark.circle --color ${SIDEBAR_COLORS.done}`.quiet()
  }

  private async sidebarClear(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux clear-status opencode`.quiet()
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
    if (this.sessionBusy || this.hasActiveSubagents()) {
      await this.sidebarSetWorking()
    } else {
      await this.sidebarSetDone()
    }
  }

  // ---------------------------------------------------------------------------
  // Fires when a subagent completes — if the parent session is idle and no
  // other subagents remain, transition to "done".
  // ---------------------------------------------------------------------------

  private async onSubagentCleared(): Promise<void> {
    if (this.hasActiveSubagents()) return
    if (this.sessionBusy) return
    if (this.isWaitingForInput()) return
    await this.sidebarSetDone()
    await this.notifyDone()
  }

  // ---------------------------------------------------------------------------
  // Pre-bound notification senders — resolved at construction from config.
  // Disabled events become noops; no runtime flag checks in handlers.
  // ---------------------------------------------------------------------------

  private makeSender(subtitle: string, body: string): () => Promise<void> {
    const { onlyWhenUnfocused } = this.deps.config.notify
    return async () => {
      if (onlyWhenUnfocused && await this.isSurfaceFocused()) return
      await this.deps.shell`cmux notify --title "OpenCode" --subtitle ${subtitle} --body ${body}`.quiet()
    }
  }

  private readonly notifyDone: () => Promise<void>
  private readonly notifyError: () => Promise<void>
  private readonly notifyPermission: () => Promise<void>
  private readonly notifyQuestion: (body: string) => Promise<void>

  // ---------------------------------------------------------------------------
  // Typed event handlers — SDK-known event types get full property types,
  // no casts required. Forward-compat events (question.*, permission.asked)
  // not yet in the SDK union are handled via the `extra` map below.
  // ---------------------------------------------------------------------------

  private readonly typedHandlers: EventHandlerMap = {
    // --- session.created (track child sessions for parent status awareness) ---
    [EventType.SessionCreated]: async (event) => {
      const { info } = event.properties
      if (info.parentID) {
        this.activeSubagents.add(info.id)
      }
    },

    // --- session.status (busy / idle state machine) ---
    [EventType.SessionStatus]: async (event) => {
      const { sessionID, status } = event.properties

      if (await this.isSubagent(sessionID)) {
        if (status.type === "idle") {
          this.activeSubagents.delete(sessionID)
          await this.onSubagentCleared()
        }
        return
      }

      if (status.type === "busy") {
        this.sessionBusy = true
        if (!this.isWaitingForInput()) await this.sidebarSetWorking()
        return
      }
      if (status.type === "idle") {
        this.sessionBusy = false
        if (this.isWaitingForInput()) return
        if (this.hasActiveSubagents()) return
        await this.sidebarSetDone()
        await this.notifyDone()
      }
    },

    // --- session.idle (legacy fallback for older SDK versions) ---
    [EventType.SessionIdle]: async (event) => {
      const { sessionID } = event.properties
      if (await this.isSubagent(sessionID)) return
      if (this.isWaitingForInput()) return
      if (this.hasActiveSubagents()) return
      await this.notifyDone()
    },

    // --- session.error ---
    [EventType.SessionError]: async (event) => {
      const { sessionID } = event.properties
      if (!sessionID) return

      if (await this.isSubagent(sessionID)) {
        this.activeSubagents.delete(sessionID)
        await this.onSubagentCleared()
        return
      }

      this.activeSubagents.clear()
      this.pendingPermissions.clear()
      this.pendingQuestions.clear()
      await this.sidebarClear()
      await this.notifyError()
    },

    // --- permission.updated (v1 SDK name — properties is the full Permission object) ---
    [EventType.PermissionUpdated]: async (event) => {
      // event.properties: Permission — has .id and .sessionID directly
      const { id, sessionID } = event.properties
      if (await this.isSubagent(sessionID)) return
      if (this.pendingPermissions.has(id)) return
      this.pendingPermissions.add(id)
      await this.sidebarSetWaiting()
      await this.notifyPermission()
    },

    // --- permission.replied ---
    [EventType.PermissionReplied]: async (event) => {
      // v1 properties: { sessionID, permissionID, response }
      // v2 properties: { sessionID, requestID, reply }
      const props = event.properties as unknown as Record<string, unknown>
      const id = this.getPermissionId(props)
      if (id) this.pendingPermissions.delete(id)
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
      await this.notifyPermission()
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
      await this.notifyQuestion(questionText)
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
  const config = await loadConfig()
  const container = createAppContainer(config, ctx)
  container.register({
    notifyPlugin: asClass(CmuxNotifyPlugin).singleton(),
  })
  const plugin = container.resolve("notifyPlugin")
  await plugin.init()
  return plugin.hooks()
}
