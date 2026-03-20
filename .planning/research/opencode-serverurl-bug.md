# Research: OpenCode `ctx.serverUrl` Bug with `--port 0`

**Date:** 2026-03-20
**Status:** Bug confirmed, upstream fix identified, workaround in place
**Relevant milestone:** v1.1

---

## Problem Statement

`CmuxSubagentViewer` needs to pass the parent OpenCode server URL to `opencode attach <url>` when opening a subagent pane. OpenCode must be launched with `--port 0` so the OS assigns a port, enabling multiple concurrent instances. However, when `--port 0` is used, `ctx.serverUrl` (the URL passed to plugins via `PluginInput`) always reports port `0` — even though the server successfully bound to a real port.

This forces the plugin to use `lsof` as a workaround, which is macOS-only and fragile.

---

## Root Cause

**File:** `packages/opencode/src/server/server.ts`

`Server.url` (the module-level variable plugins read) is assigned **before** `Bun.serve()` is called:

```ts
// server.ts line 543
url = new URL(`http://${opts.hostname}:${opts.port}`)  // set to port 0 ← BUG

// server.ts line 558
const server = opts.port === 0 ? (tryServe(4096) ?? tryServe(0)) : tryServe(opts.port)
// Bun.serve() resolves the real port here, but Server.url is never updated
```

`Bun.serve()` returns a server object with `.port` set to the actual bound port. The worker captures this correctly:

```ts
// worker.ts line 120-123
async server(input: { port: number; hostname: string; mdns?: boolean; cors?: string[] }) {
  if (server) await server.stop(true)
  server = await Server.listen(input)
  return { url: server.url.toString() }  // ← Bun.Server.url, correct
},
```

But `Server.url` (the opencode module export) is never updated, so plugins get the wrong value.

**File:** `packages/opencode/src/plugin/index.ts`

```ts
// plugin/index.ts lines 40-42
get serverUrl(): URL {
  return Server.url ?? new URL("http://localhost:4096")
},
```

`Server.url.port === "0"` when launched with `--port 0`. The fallback `http://localhost:4096` is also wrong if 4096 was unavailable and a random port was used.

---

## Proposed Upstream Fix

One line in `server.ts`, after `Bun.serve()` resolves:

```ts
const server = opts.port === 0 ? (tryServe(4096) ?? tryServe(0)) : tryServe(opts.port)
if (!server) throw new Error(`Failed to start server on port ${opts.port}`)

// Add this line:
url = new URL(`http://${opts.hostname}:${server.port}`)
```

`Bun.Server.port` contains the actual bound port after `Bun.serve()` returns.

---

## Additional Notes from Source Reading

- `Server.url` is marked `/** @deprecated do not use this dumb shit */` in `server.ts` — there may be a successor planned but not yet exposed to the plugin API
- The `listen()` fallback logic (`tryServe(4096) ?? tryServe(0)`) means `--port 0` actually tries 4096 first, then a random port — so the bug affects any user where 4096 is already taken, even without explicit `--port 0`
- `opencode attach` takes the server URL as a positional arg (`attach.ts`), so the plugin must know the real URL to construct the correct attach command

---

## Current Workaround (in this repo)

`src/lib/cmux-utils.ts` — `createServerUrlResolver()`:

1. Check `ctx.serverUrl.port` — use it if not `"0"`
2. Fall back to `lsof -a -p {pid} -i TCP -P -s TCP:LISTEN` to find the actual LISTEN port

Limitations:
- `lsof` is macOS-only (different flags/output on Linux)
- Requires inferring the opencode PID from `OPENCODE_PID` env var, `process.ppid`, or `process.pid` — heuristic, not guaranteed
- Will break if opencode ever listens on multiple sockets

---

## v1.1 Options

| Option | Description | Effort | Risk |
|--------|-------------|--------|------|
| File upstream bug + wait | One-line fix in opencode, remove workaround when released | Low (filing) / waiting | Depends on upstream velocity |
| Config workaround | Document `server.port: 4096` in `opencode.json` as alternative to `--port 0` | Minimal | Single-instance only — breaks with concurrent opencode processes |
| Improve lsof fallback | Make PID detection more reliable; handle Linux | Medium | Still OS-level inspection |
| Read port from Bun.Server | If opencode exposes `server.port` via an API endpoint or env var post-start | Unknown | Needs upstream change anyway |

**Recommended v1.1 approach:**
1. File the upstream bug report (content in this file)
2. Document `server.port: 4096` as the single-instance workaround in README
3. Track the upstream fix; simplify plugin once merged

---

## Upstream Bug Report (ready to file)

**Title:** `ctx.serverUrl` reports port `0` when `--port 0` is passed — plugin API receives incorrect server URL

**Body:**

When OpenCode is launched with `opencode --port 0`, the `serverUrl` property passed to plugins via `PluginInput` always has port `0`, even though the server successfully binds to a real port. This makes `ctx.serverUrl` unusable for plugins that need to communicate with the running OpenCode server.

**Root cause:** In `server.ts`, `Server.url` is assigned before `Bun.serve()` resolves the actual port (line 543), and is never updated after `Bun.serve()` returns (line 558). `Bun.Server.port` contains the real port and is available immediately after `Bun.serve()`.

**One-line fix** in `server.ts`, after `const server = ...`:
```ts
url = new URL(`http://${opts.hostname}:${server.port}`)
```

**Impact:** Any plugin using `ctx.serverUrl` to talk back to the server silently receives a broken URL. No public API workaround exists — plugins must resort to OS-level inspection (e.g., `lsof`) to discover the real port.

**Example:** [`@mspiegel31/opencode-cmux`](https://github.com/mspiegel31/opencode-cmux) implements an `lsof`-based fallback in `src/lib/cmux-utils.ts` solely because of this bug.

**Also worth noting:** `Server.url` is marked `@deprecated` in the source. If there is a preferred successor for the plugin API, it should be documented.
