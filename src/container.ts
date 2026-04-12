/**
 * DI container: Awilix-based dependency injection for opencode-cmux.
 *
 * The Cradle interface declares all resolvable members. Value-type members
 * (config, shell, client, serverUrl, surfaceId, workspaceId) are registered
 * here. Plugin class members (notifyPlugin, subagentPaneManager,
 * browserToolsPlugin) are declared in the interface but registered later
 * by the respective plugin setup tasks.
 */
import { createContainer, asValue, InjectionMode } from "awilix"
import type { PluginInput } from "@opencode-ai/plugin"
import type { BunShell } from "./lib/event-utils.js"
import type { Config } from "./config/index.js"
import type { CmuxNotifyPlugin } from "./notify/index.js"
import type { CmuxSidebar } from "./notify/index.js"
import type { CmuxHintProvider } from "./notify/index.js"
import type { CmuxBrowserToolsPlugin } from "./browser-tools/index.js"

export interface Cradle {
  config: Config
  shell: BunShell
  client: PluginInput["client"]
  serverUrl: PluginInput["serverUrl"]
  surfaceId: string | undefined
  workspaceId: string | undefined
  sidebar: CmuxSidebar
  hintProvider: CmuxHintProvider
  notifyPlugin: CmuxNotifyPlugin
  subagentPaneManager: unknown
  browserToolsPlugin: CmuxBrowserToolsPlugin
}

export function createAppContainer(config: Config, ctx: PluginInput) {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  })

  container.register({
    config: asValue(config),
    shell: asValue(ctx.$),
    client: asValue(ctx.client),
    serverUrl: asValue(ctx.serverUrl),
    surfaceId: asValue(process.env.CMUX_SURFACE_ID),
    workspaceId: asValue(process.env.CMUX_WORKSPACE_ID),
  })

  return container
}
