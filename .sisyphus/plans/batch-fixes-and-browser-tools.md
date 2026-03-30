# Batch Fixes + cmux Browser Tools Plugin

## TL;DR

> **Quick Summary**: Ship 4 targeted fixes (schema publishing, notification focus-gating, green color contrast, agent-done text truncation) plus a new cmux browser tools plugin that replaces chrome-devtools-mcp when running inside cmux.
> 
> **Deliverables**:
> - CI commit-back workflow for schema.json (replacing GitHub Pages)
> - Focus-aware notification gating in CmuxNotifyPlugin
> - Improved color contrast for "done" states
> - Full session titles in log messages
> - New `CmuxBrowserToolsPlugin` wrapping `cmux browser` CLI as opencode tools
> 
> **Estimated Effort**: Large (5 items, 3 parallel tracks)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Wave 1 (fixes) → Wave 2 (browser tools core) → Wave 3 (browser tools completion + final verification)

---

## Context

### Original Request
Batch of 4 fixes and 1 feature for the opencode-cmux plugin:
1. Migrate schema publishing from GitHub Pages to raw GitHub link via CI commit-back
2. Focus-aware + main-agent-only notification gating
3. Green color too light on light backgrounds
4. "Agent done" text truncated by ellipsis in logs
5. New browser tools plugin wrapping `cmux browser` CLI

### Interview Summary
**Key Discussions**:
- Fixes 1–4 are fully scoped from codebase analysis (file paths, line numbers, exact changes)
- Feature 1 had 3 open design decisions resolved via Oracle consultation
- All items can be parallelized across 3 tracks using worktrees

**Research Findings**:
- Schema URL hardcoded in 3 places: `config.ts:60`, `config.test.ts:82`, `README.md`
- Zero focus/window detection exists in the codebase — needs new mechanism
- Green `#6BCB77` used in 2 files (`cmux-notify.ts:77`, `cmux-subagent-viewer.ts:30`)
- `PaneInfo.title` stores already-truncated `shortTitle`, losing full title for log messages
- Subagent notification suppression already implemented via `isSubagent()` guards

### Oracle Design Decisions (Feature 1)
1. **Element targeting**: Use CSS selectors + `cmux browser find` (semantic locators) — no uid mapping layer
2. **Tool naming**: `browser_` prefix (`browser_navigate`, `browser_click`, etc.) — avoids name collisions with chrome-devtools-mcp
3. **`--snapshot-after`**: Always append on action tools — biggest efficiency win, eliminates round trips

---

## Work Objectives

### Core Objective
Ship all 5 items as a cohesive batch, maximizing parallel execution across 3 tracks.

### Concrete Deliverables
- `.github/workflows/pages.yml` deleted, replaced by commit-back job in CI
- `schema.json` tracked in repo, served via `raw.githubusercontent.com`
- `notify.onlyWhenUnfocused` config option with focus detection
- Darker green color constant shared between plugins
- Full session titles preserved in `PaneInfo` for log messages
- `src/cmux-browser-tools.ts` with full chrome-devtools-mcp parity tools
- Config schema updated with `cmuxBrowserTools` section
- Plugin exported from `src/index.ts`

### Definition of Done
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Schema URL resolves via raw.githubusercontent.com after merge
- [ ] All new config options have JSONC comments in bootstrap template
- [ ] Browser tools plugin registers tools when `CMUX_WORKSPACE_ID` is set

### Must Have
- Focus detection must use `cmux identify` CLI command (returns JSON with `caller.surface_ref` and `focused.surface_ref`)
- Focus detection failure mode: `isSurfaceFocused()` returns `false` on any error (fail-open — send notification when uncertain)
- Browser tools must accept CSS selectors (not uids)
- `--snapshot-after` appended to all action tools by default
- All browser tool `execute()` functions MUST wrap cmux shell calls in try/catch, return `"Error: <message>"` on failure, NEVER propagate exceptions
- Browser plugin factory MUST check `cmux browser --help` during init — return `{}` if cmux doesn't support browser subcommand
- Color constant extracted to shared location — two separate objects: `SIDEBAR_COLORS` and `STATUS_COLORS` (do NOT unify)
- Commit-back workflow must guard against infinite CI loops
- Commit-back commit message MUST use `chore:` prefix (not `feat:`/`fix:`) to avoid triggering semantic-release

### Must NOT Have (Guardrails)
- No uid→selector mapping layer (over-engineering)
- No cmux-native superset tools beyond chrome-devtools parity (follow-up). Complete tool list is defined in Tasks 7-10 — no cookies, storage, trace, screencast, download tools.
- No Lighthouse/heap profiling equivalents (Chrome-specific, accept the gap)
- No `fill_form` batch tool (defer to follow-up)
- No changes to `PluginBase` abstract class (color constants added there are OK)
- No modifications to the release workflow
- No complex surface lifecycle management — dead surface = set null + re-create, no retry loops, no health polling
- No individual command-construction tests for all 25+ tools — test representative samples per category
- Browser tools tasks that modify `cmux-browser-tools.ts` MUST run sequentially (not parallel) to avoid conflicts

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: YES (tests-after)
- **Framework**: vitest (existing `vitest.config.ts`)
- **Pattern**: Follow existing test structure in `cmux-notify.test.ts` and `config.test.ts`

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Config/Schema**: Use Bash — run `npm run generate-schema`, validate JSON output
- **Notification logic**: Use Bash — run `npm test`, verify new test cases pass
- **Browser tools**: Use Bash — run `npm run typecheck && npm run build && npm test`
- **CI workflow**: Validate YAML syntax, check for loop guards

---

## Execution Strategy

### Parallel Execution Waves

> **Metis Review Applied**: Tasks 5+6 merged (both create same file). Task 4 eliminated
> (`cmux identify` confirmed to work). Tasks 7-10 (browser tools) run SEQUENTIALLY
> (all modify `cmux-browser-tools.ts`). Task numbering adjusted.

