# Design system — "quiet, dense, obvious"

The product is used eight hours a day by people who did not choose it. It should feel like a well-made internal tool (think Linear, Basecamp, Stripe Dashboard, GitHub), not a landing page.

## What made the previous mock look machine-generated — never do these
- Marketing copy inside the app: "Enterprise Modules", "State Machine v2.4", "Vivacom OS", "Live Sync", "Production Engine".
- A subtitle and a colored pill on every nav item. Nav items are a label and an icon. Badges only for real counts (unread, pending approvals).
- Seven accent colors. One accent. Status colors only for status.
- Gradients, glass blur, `backdrop-filter`, glow shadows, `rounded-2xl` on everything.
- `font-black`, `tracking-wider uppercase` 10px labels, `text-[10px]`, emoji, sparkles icons, confetti.
- Hero banners at the top of every page. A page starts with a title row and content.
- Persona switcher in the product header. Demo logins live only on the login page under a clearly marked "Demo accounts" section.
- Toasts for everything. Toast only when the result is not visible on screen.

## Principles
1. **Content first.** Tables and forms are the product. Chrome stays neutral.
2. **One accent** for primary actions, links, focus, active nav. Everything else is gray.
3. **Borders, not shadows**, to separate surfaces. Shadows only on floating layers (menus, dialogs).
4. **Density**: 14px body, 13px in tables, 32px row height, 8px spacing grid.
5. **Sentence case** everywhere. Labels are nouns ("Payroll", "Team", "Leave").
6. **States are explicit**: every list has loading, empty, and error states; every action has a disabled and busy state.
7. **Numbers align right and use tabular figures.** Money shows currency once per column, not per cell.
8. **Dark mode is a token swap**, not a redesign. No `dark:` sprinkled on components; components use semantic tokens.

## Tokens (CSS variables on `:root` and `.dark`, mapped into Tailwind)

```
--bg            page background          light #f7f7f8   dark #0f1115
--surface       cards, panels, sidebar   light #ffffff   dark #161a22
--surface-2     table header, hover rows light #f2f3f5   dark #1c212b
--border        default border           light #e4e5e9   dark #272d38
--border-strong input borders            light #c9ccd3   dark #343b48
--fg            primary text             light #16181d   dark #e7e9ee
--fg-muted      secondary text           light #5c6370   dark #9aa3b2
--fg-subtle     placeholders, hints      light #8a919e   dark #6b7484
--accent        primary                  light #3056d3   dark #6b8cff
--accent-fg     text on accent           #ffffff          #0b1020
--accent-soft   accent tint bg           light #e8edfb   dark #1b2440
--success/-soft  #1f8a4c / #e3f5ea        dark #4cc38a / #11291c
--warning/-soft  #b7791f / #fbf1dd        dark #e0a94a / #2d2410
--danger/-soft   #c53030 / #fde8e8        dark #f26d6d / #331617
--info/-soft     #2b6cb0 / #e3eefb        dark #6aa8ea / #142235
--ring          focus ring = accent at 40%
```

Tailwind: `bg-bg bg-surface bg-surface-2 border-border text-fg text-fg-muted text-accent bg-accent-soft ...`. Colors are defined with `rgb(var(--x) / <alpha-value>)` so opacity utilities work.

Radius: `rounded` (4px) inputs/buttons/badges, `rounded-md` (6px) cards/menus, `rounded-lg` (8px) dialogs. Nothing larger except avatars.

Type: Inter (400/500/600). Mono: JetBrains Mono for clock, task keys, invoice numbers, amounts in tables (`font-mono tabular-nums`).
- Page title 20px/600. Section title 15px/600. Body 14px/400. Table 13px. Caption 12px `text-fg-muted`. No 10px or 11px text.

Spacing: page padding 24px (16px on mobile). Card padding 16px. Gap between cards 16px. Form field gap 16px, label→input 6px.

Motion: 120–160ms ease-out on hover/open only. No entrance animations on page load. Respect `prefers-reduced-motion`.

## Layout
- **Sidebar** 240px, `bg-surface`, right border. Logo + workspace name top (plain text "Vivacom"), nav groups with 11px… no: group heading 12px `text-fg-subtle` font-medium, items 14px with 16px icon, active = `bg-accent-soft text-accent` with 500 weight. Collapsible to 56px icon rail (persisted). Bottom: current user row (avatar, name, role) → menu (profile, theme, sign out).
- **Top bar** per page is *inside* the page: `PageHeader` with title, optional description (one line), optional tabs, actions on the right. Not a global header. Global elements (search Ctrl-K, inbox bell) sit at the top of the sidebar.
- **Content** max width 1280px for forms/dashboards; tables may go full width.
- **Mobile** < 768px: sidebar becomes a sheet; bottom tab bar with 4–5 items *derived from the same nav config* (Home, My day, Tasks, Chat, More).

