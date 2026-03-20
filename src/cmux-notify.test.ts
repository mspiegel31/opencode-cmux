import { describe, it, expect, vi, beforeEach } from "vitest"
import type { PluginInput } from "@opencode-ai/plugin"
import { EventType } from "./lib/plugin-base"
import { parseConfig } from "./config.js"

// ---------------------------------------------------------------------------
// Real config via parseConfig() — no filesystem I/O, no mocking.
// All-defaults: every notify flag true, sidebar enabled.
// ---------------------------------------------------------------------------
const TEST_CONFIG = parseConfig()

// ---------------------------------------------------------------------------
// Helper: create a minimal mock PluginInput
// ---------------------------------------------------------------------------
function makeMockCtx(sessionGet?: (args: unknown) => Promise<unknown>) {
  const $ = vi.fn().mockReturnValue({
    text: vi.fn().mockResolvedValue("cmux help text"),
    quiet: vi.fn().mockResolvedValue(undefined),
  })
  // Make $ also behave as a tagged template literal
  const shellFn = new Proxy($, {
    apply(target, _thisArg, args) {
      return target(...args)
    },
  }) as unknown as PluginInput["$"]

  return {
    $: shellFn,
    client: {
      session: {
        get: sessionGet ?? vi.fn().mockResolvedValue({ data: { parentID: null } }),
      },
    },
    serverUrl: "http://localhost:4096",
  } as unknown as PluginInput
}

// ---------------------------------------------------------------------------
// Helper: build an event object
// ---------------------------------------------------------------------------
function makeEvent(type: string, properties: Record<string, unknown> = {}) {
  return { type, properties }
}

// ---------------------------------------------------------------------------
// Dynamically import the class so we can test it directly
// ---------------------------------------------------------------------------
type CmuxNotifyPluginInstance = {
  init(config?: ReturnType<typeof parseConfig>): Promise<void>
  hooks(): { event: (args: { event: unknown }) => Promise<void>; "permission.ask": unknown; "tui.prompt.append": unknown }
}
type CmuxNotifyPluginClass = new (ctx: PluginInput) => CmuxNotifyPluginInstance

async function getCmuxNotifyPlugin(): Promise<CmuxNotifyPluginClass> {
  const mod = await import("./cmux-notify.js")
  return (mod as unknown as { CmuxNotifyPlugin: CmuxNotifyPluginClass }).CmuxNotifyPlugin
}

// ---------------------------------------------------------------------------
// Structure Tests
// ---------------------------------------------------------------------------

describe("CmuxNotifyPlugin — structure", () => {
  it("Test 9: CmuxNotifyPlugin can be instantiated with a mock PluginInput", async () => {
    const CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    const ctx = makeMockCtx()
    const plugin = new CmuxNotifyPlugin(ctx)
    expect(plugin).toBeTruthy()
  })

  it("Test 10: hooks() returns object with event, permission.ask, and tui.prompt.append keys", async () => {
    const CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    const ctx = makeMockCtx()
    const plugin = new CmuxNotifyPlugin(ctx)
    await plugin.init(TEST_CONFIG)
    const hooks = plugin.hooks()
    expect(hooks).toHaveProperty("event")
    expect(hooks).toHaveProperty("permission.ask")
    expect(hooks).toHaveProperty("tui.prompt.append")
  })
})

// ---------------------------------------------------------------------------
// Dispatch map routing tests
// ---------------------------------------------------------------------------