```
Wave 1 (Start Immediately — fixes + foundation, ALL parallel):
├── Task 1: Schema publishing migration (Fix 1) [quick]
├── Task 2: Shared color constants + green fix (Fix 3) [quick]
├── Task 3: Agent done full title in logs (Fix 4) [quick]
├── Task 4: Browser tools config + scaffold + surface manager (Feature 1 foundation) [unspecified-high]
│
│   NOTE: Tasks 1 and 4 both touch config.ts but different sections
│   (Task 1: SCHEMA_URL, Task 4: new BrowserToolsSchema).
│   If running in same worktree, Task 1 should commit first.

Wave 2 (After Wave 1 — core implementation):
├── Task 5: Notification focus-gating implementation (Fix 2) [unspecified-high]
│   (runs in PARALLEL with Tasks 6-9)
│
├── Tasks 6→7→8→9: Browser tools implementation (SEQUENTIAL — same file):
│   ├── Task 6: Core navigation + snapshot tools [unspecified-high]
│   ├── Task 7: DOM interaction tools [unspecified-high]
│   ├── Task 8: Page management + waiting tools [unspecified-high]
│   └── Task 9: Console, network, eval, emulation tools [unspecified-high]

Wave 3 (After Wave 2 — wiring + tests, ALL parallel):
├── Task 10: Browser tools export wiring + README update [quick]
├── Task 11: Browser tools tests [unspecified-high]
└── Task 12: Notification focus-gating tests [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 10 |
| 2 | — | — |
| 3 | — | — |
| 4 | — | 6, 7, 8, 9 |
| 5 | — | 12 |
| 6 | 4 | 7, 10, 11 |
| 7 | 6 | 8, 10, 11 |
| 8 | 7 | 9, 10, 11 |
| 9 | 8 | 10, 11 |
| 10 | 1, 9 | F1-F4 |
| 11 | 9 | F1-F4 |
| 12 | 5 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **4 tasks** (parallel) — T1-T3 → `quick`, T4 → `unspecified-high`
- **Wave 2**: **5 tasks** — T5 → `unspecified-high` (parallel), T6-T9 → `unspecified-high` (sequential chain)
- **Wave 3**: **3 tasks** (parallel) — T10 → `quick`, T11-T12 → `unspecified-high`
- **FINAL**: **4 tasks** (parallel) — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Schema Publishing Migration (Fix 1)

  **What to do**:
  - Delete `.github/workflows/pages.yml`
  - Remove `schema.json` from `.gitignore` (last line of file)
  - Run `npm run generate-schema` to create `schema.json` at repo root
  - Add `schema.json` to version control
  - Update `SCHEMA_URL` in `src/config.ts:60` from `https://mspiegel31.github.io/opencode-cmux/schema.json` to `https://raw.githubusercontent.com/mspiegel31/opencode-cmux/main/schema.json`
  - Update `BOOTSTRAP_CONTENT` template in `src/config.ts:62-84` — the `$schema` value uses `SCHEMA_URL`
  - Update assertion in `src/config.test.ts:82` — change `mspiegel31.github.io/opencode-cmux/schema.json` to `raw.githubusercontent.com/mspiegel31/opencode-cmux/main/schema.json`
  - Update `README.md` — the example config `$schema` value
  - Add a new CI job to `.github/workflows/ci.yml` that: (a) runs `npm run generate-schema`, (b) compares `schema.json` to committed version, (c) if different, commits and pushes the updated file. Guard with `if: github.actor != 'github-actions[bot]'` to prevent infinite loops. Only run on `push` to `main` (not PRs).
  - The CI job needs `contents: write` permission and must use a checkout with `persist-credentials: true`
  - **CRITICAL**: Commit message MUST be `chore: regenerate schema.json` — the `chore:` prefix does NOT trigger semantic-release. Do NOT use `feat:` or `fix:` which would trigger a release on every schema change.

  **Must NOT do**:
  - Do not modify the release workflow (`release.yml`)
  - Do not add a separate workflow file — add as a job in `ci.yml`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5, 6)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `.github/workflows/pages.yml` — current GitHub Pages workflow (delete this entirely)
  - `.github/workflows/ci.yml` — existing CI workflow to extend with schema commit-back job
  - `.github/workflows/release.yml:19-23` — example of `contents: write` permission block

  **API/Type References**:
  - `src/config.ts:60` — `SCHEMA_URL` constant (change this string)
  - `src/config.ts:62-84` — `BOOTSTRAP_CONTENT` template (uses `SCHEMA_URL` interpolation)

  **Test References**:
  - `src/config.test.ts:78-83` — "bootstrapped file contains $schema field" test (update assertion on line 82)

  **External References**:
  - `script/generate-schema.ts` — the schema generation script (no changes needed, just run it)

  **Acceptance Criteria**:

  - [ ] `.github/workflows/pages.yml` does not exist
  - [ ] `schema.json` exists at repo root and is tracked by git
  - [ ] `grep -r "mspiegel31.github.io" src/ README.md` returns zero results
  - [ ] `npm run generate-schema` succeeds
  - [ ] `npm test` passes (config.test.ts assertion updated)
  - [ ] CI workflow YAML is valid (`python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` or equivalent)

  **QA Scenarios**:

  ```
  Scenario: Schema generation produces valid JSON
    Tool: Bash
    Preconditions: Dependencies installed via npm ci
    Steps:
      1. Run `npm run generate-schema`
      2. Run `node -e "JSON.parse(require('fs').readFileSync('schema.json','utf8'))"` — must exit 0
      3. Run `grep '"type"' schema.json` — must contain JSON Schema type keywords
    Expected Result: schema.json is valid JSON with JSON Schema structure
    Failure Indicators: Non-zero exit code, parse error, empty file
    Evidence: .sisyphus/evidence/task-1-schema-valid.txt

  Scenario: No references to old GitHub Pages URL remain
    Tool: Bash
    Preconditions: URL updates applied
    Steps:
      1. Run `grep -r "mspiegel31.github.io" src/ README.md .github/`
      2. Assert: zero matches
    Expected Result: Command returns exit code 1 (no matches)
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-1-no-old-url.txt

  Scenario: Tests pass with updated schema URL
    Tool: Bash
    Preconditions: All URL references updated
    Steps:
      1. Run `npm test -- --reporter=verbose 2>&1`
      2. Assert: "bootstrapped file contains $schema field" test passes
    Expected Result: All tests pass, zero failures
    Failure Indicators: Test failure mentioning "mspiegel31.github.io"
    Evidence: .sisyphus/evidence/task-1-tests-pass.txt
  ```

  **Commit**: YES
  - Message: `fix(ci): migrate schema publishing from GitHub Pages to raw GitHub commit-back`
  - Files: `.github/workflows/pages.yml` (deleted), `.github/workflows/ci.yml`, `.gitignore`, `src/config.ts`, `src/config.test.ts`, `README.md`, `schema.json`
  - Pre-commit: `npm test`

