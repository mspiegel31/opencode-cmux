# Roadmap: opencode-cmux

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-03-20)
- ✅ **v1.1 Port Discovery** — resolved via config (2026-03-20)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Project Foundation (2/2 plans) — completed 2026-03-19
- [x] Phase 2: Config System (2/2 plans) — completed 2026-03-19
- [x] Phase 3: CI/CD & Documentation (2/2 plans) — completed 2026-03-20

</details>

<details>
<summary>✅ v1.1 Port Discovery — RESOLVED 2026-03-20 (no phases needed)</summary>

**Goal:** Make `CmuxSubagentViewer` work without requiring `--port 0`.

**Resolution:** Investigated OpenCode source (`thread.ts`) and discovered that setting `server.port: 4096` in `opencode.json` is sufficient — it flows through `resolveNetworkOptions` and triggers the external TCP server on startup without any CLI flags. README updated with this config. No code changes required. Upstream PR #18417 (filed and closed — workaround made it unnecessary).

Full research in `.planning/research/opencode-serverurl-bug.md`.

</details>

## Progress

| Phase                    | Milestone | Plans Complete | Status      | Completed  |
|--------------------------|-----------|----------------|-------------|------------|
| 1. Project Foundation    | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 2. Config System         | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 3. CI/CD & Documentation | v1.0      | 2/2            | Complete    | 2026-03-20 |
| v1.1 Port Discovery      | v1.1      | —              | Resolved    | 2026-03-20 |

---
*Roadmap created: 2026-03-19 | v1.0 archived: 2026-03-20*
