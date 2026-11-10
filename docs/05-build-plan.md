# Build plan (agent routine tasks)

Each task is self-contained, lists the files it owns, and must leave `pnpm tsc --noEmit && pnpm build` green. Agents must read `docs/01`–`04` first and must not edit files outside their ownership list except where noted.

## Wave 0 — Foundation (one agent, sequential, blocks everything)
Owns: tooling, `src/main.tsx`, `src/app/*`, `src/layouts/*`, `src/components/ui/*`, `src/components/shared/*`, `src/lib/*`, `src/types/index.ts`, `src/mock/session.ts`, `src/mock/clock.ts`, `src/mock/db/people.ts`, `src/pages/Auth/*`, `src/pages/Home/*` (placeholder), `src/pages/Inbox` (placeholder), `src/pages/Settings` (placeholder), and a **stub `routes.tsx` + placeholder page in every other module folder**.
1. Replace deps per 04. Tailwind tokens per 03. Inter + JetBrains Mono. Remove old `src/components`, `src/context`, `src/data`.
2. Types for the whole domain (every table in 02) so later waves don't touch this file.
3. UI kit, shared components, lib helpers with unit-level sanity (format tests optional).
4. Nav config + AppLayout + Sidebar (collapsible, groups, role filter, user menu) + mobile tab bar + CommandPalette (routes only).
5. Login page with demo accounts; Logout dialog; session store; guards.
6. People seed (24 employees: 4 teams across Engineering, Design, QA, Operations; 2 leads per department max; 1 HR; 1 management; 3 contractors). Other domains' seed files are created empty-but-typed exports.
Acceptance: app boots to `/login`, logging in as each role shows a different sidebar, every nav route renders its placeholder with a `PageHeader`, dark mode toggles via user menu, build green.

## Wave 1 — parallel, in-place (distinct file ownership)
**1A Attendance** — owns `src/mock/db/attendance.ts`, `src/mock/stores/attendance.ts`, `src/pages/Attendance/*`, and *wires* `session.login/logout` to attendance actions (edit only the marked hook in `session.ts`). My day (status card with TimelineBar, start/break/resume/end, current task selector reading from work store if present else none, today's segments, this week table), Team live grid + filters, Team history (date range, CSV export button), Regularizations queue (lead). Tick integration.
**1B Work** — owns `src/mock/db/work.ts`, `src/mock/stores/work.ts`, `src/pages/Work/*`. Projects list, project board (drag within/between columns, column add/rename), list view with filters/group, My tasks, Task drawer (`?task=KEY`) with description, subtasks, comments with paste-image attachment, labels, estimate vs tracked, activity. `parseTaskRefs` rendering of keys as links.
**1C Leave + People** — owns `src/mock/db/leave.ts`, `src/mock/stores/leave.ts`, `src/mock/stores/people.ts`, `src/pages/Leave/*`, `src/pages/People/*`. My leave (balances, request dialog with half-day, list), Approvals (lead → hr two-stage, overlap warning), Team calendar (month grid), Policy (HR edit leave types/quotas). People directory (table, filters, search), Profile page with tabs (overview, employment, compensation history, bank, documents, assets, attendance summary placeholder, leave balances), Onboard wizard (4 steps, checklist), status changes.

## Wave 2 — parallel
**2A Payroll** — owns `src/mock/db/payroll.ts`, `src/mock/stores/payroll.ts`, `src/pages/Payroll/*`. Runs list, Run detail (items table, recompute, adjustments drawer, approve, mark paid with reference), Payslip page (print stylesheet, A4), My payslips. Calculator uses attendance + leave stores when present.
**2B Billing** — owns `src/mock/db/billing.ts`, `src/mock/stores/billing.ts`, `src/pages/Billing/*`. Clients, Invoices list + detail (lines editor, tax/discount, send, record payment, void, print), Claims (contractor: generate from tracked hours, submit; lead verify; management approve; pay).
**2C Chat + Inbox + Home** — owns `src/mock/db/chat.ts`, `src/mock/stores/chat.ts`, `src/mock/stores/inbox.ts`, `src/pages/Chat/*`, `src/pages/Inbox/*`, `src/pages/Home/*`. Chat: conversation list with unread, message pane, composer with task reference autocomplete (`PULSE-` triggers), task cards for references, DM start. Inbox: unified approvals/mentions list with inline approve/reject. Home: four role variants composed from other modules' store selectors.

## Wave 3 — QA and polish (one agent, Haiku ok for mechanical parts)
Lint sweep for banned patterns (`dark:` outside ui, `text-[10px]`, `font-black`, hex colors, "v2.", marketing copy), empty/loading states audit, keyboard/focus audit, mobile pass at 390px, dark mode pass, dead code removal, README with run instructions and Laravel migration notes.

## Definition of done per task
- Build + typecheck green. No console errors on every route for every role.
- Every list has empty state. Every mutation has visible result (row changes, badge count changes) — toast only if the result is off-screen.
- Role scoping enforced in the store (lead sees only own team).
- Copy is sentence case, plain, no marketing words.
