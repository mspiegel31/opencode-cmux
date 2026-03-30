import { describe, it, expect, vi, beforeEach } from "vitest"
import type { PluginInput } from "@opencode-ai/plugin"
import { parseConfig } from "./config.js"

const TEST_CONFIG = parseConfig()

// ---------------------------------------------------------------------------
// Mock PluginInput factory
// ---------------------------------------------------------------------------
function makeMockCtx(
  shellResponses?: Record<string, string>,
): { ctx: PluginInput; shellCalls: string[] } {
  const shellCalls: string[] = []
  const responses = shellResponses ?? {}

  const $ = new Proxy(vi.fn(), {
    apply(_target, _thisArg, args) {
      const parts = args[0] as TemplateStringsArray
      const values = args.slice(1) as unknown[]
      const cmd = parts.reduce((acc, part, i) => {
        const val = values[i]
        const valStr = Array.isArray(val) ? val.join(" ") : String(val ?? "")
        return acc + part + (i < values.length ? valStr : "")
      }, "")
      shellCalls.push(cmd)

      const matchKey = Object.keys(responses).find((k) => cmd.includes(k))
      const responseText = matchKey ? responses[matchKey] : ""

      return {
        text: vi.fn().mockResolvedValue(responseText),
        quiet: vi.fn().mockResolvedValue(undefined),
      }
    },
  }) as unknown as PluginInput["$"]

  const ctx = {
    $,
    client: {
      session: { get: vi.fn().mockResolvedValue({ data: { parentID: null } }) },
    },
    serverUrl: "http://localhost:4096",
  } as unknown as PluginInput

  return { ctx, shellCalls }
}

// ---------------------------------------------------------------------------
// Helper to get CmuxBrowserToolsPlugin class
// ---------------------------------------------------------------------------
async function getPlugin() {
  const mod = await import("./cmux-browser-tools.js")
  return mod.CmuxBrowserToolsPlugin
}

// ---------------------------------------------------------------------------
// 1. Plugin structure
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — structure", () => {
  it("can be instantiated with a mock PluginInput", async () => {
    const Plugin = await getPlugin()
    const { ctx } = makeMockCtx()
    const plugin = new Plugin(ctx)
    expect(plugin).toBeTruthy()
  })

  it("hooks() returns an object with a tool property", async () => {
    const Plugin = await getPlugin()
    const { ctx } = makeMockCtx()
    const plugin = new Plugin(ctx)
    await plugin.init(TEST_CONFIG)
    const hooks = plugin.hooks()
    expect(hooks).toHaveProperty("tool")
    expect(typeof hooks.tool).toBe("object")
  })
})

// ---------------------------------------------------------------------------
// 2. Tool registration
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — tool registration", () => {
  let hooks: ReturnType<Awaited<ReturnType<typeof getPlugin>>["prototype"]["hooks"]>

  beforeEach(async () => {
    const Plugin = await getPlugin()
    const { ctx } = makeMockCtx({ "browser open": "surface:42\n", "browser url": "", "browser --help": "" })
    const plugin = new Plugin(ctx)
    await plugin.init(TEST_CONFIG)
    hooks = plugin.hooks()
  })

  it("registers all navigation tools", () => {
    expect(hooks.tool).toHaveProperty("browser_navigate")
    expect(hooks.tool).toHaveProperty("browser_snapshot")
    expect(hooks.tool).toHaveProperty("browser_screenshot")
    expect(hooks.tool).toHaveProperty("browser_find")
    expect(hooks.tool).toHaveProperty("browser_url")
  })

  it("registers all DOM interaction tools", () => {
    expect(hooks.tool).toHaveProperty("browser_click")
    expect(hooks.tool).toHaveProperty("browser_fill")
    expect(hooks.tool).toHaveProperty("browser_type")
    expect(hooks.tool).toHaveProperty("browser_hover")
    expect(hooks.tool).toHaveProperty("browser_scroll")
  })

  it("registers all page management tools", () => {
    expect(hooks.tool).toHaveProperty("browser_new_page")
    expect(hooks.tool).toHaveProperty("browser_wait_for")
    expect(hooks.tool).toHaveProperty("browser_handle_dialog")
    expect(hooks.tool).toHaveProperty("browser_list_pages")
  })

  it("registers all utility tools", () => {
    expect(hooks.tool).toHaveProperty("browser_evaluate")
    expect(hooks.tool).toHaveProperty("browser_console_messages")
    expect(hooks.tool).toHaveProperty("browser_network_requests")
    expect(hooks.tool).toHaveProperty("browser_emulate")
    expect(hooks.tool).toHaveProperty("browser_get")
    expect(hooks.tool).toHaveProperty("browser_is")
  })
})

