# Milestones

## v1.2 (Planned)

**Goal:** Config, Events, and Schema Hosting — richer config schema, expanded event
coverage, hosted JSON Schema via GitHub Pages.

**New dependencies:** `zod` (prod), `jsonc-parser` (prod), `zod-to-json-schema` (dev)

**Key work:**

_Phase 1 — Config Foundation_
- Replace hand-rolled merge with Zod schema (`z.object` + `.default()` at every level)
- Switch `JSON.parse` to `jsonc-parser` so config files can contain comments
- Bootstrap the default config with JSONC comments explaining each field
- Embed `$schema` URL in bootstrapped config pointing at the Pages-hosted schema

_Phase 2 — Event Coverage Expansion_
- Sidebar state machine for primary session: Working (amber) → Waiting/red lock on
  permission → clears on idle/error
- Desktop notify on permission request (deduped by `requestID`)
- Per-event `notify.*` flags in config (`sessionDone`, `sessionError`, `permissionRequest`)
- Question event: research which SDK surface to use, then wire up sidebar + notify;
  ships as config-key no-op if unresolvable before release cut

_Phase 3 — Schema Hosting_
- `script/generate-schema.ts` — imports Zod schema, runs `zodToJsonSchema()`, writes `schema.json`
- `.github/workflows/pages.yml` — triggers on push to `main`, no commit-back;
  stable URL `https://mspiegel31.github.io/opencode-cmux/schema.json`

Full plan: `.planning/milestones/v1.2-MILESTONE.md`

---

## v1.0 MVP (Shipped: 2026-03-20)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**

- TypeScript build pipeline configured with `tsc`, ESM output, and declaration files
- `src/index.ts` entry point exporting both `CmuxPlugin` and `CmuxSubagentViewer`
- Per-plugin JSON config system with file bootstrapping, deep merge, and env var overrides
- Both plugins wired to respect individual `enabled` flags from config
- GitHub Actions CI (typecheck + build + test) and release (semantic-release + npm OIDC publish) workflows
- Full README covering installation, registration, and configuration
- Published `@mspiegel31/opencode-cmux@1.0.0` to npm

---
