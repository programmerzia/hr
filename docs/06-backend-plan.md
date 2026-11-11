# 06 — Backend plan: Laravel 13 + Inertia (React 19 TS)

Status: decided 2026-11-12, confirmed by the owner. Implements `02-architecture.md`. The earlier "JSON API behind
the SPA" idea is rejected: one app, one set of routes, policies and validation, standard Laravel + React.

## Shape

- Laravel 13.42, `inertiajs/inertia-laravel` 3, `@inertiajs/react` 2, `tightenco/ziggy` 2, Pest 4, Pint.
- `resources/js/` is the former mock `src/`. UI (components, layouts, charts, lib, types) stays as is. Pages become
  Inertia pages: data arrives as props, mutations are `router.post/patch/delete` or `useForm`. `resources/js/mock/*`
  and `react-router` are removed at the end of the waves (kept only until each module is ported).
- Laravel serves `resources/views/app.blade.php` (the former `index.html`) with `@vite(['resources/js/main.tsx'])`
  and `@inertia`. Vite via `laravel-vite-plugin`. Tailwind 3.4 and tokens unchanged.
- Timezone `Asia/Dhaka`. Dates `Y-m-d`, datetimes ISO-8601 with offset. Money integer BDT. JSON snake_case, shapes
  == `resources/js/types/index.ts`. **IDs are UUIDs** (`HasUuids`) on every domain table, so `Id = string` holds.
- Local dev: Docker MySQL `db_gt` on 127.0.0.1:3310, db `vivacom_hr`, user `vivacom` (see `.env`); tests use
  `vivacom_hr_test` (phpunit.xml) with `RefreshDatabase`. Production: MySQL 8 on vivadev.

## Shared Inertia props (HandleInertiaRequests)

```
auth: { user: User, employee: Employee, role: Role, abilities: Ability[] } | null
nav:  NavGroup[]                      // computed server-side by App\Support\Nav::for(user); shape == app/nav.ts navGroups
badges: Record<string, number>        // nav badge counts (pending approvals, unread inbox…)
attendance: { day: AttendanceDay|null, open_segment: TimeSegment|null, policy: AttendancePolicy, server_time: ISODateTime }
flash: { success?: string, error?: string }
ziggy: routes (Ziggy)
```

Frontend reads these through `usePage<SharedProps>()` in `resources/js/inertia/props.ts`. Session store, guards and
the mock router are replaced by this. The top bar work chip and the heartbeat hook use `attendance`.

## Conventions

- Controllers: `App\Http\Controllers\<Module>\*Controller`, thin: Form Request → Action → `redirect()->back()` or
  `Inertia::render('Module/Page', [...])`. Page component path mirrors `resources/js/pages/<Module>/<Page>.tsx`.
- Business rules in `App\Domain\<Module>\Actions\*` (invokable), ported one-to-one from the mock stores, same
  validation messages. Pure calculators (`DayCalculator`, `PayrollCalculator`, `LeaveDays`) are unit tested.
- Authorization: Policies per model + `Gate` abilities named exactly as TS `Ability`. Team-lead scope = employees in
  teams the viewer leads. Routes grouped by module in `routes/web.php` with `auth` + `must-change-password` middleware.
- API Resources are the only serialisation path; one Resource per TS interface.
- Auditing: `spatie/laravel-activitylog` on approvals and money; History panels read it.
- Notifications: Laravel database notifications feed Inbox and nav badges.
- Tests: Pest feature test per route (happy path + one policy denial), unit tests for calculators. `php artisan test`
  and `pnpm typecheck && pnpm lint && pnpm build` must be green at the end of every agent task.
- Forms: `useForm` from Inertia for create/edit pages; `router.post(route('…'), data, { preserveScroll: true })`
  for actions. Server validation errors render through the existing `Field error=` props.
- Realtime: the heartbeat `POST /heartbeat` every 60 s returns the attendance shared prop via a partial reload
  (`router.reload({ only: ['attendance', 'badges'] })`). Team presence polls `only: ['members']` every 30 s. Reverb later.

## Auth and attendance (server authoritative)

- `POST /login` → `Auth::attempt` → `StartWork` (late minutes vs policy grace; `ended` day needs `confirm_overtime`,
  the login page gets `needs_overtime_confirm` back as a validation-style error key). Redirect `/`.
- `must_change_password` → middleware redirects everything to `/account/password` (locked shell page).
- `POST /logout {mode: break|end_day, break_category?}` → `StartBreak`/`EndDay`, then logout.
- `POST /attendance/break`, `/attendance/resume`, `/attendance/end-day`, `/attendance/current-task`, `POST /heartbeat`.
- `attendance:sweep` every minute: `working` days with `last_seen_at` older than `idle_timeout_minutes` get an
  `offline` break from the last beat; next heartbeat closes it and reopens work. Nightly job marks absent/holiday/leave.

## Seed

`DemoSeeder` (local and dev server): 8 people — Rafiq Ahmed (management), Nasrin Akter (HR), Tanvir Hossain
(team lead), Sadia Sultana and Imran Kabir (employees), Nusrat Jahan (contractor), one intern, one second team lead.
2 projects (PULSE, ERP) ~20 tasks, 30 days attendance, 3 paid payroll months + current draft, 6 invoices, 2 claims,
leave types and requests. Password `password`. `ProductionSeeder`: policy, leave types, holidays, one HR account from
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` with forced change.

## Waves

- B0 Opus ×2: **backend foundation** (all migrations from `types/index.ts`, models, factories, resources, policies,
  abilities, Nav, HandleInertiaRequests, auth routes, attendance transitions + heartbeat + sweep, DemoSeeder,
  ProductionSeeder, Pest base) and **frontend foundation** (Vite/laravel plugin, Inertia entry, `inertia/props.ts`,
  persistent AppLayout, nav from props, Login/Logout/Account pages ported, heartbeat hook, smoke harness on
  `php artisan serve`). Both green before B1.
- B1 Sonnet ×4: Attendance pages, People, Work, Leave — controllers, actions, tests, pages ported.
- B2 Sonnet ×3: Payroll (calculator ported as is; improvement comes after), Billing (invoices + claims), Inbox.
- B3 Haiku QA + Sonnet fixes; delete `resources/js/mock` and `react-router`; deploy to vivadev.

## Deploy (vivadev)

MySQL db `vivacom_hr` + user; `.env`; `composer install --no-dev --optimize-autoloader`; `php artisan migrate --force`;
`db:seed --class=ProductionSeeder` (first time; `DemoSeeder` on the dev host if wanted); `npx pnpm@12 build`;
`storage:link`; cron `schedule:run`; `config:cache route:cache view:cache`. Apache vhost already uses `public/`.