// ---------------------------------------------------------------------------
// 3. Guard behavior
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — guard behavior", () => {
  it("CmuxBrowserTools factory returns {} when CMUX_WORKSPACE_ID is not set", async () => {
    const mod = await import("./cmux-browser-tools.js")
    const orig = process.env.CMUX_WORKSPACE_ID
    try {
      delete process.env.CMUX_WORKSPACE_ID
      const { ctx } = makeMockCtx()
      const result = await mod.CmuxBrowserTools(ctx)
      expect(result).toEqual({})
    } finally {
      if (orig !== undefined) process.env.CMUX_WORKSPACE_ID = orig
    }
  })

  it("CmuxBrowserTools factory returns {} when cmuxBrowserTools.enabled is false", async () => {
    const mod = await import("./cmux-browser-tools.js")
    const origWorkspace = process.env.CMUX_WORKSPACE_ID
    const origEnabled = process.env.CMUX_BROWSER_TOOLS_ENABLED
    try {
      process.env.CMUX_WORKSPACE_ID = "test-workspace"
      process.env.CMUX_BROWSER_TOOLS_ENABLED = "false"
      const { ctx } = makeMockCtx()
      const result = await mod.CmuxBrowserTools(ctx)
      expect(result).toEqual({})
    } finally {
      if (origWorkspace !== undefined) process.env.CMUX_WORKSPACE_ID = origWorkspace
      else delete process.env.CMUX_WORKSPACE_ID
      if (origEnabled !== undefined) process.env.CMUX_BROWSER_TOOLS_ENABLED = origEnabled
      else delete process.env.CMUX_BROWSER_TOOLS_ENABLED
    }
  })
})

// ---------------------------------------------------------------------------
// 4. Command construction
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — command construction", () => {
  let plugin: Awaited<ReturnType<typeof getPlugin>>["prototype"]
  let shellCalls: string[]

  beforeEach(async () => {
    const Plugin = await getPlugin()
    const mock = makeMockCtx({ "browser open": "surface:42\n", "browser url": "", "browser --help": "" })
    shellCalls = mock.shellCalls
    plugin = new Plugin(mock.ctx)
    await plugin.init(TEST_CONFIG)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getTool(name: string): { execute: (args: any, ctx: any) => Promise<string> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (plugin.hooks().tool as any)[name]
  }

  it("browser_navigate (url) calls goto with --snapshot-after and --surface", async () => {
    await getTool("browser_navigate").execute({ type: "url", url: "https://example.com" }, {})
    const navCall = shellCalls.find((c) => c.includes("goto"))
    expect(navCall).toBeDefined()
    expect(navCall).toContain("--snapshot-after")
    expect(navCall).toContain("--surface")
  })

  it("browser_click calls click with --selector and --snapshot-after", async () => {
    await getTool("browser_click").execute({ selector: "button.submit" }, {})
    const clickCall = shellCalls.find((c) => c.includes("click"))
    expect(clickCall).toBeDefined()
    expect(clickCall).toContain("button.submit")
    expect(clickCall).toContain("--snapshot-after")
    expect(clickCall).toContain("--surface")
  })

  it("browser_snapshot calls snapshot with --surface", async () => {
    await getTool("browser_snapshot").execute({}, {})
    const snapCall = shellCalls.find((c) => c.includes("snapshot"))
    expect(snapCall).toBeDefined()
    expect(snapCall).toContain("--surface")
  })

  it("browser_evaluate calls eval with --script and --surface", async () => {
    await getTool("browser_evaluate").execute({ script: "document.title" }, {})
    const evalCall = shellCalls.find((c) => c.includes("eval"))
    expect(evalCall).toBeDefined()
    expect(evalCall).toContain("--script")
    expect(evalCall).toContain("--surface")
  })

  it("browser_navigate (back) calls back with --snapshot-after", async () => {
    await getTool("browser_navigate").execute({ type: "back" }, {})
    const backCall = shellCalls.find((c) => c.includes(" back ") || c.endsWith(" back"))
    expect(backCall).toBeDefined()
    expect(backCall).toContain("--snapshot-after")
  })
})

