# Roadmap: opencode-cmux

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-03-20)
- ✅ **v1.1 Port Discovery** — resolved via config (2026-03-20)

## Upcoming

- **v1.2 Config, Events, and Schema Hosting** — Zod config schema + jsonc-parser,
  sidebar state machine, permission/question notifications, GitHub Pages schema hosting

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
<summary>v1.2 Config, Events, and Schema Hosting — IN PROGRESS</summary>

Three phases (7 plans total). Phase 4 complete. Phases 5 and 6 remaining.
Phases 5 and 6 are parallel-safe.

- [x] Phase 4: Config Foundation (2/2 plans) — completed 2026-03-20
  - [x] 04-01-PLAN.md — Zod schema + jsonc-parser migration (TDD: src/config.ts rewrite)
  - [x] 04-02-PLAN.md — Call-site refactor (notify + viewer updated to new config shape)
- [ ] Phase 5: Event Coverage Expansion (2 plans)
  - [ ] 05-01-PLAN.md — EventType additions + sidebar state machine + permission/question handlers (all event coverage in one implementation plan)
  - [ ] 05-02-PLAN.md — End-to-end verification checkpoint (sidebar transitions, config gates, pending-input gating)
- [ ] Phase 6: Schema Hosting (2 plans)
  - [ ] 06-01: `script/generate-schema.ts`
  - [ ] 06-02: `.github/workflows/pages.yml`

</details>

## Progress

| Phase                    | Milestone | Plans Complete | Status      | Completed  |
|--------------------------|-----------|----------------|-------------|------------|
| 1. Project Foundation    | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 2. Config System         | v1.0      | 2/2            | Complete    | 2026-03-19 |
| 3. CI/CD & Documentation | v1.0      | 2/2            | Complete    | 2026-03-20 |
| v1.1 Port Discovery      | v1.1      | —              | Resolved    | 2026-03-20 |
| 4. Config Foundation     | v1.2      | 2/2            | Complete    | 2026-03-20 |
| 5. Event Coverage        | v1.2      | 0/2            | In Progress | —          |
| 6. Schema Hosting        | v1.2      | 0/2            | Planned     | —          |

---
*Roadmap created: 2026-03-19 | v1.0 archived: 2026-03-20 | v1.2 redefined: 2026-03-20*
