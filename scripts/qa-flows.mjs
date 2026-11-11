// QA flow walk against Laravel: PASS/FAIL per step with observed text.
// Usage: SMOKE_PORT=8051 pnpm qa   (QA_PORT or SMOKE_PORT, default 8198)
// WARNING: resets the local `vivacom_hr` database with `migrate:fresh --seed` first. E2E_NO_RESET=1 skips that.
// Sections: A auth and attendance basics; B HR onboarding and forced password change; C time tracking;
// D work (board, task drawer, projects); E leave two-stage approval; F payroll run and payslip, contractor claim.
import { chipText, clickText, launchBrowser, loginDemo, loginEmail, pathOf, signOut, startLaravel, wait, waitForChip } from './lib/laravel.mjs'

const PORT = Number(process.env.QA_PORT || process.env.SMOKE_PORT) || 8198
const EMPLOYEE = process.env.QA_EMAIL || 'imran.kabir@vivacom.example'
const EMPLOYEE_NAME = 'Imran Kabir'
const HR_EMAIL = 'nasrin.akter@vivacom.example'
const PERSON_EMAIL = 'test.person@vivacom.example'
const TS = String(Date.now()).slice(-6)
const KEY_LETTERS = TS.split('').map((c) => String.fromCharCode(65 + (Number(c) % 26))).join('')
const SKIPPED = []

const log = []
let page
let browser
const consoleErrors = []

async function step(id, desc, fn) {
  try {
    const { ok, observed } = await fn()
    log.push({ id, ok, desc, observed })
  } catch (e) {
    const diag = await page.evaluate(() => `${location.pathname} :: ${document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)}`).catch(() => '')
    e.message = `${e.message} [${diag}]`
    log.push({ id, ok: false, desc, observed: String(e.message).slice(0, 240) })
  }
  const last = log[log.length - 1]
  console.log(`${last.ok ? 'PASS' : 'FAIL'} ${id} ${desc}\n     ${last.observed}`)
}

