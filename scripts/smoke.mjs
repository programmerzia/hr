// Runtime smoke test: drives the real app in system Chrome for every demo role.
// Usage: pnpm smoke   (starts its own Vite dev server on port 5199)
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shots = path.join(root, 'scripts', 'screens')
const PORT = 5199
const BASE = `http://localhost:${PORT}`
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome'

rmSync(shots, { recursive: true, force: true })
mkdirSync(shots, { recursive: true })

const roles = [
  { key: 'employee', button: 'Sadia Sultana' },
  { key: 'lead', button: 'Tanvir Hossain' },
  { key: 'hr', button: 'Nasrin Akter' },
  { key: 'management', button: 'Rafiq Ahmed' },
  { key: 'contractor', button: 'Nusrat Jahan' },
]
const mobileRoutes = ['/', '/my-day', '/tasks', '/chat']

try {
  await fetch(BASE)
  console.error(`Port ${PORT} is already in use. Stop whatever is serving it and run again.`)
  process.exit(1)
} catch {
  // free
}

const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' })
const stop = () => server.kill('SIGTERM')
process.on('exit', stop)
process.on('SIGINT', () => {
  stop()
  process.exit(1)
})

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('dev server did not start')
}

const results = [] // { role, route, status, notes }
const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/[/?=&]/g, '-'))

async function main() {
  await waitForServer()
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
  try {
    for (const role of roles) await runRole(browser, role)
    await attendanceLoop(browser)
    await keyboard(browser)
    await darkMode(browser)
  } finally {
    await browser.close()
    stop()
  }
  report()
}

