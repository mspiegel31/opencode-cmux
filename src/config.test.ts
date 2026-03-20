import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { loadConfig, DEFAULT_CONFIG } from "./config.js"

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
    // Restore original env
    process.env.CMUX_CONFIG_PATH = origEnv.CMUX_CONFIG_PATH
    process.env.CMUX_NOTIFY_ENABLED = origEnv.CMUX_NOTIFY_ENABLED
    process.env.CMUX_SUBAGENT_VIEWER_ENABLED = origEnv.CMUX_SUBAGENT_VIEWER_ENABLED
    if (!origEnv.CMUX_CONFIG_PATH) delete process.env.CMUX_CONFIG_PATH
    if (!origEnv.CMUX_NOTIFY_ENABLED) delete process.env.CMUX_NOTIFY_ENABLED
    if (!origEnv.CMUX_SUBAGENT_VIEWER_ENABLED) delete process.env.CMUX_SUBAGENT_VIEWER_ENABLED
  })

  it("returns DEFAULT_CONFIG when file does not exist", async () => {
    const config = await loadConfig()
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it("creates config file when it does not exist", async () => {
    expect(existsSync(tempPath)).toBe(false)
    await loadConfig()
    expect(existsSync(tempPath)).toBe(true)
  })

  it("reads user config values from existing file", async () => {
    const userConfig = {
      cmuxNotify: { enabled: false },
      cmuxSubagentViewer: { enabled: false },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    const config = await loadConfig()
    expect(config.cmuxNotify.enabled).toBe(false)
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })

  it("merges partial config — missing keys use defaults", async () => {
    const partial = { cmuxNotify: { enabled: false } }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(partial), "utf-8")
    const config = await loadConfig()
    expect(config.cmuxNotify.enabled).toBe(false)
    // Missing key falls back to default
    expect(config.cmuxSubagentViewer.enabled).toBe(DEFAULT_CONFIG.cmuxSubagentViewer.enabled)
  })

  it("CMUX_NOTIFY_ENABLED=false overrides config file", async () => {
    const userConfig = {
      cmuxNotify: { enabled: true },
      cmuxSubagentViewer: { enabled: true },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    process.env.CMUX_NOTIFY_ENABLED = "false"
    const config = await loadConfig()
    expect(config.cmuxNotify.enabled).toBe(false)
  })

  it("CMUX_SUBAGENT_VIEWER_ENABLED=false overrides config file", async () => {
    const userConfig = {
      cmuxNotify: { enabled: true },
      cmuxSubagentViewer: { enabled: true },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    process.env.CMUX_SUBAGENT_VIEWER_ENABLED = "false"
    const config = await loadConfig()
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })

  it("unset env var does not override config file", async () => {
    const userConfig = {
      cmuxNotify: { enabled: false },
      cmuxSubagentViewer: { enabled: false },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    // No env vars set — config file values should stand
    const config = await loadConfig()
    expect(config.cmuxNotify.enabled).toBe(false)
    expect(config.cmuxSubagentViewer.enabled).toBe(false)
  })

  it("CMUX_NOTIFY_ENABLED=true overrides config file false value", async () => {
    const userConfig = {
      cmuxNotify: { enabled: false },
      cmuxSubagentViewer: { enabled: true },
    }
    mkdirSync(dirname(tempPath), { recursive: true })
    writeFileSync(tempPath, JSON.stringify(userConfig), "utf-8")
    process.env.CMUX_NOTIFY_ENABLED = "true"
    const config = await loadConfig()
    expect(config.cmuxNotify.enabled).toBe(true)
  })
})
