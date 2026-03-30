# Phase 6: Schema Hosting — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Adds JSON Schema generation and GitHub Pages hosting:
1. `script/generate-schema.ts` — imports `ConfigSchema` from `src/config.ts`, runs `zodToJsonSchema()`, writes `schema.json`
2. `npm run generate-schema` script in `package.json`
3. `.github/workflows/pages.yml` — triggers on push to main, runs build + generate-schema, deploys `schema.json` to GitHub Pages
4. `schema.json` added to `.gitignore` — never committed, lives only in Pages deployment
5. One-time manual prerequisite: enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions

Does NOT include: config changes (done), event handler changes (done).

</domain>

<decisions>
## Implementation Decisions

### Infrastructure — Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

### Key confirmed facts (from opencode source analysis)
- opencode uses `zod-to-json-schema@3.24.5` with `zodToJsonSchema(ConfigSchema, { name: "...", io: "input", additionalProperties: false })`
- `io: "input"` treats optional().default() fields as not required in the schema
- The build script runs `schema.ts` after the website build to emit the schema to the public output
- Our approach: separate `script/generate-schema.ts`, run via `tsx`, outputs `schema.json` to project root
- Schema URL: `https://mspiegel31.github.io/opencode-cmux/schema.json`

### CI approach
- Trigger: push to `main` (every merge, not just tags)
- No commit-back — schema lives only in the Pages artifact
- `cancel-in-progress: false` on pages concurrency group (never cancel mid-deploy)
- Pages environment required: `name: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`
- Actions: `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`

### tsx vs compiled import
- Use `tsx` to run `script/generate-schema.ts` directly — avoids needing to run `npm run build` first
- Add `tsx` as devDependency
- Import from `src/config.ts` directly (not `dist/`) when using tsx

### schema.json gitignore
- Add `schema.json` to `.gitignore` — generated artifact, not committed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config.ts` exports `ConfigSchema` (Zod schema object) — the generation script imports this
- `package.json` already has `zod` as a dependency; `zod-to-json-schema` goes in devDependencies

### Established Patterns
- Build: `tsc` producing `dist/`
- CI: `.github/workflows/ci.yml` (typecheck, test, build) and `.github/workflows/release.yml` (semantic-release)
- Both CI workflows trigger on push to `main` and are independent

### Integration Points
- `package.json` scripts — add `"generate-schema": "tsx script/generate-schema.ts"`
- `.github/workflows/pages.yml` — new file, parallel to existing ci.yml and release.yml
- `.gitignore` — add `schema.json`

</code_context>

<specifics>
## Specific Ideas

- Schema generation script modeled on opencode's `packages/opencode/script/schema.ts`
- Pages workflow uses `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`
- Workflow needs `pages: write` and `id-token: write` permissions

</specifics>

<deferred>
## Deferred Ideas

- SchemaStore submission — deferred to v1.3 when config shape is more stable
- JSONC support note in README — can be added as a quick-win after this phase

</deferred>
