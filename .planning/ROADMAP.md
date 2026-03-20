# Roadmap: opencode-cmux

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-03-20)
- 📋 **v1.1 Port Discovery** — Phases 4–5 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Project Foundation (2/2 plans) — completed 2026-03-19
- [x] Phase 2: Config System (2/2 plans) — completed 2026-03-19
- [x] Phase 3: CI/CD & Documentation (2/2 plans) — completed 2026-03-20

</details>

### 📋 v1.1 Port Discovery (Planned)

**Goal:** Eliminate the `lsof`-based port discovery workaround and make `CmuxSubagentViewer` work without requiring `--port 0` or any special launch flags.

**Background:** `ctx.serverUrl` reports port `0` when OpenCode is launched with `--port 0` due to a bug in OpenCode's `Server.listen()` — `Server.url` is set before `Bun.serve()` resolves the actual bound port and is never updated. The current workaround (`lsof`) is macOS-only and fragile. Full context in `.planning/research/opencode-serverurl-bug.md`.

- [ ] Phase 4: Upstream Engagement & Workaround Documentation
- [ ] Phase 5: Port Discovery Simplification (pending upstream fix)

#### Phase 4: Upstream Engagement & Workaround Documentation

**Goal:** File the upstream bug, document the `server.port: 4096` config workaround for single-instance users, and update the README to accurately describe the current constraint and its options.

**Plans:**
- 4-01: File upstream bug report in `anomalyco/opencode` and add `server.port` config workaround to README
- 4-02: Improve lsof fallback reliability (better PID detection, document Linux limitation)

#### Phase 5: Port Discovery Simplification

**Goal:** Once the upstream `ctx.serverUrl` bug is fixed, remove the `lsof` fallback entirely and rely on the plugin API directly. Gate this phase on the upstream fix being released.

**Plans:**
- 5-01: Remove `createServerUrlResolver` lsof fallback, use `ctx.serverUrl` directly
- 5-02: Update README to remove `--port 0` requirement

## Progress

| Phase                        | Milestone | Plans Complete | Status      | Completed  |
|------------------------------|-----------|----------------|-------------|------------|
| 1. Project Foundation        | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 2. Config System             | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 3. CI/CD & Documentation     | v1.0      | 2/2            | Complete    | 2026-03-20 |
| 4. Upstream Engagement       | v1.1      | 0/2            | Not started | —          |
| 5. Port Discovery Simplify   | v1.1      | 0/2            | Not started | —          |

---
*Roadmap created: 2026-03-19 | v1.0 archived: 2026-03-20*
