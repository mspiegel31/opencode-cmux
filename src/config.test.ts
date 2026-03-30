import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { existsSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { ConfigSchema, loadConfig } from "./config.js"

describe("ConfigSchema (Zod)", () => {
  it("parse({}) returns all defaults", () => {
    const config = ConfigSchema.parse({})
    expect(config).toEqual({
      notify: {
        sessionDone: true,
        sessionError: true,
        permissionRequest: true,
        question: true,
      },
      sidebar: { enabled: true },
      cmuxSubagentViewer: { enabled: true },
      cmuxBrowserTools: { enabled: true },
    })
  })

  it("partial user config fills missing keys from defaults", () => {
    const config = ConfigSchema.parse({ notify: { sessionDone: false } })
    expect(config.notify.sessionDone).toBe(false)
    expect(config.notify.sessionError).toBe(true)
    expect(config.notify.permissionRequest).toBe(true)
    expect(config.notify.question).toBe(true)
    expect(config.sidebar.enabled).toBe(true)
    expect(config.cmuxSubagentViewer.enabled).toBe(true)
  })

  it("strips unknown top-level keys (old cmuxNotify shape)", () => {
    const config = ConfigSchema.parse({ cmuxNotify: { enabled: false } } as any)
    // Unknown key stripped, defaults apply
    expect(config.notify.sessionDone).toBe(true)
    expect((config as any).cmuxNotify).toBeUndefined()
  })
})

describe("loadConfig()", () => {
  let tempPath: string
  const origEnv = { ...process.env }

  beforeEach(() => {
    tempPath = join(tmpdir(), `opencode-cmux-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    process.env.CMUX_CONFIG_PATH = tempPath
    delete process.env.CMUX_NOTIFY_ENABLED
    delete process.env.CMUX_SUBAGENT_VIEWER_ENABLED
  })

  afterEach(() => {
    rmSync(tempPath, { force: true })
    process.env.CMUX_CONFIG_PATH = origEnv.CMUX_CONFIG_PATH
    process.env.CMUX_NOTIFY_ENABLED = origEnv.CMUX_NOTIFY_ENABLED
    process.env.CMUX_SUBAGENT_VIEWER_ENABLED = origEnv.CMUX_SUBAGENT_VIEWER_ENABLED
    if (!origEnv.CMUX_CONFIG_PATH) delete process.env.CMUX_CONFIG_PATH
    if (!origEnv.CMUX_NOTIFY_ENABLED) delete process.env.CMUX_NOTIFY_ENABLED
    if (!origEnv.CMUX_SUBAGENT_VIEWER_ENABLED) delete process.env.CMUX_SUBAGENT_VIEWER_ENABLED
    vi.restoreAllMocks()
  })

  it("returns all defaults when file does not exist", async () => {
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(true)
    expect(config.notify.sessionError).toBe(true)
    expect(config.notify.permissionRequest).toBe(true)
    expect(config.notify.question).toBe(true)
    expect(config.sidebar.enabled).toBe(true)
    expect(config.cmuxSubagentViewer.enabled).toBe(true)
  })

  it("creates config file when it does not exist", async () => {
    expect(existsSync(tempPath)).toBe(false)
    await loadConfig()
    expect(existsSync(tempPath)).toBe(true)
  })

  it("bootstrapped file contains $schema field", async () => {
    await loadConfig()
    const content = readFileSync(tempPath, "utf-8")
    expect(content).toContain("$schema")
    expect(content).toContain("raw.githubusercontent.com/mspiegel31/opencode-cmux/main/schema.json")
  })

  it("bootstrapped file contains JSONC comments", async () => {
    await loadConfig()
    const content = readFileSync(tempPath, "utf-8")
    expect(content).toContain("//")
  })

  it("reads user config values from existing file", async () => {
    const userConfig = {
      notify: { sessionDone: false, sessionError: false, permissionRequest: false, question: false },
      sidebar: { enabled: false },
      cmuxSubagentViewer: { enabled: false },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(false)
    expect(config.notify.sessionError).toBe(false)
    expect(config.sidebar.enabled).toBe(false)
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })

  it("merges partial config — missing keys use defaults", async () => {
    const partial = { notify: { sessionDone: false } }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(partial), "utf-8")
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(false)
    expect(config.notify.sessionError).toBe(true)
    expect(config.cmuxSubagentViewer.enabled).toBe(true)
  })

  it("JSONC config file with // comments parses without error", async () => {
    const jsoncContent = `{
  // This is a comment
  "notify": {
    "sessionDone": false // inline comment
  }
}`
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, jsoncContent, "utf-8")
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(false)
    expect(config.notify.sessionError).toBe(true)
  })

  it("malformed JSON logs a warning and falls back to defaults (does not throw)", async () => {
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, "{ this is not valid json }", "utf-8")
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const config = await loadConfig()
    expect(spy).toHaveBeenCalled()
    expect(config.notify.sessionDone).toBe(true)
    expect(config.notify.sessionError).toBe(true)
    expect(config.cmuxSubagentViewer.enabled).toBe(true)
  })

  it("old config shape { cmuxNotify: { enabled: false } } does not throw", async () => {
    const oldConfig = { cmuxNotify: { enabled: false } }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(oldConfig), "utf-8")
    const config = await loadConfig()
    // Unknown keys stripped — defaults apply
    expect(config.notify.sessionDone).toBe(true)
    expect((config as any).cmuxNotify).toBeUndefined()
  })

  it("CMUX_NOTIFY_ENABLED=false sets ALL notify.* flags to false", async () => {
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify({}), "utf-8")
    process.env.CMUX_NOTIFY_ENABLED = "false"
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(false)
    expect(config.notify.sessionError).toBe(false)
    expect(config.notify.permissionRequest).toBe(false)
    expect(config.notify.question).toBe(false)
  })

  it("CMUX_NOTIFY_ENABLED=true sets ALL notify.* flags to true", async () => {
    const userConfig = { notify: { sessionDone: false, sessionError: false, permissionRequest: false, question: false } }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    process.env.CMUX_NOTIFY_ENABLED = "true"
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(true)
    expect(config.notify.sessionError).toBe(true)
    expect(config.notify.permissionRequest).toBe(true)
    expect(config.notify.question).toBe(true)
  })

  it("CMUX_SUBAGENT_VIEWER_ENABLED=false sets cmuxSubagentViewer.enabled to false", async () => {
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify({}), "utf-8")
    process.env.CMUX_SUBAGENT_VIEWER_ENABLED = "false"
    const config = await loadConfig()
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })

  it("unset env vars do not override config file values", async () => {
    const userConfig = {
      notify: { sessionDone: false, sessionError: false, permissionRequest: false, question: false },
      sidebar: { enabled: false },
      cmuxSubagentViewer: { enabled: false },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    const config = await loadConfig()
    expect(config.notify.sessionDone).toBe(false)
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })
})
