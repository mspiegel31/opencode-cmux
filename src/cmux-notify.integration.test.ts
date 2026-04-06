import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest"
import { execSync } from "child_process"
import type { PluginInput } from "@opencode-ai/plugin"
import { EventType, SIDEBAR_COLORS } from "./lib/plugin-base"
import { parseConfig } from "./config.js"

const IN_CMUX = !!process.env.CMUX_SURFACE_ID

// ---------------------------------------------------------------------------
// cmux CLI helpers (child_process — avoids Bun type dependency)
// ---------------------------------------------------------------------------

function cmux(args: string): string {
  return execSync(`cmux ${args}`, { encoding: "utf-8" }).trim()
}

// `cmux list-status` returns lines like:
//   opencode=Working icon=terminal color=#f59e0b
//   opencode=Conversation Complete icon=checkmark.circle color=#059669
//   (or "No status entries" when empty)
function parseStatusLine(output: string): { value: string; icon: string; color: string } | undefined {
  const trimmed = output.trim()
  if (!trimmed || trimmed === "No status entries") return undefined
  for (const line of trimmed.split("\n")) {
    const match = line.match(/^opencode=(.+?)\s+icon=(\S+)\s+color=(\S+)$/)
    if (match) return { value: match[1], icon: match[2], color: match[3] }
  }
  return undefined
}

// Tagged template shell backed by child_process.execSync.
// Vitest runs under its own VM (not Bun), so Bun.$ isn't available.
function createShell(): PluginInput["$"] {
  const shell = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let cmd = ""
    for (let i = 0; i < strings.length; i++) {
      cmd += strings[i]
      if (i < values.length) {
        const v = String(values[i])
        cmd += "'" + v.replace(/'/g, "'\\''") + "'"
      }
    }
    return {
      text: () => Promise.resolve(execSync(cmd, { encoding: "utf-8" })),
      quiet: () => { try { execSync(cmd, { stdio: "ignore" }) } catch {} return Promise.resolve() },
    }
  }) as unknown
  return shell as PluginInput["$"]
}

// ---------------------------------------------------------------------------
// Plugin class import (same dynamic import pattern as unit tests)
// ---------------------------------------------------------------------------

type CmuxNotifyPluginInstance = {
  init(config?: ReturnType<typeof parseConfig>): Promise<void>
  hooks(): { event: (args: { event: unknown }) => Promise<void> }
}
type CmuxNotifyPluginClass = new (ctx: PluginInput) => CmuxNotifyPluginInstance

async function getCmuxNotifyPlugin(): Promise<CmuxNotifyPluginClass> {
  const mod = await import("./cmux-notify.js")
  return (mod as unknown as { CmuxNotifyPlugin: CmuxNotifyPluginClass }).CmuxNotifyPlugin
}

function makeEvent(type: string, properties: Record<string, unknown> = {}) {
  return { type, properties }
}

// ---------------------------------------------------------------------------
// Integration tests — real cmux sidebar status
//
// Creates a dedicated cmux workspace, instantiates the plugin with a real
// Bun shell (not mocked), fires synthetic events, and asserts on actual
// `cmux list-status` output. Notifications disabled to avoid desktop popups.
// ---------------------------------------------------------------------------

