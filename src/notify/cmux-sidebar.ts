import { SIDEBAR_COLORS } from "../lib/event-utils.js"
import type { BunShell } from "../lib/event-utils.js"
import type { Config } from "../config/index.js"

export interface CmuxSidebarDeps {
  shell: BunShell
  config: Config
}

export class CmuxSidebar {
  constructor(private readonly deps: CmuxSidebarDeps) {}

  async setWorking(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Working --icon terminal --color ${SIDEBAR_COLORS.working}`.quiet()
  }

  async setWaiting(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Waiting --icon lock --color ${SIDEBAR_COLORS.waiting}`.quiet()
  }

  async setQuestion(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode Question --icon help-circle --color ${SIDEBAR_COLORS.question}`.quiet()
  }

  async setDone(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux set-status opencode "Conversation Complete" --icon checkmark.circle --color ${SIDEBAR_COLORS.done}`.quiet()
  }

  async clear(): Promise<void> {
    if (!this.deps.config.sidebar.enabled) return
    await this.deps.shell`cmux clear-status opencode`.quiet()
  }
}
