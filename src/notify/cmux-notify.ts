import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"
import { EventType, createEventDispatcher } from "../lib/event-utils.js"
import type { BunShell, Event, EventHandlerMap } from "../lib/event-utils.js"
import { loadConfig } from "../config/index.js"
import type { Config } from "../config/index.js"
import { asClass } from "awilix"
import { createAppContainer } from "../container.js"
import { CmuxSidebar } from "./cmux-sidebar.js"

const noop = async (): Promise<void> => {}

// ---------------------------------------------------------------------------
// Module-level utilities
// ---------------------------------------------------------------------------

/** Extract a permission/question ID from event properties (v1 + v2 shapes). */
function getPermissionId(props: unknown): string | undefined {
  if (!props || typeof props !== "object") return undefined
  const p = props as Record<string, unknown>
  const raw = p["id"] ?? p["requestID"] ?? p["permissionID"]
  if (typeof raw !== "string" || raw.trim() === "") return undefined
  return raw.trim()
}

/** Untyped property access for forward-compat events not yet in the SDK union. */
const propsOf = (event: Event) => (event as { properties: Record<string, unknown> }).properties

export interface CmuxNotifyPluginDeps {
  shell: BunShell
  client: PluginInput["client"]
  config: Config
  surfaceId: string | undefined
  sidebar: CmuxSidebar
}

export class CmuxNotifyPlugin {
  private pendingPermissions = new Set<string>()
  private pendingQuestions   = new Set<string>()
  private activeSubagents    = new Set<string>()
  private sessionBusy        = false

  private readonly notifyDone: () => Promise<void>
  private readonly notifyError: () => Promise<void>
  private readonly notifyPermission: () => Promise<void>
  private readonly notifyQuestion: (body: string) => Promise<void>

  constructor(private readonly deps: CmuxNotifyPluginDeps) {
    const { notify } = deps.config
    this.notifyDone       = notify.sessionDone       ? this.makeSender("Done", "Session finished")                                  : noop
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
  // State helpers
  // ---------------------------------------------------------------------------

  private isWaitingForInput(): boolean {
    return this.pendingPermissions.size > 0 || this.pendingQuestions.size > 0
  }

  private hasActiveSubagents(): boolean {
    return this.activeSubagents.size > 0
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
      const { caller, focused } = JSON.parse(out) as { caller?: { surface_ref?: string }; focused?: { surface_ref?: string } }
      if (!caller?.surface_ref || !focused?.surface_ref) return false
      return caller.surface_ref === focused.surface_ref
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

  private async restoreAfterInputCleared(): Promise<void> {
    if (this.isWaitingForInput()) return
    if (this.sessionBusy || this.hasActiveSubagents()) {
      await this.deps.sidebar.setWorking()
    } else {
      await this.deps.sidebar.setDone()
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
    await this.deps.sidebar.setDone()
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
        if (!this.isWaitingForInput()) await this.deps.sidebar.setWorking()
        return
      }
      if (status.type === "idle") {
        this.sessionBusy = false
        if (this.isWaitingForInput()) return
        if (this.hasActiveSubagents()) return
        await this.deps.sidebar.setDone()
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
      await this.deps.sidebar.clear()
      await this.notifyError()
    },

    // --- permission.updated (v1 SDK name — properties is the full Permission object) ---
    [EventType.PermissionUpdated]: async (event) => {
      // event.properties: Permission — has .id and .sessionID directly
      const { id, sessionID } = event.properties
      if (await this.isSubagent(sessionID)) return
      if (this.pendingPermissions.has(id)) return
      this.pendingPermissions.add(id)
      await this.deps.sidebar.setWaiting()
      await this.notifyPermission()
    },

    // --- permission.replied ---
    [EventType.PermissionReplied]: async (event) => {
      // v1 properties: { sessionID, permissionID, response }
      // v2 properties: { sessionID, requestID, reply }
      const props = event.properties as unknown as Record<string, unknown>
      const id = getPermissionId(props)
      if (id) this.pendingPermissions.delete(id)
      await this.restoreAfterInputCleared()
    },
  }

  // ---------------------------------------------------------------------------
  // Extra handlers — forward-compat event types not yet in the SDK Event union.
  // These receive the base Event type; propsOf() provides untyped access.
  // ---------------------------------------------------------------------------

  private readonly extraHandlers: Record<string, (event: Event) => Promise<void>> = {
    // --- permission.asked (v2 event name — not yet in SDK union) ---
    [EventType.PermissionAsked]: async (event) => {
      const props = propsOf(event)
      const sessionID = props["sessionID"] as string | undefined
      if (sessionID && await this.isSubagent(sessionID)) return
      const id = getPermissionId(props)
      if (!id || this.pendingPermissions.has(id)) return
      this.pendingPermissions.add(id)
      await this.deps.sidebar.setWaiting()
      await this.notifyPermission()
    },

    // --- question.asked ---
    [EventType.QuestionAsked]: async (event) => {
      const props = propsOf(event)
      const sessionID = props["sessionID"] as string | undefined
      if (sessionID && await this.isSubagent(sessionID)) return
      const id = getPermissionId(props)
      if (!id || this.pendingQuestions.has(id)) return
      this.pendingQuestions.add(id)
      const questions = props["questions"] as Array<{ header: string }> | undefined
      const questionText = questions?.[0]?.header ?? "OpenCode has a question"
      await this.deps.sidebar.setQuestion()
      await this.notifyQuestion(questionText)
    },

    // --- question.replied / question.rejected ---
    [EventType.QuestionReplied]: async (event) => {
      const id = getPermissionId(propsOf(event))
      if (id) this.pendingQuestions.delete(id)
      await this.restoreAfterInputCleared()
    },
    [EventType.QuestionRejected]: async (event) => {
      const id = getPermissionId(propsOf(event))
      if (id) this.pendingQuestions.delete(id)
      await this.restoreAfterInputCleared()
    },
  }

  // ---------------------------------------------------------------------------
  // Hooks — returned to the plugin loader
  // ---------------------------------------------------------------------------

  hooks(): Hooks {
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
        const id = getPermissionId(p)
        const sessionID = p["sessionID"] as string | undefined
        if (sessionID && await this.isSubagent(sessionID)) return
        if (id) this.pendingPermissions.add(id)
        await this.deps.sidebar.setWaiting()
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
    sidebar: asClass(CmuxSidebar).singleton(),
    notifyPlugin: asClass(CmuxNotifyPlugin).singleton(),
  })
  return container.resolve("notifyPlugin").hooks()
}
