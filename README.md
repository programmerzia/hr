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

State lives in memory and resets on reload. Only the signed-in person and the theme are kept in `localStorage`.

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
  layouts/      AppLayout (sidebar, tab bar, palette), AuthLayout
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