describe("CmuxNotifyPlugin — dispatch map routing", () => {
  let plugin: { event: (args: { event: unknown }) => Promise<void>; "permission.ask": unknown; "tui.prompt.append": unknown }
  let ctx: PluginInput
  let shellCalls: string[]

  beforeEach(async () => {
    shellCalls = []
    ctx = makeMockCtx(vi.fn().mockResolvedValue({ data: { parentID: null } }))

    // Track shell calls
    const originalShell = ctx.$
    ;(ctx.$ as unknown) = new Proxy(originalShell as object, {
      apply(_target, _thisArg, args) {
        // args[0] is the template strings array
        const parts = args[0] as string[]
        shellCalls.push(parts.join(""))
        return {
          text: vi.fn().mockResolvedValue("cmux help text"),
          quiet: vi.fn().mockResolvedValue(undefined),
        }
      },
    })

    const CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    const p = new CmuxNotifyPlugin(ctx)
    await p.init(TEST_CONFIG)
    shellCalls.length = 0 // reset after init (init calls `cmux help` — not part of dispatch tests)
    plugin = p.hooks() as typeof plugin
  })

  it("Test 1: SessionStatus busy + non-subagent → calls sidebarSetWorking (cmux set-status opencode)", async () => {
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "busy" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasSidebarWorking = shellCalls.some(
      (c) => c.includes("set-status") && c.includes("opencode")
    )
    expect(hasSidebarWorking).toBe(true)
  })

  it("Test 2: SessionStatus idle + non-subagent + no pending input → calls sidebarClear and cmux notify", async () => {
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasClear = shellCalls.some((c) => c.includes("clear-status") && c.includes("opencode"))
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasClear).toBe(true)
    expect(hasNotify).toBe(true)
  })

  it("Test 3: SessionStatus idle + pending permission → does NOT call sidebarClear", async () => {
    // First add a pending permission via PermissionAsked
    const permEvent = makeEvent(EventType.PermissionAsked, {
      sessionID: "sess-1",
      id: "perm-abc",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: permEvent })
    shellCalls.length = 0 // reset call tracking

    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasClear = shellCalls.some((c) => c.includes("clear-status") && c.includes("opencode"))
    expect(hasClear).toBe(false)
  })

  it("Test 4: PermissionAsked → adds ID to pendingPermissions, calls sidebarSetWaiting", async () => {
    const event = makeEvent(EventType.PermissionAsked, {
      sessionID: "sess-1",
      id: "perm-xyz",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasWaiting = shellCalls.some(
      (c) => c.includes("set-status") && c.includes("opencode") && c.includes("Waiting")
    )
    expect(hasWaiting).toBe(true)
  })

  it("Test 5: PermissionReplied → removes ID from pendingPermissions", async () => {
    // Add a pending permission first
    const askEvent = makeEvent(EventType.PermissionAsked, {
      sessionID: "sess-1",
      id: "perm-xyz",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: askEvent })
    shellCalls.length = 0

    // Reply to it — SDK EventPermissionReplied.properties uses `permissionID` (not `id`)
    const replyEvent = makeEvent(EventType.PermissionReplied, {
      sessionID: "sess-1",
      permissionID: "perm-xyz",
      response: "allow",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: replyEvent })

    // After removing the only pending item, session is idle → sidebarClear
    const hasClear = shellCalls.some((c) => c.includes("clear-status"))
    expect(hasClear).toBe(true)
  })

  it("Test 6: QuestionAsked → adds ID to pendingQuestions, calls sidebarSetQuestion", async () => {
    const event = makeEvent(EventType.QuestionAsked, {
      sessionID: "sess-1",
      id: "q-001",
      questions: [{ header: "Is this OK?" }],
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasQuestion = shellCalls.some(
      (c) => c.includes("set-status") && c.includes("opencode") && c.includes("Question")
    )
    expect(hasQuestion).toBe(true)
  })

  it("Test 7: QuestionReplied → removes ID from pendingQuestions", async () => {
    // Add a pending question first
    const askEvent = makeEvent(EventType.QuestionAsked, {
      sessionID: "sess-1",
      id: "q-001",
      questions: [{ header: "Is this OK?" }],
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: askEvent })
    shellCalls.length = 0

    const replyEvent = makeEvent(EventType.QuestionReplied, {
      id: "q-001",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: replyEvent })

    // After removing the only pending question, session idle → sidebarClear
    const hasClear = shellCalls.some((c) => c.includes("clear-status"))
    expect(hasClear).toBe(true)
  })

  it("Test 8: Unknown event type → no-op (no throw, no side effects)", async () => {
    const event = makeEvent("totally.unknown.event.type", {})
    await expect(
      (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    ).resolves.toBeUndefined()
    // No shell calls for unknown event
    expect(shellCalls.length).toBe(0)
  })
})