- [x] 2. Shared Color Constants + Green Contrast Fix (Fix 3)

  **What to do**:
  - Create a shared color constants object (e.g., in `src/lib/plugin-base.ts` or a new `src/lib/colors.ts` — prefer adding to `plugin-base.ts` to avoid a new file for 5 constants)
  - Define semantic color constants: `Done`, `Working`, `Waiting`, `Question`, `Error` with hex values
  - Replace `#6BCB77` (green/done) with a darker, higher-contrast green that reads well on both light and dark backgrounds. Recommendation: `#2E8B57` (SeaGreen) or `#059669` (Emerald 600) — both have WCAG AA contrast on white
  - Update `cmux-notify.ts:62-77` — replace inline hex strings with shared constants for all 4 sidebar states (Working `#f59e0b`, Waiting `#ef4444`, Question `#a855f7`, Done `#6BCB77`→new)
  - Update `cmux-subagent-viewer.ts:28-32` — replace `STATUS_CONFIG` hex values with shared constants (Running `#FFD93D`, Done `#6BCB77`→new, Error `#FF6B6B`)
  - Note: The two files use different reds (`#ef4444` vs `#FF6B6B`) and different yellows (`#f59e0b` vs `#FFD93D`) — this is intentional (sidebar vs status bar contexts). Preserve the distinction but extract both sets.

  **Must NOT do**:
  - Do not create a separate `colors.ts` file if it only has 7 constants — keep it in `plugin-base.ts`
  - Do not change the semantic meaning of any color (working=amber, waiting=red, done=green, question=purple, error=red)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/cmux-notify.ts:60-83` — four `sidebarSet*` methods with inline hex colors
  - `src/cmux-subagent-viewer.ts:28-32` — `STATUS_CONFIG` object with 3 color entries

  **WHY Each Reference Matters**:
  - `cmux-notify.ts` sidebar methods: These are the 4 places that need to import the shared constant instead of hardcoding hex
  - `cmux-subagent-viewer.ts` STATUS_CONFIG: Same pattern, different context (subagent pane status vs main session sidebar)

  **Acceptance Criteria**:

  - [ ] `grep -rn "#6BCB77" src/` returns zero results (old green removed)
  - [ ] New green hex value passes WCAG AA contrast check against white (#fff)
  - [ ] `npm run typecheck` passes
  - [ ] `npm test` passes
  - [ ] Both `cmux-notify.ts` and `cmux-subagent-viewer.ts` import from shared location

  **QA Scenarios**:

  ```
  Scenario: No hardcoded green hex remains
    Tool: Bash
    Preconditions: Color constant extraction complete
    Steps:
      1. Run `grep -rn "#6BCB77" src/`
      2. Assert: zero matches (exit code 1)
    Expected Result: Old green hex completely replaced
    Failure Indicators: Any match in any source file
    Evidence: .sisyphus/evidence/task-2-no-old-green.txt

  Scenario: Build and tests pass after color refactor
    Tool: Bash
    Preconditions: Shared constants created, imports updated
    Steps:
      1. Run `npm run typecheck`
      2. Run `npm test`
    Expected Result: Zero errors, all tests pass
    Failure Indicators: Import errors, type errors, test failures
    Evidence: .sisyphus/evidence/task-2-build-tests.txt
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `fix(ui): improve done-state color contrast and extract shared color constants`
  - Files: `src/lib/plugin-base.ts`, `src/cmux-notify.ts`, `src/cmux-subagent-viewer.ts`
  - Pre-commit: `npm test`

- [x] 3. Agent Done Full Title in Logs (Fix 4)

  **What to do**:
  - In `src/cmux-subagent-viewer.ts`, add a `fullTitle` field to the `PaneInfo` type (line 36-41)
  - In `createPane()` (line 98-133): store `title` as `fullTitle` and `shortTitle` as `title` in PaneInfo — or better, rename `title` to `shortTitle` and add `fullTitle`
  - In `closePane()` line 146: change `pane.title` to `pane.fullTitle` in the `cmux log` message so the log shows the untruncated session title
  - Keep `pane.shortTitle` (or `pane.title`) for `cmux rename-tab` (line 119) — tabs have real width constraints
  - In `createPane()` line 131: the `cmux log -- "Viewer opened: ..."` message should also use `fullTitle`

  **Must NOT do**:
  - Do not change the 40-char truncation logic for tab labels — that's correct for tab width
  - Do not change `closePane`'s `cmux set-status` call (line 145) — status bar text is fine as-is

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/cmux-subagent-viewer.ts:36-41` — `PaneInfo` type definition
  - `src/cmux-subagent-viewer.ts:115` — `shortTitle` derivation with 40-char truncation
  - `src/cmux-subagent-viewer.ts:129` — PaneInfo construction (stores `shortTitle` as `title`)
  - `src/cmux-subagent-viewer.ts:131` — `cmux log` in createPane (uses truncated title)
  - `src/cmux-subagent-viewer.ts:146` — `cmux log` in closePane (uses truncated `pane.title`)

  **Acceptance Criteria**:

  - [ ] `PaneInfo` type has both `fullTitle` and a short title field
  - [ ] `cmux log` calls use full title, `cmux rename-tab` uses short title
  - [ ] `npm run typecheck` passes
  - [ ] `npm test` passes

  **QA Scenarios**:

  ```
  Scenario: PaneInfo preserves full title
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `grep -n "fullTitle" src/cmux-subagent-viewer.ts`
      2. Assert: fullTitle appears in PaneInfo type and in createPane assignment
      3. Run `grep -n "cmux log" src/cmux-subagent-viewer.ts`
      4. Assert: both log lines reference fullTitle, not shortTitle
    Expected Result: Full title used in logs, short title used in tabs
    Failure Indicators: Log lines still using truncated title
    Evidence: .sisyphus/evidence/task-3-full-title.txt

  Scenario: Type check and tests pass
    Tool: Bash
    Steps:
      1. Run `npm run typecheck && npm test`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-3-typecheck.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `fix(ui): improve done-state color contrast and preserve full titles in logs`
  - Files: `src/cmux-subagent-viewer.ts`
  - Pre-commit: `npm test`

