// QA flow walk against Laravel: PASS/FAIL per step with observed text.
// Usage: pnpm qa   (QA_PORT, default 8198)
// WARNING: resets the local `vivacom_hr` database with `migrate:fresh --seed` first. E2E_NO_RESET=1 skips that.
// Module flows from the mock era (onboarding, leave, tasks, payroll, billing, chat) are listed as SKIP until B1/B2 port
// their pages; add them back here as each module lands.
import { chipText, clickText, launchBrowser, loginDemo, loginEmail, pathOf, signOut, startLaravel, wait, waitForChip } from './lib/laravel.mjs'

const PORT = Number(process.env.QA_PORT) || 8198
const EMPLOYEE = process.env.QA_EMAIL || 'imran.kabir@vivacom.example'
const EMPLOYEE_NAME = 'Imran Kabir'
const SKIPPED = [
  ['1.x', 'HR onboards a person, first sign-in forces a password change'],
  ['2.x', 'Employee leave request and balances'],
  ['3.x', 'Team lead approves leave and regularizations'],
  ['4.x', 'Tasks, board, time tracking'],
  ['5.x', 'Payroll run and payslips'],
  ['6.x', 'Chat and inbox'],
]

const log = []
let page
const consoleErrors = []

async function step(id, desc, fn) {
  try {
    const { ok, observed } = await fn()
    log.push({ id, ok, desc, observed })
  } catch (e) {
    log.push({ id, ok: false, desc, observed: String(e.message).slice(0, 200) })
  }
  const last = log[log.length - 1]
  console.log(`${last.ok ? 'PASS' : 'FAIL'} ${id} ${desc}\n     ${last.observed}`)
}

const { base: BASE, stop } = await startLaravel(PORT)
let failed = 1
try {
  const browser = await launchBrowser()
  try {
    page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 900 })
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Download the React DevTools/.test(m.text())) consoleErrors.push(m.text().slice(0, 160))
    })
    page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 160)))

    await step('A.1', 'Wrong password shows the server error', async () => {
      await loginEmail(BASE, page, EMPLOYEE, 'nope-nope')
      const text = await page.evaluate(() => document.body.innerText)
      return { ok: (await pathOf(page)) === '/login' && /incorrect/i.test(text), observed: `path ${await pathOf(page)}` }
    })
    await step('A.2', `${EMPLOYEE_NAME} signs in by email form`, async () => {
      await loginEmail(BASE, page, EMPLOYEE, 'password')
      await page.waitForSelector('[data-testid="topbar"]', { timeout: 8000 })
      return { ok: (await pathOf(page)) === '/', observed: `path ${await pathOf(page)}, chip "${await chipText(page)}"` }
    })
    await step('A.3', 'Sign out for a break, sign back in resumes work', async () => {
      await signOut(page, 'break')
      await loginDemo(BASE, page, EMPLOYEE_NAME)
      await waitForChip(page, 'Working')
      return { ok: true, observed: `chip "${await chipText(page)}"` }
    })
    await step('A.4', 'End day, sign in again asks to confirm overtime', async () => {
      await signOut(page, 'end_day')
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
      await page.evaluate((n) => [...document.querySelectorAll('#demo-accounts ~ ul button')].find((b) => b.textContent.includes(n))?.click(), EMPLOYEE_NAME)
      await page.waitForSelector('[role="alertdialog"], [role="dialog"]', { timeout: 8000 })
      const t = await page.evaluate(() => document.querySelector('[role="alertdialog"], [role="dialog"]')?.textContent ?? '')
      return { ok: /overtime/i.test(t), observed: t.slice(0, 80) }
    })
    await step('A.5', 'Confirming overtime signs in and works', async () => {
      await clickText(page, 'Start overtime', '[role="alertdialog"] button, [role="dialog"] button')
      await page.waitForSelector('[data-testid="topbar"]', { timeout: 8000 })
      await waitForChip(page, 'Working')
      return { ok: (await pathOf(page)) === '/', observed: `chip "${await chipText(page)}"` }
    })
    const fillPasswords = async (a, b, c) => {
      await page.goto(`${BASE}/account/password`, { waitUntil: 'networkidle0' })
      const pw = await page.$$('input[type="password"]')
      await pw[0].type(a)
      await pw[1].type(b)
      await pw[2].type(c)
      await clickText(page, 'Change password', 'button')
      await wait(1200)
      return page.evaluate(() => document.body.innerText)
    }
    await step('A.6', 'Account page: mismatched confirmation is rejected client-side', async () => {
      const t = await fillPasswords('password', 'new-password-1', 'new-password-2')
      return { ok: /do not match/i.test(t), observed: /do not match/i.test(t) ? 'mismatch error shown' : 'no error' }
    })
    await step('A.7', 'Account page: wrong current password shows server error', async () => {
      const t = await fillPasswords('wrong-current', 'new-password-1', 'new-password-1')
      return { ok: /incorrect/i.test(t), observed: /incorrect/i.test(t) ? 'server error shown' : 'no error' }
    })
  } finally {
    await browser.close()
  }
  for (const [id, desc] of SKIPPED) console.log(`SKIP ${id} ${desc} (module not ported yet)`)
  if (consoleErrors.length) console.log(`\nConsole errors:\n  ${[...new Set(consoleErrors)].join('\n  ')}`)
  failed = log.filter((l) => !l.ok).length
  console.log(`\n${log.length - failed} passed, ${failed} failed, ${SKIPPED.length} skipped`)
} finally {
  stop()
}
process.exit(failed ? 1 : 0)
