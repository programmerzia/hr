# Frontend structure (mock now, `resources/js` later)

Stack: Vite 6, React 19, TypeScript strict, Tailwind 3.4 (CSS-variable tokens), react-router 7, zustand 5, Radix primitives (dialog, dropdown-menu, popover, tooltip, tabs, select, checkbox, switch), lucide-react, date-fns 4, clsx + tailwind-merge + class-variance-authority.

Removed: canvas-confetti.

```
src/
  main.tsx                 Router + providers only
  app/
    router.tsx             createBrowserRouter; aggregates module route files; auth + role guards
    nav.ts                 Nav config: groups → items with `roles` and `to`; used by Sidebar, MobileTabBar, CommandPalette
    providers.tsx          Theme, Toaster, Tooltip provider
  layouts/
    AppLayout.tsx          Sidebar + <Outlet/> + mobile tab bar + heartbeat hook
    AuthLayout.tsx         Centered card for login
  components/
    ui/                    Kit from 03-design-system.md. One file per component. Barrel `index.ts`.
    shared/                PersonCell, StatusBadge, MoneyCell, DurationText, TaskKey, TimelineBar, Clock, EmptyTable, PageHeader, ConfirmDialog, HistoryPanel
  pages/
    <module>/              One folder per module. Each exports `routes.tsx` (RouteObject[]) and page components.
      Home/   Auth/   Attendance/ (MyDay, Team, TeamHistory, Regularizations)   Work/ (Projects, Board, TaskList, MyTasks, TaskDrawer)
      Leave/ (MyLeave, Approvals, Calendar, Policy)   People/ (Directory, Profile, Onboard)   Payroll/ (Runs, RunDetail, Payslip, MyPayslips)
      Billing/ (Clients, Invoices, InvoiceDetail, Claims, ClaimDetail)   Chat/   Inbox/   Settings/
  mock/
    db/                    Seed data per domain: people.ts, attendance.ts, work.ts, leave.ts, payroll.ts, billing.ts, chat.ts. Deterministic. Bangladeshi names, Dhaka TZ, BDT.
    stores/                zustand store per domain, e.g. useAttendanceStore. Actions mirror future Laravel actions by name (startWork, startBreak, endDay, ...). A `tick()` interval lives in one place (`mock/clock.ts`).
    session.ts             useSession: current user, role, login/logout; the login page calls `login(userId)` which calls attendance.startWork.
  lib/
    cn.ts  format.ts (money, dates, durations)  status.ts (status → badge variant + label)  taskRefs.ts (parse PULSE-142)  permissions.ts (can(role, ability, scope))
  types/
    index.ts               Domain types mirroring 02-architecture tables. snake_case fields to match Laravel JSON.
```

## Conventions
- Pages are thin: read from stores/hooks, compose shared + ui components. Business rules live in `mock/stores` (later Laravel actions).
- Types use the Laravel column names (`started_at`, `employee_id`). Dates are ISO strings.
- No `dark:` classes in pages or domain components. Use semantic tokens only. `dark:` is allowed only inside `components/ui` when a token cannot express it.
- No inline hex colors. No `text-[10px]`. No `font-black`.
- Each module's `routes.tsx` is the only file another module may import from it (plus its exported types).
- Routing: `/login`, `/` (Home), `/my-day`, `/team`, `/team/history`, `/team/regularizations`, `/projects`, `/projects/:key`, `/projects/:key/list`, `/tasks` (my tasks), `/tasks/:key` (drawer over current page via search param `?task=PULSE-142` preferred), `/leave`, `/leave/approvals`, `/leave/calendar`, `/people`, `/people/new`, `/people/:id`, `/payroll`, `/payroll/:runId`, `/payslips`, `/clients`, `/invoices`, `/invoices/:id`, `/claims`, `/claims/:id`, `/chat`, `/chat/:conversationId`, `/inbox`, `/settings/*`.
- Guards: route `handle: { roles: [...] }`; `router.tsx` redirects unauthorized to `/`. Sidebar hides items the role lacks; a direct URL still shows a plain "You don't have access" page.
- Role scoping in mock stores: `teamMembersOf(leadId)` etc. so a lead sees only their team.
- Accessibility: Radix for overlays, labels on all inputs, `aria-live` on the clock status, focus-visible everywhere.
- Code style: named exports, function components, no default exports except route lazies. Props typed inline or `interface XProps`. No barrel files except `components/ui/index.ts`.
- Quality bar: `tsc --noEmit` clean, `eslint` clean, `vite build` clean. No `any`. No unused files.

## Mock session rules
- `/login` lists demo accounts (one per role + one contractor) under a "Demo accounts" heading. Selecting one logs in and clocks in.
- Logging in while `on_break` resumes work. Logging in after `ended` asks "Start an overtime session?".
- Sign-out opens the Logout dialog: "Take a break" (category select) / "End my day". Both navigate to `/login`.
- Tick runs every second only for the current user's day and the live team board. Everything else is static seed data mutated by actions.