// ---------------------------------------------------------------------------
// 5. Surface management
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — surface management", () => {
  it("surface ID is cached — browser open called only once for two tool calls", async () => {
    const Plugin = await getPlugin()
    const mock = makeMockCtx({ "browser open": "surface:42\n", "browser url": "", "browser --help": "" })
    const plugin = new Plugin(mock.ctx)
    await plugin.init(TEST_CONFIG)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = plugin.hooks().tool as any

    await tools.browser_url.execute({}, {})
    await tools.browser_url.execute({}, {})

    const openCalls = mock.shellCalls.filter((c) => c.includes("browser open"))
    expect(openCalls).toHaveLength(1)
  })

  it("dead surface triggers re-open — browser open called twice after probe failure", async () => {
    const Plugin = await getPlugin()
    let probeCallCount = 0
    const shellCalls: string[] = []

    const $ = new Proxy(vi.fn(), {
      apply(_target, _thisArg, args) {
        const parts = args[0] as TemplateStringsArray
        const values = args.slice(1) as unknown[]
        const cmd = parts.reduce((acc, part, i) => {
          const val = values[i]
          const valStr = Array.isArray(val) ? val.join(" ") : String(val ?? "")
          return acc + part + (i < values.length ? valStr : "")
        }, "")
        shellCalls.push(cmd)

        if (cmd.includes("browser url") && cmd.includes("--surface")) {
          probeCallCount++
          if (probeCallCount === 1) {
            return {
              text: vi.fn().mockResolvedValue(""),
              quiet: vi.fn().mockRejectedValue(new Error("surface dead")),
            }
          }
        }

        return {
          text: vi.fn().mockResolvedValue(cmd.includes("browser open") ? "surface:42\n" : ""),
          quiet: vi.fn().mockResolvedValue(undefined),
        }
      },
    }) as unknown as PluginInput["$"]

    const ctx = { $, client: { session: { get: vi.fn() } }, serverUrl: "" } as unknown as PluginInput
    const plugin = new Plugin(ctx)
    await plugin.init(TEST_CONFIG)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = plugin.hooks().tool as any

    await tools.browser_snapshot.execute({}, {})
    await tools.browser_snapshot.execute({}, {})

    const openCalls = shellCalls.filter((c) => c.includes("browser open"))
    expect(openCalls.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// 6. Error handling
// ---------------------------------------------------------------------------
describe("CmuxBrowserToolsPlugin — error handling", () => {
  it("execute() returns 'Error: ...' string when shell throws", async () => {
    const Plugin = await getPlugin()
    const $ = new Proxy(vi.fn(), {
      apply() {
        return {
          text: vi.fn().mockRejectedValue(new Error("command failed")),
          quiet: vi.fn().mockResolvedValue(undefined),
        }
      },
    }) as unknown as PluginInput["$"]
    const ctx = { $, client: { session: { get: vi.fn() } }, serverUrl: "" } as unknown as PluginInput
    const plugin = new Plugin(ctx)
    await plugin.init(TEST_CONFIG)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = plugin.hooks().tool as any
    const result = await tools.browser_snapshot.execute({}, {})
    expect(typeof result).toBe("string")
    expect(result).toMatch(/^Error:/)
  })
})