## Component kit (`src/components/ui`)
Button (variants: primary, secondary, ghost, danger; sizes sm/md; `loading`, icon slot), IconButton, Input, Textarea, Select (native-styled + Radix for searchable), Checkbox, Switch, RadioGroup, Label + Field (label, hint, error), Badge (neutral default; success/warning/danger/info), Avatar (initials fallback, sizes), Card (header/body/footer), Table (Thead sticky, Tr hover, Td numeric), DataTable helpers (toolbar: search, filter chips, column sort), Tabs, Dialog, Sheet (side drawer), DropdownMenu, Popover, Tooltip, Toast (bottom-right, max 3), EmptyState (icon, title, one sentence, optional action), Skeleton, Kbd, PageHeader, Stat (label, value, delta optional), Breadcrumb, Progress (thin), SegmentedControl, DateRangePicker (simple two inputs + presets), CommandPalette.

Rules: components accept `className` and merge with `cn()`. No component reads global state. Icons from lucide at 16px (14px in badges). Every interactive element has a visible focus ring (`focus-visible:ring-2 ring-ring`).

## Domain patterns
- **Status**: `StatusBadge` maps domain statuses to semantic colors in one file (`src/lib/status.ts`). Working=success, On break=warning, Ended=neutral, Late=danger, Pending=info, Approved=success, Rejected=danger, Paid=success, Draft=neutral, Overdue=danger.
- **Time**: `Clock` component (mono, 28–40px, tabular) only on My day and team cards. Durations as `7h 42m` (never `07:42:13` outside the live clock).
- **Money**: `formatMoney(amount, currency)` → `৳1,20,000` for BDT (Indian grouping), `$1,200.00` for USD. Right-aligned.
- **Dates**: `12 Nov 2026`, times `09:12`, relative only in chat/activity (`3m ago`).
- **Timeline bar**: today's segments as a horizontal bar (work=accent, break=warning-soft, idle=hatched) from shift start to now. This is the attendance hero, not a big number.
- **People**: `PersonCell` = avatar 24px + name + (muted) designation/team. Used in every table.
- **Forms**: labels above inputs, hints below, errors replace hints in danger color. Primary action bottom-right of dialog, cancel to its left as ghost. Destructive actions require a confirm dialog with the record name in the text.
- **Tables**: toolbar row (search left, filters, actions right) → table → footer (count, pagination). Row click opens detail; row actions in a `...` menu on hover/focus.
- **Detail pages** over drawers for anything with tabs (employee, project, invoice). Drawers for quick views (task, attendance day).

## Revision 2 — visual depth and top bar (added 2026-11-10)

The first build was correct but flat. Add depth and identity without breaking the rules above.

**Top bar (new, global, 48px, sticky, `bg-surface` + bottom border).**
Left: breadcrumb for the current page (module › record) so the page title no longer repeats the module. Center-left: global search field (moved out of the sidebar; Ctrl/Cmd-K). Right, in order: **work status chip** (status dot + today's work time ticking + one-click action: Start / Break / Resume; visible on every page so the clock is never far away), Inbox bell with count, theme toggle, user avatar menu. On mobile the bar keeps logo, status chip and menu.
Sidebar becomes navigation only: logomark + "Vivacom" top, groups, collapse toggle bottom. No user row (moved to top bar).

**Surface depth.** Cards get `shadow-xs` (`0 1px 2px rgb(0 0 0 / .04)`) in light, none in dark. Page background stays one step darker than cards. Floating layers use `shadow-float`. Table headers `bg-surface-2` sticky. Hovered rows `bg-surface-2`. Selected row: 2px accent inset-left.

**Identity.** Simple logomark (rounded square, accent, white "V" path) at 24px. Avatar backgrounds from a deterministic 8-hue muted palette by name hash (text stays legible in both themes). Status dot before status text; "Working" dot has a slow 2s pulse (disabled under reduced motion).

**Type.** Page title 22px/600 letter-spacing -0.01em. Section titles 15px/600. Numeric table cells `font-mono tabular-nums`. Stat value 24px/600 mono.

**Stat cards.** Label, value, and a muted icon in a 32px `bg-surface-2` circle at right; optional one-line delta ("+2 vs last month") in success/danger text. No sparklines unless there is real series data.

**Empty states.** 32px icon in a muted circle, title, one sentence, optional action. Centered, 48px vertical padding.

**Tabs.** Underline style, 2px accent, 500 weight when active.

**Buttons.** Primary gets a 1px darker bottom border for a slight physical feel (`shadow-[inset_0_-1px_0_rgb(0_0_0/.15)]`). Secondary is white/surface with `border-border-strong`. Hover states on every interactive element.

Still forbidden: gradients, glass, glow, rainbow accents, rounded-2xl, uppercase labels, marketing copy.

## Offline tracking (added 2026-11-10)
A new break category `offline` is distinct from `idle`: idle = tab open, no activity; offline = app closed, device asleep, or network down while the day was `working`/`on_break`. Detect: (1) persisted last-heartbeat time; on app load or `visibilitychange`→visible, if the gap exceeds the policy idle timeout and the day was working, close the work segment at the last heartbeat and record an `offline` segment up to now, then resume working; (2) `navigator.onLine` false→true transitions record the same way. Timeline bar draws offline as a hatched gray band (idle is hatched warning). My day shows "Offline today" next to break time. Team views show "Offline" (gray dot) for a working member whose last heartbeat is older than 2 minutes, with "since HH:MM". History tables include an Offline column. Payroll and claims treat offline time like break time (not worked).