function track(page) {
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const t = m.text()
      if (/Download the React DevTools/.test(t)) return
      errors.push(`console.${m.type()}: ${t.slice(0, 300)}`)
    }
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 300)}`))
  return errors
}

async function login(page, name) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  const btn = await page.evaluateHandle((n) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(n)), name)
  await btn.asElement().click()
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 5000 })
  await new Promise((r) => setTimeout(r, 500))
}

async function check(page, errors, role, route, { shot = true, mobile = false } = {}) {
  const notes = []
  errors.length = 0
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 20000 })
    await new Promise((r) => setTimeout(r, 250))
    const info = await page.evaluate(() => {
      const root = document.getElementById('root')
      const text = document.body.innerText
      return {
        empty: !root || root.children.length === 0,
        boundary: /Unexpected Application Error|Something went wrong/i.test(text),
        h1: !!document.querySelector('h1'),
        path: location.pathname + location.search,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        noAccess: /don.t have access|no access/i.test(text),
      }
    })
    if (info.empty) notes.push('blank root')
    if (info.boundary) notes.push('error boundary')
    if (!info.h1 && !mobile) notes.push('no h1')
    if (info.overflowX) notes.push('horizontal overflow')
    if (info.noAccess) notes.push('no-access page')
    if (info.path !== route && !route.includes('?') && route !== '/chat') notes.push(`redirected to ${info.path}`)
    if (shot) await page.screenshot({ path: path.join(shots, `${role}-${slug(route)}${mobile ? '-mobile' : ''}.png`) })
  } catch (e) {
    notes.push(`nav error: ${e.message.slice(0, 120)}`)
  }
  notes.push(...errors.map((e) => e))
  results.push({ role: role + (mobile ? ' (390)' : ''), route, status: notes.length ? 'ERROR' : 'ok', notes })
}

async function runRole(browser, role) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  await login(page, role.button)
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
  const links = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('aside a[href^="/"], nav a[href^="/"]')].map((a) => a.getAttribute('href')))],
  )
  const routes = new Set(['/', ...links, '/my-day', '/inbox', '/chat', '/projects/PULSE', '/tasks', '/projects', '/claims'])
  // Discover ids from list pages.
  await page.goto(BASE + '/projects/PULSE', { waitUntil: 'networkidle0' })
  const key = await page.evaluate(() => (document.body.innerText.match(/PULSE-\d+/) || [])[0])
  routes.add(`/projects/PULSE?task=${key || 'PULSE-1'}`)
  routes.add('/projects/PULSE/list')
  // Detail pages are reached by clicking the first row of each list (rows are click targets, not links).
  for (const list of ['/payroll', '/invoices', '/claims', '/people', '/payslips']) {
    if (!links.includes(list)) continue
    await page.goto(BASE + list, { waitUntil: 'networkidle0' })
    const row = await page.$('main tbody tr')
    if (!row) continue
    await row.click()
    await new Promise((r) => setTimeout(r, 400))
    const here = await page.evaluate(() => location.pathname)
    if (here !== list) {
      routes.add(here)
      if (list === '/payroll') {
        const ps = await page.evaluate(() => [...document.querySelectorAll('main a[href*="/payslip/"]')].map((a) => a.getAttribute('href'))[0])
        if (ps) routes.add(ps)
        else {
          const r2 = await page.$('main tbody tr')
          if (r2) {
            await r2.click()
            await new Promise((r) => setTimeout(r, 400))
            const p2 = await page.evaluate(() => location.pathname)
            if (p2.includes('/payslip/')) routes.add(p2)
          }
        }
      }
      if (list === '/invoices') routes.add(here + '/print')
    }
  }
  if (role.key === 'employee' || role.key === 'lead') routes.add('/payslips')
  for (const r of routes) {
    // Skip routes the role cannot reach (known by guard) — report them as "no-access" only if they are in the sidebar.
    const inSidebar = links.includes(r)
    await check(page, errors, role.key, r)
    const last = results[results.length - 1]
    if (!inSidebar && last.notes.some((n) => n === 'no-access page' || n.startsWith('redirected'))) {
      last.status = 'n/a'
      last.notes = []
    }
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  for (const r of mobileRoutes) await check(page, errors, role.key, r, { mobile: true })
  await page.close()
}

async function clickText(page, text, selector = 'button, [role="menuitem"], [role="radio"], label') {
  const h = await page.evaluateHandle(
    (t, s) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim().startsWith(t) && b.offsetParent !== null),
    text,
    selector,
  )
  const el = h.asElement()
  if (!el) throw new Error(`no element with text "${text}"`)
  await el.click()
  await new Promise((r) => setTimeout(r, 200))
}

async function attendanceLoop(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  const notes = []
  try {
    await login(page, 'Sadia Sultana')
    await clickText(page, 'My day', 'a')
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'My day', { timeout: 5000 })
    await clickText(page, 'Take a break')
    await page.screenshot({ path: path.join(shots, 'employee-break-dialog.png') })
    await clickText(page, 'Start break')
    await page.waitForFunction(() => /Resume/.test(document.body.innerText), { timeout: 3000 })
    await clickText(page, 'Resume')
    await page.waitForFunction(() => /Take a break/.test(document.body.innerText), { timeout: 3000 })
    await page.click('button[aria-label="Account menu"]')
    await new Promise((r) => setTimeout(r, 200))
    await clickText(page, 'Sign out')
    await page.waitForSelector('[role="dialog"]')
    await clickText(page, 'End my day', '[role="dialog"] [role="radio"], [role="dialog"] label')
    await page.screenshot({ path: path.join(shots, 'employee-signout-dialog.png') })
    const confirm = await page.evaluateHandle(() =>
      [...document.querySelectorAll('[role="dialog"] button')].filter((b) => /sign out|end/i.test(b.textContent)).pop(),
    )
    await confirm.asElement().click()
    await page.waitForFunction(() => location.pathname === '/login', { timeout: 3000 })
  } catch (e) {
    notes.push(e.message.slice(0, 200))
  }
  notes.push(...errors)
  results.push({ role: 'employee', route: 'attendance loop', status: notes.length ? 'ERROR' : 'ok', notes })
  await page.close()
}

async function keyboard(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  const notes = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  try {
    await login(page, 'Tanvir Hossain')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyK')
    await page.keyboard.up('Control')
    await wait(300)
    if (!(await page.$('[role="dialog"]'))) notes.push('Ctrl+K did not open the palette')
    await page.screenshot({ path: path.join(shots, 'lead-palette.png') })
    await page.keyboard.press('Escape')
    await wait(300)
    if (await page.$('[role="dialog"]')) notes.push('Escape did not close the palette')
    await page.goto(BASE + '/projects/PULSE?task=PULSE-1', { waitUntil: 'networkidle0' })
    await wait(300)
    if (!(await page.$('[role="dialog"]'))) notes.push('task drawer did not open')
    await page.keyboard.press('Escape')
    await wait(300)
    if (await page.$('[role="dialog"]') || page.url().includes('task=')) notes.push('Escape did not close the task drawer')
  } catch (e) {
    notes.push(e.message.slice(0, 200))
  }
  notes.push(...errors)
  results.push({ role: 'lead', route: 'keyboard (palette, drawer)', status: notes.length ? 'ERROR' : 'ok', notes })
  await page.close()
}

async function darkMode(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = track(page)
  const notes = []
  try {
    await login(page, 'Rafiq Ahmed')
    await page.click('button[aria-label="Account menu"]')
    await clickText(page, 'Dark theme')
    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (!dark) notes.push('dark class not applied')
    for (const r of ['/', '/payroll', '/invoices', '/projects/PULSE', '/chat']) {
      await page.goto(BASE + r, { waitUntil: 'networkidle0' })
      await page.screenshot({ path: path.join(shots, `management-dark-${slug(r)}.png`) })
    }
  } catch (e) {
    notes.push(e.message.slice(0, 200))
  }
  notes.push(...errors)
  results.push({ role: 'management', route: 'dark mode', status: notes.length ? 'ERROR' : 'ok', notes })
  await page.close()
}

function report() {
  const bad = results.filter((r) => r.status === 'ERROR')
  console.log('\nrole'.padEnd(18) + 'route'.padEnd(60) + 'status')
  for (const r of results) console.log(r.role.padEnd(17) + r.route.padEnd(60) + r.status)
  console.log(`\n${results.length} checks, ${bad.length} with errors`)
  for (const r of bad) {
    console.log(`\n[${r.role}] ${r.route}`)
    for (const n of [...new Set(r.notes)]) console.log('  - ' + n)
  }
  stop()
  process.exit(bad.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  stop()
  process.exit(1)
})
