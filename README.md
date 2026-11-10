# Vivacom Pulse

Internal HR, work and billing tool for a small software company. This repo is a front-end mock: React screens running on in-memory stores and deterministic seed data, built so the same code moves into a Laravel 13 + Inertia app later. Requirements and design decisions are in `docs/`.

## Run

Requires Node 20+ and pnpm.

```
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # typecheck + production build into dist/
pnpm preview      # serve the production build
pnpm typecheck
pnpm lint
pnpm smoke        # drives every role through every route in headless Chrome
```

`pnpm smoke` starts its own dev server on port 5199 and uses the system Chrome (`/usr/bin/google-chrome`, override with `CHROME_PATH`). It logs in as each demo account, visits every route in that role's sidebar plus detail pages, fails on console errors, error boundaries, blank pages and horizontal overflow, and writes screenshots to `scripts/screens/` (git-ignored).

Besides the per-role route sweep, the smoke script asserts that the top bar (`[data-testid=topbar]`) renders on every authenticated route except the bare print views, that the work status chip text changes after Take a break and Resume, that a stale heartbeat produces an Offline row and an offline timeline band after a reload, and that the Team page lists stale working members as "Offline since HH:MM".

State lives in memory and resets on reload. Only the signed-in person, the theme, the sidebar state and the last heartbeat (see Offline tracking) are kept in `localStorage`.

## App shell

- **Top bar** (`src/layouts/TopBar.tsx`, 48px, sticky): breadcrumb, search (Ctrl/Cmd-K command palette), the work status chip, inbox bell with count, theme toggle and the account menu (name and role, Profile for HR and management, Sign out). On phones it keeps the logo, the chip and a menu button that opens the nav sheet (theme and sign out live there).
- **Work status chip** (`WorkStatusChip.tsx`): status dot, today's work time ticking, and the one action that fits the state (Start work, Take a break, Resume, Start overtime). Clicking the time opens My day. Take a break uses the same `BreakDialog` as My day.
- **Breadcrumb**: by default the nav label of the current route. A page can name its record with `usePageTitle.getState().setBreadcrumb(['Payroll', 'November 2026'])` or the `useBreadcrumb()` hook (`src/app/pageTitle.ts`). `PageHeader`'s `breadcrumb` prop calls the hook, so detail pages publish their crumbs to the top bar instead of rendering them above the title.
- **Sidebar**: logomark and name, nav groups, collapse toggle. Navigation only.
- Routes with `handle.bare` still render without the shell.

## Offline tracking

`offline` is a break category written only by the system (never offered in the break dialog, like `idle`). Idle means the tab was open and quiet; offline means the app was closed, the device slept or the network was down while the day was running.

How it is detected (`attendance.reconcileOffline`, wired in `src/mock/bootstrap.ts` and `session.heartbeat`):

- The last heartbeat time is persisted to `localStorage` (`vivacom.last_heartbeat`) on every heartbeat, only while the day is `working`, and cleared when the person stops working or signs out.
- It is checked on app start, on `visibilitychange` to visible, on the browser `online` event (using the `offline` event time as the last-seen time), and at the start of every heartbeat so a late timer cannot hide a gap.
- Rule: if the gap exceeds the policy idle timeout (10 minutes) and the day is `working`, the open work segment is closed at the last heartbeat, an `offline` segment (source `offline`) runs from there to now, and a new work segment opens. If the open segment is an `idle` break that began at the last heartbeat, it is converted to `offline` and work resumes. If the person is on a break they chose, nothing changes. A heartbeat from before the current work segment began is ignored.
- Totals: `computeTotals` returns `workSeconds`, `breakSeconds` (chosen breaks only), `idleSeconds` and `offlineSeconds`. Idle and offline are not worked, so payroll hours and contractor claim hours (which read `workSeconds`) are unaffected. History tables and the My day week table show an Offline column; the My day status card shows "Offline today 25m".
- Presence for team views: `presenceOf(employeeId)` reports a `working` person as offline when the last heartbeat is older than 2 minutes, with the time it was last seen. Team shows a gray dot with "Offline since 15:12". The seed marks two working members as stale (15 and 7 minutes) so this is visible; the other seeded members keep a fresh heartbeat while the page is open.

Limits of the mock:

- Attendance is in memory, so a reload resets the day to the seed. If a persisted session has a heartbeat from earlier today and the seed day is `not_started`, the day is rebuilt as working from that heartbeat (first sign-in time becomes the last heartbeat, no lateness is invented) and the gap is then reconciled. Earlier segments from before the reload are lost.
- A heartbeat from a previous calendar day is ignored.
- The heartbeat is a local timer, so a dropped network alone does not stop it; the `offline` and `online` events stand in for failed heartbeat posts. The real implementation derives offline time on the server from missed heartbeats.
- Other people's presence is simulated; real presence needs the server heartbeat table.

## Demo accounts

Use the buttons under "Demo accounts" on the login page. Signing in starts the work clock.

| Person | Role | What to look at |
| --- | --- | --- |
| Sadia Sultana | Employee | My day, tasks, leave, payslips |
| Tanvir Hossain | Team lead | Team board, approvals, regularizations, contractor claim verification |
| Nasrin Akter | HR | People, payroll runs, leave policy |
| Rafiq Ahmed | Management | Payroll approval, invoices, clients, claims |
| Nusrat Jahan | Contractor | Monthly claims built from tracked hours |

## Modules

- Attendance: sign-in clock, breaks, end of day, team live board, history, regularizations.
- Work: projects, board, list, my tasks, task drawer (`?task=PULSE-1`) with comments, subtasks and tracked time.
- Leave: balances, requests with half days, two-stage approval, team calendar, policy.
- People: directory, profile with compensation history, onboarding.
- Payroll: monthly runs, adjustments, approve and mark paid, printable payslips.
- Billing: clients, invoices, payments, contractor claims (draft, submit, verify, approve, pay).
- Chat and inbox: conversations with task references, unified approvals and mentions.

## Folder structure

```
src/
  app/          router, nav config, guards, providers, theme, lazy route helper
  layouts/      AppLayout, TopBar, WorkStatusChip, Sidebar, MobileTabBar, AuthLayout
  components/
    ui/         design-system kit (Button, Dialog, DataTable, ...)
    shared/     domain components (PersonCell, StatusBadge, MoneyCell, ...)
  pages/<Module>/   routes.tsx plus page components
  mock/
    db/         deterministic seed data per domain
    stores/     zustand stores; action names mirror future Laravel actions
    bootstrap.ts   wires cross-module providers once at startup
    session.ts  current user and role
  lib/ types/   helpers and domain types (Laravel column names, snake_case)
docs/           requirements, architecture, design system, frontend structure, build plan
scripts/        smoke.mjs
```

Pages are thin; business rules live in `mock/stores`. Routes can set `handle: { roles, allow, bare }`; `bare` renders a page without the app shell (payslip and invoice print views). Route pages are lazy-loaded.

## Moving to Laravel 13 + Inertia

See `docs/02-architecture.md` and `docs/04-frontend-structure.md`. Summary:

1. Create the Laravel 13 app with Inertia (React, TypeScript). Move `src/` to `resources/js/`.
2. Backend: one Domain folder per module with Actions named like the store actions (`StartWork`, `StartBreak`, `EndDay`, `ApproveAsLead`, ...). Controllers stay thin: validate, run the action, redirect or `Inertia::render`. Authorization lives in policies.
3. Replace `src/mock/stores/*` actions with `router.post(route('...'))` calls; page data arrives as Inertia props instead of store selectors. Seed files become migrations, factories and seeders.
4. Swap `react-router` for Inertia: `<Link>` from `@inertiajs/react`, the route table becomes `routes/web.php` plus Ziggy. `useParams` and `?task=` become page props and query strings. Lazy `page(() => import(...))` becomes Inertia's page resolver with `import.meta.glob`.
5. Share `auth.user`, `auth.abilities`, `nav` and badge counts from `HandleInertiaRequests`. `app/nav.ts` keeps its shape and is fed from shared props rather than the mock session.
6. Login fires the `StartWork` action; logout is a controller taking `mode=break|end_day`. The heartbeat posts every 60 seconds and a scheduler job sweeps idle sessions. Server time is the source of truth; client timers only display.
7. Realtime (team board, chat, notifications) via Laravel Reverb and Echo. Payslip and invoice PDFs render server side; the bare print routes here are the templates.
8. Layouts, the UI kit, shared components and formatting helpers need no changes.
