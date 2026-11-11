// Shared e2e harness: resets the local DB, makes sure assets exist, starts `php artisan serve`, launches Chrome.
// WARNING: unless E2E_NO_RESET=1, this runs `php artisan migrate:fresh --seed`, wiping the local `vivacom_hr` data.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome'
export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function startLaravel(port) {
  const base = `http://127.0.0.1:${port}`
  try {
    await fetch(base)
    console.error(`Port ${port} is already in use. Stop whatever is serving it, or set SMOKE_PORT.`)
    process.exit(1)
  } catch {
    // free
  }

  if (process.env.E2E_NO_RESET !== '1') {
    console.log('Resetting local database (migrate:fresh --seed)…')
    execFileSync('php', ['artisan', 'migrate:fresh', '--seed', '--force'], { cwd: root, stdio: 'inherit' })
  }
  // public/hot means `pnpm dev` is running and Laravel serves assets from it; otherwise we need a build.
  if (!existsSync(path.join(root, 'public', 'hot')) && (process.env.E2E_BUILD === '1' || !existsSync(path.join(root, 'public', 'build', 'manifest.json')))) {
    console.log('Building assets (pnpm build)…')
    execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  }

  // Own process group so stop() takes down artisan and the php -S child it spawns, and nothing else.
  const server = spawn('php', ['artisan', 'serve', '--host=127.0.0.1', `--port=${port}`, '--no-reload'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  })
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      // already gone
    }
  }
  process.on('exit', stop)
  process.on('SIGINT', () => {
    stop()
    process.exit(1)
  })

  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/login`)
      if (r.ok) break
    } catch {
      /* not up yet */
    }
    if (i === 99) throw new Error('php artisan serve did not start')
    await wait(200)
  }
  return { base, stop }
}

export async function launchBrowser() {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
}

/** Collects console errors/warnings and page errors on a page. */
export function track(page) {
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

export async function clickText(page, text, selector = 'button, [role="menuitem"], [role="radio"], label, a') {
  const h = await page.evaluateHandle(
    (t, s) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim().startsWith(t) && b.offsetParent !== null),
    text,
    selector,
  )
  const el = h.asElement()
  if (!el) throw new Error(`no element with text "${text}"`)
  await el.click()
}

export const pathOf = (page) => page.evaluate(() => location.pathname)
export const chipText = (page) =>
  page.evaluate(() => document.querySelector('[data-testid="work-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '')

export async function waitForChip(page, label, timeout = 8000) {
  await page.waitForFunction(
    (l) => document.querySelector('[data-testid="work-chip"]')?.textContent?.includes(l),
    { timeout },
    label,
  )
}

/** Signs in through the demo account button with that name; waits for the app shell. */
export async function loginDemo(base, page, name) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle0' })
  const h = await page.evaluateHandle((n) => [...document.querySelectorAll('#demo-accounts ~ ul button')].find((b) => b.textContent.includes(n)), name)
  if (!h.asElement()) throw new Error(`no demo account "${name}"`)
  await h.asElement().click()
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 10000 })
  await page.waitForSelector('[data-testid="topbar"]', { timeout: 10000 })
}

export async function loginEmail(base, page, email, password) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle0' })
  await page.type('input[type="email"]', email)
  await page.type('input[type="password"]', password)
  await clickText(page, 'Sign in', 'button[type="submit"]')
  await wait(1200)
}

/** Opens the account menu → Sign out → picks the mode and confirms. */
export async function signOut(page, mode) {
  await page.click('[aria-label="Account menu"]')
  await wait(200)
  await clickText(page, 'Sign out', '[role="menuitem"]')
  await page.waitForSelector('[role="dialog"]')
  if (mode === 'end_day') await clickText(page, 'End my day', '[role="radio"], label')
  await clickText(page, mode === 'end_day' ? 'End my day' : 'Sign out for a break', '[role="dialog"] button')
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 10000 })
}
