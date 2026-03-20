/**
 * Shared utilities for cmux plugins.
 */

import type { PluginInput } from "@opencode-ai/plugin"

/**
 * Discover the real OpenCode server URL.
 *
 * `ctx.serverUrl` may report port 0 when `--port 0` is used (a known bug).
 * This helper checks ctx.serverUrl first, then falls back to parsing `lsof`
 * output to find the actual LISTEN port for the OpenCode process.
 *
 * The result is cached after the first successful resolution.
 */
export function createServerUrlResolver(ctx: Pick<PluginInput, "serverUrl" | "$">) {
  let cached: string | null = null
  const { $ } = ctx

  return async function getServerUrl(): Promise<string | null> {
    if (cached) return cached

    // Check if serverUrl already has a valid port
    const provided = ctx.serverUrl
    if (provided && provided.port && provided.port !== "0") {
      cached = provided.toString().replace(/\/$/, "")
      return cached
    }

    // Find LISTEN port for our specific opencode process
    const pid = process.env.OPENCODE_PID || String(process.ppid || process.pid)
    try {
      const out = await $`lsof -a -p ${pid} -i TCP -P -s TCP:LISTEN`.nothrow().text()
      for (const line of out.split("\n")) {
        const m = line.match(/:(\d+)\s+\(LISTEN\)/)
        if (m) {
          cached = `http://localhost:${m[1]}`
          return cached
        }
      }
    } catch {}

    return null
  }
}