const { base: BASE, stop } = await startLaravel(PORT)
let failed = 1
try {
  browser = await launchBrowser()
  // Each role gets its own browser context, so sessions never leak between accounts.
  const freshPage = async () => {
    const ctx = await browser.createBrowserContext()
    page = await ctx.newPage()
    await page.setViewport({ width: 1366, height: 900 })
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Download the React DevTools/.test(m.text())) consoleErrors.push(m.text().slice(0, 160))
    })
    page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 160)))
    return page
  }
  const bodyText = () => page.evaluate(() => document.body.innerText)
  const snip = (t, re) => {
    const i = Math.max(0, re ? t.search(re) : 0)
    return t.slice(Math.max(0, i - 40), i + 140).replace(/\s+/g, ' ').trim()
  }
  const waitBody = (re, timeout = 8000) =>
    page.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), { timeout }, re.source)
  const waitPath = (re, timeout = 8000) =>
    page.waitForFunction((s) => new RegExp(s).test(location.pathname), { timeout }, re.source)
  const hasTopbar = () => page.evaluate(() => !!document.querySelector('[data-testid="topbar"]'))

  /** Sets a native input, select or textarea by its label (scoped to an open dialog when there is one). */
  function setNative(el, v) {
    const tag = el.tagName
    if (tag === 'SELECT') {
      const o = [...el.options].find((x) => x.textContent.trim().startsWith(v) || x.value === v)
      if (!o) throw new Error(`no option "${v}" in [${[...el.options].map((x) => x.textContent.trim()).join(' | ')}]`)
      v = o.value
    }
    const proto = tag === 'SELECT' ? HTMLSelectElement.prototype : tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  async function fieldEl(label) {
    const h = await page.evaluateHandle((l) => {
      const scope = document.querySelector('[role="dialog"]') || document
      const labels = [...scope.querySelectorAll('label')].filter((x) => x.offsetParent !== null)
      const lab = labels.find((x) => x.textContent.replace(/\*/g, '').trim().startsWith(l)) ?? labels.find((x) => x.textContent.replace(/\*/g, '').trim().startsWith(l))
      if (!lab) return null
      return (lab.htmlFor && document.getElementById(lab.htmlFor)) || lab.querySelector('input,select,textarea')
    }, label)
    const el = h.asElement()
    if (!el) throw new Error(`no field labelled "${label}"`)
    return el
  }
  const isNative = (el) => el.evaluate((e) => ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.tagName))
  async function pickOption(el, text) {
    await el.click()
    await wait(300)
    const ok = await page.evaluate((t) => {
      const o = [...document.querySelectorAll('[role="option"]')].find((x) => x.textContent.trim().startsWith(t))
      if (!o) return false
      o.click()
      return true
    }, text)
    await wait(300)
    if (!ok) {
      await page.keyboard.press('Escape')
      throw new Error(`no option "${text}" in the open picker`)
    }
  }
  const setField = async (label, v) => {
    const el = await fieldEl(label)
    if (await isNative(el)) return el.evaluate(setNative, v)
    return pickOption(el, v)
  }
  async function selectOther(label) {
    const el = await fieldEl(label)
    if (await isNative(el)) {
      const next = await el.evaluate((s) => [...s.options].find((o) => o.value && o.value !== s.value)?.textContent.trim())
      await el.evaluate(setNative, next)
      return next
    }
    await el.click()
    await wait(300)
    const next = await page.evaluate(() => {
      const o = [...document.querySelectorAll('[role="option"]')].find((x) => x.getAttribute('aria-selected') !== 'true' && x.getAttribute('data-disabled') === null)
      if (!o) return null
      const t = o.textContent.trim()
      o.click()
      return t
    })
    await wait(300)
    if (!next) {
      await page.keyboard.press('Escape')
      throw new Error('no alternative option in the open picker')
    }
    return next
  }
  const clickBtn = (text) => clickText(page, text, 'button')
  const clickDlg = (text) => clickText(page, text, '[role="dialog"] button, [role="alertdialog"] button')
  async function clickInRow(needle, btn) {
    const ok = await page.evaluate(
      (n, b) => {
        const rows = [...document.querySelectorAll('tr, [role="row"], li, article')]
          .filter((r) => r.offsetParent !== null && r.textContent.includes(n))
          .sort((a, c) => a.textContent.length - c.textContent.length)
        for (const r of rows) {
          const x = [...r.querySelectorAll('button')].find((y) => y.textContent.trim().startsWith(b))
          if (x) {
            x.click()
            return true
          }
        }
        return false
      },
      needle,
      btn,
    )
    if (!ok) throw new Error(`no "${btn}" button in a row containing "${needle}"`)
  }
  async function clickRow(...needles) {
    const ok = await page.evaluate((ns) => {
      for (const n of ns) {
        const r = [...document.querySelectorAll('tr, [role="row"]')]
          .filter((x) => x.offsetParent !== null && x.textContent.includes(n))
          .sort((a, b) => a.textContent.length - b.textContent.length)[0]
        if (r) {
          r.click()
          return true
        }
      }
      return false
    }, needles)
    if (!ok) throw new Error(`no row containing ${needles.join(' or ')}`)
  }
  // Casual leave balance card: "Casual leave" / "<available> of <entitled>" / "<used> used, <pending> pending".
  const casualBalance = (t) => {
    const m = t.match(/Casual leave\s+([\d.]+) of ([\d.]+)\s+([\d.]+) used, ([\d.]+) pending/)
    return m ? `available ${m[1]} of ${m[2]}, used ${m[3]}, pending ${m[4]}` : 'no casual balance card'
  }

  // ---------- A (unchanged) ----------
  await freshPage()
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

  // ---------- B. HR onboarding ----------
  await step('B.1', 'HR creates Test Person in the onboarding wizard; profile shows Sign-in details', async () => {
    await freshPage()
    await loginEmail(BASE, page, HR_EMAIL, 'password')
    await page.goto(`${BASE}/people/onboard`, { waitUntil: 'networkidle0' })
    await setField('Full name', 'Test Person')
    await setField('Work email', PERSON_EMAIL)
    await setField('Phone', '+8801712345678')
    await setField('National ID', '1234567890123')
    await clickBtn('Continue')
    const deptOpts = await (await fieldEl('Department')).evaluate((s) => [...s.options].map((o) => o.textContent.trim()))
    for (const d of deptOpts) {
      await setField('Department', d)
      const teams = await (await fieldEl('Team')).evaluate((s) => [...s.options].map((o) => o.textContent.trim()))
      if (teams.some((t) => t.startsWith('Web platform'))) break
    }
    await setField('Team', 'Web platform')
    await setField('Designation', 'QA Engineer')
    const type = await (await fieldEl('Employment type')).evaluate((s) => `${s.value} (${s.options[s.selectedIndex]?.textContent.trim()})`)
    await clickBtn('Continue')
    await setField('Basic', '50000')
    await setField('House rent', '25000')
    await setField('Medical', '5000')
    await setField('Conveyance', '3000')
    await setField('Bank', 'City Bank')
    await setField('Branch', 'Gulshan')
    await setField('Account name', 'Test Person')
    await setField('Account number', '1234567890')
    await setField('Routing number', '123456789')
    await clickBtn('Continue')
    await clickBtn('Create person')
    await waitBody(/Sign-in details/, 10000)
    const t = await bodyText()
    const ok = t.includes(PERSON_EMAIL) && /welcome123/.test(t) && /\/people\/\d+/.test(await pathOf(page))
    return { ok, observed: `path ${await pathOf(page)}; employment ${type}; ${snip(t, /Sign-in details/)}` }
  })
  await step('B.2', 'Sign out (break); test.person signs in with welcome123 and is forced to /account/password', async () => {
    await signOut(page, 'break')
    await loginEmail(BASE, page, PERSON_EMAIL, 'welcome123')
    await waitPath(/^\/account\/password$/).catch(() => {})
    const path = await pathOf(page)
    const t = await bodyText()
    return { ok: path === '/account/password' && !(await hasTopbar()), observed: `path ${path}, topbar ${await hasTopbar()}, ${snip(t, /password/i)}` }
  })
  await step('B.3', 'Set new password Testpass123! and land on Home', async () => {
    await setField('Current password', 'welcome123')
    await setField('New password', 'Testpass123!')
    await setField('Confirm new password', 'Testpass123!')
    await clickBtn('Change password')
    await waitPath(/^\/$/, 10000).catch(() => {})
    await page.waitForSelector('[data-testid="topbar"]', { timeout: 8000 }).catch(() => {})
    const path = await pathOf(page)
    return { ok: path === '/' && (await hasTopbar()), observed: `path ${path}, chip "${await chipText(page)}"` }
  })
  await step('B.4', 'Sign out, sign in with the new password lands on Home', async () => {
    await signOut(page, 'break')
    await loginEmail(BASE, page, PERSON_EMAIL, 'Testpass123!')
    await waitPath(/^\/$/, 8000).catch(() => {})
    const path = await pathOf(page)
    return { ok: path === '/' && (await hasTopbar()), observed: `path ${path}, topbar ${await hasTopbar()}` }
  })
  await step('B.5', 'Sign out, welcome123 no longer works', async () => {
    await signOut(page, 'break')
    await loginEmail(BASE, page, PERSON_EMAIL, 'welcome123')
    const path = await pathOf(page)
    const t = await bodyText()
    return { ok: path === '/login' && /incorrect|invalid|do not match|wrong|not match/i.test(t), observed: `path ${path}, ${snip(t, /incorrect|invalid|wrong|match/i)}` }
  })

  // ---------- C. Time tracking (Sadia) ----------
  await step('C.1', 'Sadia signs in, chip shows Working', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Sadia Sultana')
    await waitForChip(page, 'Working')
    return { ok: /Working/.test(await chipText(page)), observed: `chip "${await chipText(page)}"` }
  })
  await step('C.2', 'Take a break (Lunch) shows On break', async () => {
    await clickText(page, 'Take a break', 'button')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await clickText(page, 'Lunch', '[role="radio"], label, button')
    await clickText(page, 'Start break', '[role="dialog"] button')
    await waitForChip(page, 'On break')
    return { ok: /On break/.test(await chipText(page)), observed: `chip "${await chipText(page)}"` }
  })
  await step('C.3', 'Resume shows Working again', async () => {
    await clickText(page, 'Resume', 'button')
    await waitForChip(page, 'Working')
    return { ok: /Working/.test(await chipText(page)), observed: `chip "${await chipText(page)}"` }
  })
  await step('C.4', 'My day: pick current task if a picker exists; tracked time shows', async () => {
    await page.goto(`${BASE}/my-day`, { waitUntil: 'networkidle0' })
    const h = await page.$('[aria-label="Current task"]')
    if (!h) {
      const t = await bodyText()
      return { ok: /Tracked today|Worked/.test(t), observed: `no current-task picker; ${snip(t, /Tracked today|Worked/)}` }
    }
    const tag = await h.evaluate((e) => e.tagName)
    let picked
    if (tag === 'SELECT') {
      picked = await h.evaluate((s) => [...s.options].find((o) => o.value && !/^No task/i.test(o.textContent.trim()))?.textContent.trim())
      await h.evaluate(setNative, picked)
    } else {
      await h.click()
      await wait(300)
      picked = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find((o) => !/^No task/i.test(o.textContent.trim()))?.textContent.trim())
      await page.evaluate((p) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === p)?.click(), picked)
    }
    await wait(800)
    const t = await bodyText()
    const ok = !!picked && (t.includes(picked.slice(0, 20)) || /Tracked today/.test(t))
    return { ok, observed: `picked "${picked}"; ${snip(t, /Tracked today|Current task/)}` }
  })
  await step('C.5', 'End my day returns to the login page', async () => {
    await signOut(page, 'end_day')
    return { ok: (await pathOf(page)) === '/login', observed: `path ${await pathOf(page)}` }
  })
  await step('C.6', 'Sign in again asks to confirm overtime, then Home', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
    await page.evaluate(() => [...document.querySelectorAll('#demo-accounts ~ ul button')].find((b) => b.textContent.includes('Sadia Sultana'))?.click())
    await page.waitForSelector('[role="alertdialog"], [role="dialog"], [data-testid="topbar"]', { timeout: 8000 })
    const asked = await page.evaluate(() => /overtime/i.test(document.body.innerText))
    if (asked) await clickText(page, 'Start overtime', '[role="alertdialog"] button, [role="dialog"] button')
    await page.waitForSelector('[data-testid="topbar"]', { timeout: 8000 })
    return { ok: asked && (await pathOf(page)) === '/', observed: `overtime confirm ${asked}; path ${await pathOf(page)}` }
  })

  // ---------- D. Work (Tanvir) ----------
  const taskTitle = `QA task ${TS}`
  let taskKey = ''
  await step('D.1', 'Tanvir opens the PULSE board from /projects', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Tanvir Hossain')
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle0' })
    const clicked = await page.evaluate(() => {
      const a = document.querySelector('a[href$="/projects/PULSE/board"]')
      if (a) a.click()
      return !!a
    })
    await waitPath(/\/projects\/PULSE\/board/, 8000).catch(() => {})
    return { ok: clicked && /\/projects\/PULSE\/board/.test(await pathOf(page)), observed: `path ${await pathOf(page)}` }
  })
  await step('D.2', 'Create a task with Add task, assigned to Sadia, shows on the board', async () => {
    await clickBtn('Add task')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await setField('Title', taskTitle)
    await setField('Assignee', 'Sadia')
    await clickDlg('Create task')
    await waitBody(new RegExp(taskTitle), 8000)
    const t = await bodyText()
    // The card shows its key right before the title; take the last key before the title, not a neighbour's.
    const before = t.slice(Math.max(0, t.indexOf(taskTitle) - 200), t.indexOf(taskTitle))
    const keys = before.match(/PULSE-\d+/g)
    const m = keys ? [keys[keys.length - 1]] : t.slice(t.indexOf(taskTitle), t.indexOf(taskTitle) + 200).match(/PULSE-\d+/)
    taskKey = m ? m[0] : ''
    return { ok: !!taskKey, observed: `key ${taskKey || 'not found'}; ${snip(t, new RegExp(taskTitle))}` }
  })
  await step('D.3', 'Open the task via ?task=KEY and change its status in the drawer', async () => {
    await page.goto(`${BASE}/projects/PULSE/board?task=${taskKey}`, { waitUntil: 'networkidle0' })
    await waitBody(new RegExp(taskTitle), 8000)
    const next = await selectOther('Status')
    await wait(800)
    const t = await bodyText()
    return { ok: !!next, observed: `status set to "${next}"; ${snip(t, /Activity/)}` }
  })
  await step('D.4', 'Assign to Sadia and post a comment from the drawer', async () => {
    await setField('Assignee', 'Sadia')
    await wait(500)
    const c = await page.$('[aria-label="Comment"]')
    if (!c) throw new Error('no comment box in drawer')
    await c.click()
    await c.type(`QA comment ${TS}`)
    await clickText(page, 'Comment', '[role="dialog"] button, button')
    await waitBody(new RegExp(`QA comment ${TS}`), 8000)
    return { ok: true, observed: 'comment posted' }
  })
  await step('D.5', 'Activity lists the status, assignee and comment changes', async () => {
    const t = await bodyText()
    const i = t.lastIndexOf('Activity')
    const section = i >= 0 ? t.slice(i, i + 900).replace(/\s+/g, ' ') : ''
    const ok = /moved|status/i.test(section) && /assign/i.test(section) && /comment/i.test(section)
    return { ok, observed: `Activity: ${section.slice(0, 220)}` }
  })
  await step('D.6', 'Create a new project from /projects', async () => {
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle0' })
    await clickBtn('New project')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await setField('Name', `QA Project ${TS}`)
    await setField('Key', KEY_LETTERS)
    await clickDlg('Create project')
    await waitBody(new RegExp(`QA Project ${TS}`), 8000).catch(() => {})
    await wait(800)
    const t = await bodyText()
    return { ok: t.includes(`QA Project ${TS}`) || /\/projects\//.test(await pathOf(page)), observed: `path ${await pathOf(page)}; ${snip(t, new RegExp(`QA Project ${TS}`))}` }
  })

  // ---------- E. Leave ----------
  const reason = `QA leave ${TS}`
  let before = ''
  await step('E.1', 'Sadia requests 2 casual leave days (Mon 16 and Tue 17 Nov 2026)', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Sadia Sultana')
    await page.goto(`${BASE}/leave`, { waitUntil: 'networkidle0' })
    before = casualBalance(await bodyText())
    await clickBtn('Request leave')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await setField('Leave type', 'Casual')
    await setField('From', '2026-11-16')
    await setField('To', '2026-11-17')
    await setField('Reason', reason)
    await clickDlg('Submit request')
    await waitBody(new RegExp(reason), 8000)
    const t = await bodyText()
    return { ok: /Pending|Submitted|Awaiting/i.test(snip(t, new RegExp(reason))) || /Pending/.test(t), observed: snip(t, new RegExp(reason)) }
  })
  await step('E.2', 'Tanvir approves at the team-lead stage', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Tanvir Hossain')
    await page.goto(`${BASE}/leave/approvals`, { waitUntil: 'networkidle0' })
    await clickInRow(reason, 'Approve').catch(async () => {
      await page.evaluate(() => {})
      await clickText(page, 'Approve', 'button')
    })
    await wait(1000)
    const t = await bodyText()
    return { ok: t.includes(reason) ? /HR|Stage|second|next|Approved/i.test(t) : true, observed: snip(t, new RegExp(reason)) || 'request no longer listed' }
  })
  await step('E.3', 'HR approves at the second stage', async () => {
    await freshPage()
    await loginEmail(BASE, page, HR_EMAIL, 'password')
    await page.goto(`${BASE}/leave/approvals`, { waitUntil: 'networkidle0' })
    await clickInRow(reason, 'Approve').catch(async () => {
      await clickText(page, 'Approve', 'button')
    })
    await wait(1000)
    const t = await bodyText()
    return { ok: !t.includes(reason) || /Approved/.test(snip(t, new RegExp(reason))), observed: snip(t, new RegExp(reason)) || 'request no longer listed' }
  })
  await step('E.4', 'Sadia sees the request Approved and her casual balance changed', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Sadia Sultana')
    await page.goto(`${BASE}/leave`, { waitUntil: 'networkidle0' })
    const t = await bodyText()
    const after = casualBalance(t)
    const approved = t.includes(reason) && /Approved/.test(t.slice(t.indexOf(reason), t.indexOf(reason) + 300))
    return { ok: approved && after !== before && after !== 'no casual balance card', observed: `request ${approved ? 'Approved' : 'not Approved'}; casual balance before: ${before}; after: ${after}` }
  })
  await step('E.5', 'Sadia inbox shows a leave notification', async () => {
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle0' })
    const t = await bodyText()
    return { ok: /leave/i.test(t) && /approved/i.test(t), observed: snip(t, /leave/i) }
  })

  // ---------- F. Payroll and billing ----------
  const RUN = ['November 2026', 'Nov 2026']
  const PAY_REF = `BEFTN-QA-${TS}`
  await step('F.1', 'HR opens the Nov 2026 draft payroll run', async () => {
    await freshPage()
    await loginEmail(BASE, page, HR_EMAIL, 'password')
    await page.goto(`${BASE}/payroll`, { waitUntil: 'networkidle0' })
    await clickRow(...RUN)
    await wait(1000)
    await page.waitForFunction(() => /\/payroll\/\d+/.test(location.pathname) || /Draft/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {})
    const t = await bodyText()
    return { ok: /Draft/i.test(t), observed: `path ${await pathOf(page)}; ${snip(t, /Draft/i)}` }
  })
  await step('F.2', 'Add a bonus adjustment to Sadia', async () => {
    await clickRow('Sadia Sultana')
    await wait(800)
    await setField('Type', 'Bonus')
    await setField('Label', `QA bonus ${TS}`)
    await setField('Amount', '5000')
    await clickBtn('Add adjustment')
    await waitBody(new RegExp(`QA bonus ${TS}`), 8000)
    return { ok: true, observed: snip(await bodyText(), new RegExp(`QA bonus ${TS}`)) }
  })
  await step('F.3', 'Send the run for review', async () => {
    // The item sheet stays open after adding an adjustment and covers the header button; close it first.
    await page.keyboard.press('Escape')
    await wait(800)
    await clickBtn('Send for review')
    await waitBody(/Waiting for management to approve|In review/, 8000).catch(() => {})
    const t = await bodyText()
    const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((x) => /Send|Approve|Recompute|review/i.test(x)))
    return { ok: !/Send for review/.test(t) && /In review/.test(t), observed: `buttons [${btns.join(' | ')}]; ${snip(t, /Draft|In review|Waiting for management|Send for review/)}` }
  })
  await step('F.4', 'Rafiq approves the run', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Rafiq Ahmed')
    await page.goto(`${BASE}/payroll`, { waitUntil: 'networkidle0' })
    await clickRow(...RUN)
    await wait(1000)
    await clickBtn('Approve')
    await page.waitForSelector('[role="dialog"], [role="alertdialog"]', { timeout: 5000 })
    await clickDlg('Approve')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Approved/.test(t), observed: snip(t, /Approved/) }
  })
  await step('F.5', 'HR marks the run paid with a bank reference', async () => {
    await freshPage()
    await loginEmail(BASE, page, HR_EMAIL, 'password')
    await page.goto(`${BASE}/payroll`, { waitUntil: 'networkidle0' })
    await clickRow(...RUN)
    await wait(1000)
    await clickBtn('Mark as paid')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await setField('Bank reference', PAY_REF)
    await clickDlg('Mark as paid')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Paid/.test(t) && t.includes(PAY_REF), observed: snip(t, /Paid/) }
  })
  await step('F.6', 'Sadia opens her November payslip', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Sadia Sultana')
    await page.goto(`${BASE}/payslips`, { waitUntil: 'networkidle0' })
    await clickRow(...RUN).catch(() => clickText(page, 'Nov', 'a, button'))
    await wait(1200)
    const t = await bodyText()
    return { ok: /payslip/i.test(await pathOf(page)) && /Net/i.test(t), observed: `path ${await pathOf(page)}; ${snip(t, /Net/)}` }
  })
  await step('F.7', 'Nusrat generates and submits the November claim', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Nusrat Jahan')
    await page.goto(`${BASE}/claims`, { waitUntil: 'networkidle0' })
    const gen = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^Generate claim for/.test(b.textContent.trim())))
    if (gen) {
      await clickText(page, 'Generate claim for', 'button')
      // Generate redirects straight to the new claim's detail page.
      await page.waitForFunction(() => /\/claims\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 10000 }).catch(() => {})
    }
    if (!/\/claims\/[0-9a-f-]{36}$/.test(await pathOf(page))) await clickRow('November 2026', 'Nov 2026')
    await wait(1000)
    await clickBtn('Submit')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Submitted/i.test(t), observed: `${gen ? 'generated' : 'already existed'}; ${snip(t, /Submitted|Draft/i)}` }
  })
  await step('F.8', 'Tanvir verifies the claim hours', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Tanvir Hossain')
    await page.goto(`${BASE}/claims`, { waitUntil: 'networkidle0' })
    await clickRow('November 2026', 'Nov 2026')
    await wait(1000)
    await clickBtn('Verify hours')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Verified/i.test(t), observed: snip(t, /Verified|Approve/i) }
  })
  await step('F.9', 'Rafiq approves the claim', async () => {
    await freshPage()
    await loginDemo(BASE, page, 'Rafiq Ahmed')
    await page.goto(`${BASE}/claims`, { waitUntil: 'networkidle0' })
    await clickRow('November 2026', 'Nov 2026')
    await wait(1000)
    await clickBtn('Approve')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Approved/i.test(t), observed: snip(t, /Approved/i) }
  })
  await step('F.10', 'HR marks the claim paid', async () => {
    await freshPage()
    await loginEmail(BASE, page, HR_EMAIL, 'password')
    await page.goto(`${BASE}/claims`, { waitUntil: 'networkidle0' })
    await clickRow('November 2026', 'Nov 2026')
    await wait(1000)
    await clickBtn('Mark as paid')
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await setField('Transfer reference', `CLM-QA-${TS}`)
    await clickDlg('Mark as paid')
    await wait(1200)
    const t = await bodyText()
    return { ok: /Paid/.test(t), observed: snip(t, /Paid/) }
  })

  for (const [id, desc] of SKIPPED) console.log(`SKIP ${id} ${desc}`)
  if (consoleErrors.length) console.log(`\nConsole errors:\n  ${[...new Set(consoleErrors)].join('\n  ')}`)
  failed = log.filter((l) => !l.ok).length
  console.log(`\n${log.length - failed} passed, ${failed} failed, ${SKIPPED.length} skipped`)
} finally {
  if (browser) await browser.close().catch(() => {})
  stop()
}
process.exit(failed ? 1 : 0)
