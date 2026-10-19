# Real-time Stream — Agent Instructions

## Scope and stack
- Current authorized scope: Module 1 — Media Connection PoC (NestJS token API and React/LiveKit meeting page), environment setup, tests and documentation. Do not implement database/auth, dynamic rooms, chat or club workflows until requested.
- Backend: Node.js / NestJS. Frontend: React / Vite. Stream: LiveKit Cloud. Database: Supabase. Chat: Socket.IO over WebSocket.
- Source is organized as a NestJS livekit module and a frontend meeting feature. See `docs/modules/module-01-media-poc.mdx`.

## Session start
1. Read `README.md`, this file, `.codex/AGENTS.md` (Codex) or `CLAUDE.md` (Claude), `docs/index.mdx`, `docs/ai-workflow.mdx`, `docs/plans/master-plan.mdx`, and `docs/dev/session-log.mdx`.
2. Read the active phase and its latest work log before editing.
3. Check `git status --short` if `.git` exists; the project now has a Git repository. Preserve unrelated changes.
4. Inspect relevant files with `rg` before changing them. Follow the user's current authorized scope; a roadmap is not permission to implement future phases.

## Working rules
- Use PowerShell-compatible commands. Install from root with `npm install`; use `npm --workspace backend ...` / `npm --workspace frontend ...` for workspace commands.
- Only run scripts that exist in package.json. Root scripts include dev:backend, dev:frontend, typecheck, build and test.
- Never hardcode or log credentials. Keep Supabase secret keys and LiveKit API secrets backend-only; never put secrets in `VITE_*` variables.
- Before future Supabase schema/RLS/migration work, read the available Supabase Postgres best-practices skill.
- Do not auto-commit, publish, or execute destructive Git/filesystem commands without user authorization.
- Use the smallest relevant checks. Record skipped checks and their reasons honestly.

## Mandatory session close
Every working session, including configuration/docs-only sessions, must be closed in `docs/` before the final response:
1. Create a unique work log `docs/work-logs/YYYY-MM-DD-NN-phase-XX-topic.mdx` using `docs/templates/session-close.mdx`. Use Asia/Saigon time; NN increases for each session that day.
2. Record the phase, objective, completed work, changed files, commands/results, decisions, blockers, unfinished work, and concrete next step. If interrupted, checkpoint when possible; never invent completed checks.
3. Update the phase page in `docs/plans/` and `docs/plans/master-plan.mdx` with actual status and link to the work log. Finishing a session does not automatically finish the phase.
4. Append an entry/link to `docs/dev/session-log.mdx`; update `docs/CHANGELOG.mdx` for changes and relevant setup/architecture docs.
5. Register new pages in `docs/docs.json`. Do not overwrite earlier logs.
6. Verify JSON and navigation targets; report any verification limits. Summarize changes, checks, phase status, and remaining work in the final response.

Phase states: `Todo`, `In Progress`, `Blocked`, `Done`. Session outcomes: `Completed`, `Partial`, `Blocked`. Mark a phase Done only when its acceptance criteria are satisfied and recorded.
