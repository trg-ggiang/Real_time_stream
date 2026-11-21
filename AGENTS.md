# Real-time Stream — Agent Instructions

## Scope and stack
- Use the current user request to determine scope. The source already includes dynamic meetings, meeting chat, public/personal/admin flows and a club workspace. Start with [CODE_FLOW.md](CODE_FLOW.md) and the [workspace handoff](docs/design/phase-04-club-workspace.md).
- Backend: Node.js / NestJS. Frontend: React / Vite. Stream: LiveKit Cloud. Database: Supabase. Chat: Socket.IO for meeting sessions and HTTP polling for club channels.
- Source is organized by feature in `backend/src` and `frontend/src/features`. The historical media PoC is documented in `docs/modules/module-01-media-poc.mdx`.

## Session start
1. Read `README.md`, this file, `.codex/AGENTS.md` (Codex) or `CLAUDE.md` (Claude), `docs/index.mdx`, `docs/ai-workflow.mdx`, `docs/plans/master-plan.mdx`, and `docs/dev/session-log.mdx`.
2. Open the active phase and relevant completed work logs via `docs/dev/session-log.mdx`. Check the related source and migrations to distinguish current behavior from historical notes.
3. Check `git status -sb` before editing. Preserve unrelated changes. Confirm the target branch before an authorized commit or push.
4. Inspect relevant files with `rg` before changing them. Follow the user's current authorized scope; a roadmap is not permission to implement future phases.

## Working rules
- Use PowerShell-compatible commands. Install from root with `npm install`; use `npm --workspace backend ...` / `npm --workspace frontend ...` for workspace commands.
- Only run scripts that exist in package.json. Root scripts include dev:backend, dev:frontend, typecheck, build and test.
- Never hardcode or log credentials. Keep Supabase secret keys and LiveKit API secrets backend-only; never put secrets in `VITE_*` variables.
- Before future Supabase schema/RLS/migration work, read the available Supabase Postgres best-practices skill.
- Do not auto-commit, publish, or execute destructive Git/filesystem commands without user authorization.
- Use the smallest relevant checks. Report automated tests, browser fixtures, read-only checks against services and live end-to-end tests separately. Record skipped checks and their reasons.

## Work logs for completed code changes only
Create a work log only after requested application or operational script code changes are complete. Do not create logs for questions, explanations, read-only reviews, Git operations, configuration/docs-only changes, or incomplete work. The user's current instruction takes precedence over older logging requirements.
For a completed code change:
1. Create a unique work log `docs/work-logs/YYYY-MM-DD-NN-phase-XX-topic.mdx` using `docs/templates/session-close.mdx`. Use Asia/Saigon time; NN increases for each session that day.
2. Record the phase, objective, completed code, changed files, commands/results and concrete next step. Never invent completed checks; do not create an unfinished-session checkpoint unless the user explicitly requests one.
3. Update the phase page in `docs/plans/` and `docs/plans/master-plan.mdx` with actual status and link to the work log. Finishing a session does not automatically finish the phase.
4. Append an entry/link to `docs/dev/session-log.mdx`; update `docs/CHANGELOG.mdx` for changes and relevant setup/architecture docs.
5. Register new pages in `docs/docs.json`. Do not overwrite earlier logs.
6. Verify JSON and navigation targets; report any verification limits. Summarize changes, checks, phase status, and remaining work in the final response.

Phase states: `Todo`, `In Progress`, `Blocked`, `Done`. Session outcomes: `Completed`, `Partial`, `Blocked`. Mark a phase Done only when its acceptance criteria are satisfied and recorded.
