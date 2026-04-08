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

  it("Test 2: SessionStatus idle + non-subagent + no pending input → calls sidebarSetDone and cmux notify", async () => {
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasDone = shellCalls.some((c) => c.includes("set-status") && c.includes("opencode") && c.includes("Conversation Complete"))
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasDone).toBe(true)
    expect(hasNotify).toBe(true)
  })

  it("Test 3: SessionStatus idle + pending permission → does NOT call sidebarSetDone", async () => {
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
    const hasDone = shellCalls.some((c) => c.includes("set-status") && c.includes("opencode") && c.includes("Conversation Complete"))
    expect(hasDone).toBe(false)
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

  it("Test 5a: PermissionReplied (v1 shape: permissionID) → removes ID from pendingPermissions", async () => {
    const askEvent = makeEvent(EventType.PermissionAsked, {
      sessionID: "sess-1",
      id: "perm-xyz",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: askEvent })
    shellCalls.length = 0

    const replyEvent = makeEvent(EventType.PermissionReplied, {
      sessionID: "sess-1",
      permissionID: "perm-xyz",
      response: "allow",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: replyEvent })

    const hasDone = shellCalls.some((c) => c.includes("set-status") && c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
  })

  it("Test 5b: PermissionReplied (v2 shape: requestID) → removes ID from pendingPermissions", async () => {
    const askEvent = makeEvent(EventType.PermissionAsked, {
      sessionID: "sess-1",
      id: "perm-xyz",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: askEvent })
    shellCalls.length = 0

    const replyEvent = makeEvent(EventType.PermissionReplied, {
      sessionID: "sess-1",
      requestID: "perm-xyz",
      reply: "once",
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event: replyEvent })

    const hasDone = shellCalls.some((c) => c.includes("set-status") && c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
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

    // After removing the only pending question, session idle → sidebarSetDone
    const hasDone = shellCalls.some((c) => c.includes("set-status") && c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
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

// ---------------------------------------------------------------------------
// Active subagent tracking tests
// ---------------------------------------------------------------------------

describe("CmuxNotifyPlugin — active subagent tracking", () => {
  let plugin: { event: (args: { event: unknown }) => Promise<void> }
  let ctx: PluginInput
  let shellCalls: string[]

  beforeEach(async () => {
    shellCalls = []
    // session.get mock: sessions starting with "child-" have parentID set
    const sessionGet = vi.fn().mockImplementation((args: { path: { id: string } }) => {
      const isChild = args.path.id.startsWith("child-")
      return Promise.resolve({ data: { parentID: isChild ? "parent-1" : null } })
    })
    ctx = makeMockCtx(sessionGet)

    const originalShell = ctx.$
    ;(ctx.$ as unknown) = new Proxy(originalShell as object, {
      apply(_target, _thisArg, args) {
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
    shellCalls.length = 0
    plugin = p.hooks() as typeof plugin
  })

  it("session.created with parentID → tracks subagent, parent idle defers done", async () => {
    // Child session created
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })

    // Parent goes idle — should NOT show "Conversation Complete"
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })

    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    expect(hasDone).toBe(false)
  })

  it("session.created without parentID → does not track, parent idle shows done", async () => {
    // Non-child session created (no parentID)
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "parent-1" },
    }) })

    // Parent goes idle — should show "Conversation Complete"
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })

    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
  })

  it("last subagent idle + parent already idle → triggers done", async () => {
    // Create child, make parent idle (deferred)
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })
    shellCalls.length = 0

    // Child goes idle via session.status
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "child-1",
      status: { type: "idle" },
    }) })

    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasDone).toBe(true)
    expect(hasNotify).toBe(true)
  })

  it("subagent error clears tracking and triggers done when parent idle", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })
    shellCalls.length = 0

    // Child errors
    await plugin.event({ event: makeEvent(EventType.SessionError, {
      sessionID: "child-1",
    }) })

    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
  })

  it("parent error clears all tracked subagents", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-2", parentID: "parent-1" },
    }) })

    // Parent errors — should clear sidebar (not show done)
    await plugin.event({ event: makeEvent(EventType.SessionError, {
      sessionID: "parent-1",
    }) })
    shellCalls.length = 0

    // Now if parent goes idle, no subagents should block — shows done
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })

    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    expect(hasDone).toBe(true)
  })

  it("multiple subagents — done only fires after ALL complete", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-2", parentID: "parent-1" },
    }) })
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "parent-1",
      status: { type: "idle" },
    }) })
    shellCalls.length = 0

    // First child completes — should NOT show done
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "child-1",
      status: { type: "idle" },
    }) })
    expect(shellCalls.some((c) => c.includes("Conversation Complete"))).toBe(false)
    shellCalls.length = 0

    // Second child completes — NOW shows done
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "child-2",
      status: { type: "idle" },
    }) })
    expect(shellCalls.some((c) => c.includes("Conversation Complete"))).toBe(true)
  })

  it("restoreAfterInputCleared with active subagents → shows Working not Done", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionCreated, {
      info: { id: "child-1", parentID: "parent-1" },
    }) })

    // Add and resolve a permission while subagent is active
    await plugin.event({ event: makeEvent(EventType.PermissionAsked, {
      sessionID: "parent-1",
      id: "perm-1",
    }) })
    shellCalls.length = 0

    await plugin.event({ event: makeEvent(EventType.PermissionReplied, {
      sessionID: "parent-1",
      permissionID: "perm-1",
      response: "allow",
    }) })

    const hasWorking = shellCalls.some((c) => c.includes("set-status") && c.includes("Working"))
    const hasDone = shellCalls.some((c) => c.includes("Conversation Complete"))
    expect(hasWorking).toBe(true)
    expect(hasDone).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Focus-gating tests
