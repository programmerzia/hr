# 08 — Access control (roles & module permissions)

Owner decision (2026-11-12): Spatie-style RBAC managed by management in-app. Menus hide, routes 403, server is the source of truth.

## Model
- Package: `spatie/laravel-permission` (guard `web`, model `App\Models\User`). Tables from the package migration.
- **Permissions** keep the existing ability slugs so no Gate/route/frontend call sites change. Grouped by module for the UI:

| module | permission | label |
|---|---|---|
| attendance | view_team | View team attendance, history, regularisations, overtime |
| leave | approve_leave_lead | Approve leave for own team |
| leave | approve_leave_hr | Approve leave company-wide, manage leave types |
| people | manage_people | Onboard, edit employees, approve password resets |
| payroll | manage_payroll | Draft, review, hold, adjust payroll runs |
| payroll | approve_payroll | Approve, pay, reopen payroll runs |
| billing | manage_billing | Clients and invoices |
| claims | verify_claims | Verify contractor claims |
| claims | approve_claims | Approve claims |
| projects | manage_projects | Create projects, columns, members |
| reports | view_reports | Company reports and CSV exports |
| settings | manage_policy | Attendance/payroll policies, holidays |
| settings | manage_settings | (kept, same as manage_policy group) |
| access | manage_access | Roles & permissions (NEW) |

- **Roles**: seeded from today's five: `employee`, `team_lead`, `hr`, `management`, `contractor`. Seed matrix = `App\Support\Abilities::TABLE` + `manage_access` → management. Built-in roles are `is_system` (cannot be deleted/renamed; management role cannot lose `manage_access`). Management can create custom roles.
- `users.role` stays and holds the role slug (mirror of the single Spatie role). Policies' scope rules (own team, own record, `role === 'management'`) keep reading it. Custom roles get permissions only; scope behaves like `employee`.
- `Abilities::for($user)` → `$user->getAllPermissions()->pluck('name')`. `Gate::define` per permission → `$user->hasPermissionTo(...)`. Frontend `can()` unchanged (reads shared `auth.abilities`). Per-user direct permissions supported via Spatie (shown in the UI as overrides).
- `App\Support\Nav`: replace `roles` keys with `permission` keys (group shows if any item visible; item shows if user has its permission). Mapping: team group items → view_team except leave-approvals → approve_leave_lead|approve_leave_hr, team-sheet → view_team, claims(team) → verify_claims; people → manage_people; payroll → manage_payroll; reports → view_reports; clients/invoices → manage_billing; claims(finance) → approve_claims; settings → manage_policy|manage_access.
- Routes: every module group guarded (`can:` middleware); `/people` directory stays open to all; add `can:manage_access` group for Settings → Access. 403 renders Inertia page `Errors/Forbidden` ("No access") inside the app layout.
- Role change on an employee: `PATCH /people/{employee}/role` (manage_access), syncs Spatie role + `users.role`, logs to SettingsLog/activity; cannot change own role; cannot demote the last `manage_access` holder.

## UI (Settings → Access, tab `access`)
- `GET /settings/access` → `Settings/AccessPage`: props `{ roles: [{id,name,label,is_system,users_count,permissions:string[]}], permissions: [{name,label,module}], modules: [{key,label}], users: [{id,name,email,role,direct_permissions:string[]}] }`.
- Matrix: rows = permissions grouped by module, columns = roles, checkboxes; Save per role → `PUT /settings/access/roles/{role}` `{permissions:string[]}`.
- Create role `POST /settings/access/roles` `{name,label}`; delete non-system `DELETE /settings/access/roles/{role}` (refused if users attached).
- People tab on same page: role select per user → `PATCH /people/{employee}/role` `{role}`; "Overrides" sheet → `PUT /settings/access/users/{user}/permissions` `{permissions:string[]}`.
- Cache: Spatie permission cache reset after every write.

## Tests
- Feature: each guarded route 403 for a role without the permission and 200 with it (table-driven over routes above); matrix save; role create/delete rules; role change rules; management can't lose manage_access; nav reflects permissions.
- Browser QA flow L: management revokes `view_reports` from hr → HR menu loses Reports and `/reports` returns 403; restore.
