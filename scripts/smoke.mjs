// End-to-end smoke test against Laravel (php artisan serve) in system Chrome.
// Usage: pnpm smoke            (SMOKE_PORT, default 8199)
// WARNING: resets the local `vivacom_hr` database with `migrate:fresh --seed` first. E2E_NO_RESET=1 skips that.
// Builds assets when public/build is missing (E2E_BUILD=1 forces it); uses `pnpm dev` instead when public/hot exists.
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { chipText, clickText, launchBrowser, loginDemo, pathOf, root, signOut, startLaravel, track, wait, waitForChip } from './lib/laravel.mjs'

const PORT = Number(process.env.SMOKE_PORT) || 8199
const shots = path.join(root, 'scripts', 'screens')
rmSync(shots, { recursive: true, force: true })
mkdirSync(shots, { recursive: true })

const roles = [
  { key: 'employee', button: 'Imran Kabir' }, // Sadia ended her day in the core flow,
  { key: 'lead', button: 'Tanvir Hossain' },
  { key: 'hr', button: 'Nasrin Akter' },
  { key: 'management', button: 'Rafiq Ahmed' },
  { key: 'contractor', button: 'Nusrat Jahan' },
]
// Routes served by Laravel so far. Everything else found in the nav is reported as skipped until its module is ported.
const PORTED = new Set(['/', '/account/password', '/my-day', '/team', '/team/history', '/team/regularizations', '/leave', '/leave/approvals', '/leave/calendar', '/leave/policy', '/projects', '/tasks'])
for (const r of ['/people']) PORTED.add(r) // people module
for (const r of ['/payroll', '/payslips']) PORTED.add(r) // payroll module
for (const r of ['/inbox', '/chat', '/settings', '/settings/attendance', '/settings/payroll', '/settings/leave-types', '/settings/holidays']) PORTED.add(r) // platform + settings
for (const r of ['/reports', '/team/sheet', '/me/statement']) PORTED.add(r) // reports module
for (const r of ['/clients', '/invoices', '/claims']) PORTED.add(r) // billing module
const mobileRoutes = ['/']

const results = [] // { area, item, status: ok|FAIL|skip, notes }
const rec = (area, item, ok, notes = []) => results.push({ area, item, status: ok ? 'ok' : 'FAIL', notes })

const { base: BASE, stop } = await startLaravel(PORT)

async function coreFlow(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  let beats = 0
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/heartbeat') beats++
  })
  const step = async (item, fn) => {
    errors.length = 0
    try {
      const notes = (await fn()) ?? []
      rec('core', item, notes.length === 0 && errors.length === 0, [...notes, ...errors])
    } catch (e) {
      rec('core', item, false, [String(e.message).slice(0, 200), ...errors])
    }
    await page.screenshot({ path: path.join(shots, `core-${results.length}.png`) }).catch(() => {})
  }

  await step('login page renders', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
    const info = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent,
      demo: !!document.getElementById('demo-accounts'),
      email: !!document.querySelector('input[type="email"]'),
    }))
    const n = []
    if (info.h1 !== 'Sign in') n.push(`h1 "${info.h1}"`)
    if (!info.email) n.push('no email field')
    if (!info.demo) n.push('no demo accounts list')
    return n
  })
  await step('Sadia signs in → Home, top bar, chip Working', async () => {
    await loginDemo(BASE, page, 'Sadia Sultana')
    await waitForChip(page, 'Working')
    const p = await pathOf(page)
    const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent ?? '')
    const n = []
    if (p !== '/') n.push(`path ${p}`)
    if (!/Sadia/.test(h1)) n.push(`h1 "${h1}"`)
    return n
  })
  await step('heartbeat request fires', async () => {
    await wait(1500)
    return beats > 0 ? [] : ['no POST /heartbeat seen']
  })
  await step('take a break → On break', async () => {
    await clickText(page, 'Take a break', '[data-testid="work-chip"] button')
    await page.waitForSelector('[role="dialog"]')
    await clickText(page, 'Start break', '[role="dialog"] button')
    await waitForChip(page, 'On break')
  })
  await step('resume → Working', async () => {
    await clickText(page, 'Resume', '[data-testid="work-chip"] button')
    await waitForChip(page, 'Working')
  })
  await step('timer ticks locally', async () => {
    const a = await chipText(page)
    await wait(2200)
    const b = await chipText(page)
    return a !== b ? [] : [`chip unchanged: ${a}`]
  })
  await step('sign out, end day → login page', async () => {
    await signOut(page, 'end_day')
  })
  await page.close()
}

async function roleSweep(browser, role) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  try {
    await loginDemo(BASE, page, role.button)
  } catch (e) {
    rec(role.key, 'login', false, [String(e.message).slice(0, 200), ...errors])
    await page.close()
    return
  }
  const links = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('aside a[href^="/"], nav a[href^="/"]')].map((a) => a.getAttribute('href')))],
  )
  const routes = new Set(['/', ...links])
  for (const r of routes) {
    if (!PORTED.has(r)) {
      results.push({ area: role.key, item: r, status: 'skip', notes: ['not ported yet'] })
      continue
    }
    await check(page, errors, role.key, r)
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  for (const r of mobileRoutes) await check(page, errors, `${role.key} (390)`, r, true)
  await page.setViewport({ width: 1366, height: 900 })
  // Sign out for a break so the next run of this role resumes cleanly.
  await signOut(page, 'break').catch((e) => rec(role.key, 'sign out', false, [e.message]))
  await page.close()
}

async function check(page, errors, area, route, mobile = false) {
  errors.length = 0
  const notes = []
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 20000 })
    await wait(250)
    const info = await page.evaluate(() => ({
      empty: !document.getElementById('app')?.children.length,
      h1: !!document.querySelector('h1'),
      topbar: !!document.querySelector('[data-testid="topbar"]'),
      path: location.pathname,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }))
    if (info.empty) notes.push('blank app root')
    if (!info.h1) notes.push('no h1')
    if (!info.topbar) notes.push('top bar missing')
    if (info.overflowX) notes.push('horizontal overflow')
    if (info.path !== route) notes.push(`redirected to ${info.path}`)
    const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '-')
    await page.screenshot({ path: path.join(shots, `${area.replace(/\W+/g, '')}-${slug}.png`) })
  } catch (e) {
    notes.push(`nav error: ${e.message.slice(0, 120)}`)
  }
  notes.push(...errors)
  rec(area, route, notes.length === 0, notes)
}

function report() {
  const bad = results.filter((r) => r.status === 'FAIL')
  const skipped = results.filter((r) => r.status === 'skip')
  for (const r of results) {
    if (r.status === 'skip') continue
    console.log(`${r.status.padEnd(4)} ${r.area.padEnd(18)} ${r.item}${r.notes.length ? `\n       ${r.notes.join('\n       ')}` : ''}`)
  }
  console.log(`\n${results.length - skipped.length - bad.length} ok, ${bad.length} failed, ${skipped.length} skipped (not ported). Screens: scripts/screens/`)
  return bad.length
}

let failures = 1
try {
  const browser = await launchBrowser()
  try {
    await coreFlow(browser)
    for (const role of roles) await roleSweep(browser, role)
  } finally {
    await browser.close()
  }
  failures = report()
} finally {
  stop()
}
process.exit(failures ? 1 : 0)