// ---------------------------------------------------------------------------

describe("CmuxNotifyPlugin — focus-gating", () => {
  let plugin: { event: (args: { event: unknown }) => Promise<void> }
  let ctx: PluginInput
  let shellCalls: string[]
  let isFocused = false
  let throwOnIdentify = false

  beforeEach(async () => {
    isFocused = false
    throwOnIdentify = false
    shellCalls = []
    ctx = makeMockCtx(vi.fn().mockResolvedValue({ data: { parentID: null } }))

    // Override shell mock with focus-awareness: cmux identify returns focused/unfocused JSON
    const originalShell = ctx.$
    ;(ctx.$ as unknown) = new Proxy(originalShell as object, {
      apply(_target, _thisArg, args) {
        const parts = args[0] as string[]
        const cmdStr = parts.join("")
        shellCalls.push(cmdStr)

        if (cmdStr.includes("identify")) {
          if (throwOnIdentify) {
            return {
              text: vi.fn().mockRejectedValue(new Error("cmux identify failed")),
              quiet: vi.fn().mockResolvedValue(undefined),
            }
          }
          return {
            text: vi.fn().mockResolvedValue(
              isFocused
                ? JSON.stringify({ caller: { surface_ref: "surface:1" }, focused: { surface_ref: "surface:1" } })
                : JSON.stringify({ caller: { surface_ref: "surface:1" }, focused: { surface_ref: "surface:99" } })
            ),
            quiet: vi.fn().mockResolvedValue(undefined),
          }
        }
        return {
          text: vi.fn().mockResolvedValue("cmux help text"),
          quiet: vi.fn().mockResolvedValue(undefined),
        }
      },
    })

    const CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    const p = new CmuxNotifyPlugin(ctx)
    await p.init(TEST_CONFIG)
    shellCalls.length = 0 // reset after init
    plugin = p.hooks() as typeof plugin
  })

  it("Test 11: Focused + onlyWhenUnfocused=true → notification suppressed, sidebar still updates", async () => {
    isFocused = true
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    const hasSidebarDone = shellCalls.some(
      (c) => c.includes("set-status") && c.includes("opencode") && c.includes("Conversation Complete")
    )
    expect(hasNotify).toBe(false)
    expect(hasSidebarDone).toBe(true)
  })

  it("Test 12: Not focused + onlyWhenUnfocused=true → notification fires", async () => {
    isFocused = false
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasNotify).toBe(true)
  })

  it("Test 13: Focused + onlyWhenUnfocused=false → notification fires regardless", async () => {
    isFocused = true
    const CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    const p = new CmuxNotifyPlugin(ctx)
    const customConfig = parseConfig({ notify: { onlyWhenUnfocused: false } })
    await p.init(customConfig)
    shellCalls.length = 0
    const localPlugin = p.hooks() as typeof plugin

    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await localPlugin.event({ event })
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasNotify).toBe(true)
  })

  it("Test 14: Sidebar NOT suppressed when focused (busy → set-status Working)", async () => {
    isFocused = true
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

  it("Test 15: Focus detection failure → fail-open (notification fires)", async () => {
    throwOnIdentify = true
    const event = makeEvent(EventType.SessionStatus, {
      sessionID: "sess-1",
      status: { type: "idle" },
    })
    await (plugin as { event: (args: { event: unknown }) => Promise<void> }).event({ event })
    const hasNotify = shellCalls.some((c) => c.includes("notify"))
    expect(hasNotify).toBe(true)
  })
})
