/**
 * cmux-subagent-viewer: Automatically opens OpenCode TUI viewers in cmux panes
 * for child sessions spawned by the Task tool.
 *
 * When a child session is created (detected via session.created event with parentID),
 * a new cmux split pane is created and `opencode attach --session <id>` is launched
 * in it — giving a full TUI view with theming, syntax highlighting, and live streaming.
 *
 * Layout strategy:
 *   - Panes split within the origin workspace (first splits right, subsequent
 *     split down from the first viewer surface).
 *
 * Pane creation is serialized via a promise queue to avoid race conditions
 * when multiple session.created events fire concurrently.
 *
 * When the child session completes (session.idle) or errors (session.error),
 * the sidebar status is updated and the pane is cleaned up after a short delay.
 */

import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin"
import { EventType, STATUS_COLORS } from "../lib/event-utils.js"
import type { BunShell, Event } from "../lib/event-utils.js"
import { createServerUrlResolver } from "../lib/cmux-utils.js"
import { loadConfig } from "../config/index.js"
import { asFunction } from "awilix"
import { createAppContainer } from "../container.js"

const PANE_LINGER_MS = 4_000 // keep pane open briefly after completion

const STATUS_CONFIG = {
  Running: { icon: "bolt",            color: STATUS_COLORS.running },
  Done:    { icon: "checkmark.circle", color: STATUS_COLORS.done },
  Error:   { icon: "xmark.circle",    color: STATUS_COLORS.error },
} as const

type StatusName = keyof typeof STATUS_CONFIG

type PaneInfo = {
  surface: string
  sessionID: string
  title: string      // short/truncated (for tab display)
  fullTitle: string  // original, untruncated (for logs)
  index: number
}

interface SubagentPaneManagerDeps {
  shell: BunShell
  client: PluginInput["client"]
  originWorkspace: string
  getServerUrl: () => Promise<string | null>
}

class SubagentPaneManager {
  private activePanes = new Map<string, PaneInfo>()
  private paneCount = 0
  private firstViewerSurface: string | null = null

  // Serializes createPane calls so concurrent session.created events
  // don't race on shared state (paneCount, firstViewerSurface, etc.)
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly deps: SubagentPaneManagerDeps) {}

  // ---------------------------------------------------------------------------
  // Hooks (returned to the plugin loader)
  // ---------------------------------------------------------------------------

  hooks(): Hooks {
    return {
      event: async ({ event }: { event: Event }) => {
        if (event.type === EventType.SessionCreated) {
          const { info } = event.properties
          if (!info.parentID) return
          const title = info.title || `Child ${info.id.slice(0, 12)}`
          await this.enqueueCreatePane(info.id, title)
        }

        if (event.type === EventType.SessionIdle || event.type === EventType.SessionError) {
          const sid = event.properties.sessionID
          if (!sid) return
          const status: StatusName = event.type === EventType.SessionIdle ? "Done" : "Error"
          if (this.activePanes.has(sid)) await this.closePane(sid, status)
        }
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Serialized pane creation
  // ---------------------------------------------------------------------------

  private enqueueCreatePane(sessionID: string, title: string): Promise<void> {
    this.queue = this.queue.then(() => this.createPane(sessionID, title))
    return this.queue
  }

  // ---------------------------------------------------------------------------
  // Pane lifecycle
  // ---------------------------------------------------------------------------

  private async createPane(sessionID: string, title: string): Promise<void> {
    const $ = this.deps.shell
    const index = this.paneCount
    try {
      let result: string
      if (index === 0) {
        // First pane — split right of the main surface
        result = await $`cmux new-split right --workspace ${this.deps.originWorkspace}`.text()
      } else {
        // Subsequent panes stack down from the first viewer surface
        result = await $`cmux new-split down --workspace ${this.deps.originWorkspace} --surface ${this.firstViewerSurface!}`.text()
      }

      const surface = this.parseSurface(result)
      if (!surface) return
      if (index === 0) this.firstViewerSurface = surface

      const shortTitle = title.length > 40 ? title.slice(0, 37) + "..." : title
      const statusKey = `agent-${index}`

      const { icon, color } = STATUS_CONFIG.Running
      await $`cmux rename-tab --surface ${surface} ${shortTitle}`.quiet()
      await $`cmux set-status ${statusKey} Running --icon ${icon} --color ${color}`.quiet()

      const serverUrl = await this.deps.getServerUrl()
      if (!serverUrl) return
      const attachCmd = `opencode attach ${serverUrl} --session ${sessionID}`
      await $`cmux send --surface ${surface} -- ${attachCmd}`.quiet()
      await $`cmux send-key --surface ${surface} Enter`.quiet()

      this.paneCount++
      const info: PaneInfo = { surface, sessionID, title: shortTitle, fullTitle: title, index }
      this.activePanes.set(sessionID, info)
      await $`cmux log -- ${"Viewer opened: " + title}`.quiet()
    } catch {}
  }

  private async closePane(sessionID: string, status: StatusName) {
    const $ = this.deps.shell
    const pane = this.activePanes.get(sessionID)
    if (!pane) return
    this.activePanes.delete(sessionID) // remove immediately to prevent double-close

    const { icon, color } = STATUS_CONFIG[status]
    const statusKey = `agent-${pane.index}`

    try {
      await $`cmux set-status ${statusKey} ${status} --icon ${icon} --color ${color}`.quiet()
      await $`cmux log -- ${`Agent ${status.toLowerCase()}: ${pane.fullTitle}`}`.quiet()
    } catch {}

    // Linger so user can see final output, then tear down
    setTimeout(async () => {
      try {
        await $`cmux close-surface --surface ${pane.surface}`.quiet()
        await $`cmux clear-status ${statusKey}`.quiet()
      } catch {}

      if (this.activePanes.size === 0) {
        this.paneCount = 0
        this.firstViewerSurface = null
      }
    }, PANE_LINGER_MS)
  }

  // ---------------------------------------------------------------------------
  // Parsing helpers
  // ---------------------------------------------------------------------------

  private parseSurface(text: string): string | null {
    const m = text.match(/surface:(\d+)/)
    return m ? `surface:${m[1]}` : null
  }
}

// ---------------------------------------------------------------------------
// Plugin export (factory called by the opencode plugin loader)
// ---------------------------------------------------------------------------

export const CmuxSubagentViewer: Plugin = async (ctx) => {
  const originWorkspace = process.env.CMUX_WORKSPACE_ID
  if (!originWorkspace) return {}

  const config = await loadConfig()
  if (!config.cmuxSubagentViewer.enabled) return {}

  const getServerUrl = createServerUrlResolver({ $: ctx.$, serverUrl: ctx.serverUrl })

  const container = createAppContainer(config, ctx)
  container.register({
    subagentPaneManager: asFunction(({ shell, client }: { shell: BunShell; client: PluginInput["client"] }) =>
      new SubagentPaneManager({ shell, client, originWorkspace, getServerUrl })
    ).singleton(),
  })

  const manager = container.resolve("subagentPaneManager") as SubagentPaneManager
  return manager.hooks()
}
