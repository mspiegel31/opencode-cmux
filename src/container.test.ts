import { describe, it, expect, beforeEach, afterEach } from "vitest"
import type { PluginInput } from "@opencode-ai/plugin"
import type { BunShell } from "./lib/event-utils.js"
import { parseConfig } from "./config/index.js"
import { createAppContainer } from "./container.js"

function makeCtx(overrides?: Partial<PluginInput>): PluginInput {
  return {
    $: {} as BunShell,
    client: {} as PluginInput["client"],
    serverUrl: new URL("http://localhost:4096"),
    ...overrides,
  } as PluginInput
}

describe("createAppContainer", () => {
  let savedSurfaceId: string | undefined
  let savedWorkspaceId: string | undefined

  beforeEach(() => {
    savedSurfaceId = process.env.CMUX_SURFACE_ID
    savedWorkspaceId = process.env.CMUX_WORKSPACE_ID
  })

  afterEach(() => {
    if (savedSurfaceId === undefined) delete process.env.CMUX_SURFACE_ID
    else process.env.CMUX_SURFACE_ID = savedSurfaceId

    if (savedWorkspaceId === undefined) delete process.env.CMUX_WORKSPACE_ID
    else process.env.CMUX_WORKSPACE_ID = savedWorkspaceId
  })

  it("creates a container without errors", () => {
    const container = createAppContainer(parseConfig(), makeCtx())
    expect(container).toBeDefined()
  })

  it("resolves config to the value passed in", () => {
    const config = parseConfig({ sidebar: { enabled: false } })
    const container = createAppContainer(config, makeCtx())
    expect(container.resolve("config")).toBe(config)
  })

  it("resolves shell to the mock passed via ctx.$", () => {
    const shell = { tag: "mock-shell" } as unknown as BunShell
    const container = createAppContainer(parseConfig(), makeCtx({ $: shell }))
    expect(container.resolve("shell")).toBe(shell)
  })

  it("resolves client to the mock passed via ctx.client", () => {
    const client = { tag: "mock-client" } as unknown as PluginInput["client"]
    const container = createAppContainer(parseConfig(), makeCtx({ client }))
    expect(container.resolve("client")).toBe(client)
  })

  it("resolves serverUrl to the URL passed via ctx.serverUrl", () => {
    const url = new URL("http://localhost:9999")
    const container = createAppContainer(parseConfig(), makeCtx({ serverUrl: url }))
    expect(container.resolve("serverUrl")).toBe(url)
  })

  it("resolves surfaceId from CMUX_SURFACE_ID env var", () => {
    process.env.CMUX_SURFACE_ID = "test-surface-42"
    const container = createAppContainer(parseConfig(), makeCtx())
    expect(container.resolve("surfaceId")).toBe("test-surface-42")
  })

  it("resolves surfaceId as undefined when env var is not set", () => {
    delete process.env.CMUX_SURFACE_ID
    const container = createAppContainer(parseConfig(), makeCtx())
    expect(container.resolve("surfaceId")).toBeUndefined()
  })

  it("resolves workspaceId from CMUX_WORKSPACE_ID env var", () => {
    process.env.CMUX_WORKSPACE_ID = "test-workspace-7"
    const container = createAppContainer(parseConfig(), makeCtx())
    expect(container.resolve("workspaceId")).toBe("test-workspace-7")
  })

  it("returns the same reference on repeated resolve (singleton behavior)", () => {
    const config = parseConfig()
    const container = createAppContainer(config, makeCtx())
    expect(container.resolve("config")).toBe(container.resolve("config"))
    expect(container.resolve("shell")).toBe(container.resolve("shell"))
  })

  it("throws when resolving an unregistered name (strict mode)", () => {
    const container = createAppContainer(parseConfig(), makeCtx())
    expect(() =>
      container.resolve("notifyPlugin" as keyof typeof container.cradle),
    ).toThrow()
  })
})