describe.runIf(IN_CMUX)("CmuxNotifyPlugin — integration (real cmux)", () => {
  let testWorkspaceRef: string
  let originalWorkspaceId: string
  let CmuxNotifyPlugin: CmuxNotifyPluginClass
  let bunShell: PluginInput["$"]
  let savedWorkspaceEnv: string | undefined

  const TEST_CONFIG = parseConfig({
    notify: { sessionDone: false, sessionError: false, permissionRequest: false, question: false },
    sidebar: { enabled: true },
  })

  beforeAll(async () => {
    CmuxNotifyPlugin = await getCmuxNotifyPlugin()
    bunShell = createShell()

    originalWorkspaceId = JSON.parse(cmux("--json current-workspace")).workspace_id

    const newOut = cmux('new-workspace --name "🧪 integ" --cwd /tmp --command "sleep 3600"')
    const match = newOut.match(/workspace:\d+/)
    testWorkspaceRef = match![0]

    cmux(`select-workspace --workspace ${originalWorkspaceId}`)

    savedWorkspaceEnv = process.env.CMUX_WORKSPACE_ID
    process.env.CMUX_WORKSPACE_ID = testWorkspaceRef
  })

  afterAll(() => {
    process.env.CMUX_WORKSPACE_ID = savedWorkspaceEnv
    if (testWorkspaceRef) {
      try { cmux(`close-workspace --workspace ${testWorkspaceRef}`) } catch {}
    }
  })

  let plugin: { event: (args: { event: unknown }) => Promise<void> }

  beforeEach(async () => {
    try { cmux(`clear-status opencode --workspace ${testWorkspaceRef}`) } catch {}

    const ctx = {
      $: bunShell,
      client: { session: { get: vi.fn().mockResolvedValue({ data: { parentID: null } }) } },
      serverUrl: "http://localhost:4096",
    } as unknown as PluginInput

    const p = new CmuxNotifyPlugin(ctx)
    await p.init(TEST_CONFIG)
    plugin = p.hooks() as typeof plugin
  })

  function getStatus() {
    const output = cmux(`list-status --workspace ${testWorkspaceRef}`)
    return parseStatusLine(output)
  }

  // ---------------------------------------------------------------------------
  // Status lifecycle
  // ---------------------------------------------------------------------------

  it("session.status busy → sidebar shows Working", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1",
      status: { type: "busy" },
    })})

    const status = getStatus()
    expect(status?.value).toBe("Working")
    expect(status?.color).toBe(SIDEBAR_COLORS.working)
  })

  it("session.status idle (nothing pending) → sidebar shows Conversation Complete", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1",
      status: { type: "idle" },
    })})

    const status = getStatus()
    expect(status?.value).toBe("Conversation Complete")
    expect(status?.color).toBe(SIDEBAR_COLORS.done)
  })

  // ---------------------------------------------------------------------------
  // Permission lifecycle — the v2 requestID fix
  // ---------------------------------------------------------------------------

  it("permission.asked → Waiting, permission.replied (v1 permissionID) → restores to Working", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1", status: { type: "busy" },
    })})

    await plugin.event({ event: makeEvent(EventType.PermissionAsked, {
      sessionID: "s1", id: "perm-v1-1",
    })})
    expect(getStatus()?.value).toBe("Waiting")

    await plugin.event({ event: makeEvent(EventType.PermissionReplied, {
      sessionID: "s1", permissionID: "perm-v1-1", response: "allow",
    })})
    expect(getStatus()?.value).toBe("Working")
  })

  it("permission.asked → Waiting, permission.replied (v2 requestID) → restores to Working", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1", status: { type: "busy" },
    })})

    await plugin.event({ event: makeEvent(EventType.PermissionAsked, {
      sessionID: "s1", id: "perm-v2-1",
    })})
    expect(getStatus()?.value).toBe("Waiting")

    await plugin.event({ event: makeEvent(EventType.PermissionReplied, {
      sessionID: "s1", requestID: "perm-v2-1", reply: "once",
    })})
    expect(getStatus()?.value).toBe("Working")
  })

  // ---------------------------------------------------------------------------
  // Question lifecycle
  // ---------------------------------------------------------------------------

  it("question.asked → Question, question.replied → restores to Working", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1", status: { type: "busy" },
    })})

    await plugin.event({ event: makeEvent(EventType.QuestionAsked, {
      sessionID: "s1", id: "q-1", questions: [{ header: "Pick one?" }],
    })})
    expect(getStatus()?.value).toBe("Question")
    expect(getStatus()?.color).toBe(SIDEBAR_COLORS.question)

    await plugin.event({ event: makeEvent(EventType.QuestionReplied, {
      sessionID: "s1", requestID: "q-1", answers: [["yes"]],
    })})
    expect(getStatus()?.value).toBe("Working")
  })

  it("question.rejected → restores to Working", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1", status: { type: "busy" },
    })})

    await plugin.event({ event: makeEvent(EventType.QuestionAsked, {
      sessionID: "s1", id: "q-2", questions: [{ header: "OK?" }],
    })})
    expect(getStatus()?.value).toBe("Question")

    await plugin.event({ event: makeEvent(EventType.QuestionRejected, {
      sessionID: "s1", requestID: "q-2",
    })})
    expect(getStatus()?.value).toBe("Working")
  })

  // ---------------------------------------------------------------------------
  // Multiple pending items — only restores after ALL cleared
  // ---------------------------------------------------------------------------

  it("mixed pending: permission + question → restores only after both cleared", async () => {
    await plugin.event({ event: makeEvent(EventType.SessionStatus, {
      sessionID: "s1", status: { type: "busy" },
    })})

    await plugin.event({ event: makeEvent(EventType.PermissionAsked, {
      sessionID: "s1", id: "perm-mix-1",
    })})
    expect(getStatus()?.value).toBe("Waiting")

    await plugin.event({ event: makeEvent(EventType.QuestionAsked, {
      sessionID: "s1", id: "q-mix-1", questions: [{ header: "Confirm?" }],
    })})
    expect(getStatus()?.value).toBe("Question")

    await plugin.event({ event: makeEvent(EventType.PermissionReplied, {
      sessionID: "s1", requestID: "perm-mix-1", reply: "once",
    })})
    expect(getStatus()?.value).toBe("Question")

    await plugin.event({ event: makeEvent(EventType.QuestionReplied, {
      sessionID: "s1", requestID: "q-mix-1", answers: [["yes"]],
    })})
    expect(getStatus()?.value).toBe("Working")
  })

  // ---------------------------------------------------------------------------
  // Error clears everything
  // ---------------------------------------------------------------------------

  it("session.error clears sidebar even with pending items", async () => {
    // SessionError handler requires notify.sessionError=true to reach the clear logic
    const errorConfig = parseConfig({
      notify: { sessionDone: false, sessionError: true, permissionRequest: false, question: false },
      sidebar: { enabled: true },
    })
    const ctx = {
      $: bunShell,
      client: { session: { get: vi.fn().mockResolvedValue({ data: { parentID: null } }) } },
      serverUrl: "http://localhost:4096",
    } as unknown as PluginInput
    const p = new CmuxNotifyPlugin(ctx)
    await p.init(errorConfig)
    const errorPlugin = p.hooks() as typeof plugin

    await errorPlugin.event({ event: makeEvent(EventType.PermissionAsked, {
      sessionID: "s1", id: "perm-err-1",
    })})
    expect(getStatus()?.value).toBe("Waiting")

    await errorPlugin.event({ event: makeEvent(EventType.SessionError, {
      sessionID: "s1", error: "something broke",
    })})
    expect(getStatus()).toBeUndefined()
  })
})
