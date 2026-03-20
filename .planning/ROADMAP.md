# Roadmap: opencode-cmux

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-03-20)
- ✅ **v1.1 Port Discovery** — resolved via config (2026-03-20)

## Upcoming

- ✅ **v1.2 Config, Events, and Schema Hosting** — shipped 2026-03-20
- 🔄 **v1.3 Code Quality** — Phase 7: cmux-notify class-based refactor

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

<details>
<summary>✅ v1.2 Config, Events, and Schema Hosting — COMPLETE 2026-03-20</summary>

Three phases complete. All 4 plans executed.

- [x] Phase 4: Config Foundation (2/2 plans) — completed 2026-03-20
  - [x] 04-01-PLAN.md — Zod schema + jsonc-parser migration (TDD: src/config.ts rewrite)
  - [x] 04-02-PLAN.md — Call-site refactor (notify + viewer updated to new config shape)
- [x] Phase 5: Event Coverage Expansion (1/1 plans) — completed 2026-03-20
  - [x] 05-01-PLAN.md — EventType additions + sidebar state machine + permission/question handlers
- [x] Phase 6: Schema Hosting (1/1 plans) — completed 2026-03-20
  - [x] 06-01-PLAN.md — `script/generate-schema.ts` + `.github/workflows/pages.yml`

</details>

## Progress

| Phase                    | Milestone | Plans Complete | Status      | Completed  |
|--------------------------|-----------|----------------|-------------|------------|
| 1. Project Foundation    | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 2. Config System         | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 3. CI/CD & Documentation | v1.0      | 2/2            | Complete    | 2026-03-20 |
| v1.1 Port Discovery      | v1.1      | —              | Resolved    | 2026-03-20 |
| 4. Config Foundation     | v1.2      | 2/2            | Complete    | 2026-03-20 |
| 5. Event Coverage        | v1.2      | 1/1            | Complete    | 2026-03-20 |
| 6. Schema Hosting        | v1.2      | 1/1            | Complete    | 2026-03-20 |
| 7. cmux-notify Refactor  | v1.3      | 0/TBD          | Not planned | —          |

### Phase 7: Refactor cmux-notify to class-based with event dispatch map

**Goal:** Refactor `cmux-notify.ts` from function-based closures to the same `PluginBase` class pattern used by `cmux-subagent-viewer.ts`, replacing the if-chain event handler with a typed dispatch map for consistency and future maintainability.
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:
- [ ] 07-01-PLAN.md — Class-based CmuxNotifyPlugin refactor with TDD (dispatch map + state as class fields)

---
*Roadmap created: 2026-03-19 | v1.0 archived: 2026-03-20 | v1.2 redefined: 2026-03-20*
