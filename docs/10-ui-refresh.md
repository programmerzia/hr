# 10. UI refresh: "crisp product" look and a faster My day (2026-11-25)

The owner chose this direction. Restrained, dense and product-grade, in the spirit of Linear and Stripe's dashboard. Anything that looks AI-generated is out: gradients, glass, glows, emoji, marketing copy, and badges on everything.

## A. Design system (applies to every page)

Every page uses the tokens in `resources/js/index.css`, `tailwind.config.js`, `components/ui/*`, `components/shared/*` and `layouts/*`. Change those; do not edit pages one by one.

### Tokens: light and dark, RGB triplets as today

**Light**

| Token | Value |
|---|---|
| Canvas `--bg` | 246 247 249 |
| Surface | 255 255 255 |
| `--surface-2` | 241 243 246 |
| `--border` | 229 231 235 |
| `--border-strong` | 209 213 219 |
| `--fg` | 17 24 39 |
| `--fg-muted` | 75 85 99 |
| `--fg-subtle` | 128 136 150 |
| Accent | 79 70 229 (indigo) |
| `--accent-strong` | 67 56 202 |
| `--accent-soft` | 238 242 255 |
| `--ring` | 99 102 241 |

**Dark**

| Token | Value |
|---|---|
| `--bg` | 12 14 19 |
| Surface | 21 24 32 |
| `--surface-2` | 28 32 42 |
| `--border` | 38 43 54 |
| `--border-strong` | 52 58 72 |
| Accent | 129 140 248 |
| `--accent-strong` | 165 180 252 |
| `--accent-soft` | 30 32 66 |

Keep success, warning, danger and info. Slightly richer values are fine, but they must keep WCAG AA contrast for text on their `-soft` backgrounds.

**Sidebar.** Dark navy in both themes. Add these tokens:

| Token | Light theme | Dark theme |
|---|---|---|
| `--sidebar` | 15 23 42 | 10 12 17 |
| `--sidebar-fg` | 203 213 225 | same |
| `--sidebar-fg-strong` | 255 255 255 | same |
| `--sidebar-muted` | 100 116 139 | same |
| `--sidebar-hover` | 30 41 59 | same |
| `--sidebar-active` | 30 41 59 | same |
| `--sidebar-border` | 30 41 59 | same |

- The active item has a 2px indigo bar on its left and white text.
- Section labels are 11px, uppercase, tracking 0.06em, in `--sidebar-muted`.
- Count badges on the sidebar stay readable on navy.

### Type
- Inter, already loaded. Turn on `font-feature-settings: 'cv11', 'ss01'` on html.
- Add a `.num` utility, `font-variant-numeric: tabular-nums`, for every number and time. Replace `font-mono` on numbers (times, durations, money, counts, the clock) with `.num` in Inter.
- Keep JetBrains Mono only for identifiers: task keys (`TaskKey`), codes and the Ctrl K hint.
- Page title (PageHeader): 22px, semibold, tracking-tight. The description is 13px muted.
- Section titles (h2): 15px semibold.
- Body text is 14px. Table cells are 13px.

### Surfaces
- Cards are `rounded-lg` (10px) with a 1px border and a shadow of `0 1px 2px rgb(16 24 40 / 0.04)`. No shadow in dark mode.
- A card header has the title plus right-aligned actions, 14px padding and a border under it.
- Tables:
  - The header row is 11px, uppercase, tracking 0.04em, `fg-subtle`, on surface-2. It is 36px tall and body rows are 40px.
  - Hover is `surface-2/60`. Numeric cells use `.num`.
  - The table sits inside a card frame with rounded corners and overflow hidden.
- Badges and StatusBadge:
  - A 20px-tall pill, 12px medium text, with a 6px dot coloured by status on a soft background.
  - Neutral statuses (Ended, Not started) get a grey dot on surface-2.
- Buttons:
  - 32px tall, `rounded-md`.
  - Primary is solid indigo. Secondary is white with a border and shadow-xs. Ghost has no border.
  - `sm` is 28px.
  - A clear 2px focus ring in the ring colour, offset by 2px.
- Inputs and Selects: 34px, `rounded-md`, with the same focus ring.

### Shell
- **Sidebar.** Navy, 232px wide, with the logo row on top. The collapse button sits at the bottom. The mobile tab bar is unchanged apart from colours.
- **TopBar.** 56px, surface colour with a bottom border. Breadcrumb on the left, then search (a surface-2 field with a border), the work status chip, notifications, theme toggle and avatar.
- **Content.** Max width 1280px, centred, with 24px padding (16px on mobile).

### Charts
- `charts/colors.ts`: `--chart-1` becomes the indigo accent. Keep the others distinct.
- TimelineBar:
  - Work is indigo, break amber, idle hatched and offline hatched grey.
  - Bar height 12px, `rounded-full` track. Hour labels are 11px `.num`.
  - The "now" marker is a 2px fg line.

## B. My day (`resources/js/pages/Attendance/MyDayPage.tsx`)

1. **Today first.**
   - The week table is newest first. It shows only days up to and including today; future days appear only in the chart.
   - Today's row reads "Today", has an accent-soft background, and is bold.
2. **Attention strip.** This replaces the "Needs attention this month" table at the bottom.
   - When `recent_days` is not empty, show a compact warning-soft strip directly under the page header: "N days need attention".
   - Each day is listed inline as `Mon 23 Nov · Late 38m` with a small "Regularise" ghost button. When the request is pending, show a "Pending" badge in place of the button; when it was rejected, show the rejection note in its title.
   - Show at most 3 days, then a "+N more" toggle that expands the strip.
3. **Compact hero card.** One card that holds:
   - Row 1, left: StatusBadge and the late, early, grade and overtime chips. Right: the action buttons in a row (Take a break or Resume, End my day, Start work, Start overtime).
   - Row 2: the clock, 40px `.num` semibold, then the since text and the break, offline and idle totals in 13px muted.
   - Row 3: a linear progress bar to the daily target (6px, rounded, accent fill, success colour at 100%), labelled `6h 12m of 8h · 78%`. This replaces the Ring.
   - Row 4: TimelineBar.
   - Row 5, separated by a top border: the current task select inline with its hint.
   - The late-rule sentence is a single 12px muted line under the chips.
4. **Today's intervals, collapsible.**
   - A section with a one-line summary button: `Today's intervals · Work 6h 2m · Break 40m · Offline 5m · 7 intervals` and a chevron. It has `aria-expanded` and `aria-controls`.
   - Collapsed by default. Remember the choice in localStorage key `hr.myday.intervals`, wrapped in try/catch.
   - Expanded, it shows the table newest first, with the running interval on top.
   - The offline and idle parts of the summary appear only when they are 1 minute or more.
5. **This week.** Chart and stats as now, but tighter, with the table described in item 1 below them.
6. **Unchanged:** all dialogs, regularization behaviour, the leave banner text, data props, routes and server code.

## Done when
- `npx tsc --noEmit` and `pnpm build` pass.
- `pnpm smoke` passes. Run it only from the main session, because it resets the local DB.
- A Haiku visual QA on the screenshots finds no overlap, clipping, unreadable contrast or broken tables, in both light and dark.
