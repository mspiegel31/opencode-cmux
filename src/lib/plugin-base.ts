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
