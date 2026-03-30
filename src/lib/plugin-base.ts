/**
 * Shared base class and types for cmux plugins.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Derived types (not directly exported by @opencode-ai/plugin)
// ---------------------------------------------------------------------------

/** The Bun shell template-tag, derived from PluginInput. */
export type BunShell = PluginInput["$"]

/** The Event union from the Hooks.event signature. */
export type Event = Parameters<NonNullable<Hooks["event"]>>[0]["event"]

/**
 * A typed handler map for the OpenCode Event discriminated union.
 *
 * Each key is a valid event `type` string. The value is a handler whose
 * argument is automatically narrowed to the matching SDK event variant —
 * no manual casts needed inside handlers.
 *
 * Unrecognised event types (e.g. `question.*` not yet in the SDK union)
 * can be handled by adding entries to the `extra` map.
 *
 * @example
 * const handler = createEventDispatcher({
 *   [EventType.SessionStatus]: async (event) => {
 *     // event.properties is typed as { sessionID: string; status: SessionStatus }
 *     const { sessionID, status } = event.properties
 *   },
 * })
 */
export type EventHandlerMap = {
  [K in Event["type"]]?: (event: Extract<Event, { type: K }>) => Promise<void>
}

/**
 * Builds the `Hooks["event"]` callback from a typed handler map.
 *
 * Handlers receive the narrowed SDK event type — no `as` casts required.
 * Event types not present in the SDK union (forward-compat entries like
 * `question.*`) can be handled via the optional `extra` map, which accepts
 * the raw `Event` union so callers can cast as needed.
 */
export function createEventDispatcher(
  handlers: EventHandlerMap,
  extra: Record<string, (event: Event) => Promise<void>> = {},
): NonNullable<Hooks["event"]> {
  return async ({ event }: { event: Event }): Promise<void> => {
    const typed = handlers[event.type as Event["type"]]
    if (typed) {
      // Safe: the mapped type guarantees the handler at key K accepts Extract<Event, { type: K }>,
      // and we only reach this branch when event.type === K.
      await (typed as (e: Event) => Promise<void>)(event)
      return
    }
    await extra[event.type]?.(event)
  }
}

// ---------------------------------------------------------------------------
// Event type enum
// ---------------------------------------------------------------------------

/** String constants for event.type values used in plugin hooks. */
export enum EventType {
  // Session lifecycle
  SessionCreated   = "session.created",
  SessionUpdated   = "session.updated",
  SessionDeleted   = "session.deleted",
  SessionIdle      = "session.idle",
  SessionError     = "session.error",
  SessionStatus    = "session.status",
  SessionCompacted = "session.compacted",
  SessionDiff      = "session.diff",

  // Messages
  MessageUpdated     = "message.updated",
  MessageRemoved     = "message.removed",
  MessagePartUpdated = "message.part.updated",
  MessagePartRemoved = "message.part.removed",

  // Permissions
  PermissionAsked   = "permission.asked",   // v2 event name
  PermissionUpdated = "permission.updated", // v1 event name (fallback)
  PermissionReplied = "permission.replied",

  // Questions
  QuestionAsked    = "question.asked",
  QuestionReplied  = "question.replied",
  QuestionRejected = "question.rejected",

  // Files & VCS
  FileEdited         = "file.edited",
  FileWatcherUpdated = "file.watcher.updated",
  VcsBranchUpdated   = "vcs.branch.updated",

  // TUI
  TuiPromptAppend  = "tui.prompt.append",
  TuiCommandExecute = "tui.command.execute",
  TuiToastShow     = "tui.toast.show",

  // Misc
  CommandExecuted         = "command.executed",
  TodoUpdated             = "todo.updated",
  LspUpdated              = "lsp.updated",
  LspClientDiagnostics    = "lsp.client.diagnostics",
  ServerConnected         = "server.connected",
  ServerInstanceDisposed  = "server.instance.disposed",
  InstallationUpdated     = "installation.updated",
  InstallationUpdateAvail = "installation.update-available",

  // PTY
  PtyCreated = "pty.created",
  PtyUpdated = "pty.updated",
  PtyExited  = "pty.exited",
  PtyDeleted = "pty.deleted",
}

// ---------------------------------------------------------------------------
// Shared color constants
// ---------------------------------------------------------------------------

/** Sidebar status bar colors (used by CmuxNotifyPlugin). */
export const SIDEBAR_COLORS = {
  working:  '#f59e0b',
  waiting:  '#ef4444',
  question: '#a855f7',
  done:     '#059669',
} as const

/** Subagent pane status bar colors (used by SubagentPaneManager). */
export const STATUS_COLORS = {
  running: '#FFD93D',
  done:    '#059669',
  error:   '#FF6B6B',
} as const

// ---------------------------------------------------------------------------
// Abstract base class
// ---------------------------------------------------------------------------

/**
 * Base class for class-based OpenCode plugins.
 *
 * Subclasses receive the full PluginInput via `this.ctx` and must implement
 * `hooks()` which returns the Hooks object wired into the plugin system.
 *
 * Usage:
 * ```ts
 * class MyPlugin extends PluginBase {
 *   hooks(): Hooks { return { event: async ({ event }) => { ... } } }
 * }
 *
 * export const myPlugin: Plugin = async (ctx) => new MyPlugin(ctx).hooks()
 * ```
 */
export abstract class PluginBase {
  protected readonly $: BunShell

  constructor(protected readonly ctx: PluginInput) {
    this.$ = ctx.$
  }

  abstract hooks(): Hooks
}