- [x] 4. Browser Tools Config + Scaffold + Surface Manager (Feature 1 Foundation)

  **What to do**:
  - Add `cmuxBrowserTools` section to `ConfigSchema` in `src/config.ts`:
    ```typescript
    const BrowserToolsSchema = z.object({
      enabled: z.boolean().default(true),
    }).default(() => ({ enabled: true }))
    ```
  - Add `cmuxBrowserTools: BrowserToolsSchema` to `ConfigSchema`
  - Add JSONC comment block to `BOOTSTRAP_CONTENT` template
  - Add env override `CMUX_BROWSER_TOOLS_ENABLED` in `applyEnvOverrides()`
  - Create `src/cmux-browser-tools.ts` with:
    - `CmuxBrowserToolsPlugin extends PluginBase`
    - `hooks(): Hooks` returning `{ tool: {} }` (tools added in Tasks 6-9)
    - Plugin factory export: `export const CmuxBrowserTools: Plugin = async (ctx) => { ... }`
    - Guard: return `{}` if `CMUX_WORKSPACE_ID` not set or `config.cmuxBrowserTools.enabled` is false
    - **Capability check**: try `cmux browser --help` during init — if it fails, return `{}` (cmux version doesn't support browser)
  - Implement surface lifecycle management:
    - `private surfaceId: string | null = null`
    - `private async ensureSurface(url?: string): Promise<string>` — if surfaceId is null, call `cmux browser open [url]` (default `about:blank`), parse surface ID from output using regex `/surface:(\d+)/`, store it. If surface already exists, try a simple command; if it fails, set surfaceId=null and re-create.
    - Dead surface detection: one command attempt, if fail → null → re-create. No retry loops, no health polling.
  - Do NOT add tools yet — that's Tasks 6-9
  - Do NOT export from `index.ts` yet — that's Task 10

  **Must NOT do**:
  - Do not implement any browser tools in this task
  - Do not modify `index.ts` exports
  - Do not add complex surface recovery logic — keep it simple

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Config + scaffold + surface lifecycle in one coherent unit
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 6, 7, 8, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/config.ts:31-33` — `SubagentViewerSchema` pattern (copy for BrowserToolsSchema)
  - `src/config.ts:95-109` — `applyEnvOverrides()` pattern
  - `src/config.ts:62-84` — `BOOTSTRAP_CONTENT` template
  - `src/cmux-subagent-viewer.ts:177-184` — Plugin factory with guards
  - `src/cmux-subagent-viewer.ts:98-133` — `createPane()` showing surface creation + parsing
  - `src/cmux-subagent-viewer.ts:167-170` — `parseSurface()` regex: `text.match(/surface:(\d+)/)`

  **API/Type References**:
  - `src/lib/plugin-base.ts:141-149` — `PluginBase` abstract class
  - `node_modules/@opencode-ai/plugin/dist/tool.d.ts` — `tool()` function signature

  **Acceptance Criteria**:

  - [ ] `ConfigSchema.parse({}).cmuxBrowserTools.enabled === true`
  - [ ] `src/cmux-browser-tools.ts` exists with class, factory, guards, and surface manager
  - [ ] `ensureSurface()` returns a surface ID string
  - [ ] Plugin returns `{}` when `CMUX_WORKSPACE_ID` is not set
  - [ ] Plugin returns `{}` when `cmux browser --help` fails
  - [ ] `npm run typecheck` passes
  - [ ] `npm test` passes

  **QA Scenarios**:

  ```
  Scenario: Config schema accepts new section
    Tool: Bash
    Steps:
      1. Run `npm run build`
      2. Run `node -e "const {ConfigSchema} = require('./dist/config.js'); console.log(JSON.stringify(ConfigSchema.parse({})))"`
      3. Assert output contains `"cmuxBrowserTools":{"enabled":true}`
    Expected Result: New config section parsed with default
    Evidence: .sisyphus/evidence/task-4-config-schema.txt

  Scenario: Plugin scaffold compiles with surface manager
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `grep -n "ensureSurface" src/cmux-browser-tools.ts`
      3. Assert: method exists
    Expected Result: Types pass, surface manager defined
    Evidence: .sisyphus/evidence/task-4-scaffold.txt
  ```

  **Commit**: YES
  - Message: `feat(browser): scaffold browser tools plugin with config and surface manager`
  - Files: `src/config.ts`, `src/cmux-browser-tools.ts`
  - Pre-commit: `npm run typecheck && npm test`

- [x] 5. Notification Focus-Gating Implementation (Fix 2)

  **What to do**:
  - Implement focus detection in `src/cmux-notify.ts` using `cmux identify` (confirmed by Metis to return JSON with `caller.surface_ref` and `focused.surface_ref`)
  - Add `notify.onlyWhenUnfocused: boolean` (default `true`) to `NotifySchema` in `src/config.ts`
  - Add the field to `BOOTSTRAP_CONTENT` with a JSONC comment
  - Create a private method `private async isSurfaceFocused(): Promise<boolean>` that:
    1. Calls `cmux identify` and parses the JSON output
    2. Compares `focused.surface_ref` against `CMUX_SURFACE_ID` env var
    3. Returns `true` if they match (user is looking at the opencode surface)
    4. On ANY error (command fails, invalid JSON, missing field): returns `false` (fail-open — send notification when uncertain)
  - At each of the 5 notification sites in `cmux-notify.ts` (lines 124-125, 136-137, 149, 160-161, 205-206), add a focus check: `if (this.config.notify.onlyWhenUnfocused && await this.isSurfaceFocused()) return`
  - Place the focus check AFTER the `isSubagent()` guard and config flag check, BEFORE the `cmux notify` call

  **Must NOT do**:
  - Do not add focus checks to sidebar status updates (only to `cmux notify` calls)
  - Do not change the existing `isSubagent()` behavior
  - Do not poll for focus — check once per notification event

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Focus detection has platform-specific edge cases
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (parallel with Tasks 6-9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None (research spike eliminated — `cmux identify` confirmed)

  **References**:

  **Pattern References**:
  - `src/cmux-notify.ts:47-54` — `isSubagent()` method pattern (similar guard, async, returns boolean)
  - `src/cmux-notify.ts:108-172` — `typedHandlers` where notification sites live
  - `src/cmux-notify.ts:179-223` — `extraHandlers` with remaining notification sites

  **API/Type References**:
  - `src/config.ts:20-25` — `NotifySchema` where new field goes
  - `cmux identify` — returns JSON: `{ "caller": { "surface_ref": "..." }, "focused": { "surface_ref": "..." } }`

  **Acceptance Criteria**:

  - [ ] `config.notify.onlyWhenUnfocused` exists with default `true`
  - [ ] When surface is focused: `cmux notify` calls are suppressed
  - [ ] When surface is NOT focused: `cmux notify` calls fire normally
  - [ ] Sidebar status updates (`cmux set-status`) are NOT affected by focus state
  - [ ] `npm test` passes

  **QA Scenarios**:

  ```
  Scenario: Config schema accepts new onlyWhenUnfocused field
    Tool: Bash
    Steps:
      1. Run `node -e "const {ConfigSchema} = require('./dist/config.js'); const c = ConfigSchema.parse({}); console.log(c.notify.onlyWhenUnfocused)"`
      2. Assert: output is `true`
    Expected Result: Field exists with default true
    Evidence: .sisyphus/evidence/task-7-config-field.txt

  Scenario: Focus check method exists and is callable
    Tool: Bash
    Steps:
      1. Run `grep -n "isSurfaceFocused" src/cmux-notify.ts`
      2. Assert: method defined as `private async isSurfaceFocused(): Promise<boolean>`
      3. Run `npm run typecheck`
    Expected Result: Method compiles, returns boolean
    Evidence: .sisyphus/evidence/task-7-focus-method.txt
  ```

  **Commit**: YES
  - Message: `feat(notify): add focus-aware notification gating`
  - Files: `src/config.ts`, `src/cmux-notify.ts`
  - Pre-commit: `npm test`

- [x] 6. Core Navigation + Snapshot Tools (Feature 1)

  **What to do**:
  - In `src/cmux-browser-tools.ts`, implement these tools using `tool()` from `@opencode-ai/plugin`:
  - **`browser_navigate`**: Wraps `cmux browser goto <url>`, `back`, `forward`, `reload`. Args: `{ type: "url"|"back"|"forward"|"reload", url?: string }`. Appends `--snapshot-after`. For `type: "url"`, calls `ensureSurface()` first (creates browser if none exists). Pass `--surface <id>` to all commands.
  - **`browser_snapshot`**: Wraps `cmux browser snapshot`. Args: `{ interactive?: boolean, compact?: boolean, maxDepth?: number, selector?: string }`. Maps to `--interactive`, `--compact`, `--max-depth`, `--selector` flags.
  - **`browser_screenshot`**: Wraps `cmux browser screenshot`. Args: `{ filePath?: string }`. If no path, use a temp path and return the image data. Pass `--out <path>`.
  - **`browser_find`**: Wraps `cmux browser find`. Args: `{ by: "role"|"text"|"label"|"placeholder"|"alt"|"title"|"testid"|"first"|"last"|"nth", value: string, index?: number }`. This is the PRIMARY element targeting tool — emphasize this in the description.
  - **`browser_url`**: Wraps `cmux browser url`. No args. Returns current page URL.
  - All tools call `ensureSurface()` before executing and pass `--surface <surfaceId>`.
  - All action tools (navigate) append `--snapshot-after` and return action result + snapshot delimited by `\n\n--- Page Snapshot ---\n`.
  - Tool descriptions should be clear and actionable — the AI reads these to decide which tool to use.

  **Must NOT do**:
  - Do not implement DOM interaction tools (Task 9)
  - Do not implement page management tools (Task 10)
  - Do not add uid-based targeting — use CSS selectors and `find` locators

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core tools define the pattern all other tools follow — needs careful design
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (sequential with Tasks 7, 8, 9 — same file)
  - **Blocks**: Tasks 7, 10, 11
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/cmux-browser-tools.ts` — plugin scaffold from Task 5/6 (add tools to the `tool: {}` object in `hooks()`)

  **API/Type References**:
  - `node_modules/@opencode-ai/plugin/dist/tool.d.ts` — `tool()` function: `tool({ description, args, execute })`
  - `tool.schema` is a re-export of `zod` — args are Zod shapes

  **External References**:
  - cmux browser CLI: `goto <url> [--snapshot-after]`, `back [--snapshot-after]`, `forward [--snapshot-after]`, `reload [--snapshot-after]`
  - cmux browser CLI: `snapshot [--interactive] [--compact] [--max-depth <n>] [--selector <css>]`
  - cmux browser CLI: `screenshot [--out <path>]`
  - cmux browser CLI: `find <role|text|label|placeholder|alt|title|testid|first|last|nth> [value]`
  - cmux browser CLI: `url` (returns current URL)

  **Acceptance Criteria**:

  - [ ] 5 tools registered: `browser_navigate`, `browser_snapshot`, `browser_screenshot`, `browser_find`, `browser_url`
  - [ ] Each tool has a clear description string
  - [ ] Each tool calls `ensureSurface()` and passes `--surface`
  - [ ] `browser_navigate` appends `--snapshot-after`
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Navigation tools compile and register
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `npm run build`
      3. Run `grep -c "browser_navigate\|browser_snapshot\|browser_screenshot\|browser_find\|browser_url" src/cmux-browser-tools.ts`
      4. Assert: count >= 5 (each tool name appears at least once)
    Expected Result: All 5 tools defined, code compiles
    Evidence: .sisyphus/evidence/task-8-nav-tools.txt

  Scenario: snapshot-after pattern present in navigate
    Tool: Bash
    Steps:
      1. Run `grep "snapshot-after" src/cmux-browser-tools.ts`
      2. Assert: at least one match in navigate-related code
    Expected Result: --snapshot-after appended to navigation commands
    Evidence: .sisyphus/evidence/task-8-snapshot-after.txt
  ```

  **Commit**: YES (groups with Tasks 9-11)
  - Message: `feat(browser): implement core browser tools (navigate, snapshot, find, screenshot)`
  - Files: `src/cmux-browser-tools.ts`
  - Pre-commit: `npm run typecheck`

- [x] 7. DOM Interaction Tools (Feature 1)

  **What to do**:
  - Add these tools to `src/cmux-browser-tools.ts`:
  - **`browser_click`**: Wraps `cmux browser click --selector <css> [--snapshot-after]`. Args: `{ selector: string, doubleClick?: boolean }`. Use `dblclick` subcommand if `doubleClick` is true.
  - **`browser_hover`**: Wraps `cmux browser hover --selector <css> [--snapshot-after]`. Args: `{ selector: string }`.
  - **`browser_fill`**: Wraps `cmux browser fill --selector <css> --text <text> [--snapshot-after]`. Args: `{ selector: string, value: string }`. For select elements, this also works.
  - **`browser_type`**: Wraps `cmux browser type --text <text> [--snapshot-after]`. Args: `{ text: string, submitKey?: string }`. Types into currently focused input. If `submitKey` provided, follow with `cmux browser press --key <key>`.
  - **`browser_press_key`**: Wraps `cmux browser press --key <key> [--snapshot-after]`. Args: `{ key: string }`.
  - **`browser_select`**: Wraps `cmux browser select --selector <css> --value <value> [--snapshot-after]`. Args: `{ selector: string, value: string }`.
  - **`browser_scroll`**: Wraps `cmux browser scroll [--selector <css>] [--dx <n>] [--dy <n>] [--snapshot-after]`. Args: `{ selector?: string, deltaX?: number, deltaY?: number }`.
  - All action tools append `--snapshot-after` and return result + snapshot with delimiter.
  - All tools call `ensureSurface()` and pass `--surface <id>`.

  **Must NOT do**:
  - Do not implement `drag` (not supported by cmux CLI — documented gap)
  - Do not implement `upload_file` (not in cmux CLI — documented gap)
  - Do not implement `fill_form` batch (deferred to follow-up)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (sequential after Task 6 — same file)
  - **Blocks**: Tasks 8, 10, 11
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - Task 8's tools — follow the same pattern (ensureSurface → build command → execute → parse result + snapshot)

  **External References**:
  - cmux browser CLI: `click [--selector <css>] [--snapshot-after]`
  - cmux browser CLI: `dblclick [--selector <css>] [--snapshot-after]`
  - cmux browser CLI: `hover [--selector <css>] [--snapshot-after]`
  - cmux browser CLI: `fill [--selector <css>] [--text <text>] [--snapshot-after]`
  - cmux browser CLI: `type [--text <text>] [--snapshot-after]`
  - cmux browser CLI: `press [--key <key>] [--snapshot-after]`
  - cmux browser CLI: `select [--selector <css>] [--value <value>] [--snapshot-after]`
  - cmux browser CLI: `scroll [--selector <css>] [--dx <n>] [--dy <n>] [--snapshot-after]`

  **Acceptance Criteria**:

  - [ ] 7 tools registered: `browser_click`, `browser_hover`, `browser_fill`, `browser_type`, `browser_press_key`, `browser_select`, `browser_scroll`
  - [ ] All tools append `--snapshot-after`
  - [ ] `browser_click` supports `doubleClick` flag
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: DOM tools compile
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `grep -c "browser_click\|browser_hover\|browser_fill\|browser_type\|browser_press_key\|browser_select\|browser_scroll" src/cmux-browser-tools.ts`
      3. Assert: count >= 7
    Expected Result: All 7 tools defined, types pass
    Evidence: .sisyphus/evidence/task-9-dom-tools.txt
  ```

  **Commit**: YES (groups with Tasks 8, 10, 11)
  - Message: `feat(browser): implement DOM interaction tools (click, fill, type, hover, scroll)`
  - Files: `src/cmux-browser-tools.ts`
  - Pre-commit: `npm run typecheck`

- [x] 8. Page Management + Waiting Tools (Feature 1)

  **What to do**:
  - Add these tools to `src/cmux-browser-tools.ts`:
  - **`browser_new_page`**: Wraps `cmux browser tab new [url]`. Args: `{ url?: string }`. Opens new tab in existing browser surface.
  - **`browser_close_page`**: Wraps `cmux browser tab close`. Args: `{ tabIndex?: number }`.
  - **`browser_list_pages`**: Wraps `cmux browser tab list`. No args. Returns tab list.
  - **`browser_select_page`**: Wraps `cmux browser tab switch <index>`. Args: `{ tabIndex: number }`.
  - **`browser_resize`**: Wraps `cmux browser viewport <width> <height>`. Args: `{ width: number, height: number }`.
  - **`browser_wait_for`**: Wraps `cmux browser wait`. Args: `{ selector?: string, text?: string, urlContains?: string, timeoutMs?: number }`. At least one of selector/text/urlContains required. Maps to `--selector`, `--text`, `--url-contains`, `--timeout-ms`.
  - **`browser_handle_dialog`**: Wraps `cmux browser dialog <accept|dismiss> [text]`. Args: `{ action: "accept"|"dismiss", promptText?: string }`.
  - All tools call `ensureSurface()` and pass `--surface <id>`.

  **Must NOT do**:
  - Do not implement `browser_open` (new surface) — we manage surfaces internally via `ensureSurface()`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (sequential after Task 7 — same file)
  - **Blocks**: Tasks 9, 10, 11
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - Task 8's tools — same pattern

  **External References**:
  - cmux browser CLI: `tab new [url]`, `tab close`, `tab list`, `tab switch <index>`
  - cmux browser CLI: `viewport <width> <height>`
  - cmux browser CLI: `wait [--selector <css>] [--text <text>] [--url-contains <text>] [--timeout-ms <ms>]`
  - cmux browser CLI: `dialog <accept|dismiss> [text]`

  **Acceptance Criteria**:

  - [ ] 7 tools registered: `browser_new_page`, `browser_close_page`, `browser_list_pages`, `browser_select_page`, `browser_resize`, `browser_wait_for`, `browser_handle_dialog`
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Page management tools compile
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `grep -c "browser_new_page\|browser_close_page\|browser_list_pages\|browser_select_page\|browser_resize\|browser_wait_for\|browser_handle_dialog" src/cmux-browser-tools.ts`
      3. Assert: count >= 7
    Expected Result: All 7 tools defined, types pass
    Evidence: .sisyphus/evidence/task-10-page-tools.txt
  ```

  **Commit**: YES (groups with Tasks 8, 9, 11)
  - Message: `feat(browser): implement page management and waiting tools`
  - Files: `src/cmux-browser-tools.ts`
  - Pre-commit: `npm run typecheck`

- [x] 9. Console, Network, Eval, and Emulation Tools (Feature 1)

  **What to do**:
  - Add these tools to `src/cmux-browser-tools.ts`:
  - **`browser_console_messages`**: Wraps `cmux browser console list`. No args. Returns console messages.
  - **`browser_network_requests`**: Wraps `cmux browser network requests`. No args. Returns network log.
  - **`browser_evaluate`**: Wraps `cmux browser eval --script <js>`. Args: `{ script: string }`. Returns eval result.
  - **`browser_emulate`**: Combines multiple cmux commands. Args: `{ geolocation?: { lat: number, lng: number }, offline?: boolean }`. Calls `cmux browser geolocation <lat> <lng>` and/or `cmux browser offline <true|false>`.
  - **`browser_get`**: Wraps `cmux browser get <property>`. Args: `{ property: "url"|"title"|"text"|"html"|"value"|"attr"|"count"|"box"|"styles", selector?: string, attribute?: string }`. Powerful element property extraction.
  - **`browser_is`**: Wraps `cmux browser is <state>`. Args: `{ state: "visible"|"enabled"|"checked", selector: string }`. Element state assertions.
  - All tools call `ensureSurface()` and pass `--surface <id>`.

  **Must NOT do**:
  - Do not implement `performance_start_trace` / `performance_stop_trace` (low priority, add later if needed)
  - Do not implement `lighthouse_audit` or `take_memory_snapshot` (Chrome-specific, accepted gap)
  - Do not implement cookie/storage tools (defer to follow-up)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (sequential after Task 8 — same file)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Task 8

  **References**:

  **External References**:
  - cmux browser CLI: `console list`, `network requests`
  - cmux browser CLI: `eval [--script <js>]`
  - cmux browser CLI: `geolocation <lat> <lng>`, `offline <true|false>`
  - cmux browser CLI: `get <url|title|text|html|value|attr|count|box|styles> [--selector <css>]`
  - cmux browser CLI: `is <visible|enabled|checked> [--selector <css>]`

  **Acceptance Criteria**:

  - [ ] 6 tools registered: `browser_console_messages`, `browser_network_requests`, `browser_evaluate`, `browser_emulate`, `browser_get`, `browser_is`
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:

  ```
  Scenario: Utility tools compile
    Tool: Bash
    Steps:
      1. Run `npm run typecheck`
      2. Run `npm run build`
    Expected Result: Zero errors
    Evidence: .sisyphus/evidence/task-11-utility-tools.txt
  ```

  **Commit**: YES (groups with Tasks 8, 9, 10)
  - Message: `feat(browser): implement console, network, eval, and emulation tools`
  - Files: `src/cmux-browser-tools.ts`
  - Pre-commit: `npm run typecheck`

- [x] 10. Browser Tools Export Wiring + README Update (Feature 1)

  **What to do**:
  - Add export to `src/index.ts`: `export { CmuxBrowserTools } from "./cmux-browser-tools.js"`
  - Update `README.md`:
    - Add `CmuxBrowserTools` section under Reference → Plugins
    - Document what it does (wraps cmux browser CLI as AI tools)
    - Document config option: `cmuxBrowserTools.enabled`
    - Note: replaces chrome-devtools-mcp when running inside cmux
    - Update the example config block to include `cmuxBrowserTools` section
  - Update schema URL in README if not already done by Task 1
  - Regenerate `schema.json` (run `npm run generate-schema`) since config schema changed in Task 5

  **Must NOT do**:
  - Do not list every individual tool in the README (too verbose, changes frequently)
  - Do not mention chrome-devtools-mcp tool name mapping (implementation detail)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 9

  **References**:

  **Pattern References**:
  - `src/index.ts` — existing exports (2 lines, add 1 more)
  - `README.md` — existing plugin reference sections (CmuxPlugin, CmuxSubagentViewer)

  **Acceptance Criteria**:

  - [ ] `src/index.ts` exports `CmuxBrowserTools`
  - [ ] `README.md` has CmuxBrowserTools section
  - [ ] `schema.json` regenerated with `cmuxBrowserTools` section
  - [ ] `npm run build` succeeds (export resolves)

  **QA Scenarios**:

  ```
  Scenario: Export wiring works
    Tool: Bash
    Steps:
      1. Run `npm run build`
      2. Run `node -e "const m = require('./dist/index.js'); console.log(typeof m.CmuxBrowserTools)"`
      3. Assert: output is "function"
    Expected Result: Plugin factory exported and callable
    Evidence: .sisyphus/evidence/task-12-export.txt

  Scenario: Schema includes new config section
    Tool: Bash
    Steps:
      1. Run `npm run generate-schema`
      2. Run `grep "cmuxBrowserTools" schema.json`
      3. Assert: at least one match
    Expected Result: Schema reflects new config section
    Evidence: .sisyphus/evidence/task-12-schema.txt
  ```

  **Commit**: YES
  - Message: `feat(browser): wire exports, update README, regenerate schema`
  - Files: `src/index.ts`, `README.md`, `schema.json`
  - Pre-commit: `npm run build && npm test`

- [x] 11. Browser Tools Tests (Feature 1)

  **What to do**:
  - Create `src/cmux-browser-tools.test.ts`
  - Follow the testing pattern from `cmux-notify.test.ts`:
    - `makeMockCtx()` helper that mocks `this.$` (Bun shell) to capture shell commands
    - Track all shell invocations in a `shellCalls: string[]` array
    - Use `parseConfig()` for test config
  - Test categories:
    1. **Plugin structure**: class can be instantiated, hooks() returns tool map
    2. **Tool registration**: verify all expected tool keys exist in the hooks `tool` object
    3. **Command construction**: for each tool, call its `execute()` with mock args and verify the shell command string is correctly constructed (correct subcommand, correct flags, `--surface <id>` present, `--snapshot-after` present for action tools)
    4. **Surface management**: verify `ensureSurface()` is called, surface ID is cached, dead surface triggers re-creation
    5. **Guard behavior**: verify plugin returns `{}` when `CMUX_WORKSPACE_ID` is not set or `config.cmuxBrowserTools.enabled` is false
  - Do NOT test against a real cmux instance — mock all shell calls

  **Must NOT do**:
  - Do not write integration tests requiring a real cmux session
  - Do not test cmux CLI output parsing (that's cmux's responsibility)
  - Do not duplicate existing config tests from `config.test.ts`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive test suite for 25+ tools requires careful structure
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 12)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 9

  **References**:

  **Pattern References**:
  - `src/cmux-notify.test.ts:15-36` — `makeMockCtx()` pattern for mocking PluginInput
  - `src/cmux-notify.test.ts:87-115` — `beforeEach` with shell call tracking via Proxy
  - `src/cmux-notify.test.ts:117-127` — Example test asserting specific shell command content

  **Test References**:
  - `src/config.test.ts:7-38` — ConfigSchema test pattern (verify new cmuxBrowserTools field)

  **Acceptance Criteria**:

  - [ ] `src/cmux-browser-tools.test.ts` exists
  - [ ] Tests cover: structure, tool registration, command construction for at least 5 tools, surface management, guard behavior
  - [ ] `npm test` passes with new test file included
  - [ ] Test count increases by at least 10

  **QA Scenarios**:

  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- --reporter=verbose 2>&1`
      2. Assert: zero failures
      3. Count test cases in output
    Expected Result: All tests pass, at least 10 new test cases
    Evidence: .sisyphus/evidence/task-13-tests.txt
  ```

  **Commit**: YES
  - Message: `test(browser): add unit tests for browser tools plugin`
  - Files: `src/cmux-browser-tools.test.ts`
  - Pre-commit: `npm test`

- [x] 12. Notification Focus-Gating Tests (Fix 2)

  **What to do**:
  - Add tests to `src/cmux-notify.test.ts` in a new describe block: `"CmuxNotifyPlugin — focus-gating"`
  - Test cases:
    1. When `onlyWhenUnfocused: true` and surface IS focused → `cmux notify` is NOT called
    2. When `onlyWhenUnfocused: true` and surface is NOT focused → `cmux notify` IS called
    3. When `onlyWhenUnfocused: false` → `cmux notify` fires regardless of focus state
    4. Sidebar status updates (`cmux set-status`) are NOT affected by focus state (still fire when focused)
    5. Focus check only applies to notification sites, not to permission/question state tracking
  - Mock the focus detection: either mock the shell call that checks focus, or inject the focus check as a testable method
  - Follow existing test patterns: use `shellCalls` tracking, `makeEvent()`, `makeMockCtx()`

  **Must NOT do**:
  - Do not modify existing passing tests
  - Do not test against real cmux focus state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/cmux-notify.test.ts:87-115` — existing dispatch test setup pattern
  - `src/cmux-notify.test.ts:129-139` — Test 2 pattern: SessionStatus idle triggers notify + sidebar

  **Acceptance Criteria**:

  - [ ] At least 5 new test cases for focus-gating
  - [ ] Tests verify focus suppresses notifications but not sidebar
  - [ ] `npm test` passes

  **QA Scenarios**:

  ```
  Scenario: Focus-gating tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- --reporter=verbose 2>&1 | grep -i "focus"`
      2. Assert: multiple focus-related test names appear
      3. Assert: all pass
    Expected Result: Focus-gating test block visible, all passing
    Evidence: .sisyphus/evidence/task-14-focus-tests.txt
  ```

  **Commit**: YES
  - Message: `test(notify): add focus-gating unit tests`
  - Files: `src/cmux-notify.test.ts`
  - Pre-commit: `npm test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Order | Message | Files |
|-------|---------|-------|
| 1 | `fix(ci): migrate schema publishing from GitHub Pages to raw GitHub commit-back` | `.github/workflows/`, `.gitignore`, `src/config.ts`, `src/config.test.ts`, `README.md`, `schema.json` |
| 2 | `fix(ui): improve done-state color contrast and preserve full titles in logs` | `src/lib/plugin-base.ts`, `src/cmux-notify.ts`, `src/cmux-subagent-viewer.ts` |
| 3 | `feat(browser): scaffold browser tools plugin with config and surface manager` | `src/config.ts`, `src/cmux-browser-tools.ts` |
| 4 | `feat(notify): add focus-aware notification gating` | `src/config.ts`, `src/cmux-notify.ts` |
| 5 | `feat(browser): implement browser tools (navigate, DOM, pages, utilities)` | `src/cmux-browser-tools.ts` |
| 6 | `feat(browser): wire exports, update README, regenerate schema` | `src/index.ts`, `README.md`, `schema.json` |
| 7 | `test(browser): add browser tools unit tests` | `src/cmux-browser-tools.test.ts` |
| 8 | `test(notify): add focus-gating unit tests` | `src/cmux-notify.test.ts` |

> **CI commit-back message** (Task 1 workflow): Use `chore: regenerate schema.json` — `chore:` prefix does NOT trigger semantic-release.

---

## Success Criteria

### Verification Commands
```bash
npm run typecheck   # Expected: no errors
npm run build       # Expected: clean build
npm test            # Expected: all tests pass
npm run generate-schema  # Expected: schema.json generated
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Schema URL updated in config.ts, config.test.ts, README.md
- [ ] GitHub Pages workflow deleted
- [ ] Browser tools plugin exports from index.ts
- [ ] New config options documented in bootstrap template
