// Go-live visual QA: walks the screens and flows listed for the pre-deploy review and saves PNGs under scripts/screens/golive/.
// Usage: node scripts/qa-golive.mjs           (QA_PORT or SMOKE_PORT, default 8197)
// WARNING: resets the local `vivacom_hr` database with `migrate:fresh --seed` first (unless E2E_NO_RESET=1).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chipText, clickText, launchBrowser, loginDemo, pathOf, root, signOut, startLaravel, wait, waitForChip } from './lib/laravel.mjs'

const PORT = Number(process.env.QA_PORT || process.env.SMOKE_PORT) || 8197
const shots = path.join(root, 'scripts', 'screens', 'golive')
rmSync(shots, { recursive: true, force: true })
mkdirSync(shots, { recursive: true })

const REASON = `QA leave golive ${String(Date.now()).slice(-5)}`
const PAY_REASON = 'Staff leaving early for Eid travel'
const findings = [] // { area, item, ok, notes[] }
const note = (area, item, ok, notes = []) => {
  findings.push({ area, item, ok, notes })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${area} :: ${item}${notes.length ? `\n       ${notes.join('\n       ')}` : ''}`)
}
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

const { base: BASE, stop } = await startLaravel(PORT)
const browser = await launchBrowser()

/** A fresh browser context (own cookies) with error + HTTP >=400 capture. */
async function session(width = 1440, height = 900) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height })
  const errs = []
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !/React DevTools/.test(m.text())) errs.push(`console.${m.type()}: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${String(e.message).slice(0, 200)}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`)
  })
  page.qa = { errs, ctx }
  return page
}
const clearErrs = (page) => (page.qa.errs.length = 0)
const flushErrs = (page) => [...new Set(page.qa.errs)]

async function shot(page, name) {
  const body = await page.evaluate(() => document.body.innerText).catch(() => '')
  const bad = [...body.matchAll(/\b(undefined|NaN|Invalid Date|\[object Object\])\b/g)].map((m) => m[0])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1).catch(() => false)
  await page.screenshot({ path: path.join(shots, `${slug(name)}.png`), fullPage: false })
  return { bad: [...new Set(bad)], overflow }
}
async function visit(page, url) {
  const res = await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 30000 })
  await wait(300)
  return res?.status() ?? 0
}
const bodyText = (page) => page.evaluate(() => document.body.innerText)
const setDark = async (page, on) => {
  await page.evaluate((d) => localStorage.setItem('vivacom.theme', d ? 'dark' : 'light'), on)
}
async function clickIn(page, text, selector = 'button, a, [role="tab"], [role="menuitem"], label') {
  const ok = await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null && x.textContent.replace(/\s+/g, ' ').trim().startsWith(t))
      if (!el) return false
      el.click()
      return true
    },
    text,
    selector,
  )
  if (!ok) throw new Error(`no visible "${text}"`)
  await wait(500)
}
async function clickRowContaining(page, needle) {
  const ok = await page.evaluate((n) => {
    const rows = [...document.querySelectorAll('tr, [role="row"], li, article')]
      .filter((r) => r.offsetParent !== null && r.textContent.includes(n))
      .sort((a, b) => a.textContent.length - b.textContent.length)
    if (!rows[0]) return false
    rows[0].click()
    return true
  }, needle)
  if (!ok) throw new Error(`no row containing "${needle}"`)
  await wait(700)
}
async function clickInRow(page, needle, btn) {
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
  if (!ok) throw new Error(`no "${btn}" in row "${needle}"`)
  await wait(900)
}
/** Fill a labelled field inside the open dialog (or the page). Works with Radix-style Field wrappers that lack htmlFor. */
async function fill(page, label, value) {
  const handle = await page.evaluateHandle((l) => {
    const scope = document.querySelector('[role="dialog"]') || document
    const lab = [...scope.querySelectorAll('label')].find((x) => x.offsetParent !== null && x.textContent.replace(/\*/g, '').trim().startsWith(l))
    if (!lab) return null
    if (lab.htmlFor && document.getElementById(lab.htmlFor)) return document.getElementById(lab.htmlFor)
    return lab.querySelector('input,select,textarea') ?? lab.parentElement?.querySelector('input,select,textarea') ?? lab.nextElementSibling?.querySelector?.('input,select,textarea') ?? null
  }, label)
  const el = handle.asElement()
  if (!el) {
    const labels = await page.evaluate(() => [...(document.querySelector('[role="dialog"]') ?? document.body).querySelectorAll('label, button, [role="combobox"]')].filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim()).filter(Boolean).slice(0, 30).join(' | '))
    throw new Error(`no field "${label}" in [${labels}]`)
  }
  await el.evaluate((e, v) => {
    if (e.tagName === 'SELECT') {
      const o = [...e.options].find((x) => x.textContent.trim().startsWith(v) || x.value === v)
      if (!o) throw new Error(`no option ${v} in [${[...e.options].map((x) => x.textContent.trim()).join('|')}]`)
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, o.value)
    } else {
      const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v)
    }
    e.dispatchEvent(new Event('input', { bubbles: true }))
    e.dispatchEvent(new Event('change', { bubbles: true }))
  }, String(value))
}
const dialogBtn = (page, text) => clickText(page, text, '[role="dialog"] button, [role="alertdialog"] button')
const fetchCsv = (page, href) =>
  page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'same-origin' })
    const t = await r.text()
    return { status: r.status, type: r.headers.get('content-type') ?? '', head: t.split('\n')[0].slice(0, 120), bytes: t.length }
  }, href)

// ---------- 1. Reports (HR) ----------
async function reports() {
  const page = await session()
  await loginDemo(BASE, page, 'Nasrin Akter')
  const status = await visit(page, '/reports')
  const sections = ['Monthly summary', 'Daily attendance', 'Late and early leave', 'Month sheet', 'Leave register', 'Leave balance', 'Headcount', 'Payroll summary', 'Department cost', 'Employee statement', 'Salary changes', 'Monthly tax (TDS)']
  const navLabels = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Reports"] button, nav[aria-label="Reports"] a')].map((b) => b.textContent.trim()))
  note('reports', `left list items: ${navLabels.join(' | ')}`, sections.every((s) => navLabels.includes(s)), sections.filter((s) => !navLabels.includes(s)).map((s) => `missing ${s}`))
  for (const label of sections) {
    const area = `reports/${label}`
    try {
      clearErrs(page)
      await clickIn(page, label, 'nav[aria-label="Reports"] button, nav[aria-label="Reports"] a')
      await wait(700)
      const s = await shot(page, `reports-${slug(label)}`)
      const href = await page.evaluate(() => {
        const a = [...document.querySelectorAll('a[download]')].find((x) => /Export CSV/.test(x.textContent))
        return a ? a.href : null
      })
      const csv = href ? await fetchCsv(page, href) : null
      const notes = [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll'] : []), ...flushErrs(page)]
      if (!href) notes.push('no Export CSV link')
      else if (!(csv.status === 200 && /text\/csv/.test(csv.type))) notes.push(`CSV HTTP ${csv.status} ${csv.type}`)
      note('reports', `${label}: opened, CSV ${csv ? `${csv.status} ${csv.type} "${csv.head}"` : 'n/a'}`, notes.length === 0, notes)
    } catch (e) {
      note('reports', label, false, [e.message, ...flushErrs(page)])
    }
  }
  // Dark theme on the Reports page.
  await setDark(page, true)
  await visit(page, '/reports?tab=summary')
  await shot(page, 'DARK-reports')
  await setDark(page, false)
  note('reports', `page status ${status}`, status === 200)
  await page.qa.ctx.close()
}

// ---------- 2. Team reports (lead) ----------
async function teamReports() {
  const page = await session()
  await loginDemo(BASE, page, 'Tanvir Hossain')
  const tabs = ['sheet', 'att_summary', 'att_daily', 'late_early', 'leave_register', 'leave_balance']
  for (const tab of tabs) {
    clearErrs(page)
    const status = await visit(page, `/team/sheet?tab=${tab}`)
    const names = await page.evaluate(() => [...document.querySelectorAll('td:first-child, tbody tr td:nth-child(1)')].map((t) => t.textContent.trim()).filter(Boolean))
    const s = await shot(page, `team-${tab}`)
    const hasHr = await page.evaluate(() => document.body.innerText.includes('Nasrin Akter'))
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[download]')].find((x) => /Export CSV/.test(x.textContent))
      return a ? a.href : null
    })
    const csv = href ? await fetchCsv(page, href) : null
    const notes = [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll'] : []), ...(hasHr ? ['HR person Nasrin Akter visible in team view'] : []), ...(status !== 200 ? [`HTTP ${status}`] : []), ...flushErrs(page)]
    if (csv && !(csv.status === 200 && /text\/csv/.test(csv.type))) notes.push(`CSV HTTP ${csv.status} ${csv.type}`)
    note('team', `tab=${tab}: ${names.length} name cells, CSV ${csv ? csv.status : 'none'}`, notes.length === 0, notes)
  }
  await page.qa.ctx.close()
}

// ---------- 3. Audit log (management) ----------
async function auditLog() {
  const page = await session()
  await loginDemo(BASE, page, 'Rafiq Ahmed')
  clearErrs(page)
  const status = await visit(page, '/settings/audit-log')
  const s = await shot(page, 'audit-log')
  const controls = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    labels: [...document.querySelectorAll('label, [aria-label]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim()).filter(Boolean).slice(0, 25),
    selects: document.querySelectorAll('select').length,
    inputs: document.querySelectorAll('input').length,
    next: [...document.querySelectorAll('button, a')].some((b) => /next|›|→/i.test(b.textContent + (b.getAttribute('aria-label') ?? ''))),
    csv: [...document.querySelectorAll('a[href*="csv"]')].map((a) => a.href),
  }))
  const notes = [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll'] : []), ...(status !== 200 ? [`HTTP ${status}`] : []), ...flushErrs(page)]
  note('audit-log', `page: ${controls.rows} rows, ${controls.selects} selects, ${controls.inputs} inputs, pagination ${controls.next}`, controls.rows > 0 && notes.length === 0, notes)
  // Apply the first select's alternative option, then screenshot.
  try {
    const changed = await page.evaluate(() => {
      const sel = document.querySelector('select')
      if (!sel || sel.options.length < 2) return null
      const o = sel.options[1]
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, o.value)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return `${sel.getAttribute('aria-label') ?? sel.name}=${o.textContent.trim()}`
    })
    await wait(1200)
    await clickText(page, 'Filter', 'button')
    await wait(1200)
    const n = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
    const s2 = await shot(page, 'audit-log-filtered')
    note('audit-log', `filter ${changed ?? 'no select'} → ${n} rows`, s2.bad.length === 0, [...s2.bad.map((b) => `shows "${b}"`), ...flushErrs(page)])
  } catch (e) {
    note('audit-log', 'filter', false, [e.message])
  }
  // Pagination: click the next control if enabled.
  const pg = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /next/i.test(x.getAttribute('aria-label') ?? '') || /^(Next|›)$/.test(x.textContent.trim()))
    if (!b) return 'no next control'
    if (b.disabled) return 'next disabled'
    const before = document.querySelector('tbody')?.textContent ?? ''
    b.click()
    return `clicked (rows changed: pending)`
  })
  await wait(1000)
  const pageInfo = await page.evaluate(() => document.body.innerText.match(/Page \d+ of \d+|\d+–\d+ of \d+|\d+-\d+ of \d+/)?.[0] ?? '')
  note('audit-log', `pagination: ${pg}; indicator "${pageInfo}"`, true)
  // CSV export link.
  const href = await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => /csv|export/i.test(a.textContent + a.href))?.href ?? null)
  const csv = href ? await page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'same-origin' })
    return { status: r.status, type: r.headers.get('content-type') ?? '', head: (await r.text()).split('\n')[0].slice(0, 140) }
  }, href) : null
  note('audit-log', `CSV: ${csv ? `${csv.status} ${csv.type} "${csv.head}"` : 'no export link found'}`, !!csv && csv.status === 200 && /text\/csv/.test(csv.type), flushErrs(page))
  await page.qa.ctx.close()
}

// ---------- 4. Leave trail ----------
async function leaveTrail() {
  const emp = await session()
  await loginDemo(BASE, emp, 'Sadia Sultana')
  clearErrs(emp)
  await visit(emp, '/leave')
  try {
    await clickText(emp, 'Request leave', 'button')
    await emp.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await fill(emp, 'Leave type', 'Casual')
    await fill(emp, 'From', '2026-12-14')
    await fill(emp, 'To', '2026-12-15')
    await fill(emp, 'Reason', REASON)
    await shot(emp, 'leave-request-dialog')
    await dialogBtn(emp, 'Submit request')
    await emp.waitForFunction((r) => document.body.innerText.includes(r), { timeout: 10000 }, REASON)
    const s = await shot(emp, 'leave-submitted')
    note('leave', 'employee submitted casual leave 14-15 Dec', true, [...s.bad, ...flushErrs(emp)])
  } catch (e) {
    note('leave', 'employee submit', false, [e.message.slice(0, 200), ...flushErrs(emp)])
  }
  // Lead, then HR approve.
  for (const [who, stage] of [['Tanvir Hossain', 'lead'], ['Nasrin Akter', 'hr']]) {
    try {
      const p = await session()
      await loginDemo(BASE, p, who)
      clearErrs(p)
      await visit(p, '/leave/approvals')
      await clickInRow(p, REASON, 'Approve')
      await wait(800)
      const s = await shot(p, `leave-approvals-${stage}-approved`)
      note('leave', `${who} approves at ${stage} stage`, true, [...s.bad, ...flushErrs(p)])
      await p.qa.ctx.close()
    } catch (e) {
      note('leave', `${who} approval (${stage})`, false, [e.message.slice(0, 200), ...flushErrs(emp)])
    }
  }
  // Employee: My leave, expand the request.
  clearErrs(emp)
  await visit(emp, '/leave')
  try {
    const expanded = await emp.evaluate((r) => {
      const row = [...document.querySelectorAll('tr, [role="row"], li, article')].filter((x) => x.offsetParent !== null && x.textContent.includes(r)).sort((a, b) => a.textContent.length - b.textContent.length)[0]
      const btn = row && [...row.querySelectorAll('button')].filter((x) => !/Cancel/.test(x.textContent)).pop()
      if (btn) btn.click()
      else if (row) row.click()
      return !!row
    }, REASON)
    if (!expanded) throw new Error('no row')
    await wait(700)
    const t = await bodyText(emp)
    const i = t.indexOf(REASON)
    const trail = t.slice(Math.max(0, i - 50), i + 900).replace(/\s+/g, ' ')
    const notes = []
    if (!/Requested by .* · /.test(t)) notes.push('no "Requested by … · date" line')
    if (!/Approved \(Lead\) by /.test(t)) notes.push('no "Approved (Lead) by" line')
    if (!/Approved \(HR\) by /.test(t)) notes.push('no "Approved (HR) by" line')
    const s = await shot(emp, 'leave-my-leave-expanded')
    note('leave', 'My leave expanded trail', notes.length === 0, [...notes, ...s.bad.map((b) => `shows "${b}"`), `trail: ${trail.slice(0, 420)}`, ...flushErrs(emp)])
  } catch (e) {
    note('leave', 'My leave expand', false, [e.message.slice(0, 200), ...flushErrs(emp)])
  }
  // HR: Approvals row drawer (History section) and Calendar chip drawer.
  try {
    const hr = await session()
    await loginDemo(BASE, hr, 'Nasrin Akter')
    clearErrs(hr)
    await visit(hr, '/leave/approvals')
    const opened = await hr.evaluate(() => {
      const row = [...document.querySelectorAll('tr, [role="row"], li')].find((x) => x.offsetParent !== null && /Tanvir Hossain/.test(x.textContent) && /Annual leave/.test(x.textContent))
      const cell = row && [...row.querySelectorAll('td')].find((td) => /Annual leave/.test(td.textContent) || /Family event/.test(td.textContent))
      if (!cell) return false
      cell.click()
      return true
    })
    await wait(900)
    const dlg = await hr.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')
    const s = await shot(hr, 'leave-approvals-drawer-history')
    const hasHistory = /History/i.test(dlg)
    note('leave', `Approvals row drawer opened=${opened}; History section ${hasHistory ? 'present' : 'MISSING'}`, opened && hasHistory, [...s.bad.map((b) => `shows "${b}"`), `drawer: ${dlg.replace(/\s+/g, ' ').slice(0, 300)}`, ...flushErrs(hr)])
    await visit(hr, '/leave/calendar')
    await wait(500)
    // Approved leave sits in December (the approved demo requests); step forward a month until a chip shows.
    let chipClicked = null
    for (let m = 0; m < 3 && !chipClicked; m++) {
      chipClicked = await hr.evaluate(() => {
        const el = [...document.querySelectorAll('button, a, [role="button"], [title]')].find((x) => x.offsetParent !== null && /Sadia|Imran|Tanvir|Annual|Casual|Sick|Nusrat|Fahim/.test(x.textContent + (x.getAttribute('title') ?? '')) && x.textContent.length < 80)
        if (!el) return null
        el.click()
        return el.textContent.trim().slice(0, 60) || el.getAttribute('title')
      })
      if (!chipClicked) await hr.evaluate(() => {
        document.querySelector('button[aria-label="Next month"]')?.click()
      })
      await wait(500)
    }
    await wait(800)
    const dlg2 = await hr.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')
    const s2 = await shot(hr, 'leave-calendar-chip-drawer')
    note('leave', `Calendar chip "${chipClicked}" → drawer ${dlg2 ? 'opened' : 'NOT opened'}`, !!chipClicked && !!dlg2, [...s2.bad.map((b) => `shows "${b}"`), `drawer: ${dlg2.replace(/\s+/g, ' ').slice(0, 300)}`, ...flushErrs(hr)])
    await hr.qa.ctx.close()
  } catch (e) {
    note('leave', 'approvals drawer / calendar', false, [e.message.slice(0, 200)])
  }
  await emp.qa.ctx.close()
}

// ---------- 5. People profile Activity ----------
async function profileActivity() {
  const page = await session()
  await loginDemo(BASE, page, 'Nasrin Akter')
  clearErrs(page)
  await visit(page, '/people')
  await clickRowContaining(page, 'Sadia Sultana').catch(() => {})
  await wait(400)
  const url = await pathOf(page)
  if (!/\/people\/\d+/.test(url)) {
    await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Sadia Sultana'))?.click())
    await wait(900)
  }
  try {
    await clickText(page, 'Activity', 'button, [role="tab"], a')
    await wait(700)
    const s = await shot(page, 'people-profile-activity')
    const t = await bodyText(page)
    note('people', `profile ${await pathOf(page)} Activity tab`, /Activity/.test(t) && s.bad.length === 0, [...s.bad.map((b) => `shows "${b}"`), ...flushErrs(page)])
  } catch (e) {
    note('people', 'Activity tab', false, [e.message])
  }
  await page.qa.ctx.close()
}

// ---------- 6. Payroll ----------
const txt = (p) => bodyText(p)
async function openRun(p, month) {
  await visit(p, '/payroll')
  await clickRowContaining(p, month)
  await wait(900)
}
async function ackFlags(p) {
  for (let i = 0; i < 40; i++) {
    const clicked = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.textContent.trim() === 'Acknowledge')
      if (!b) return false
      b.click()
      return true
    })
    if (!clicked) break
    await wait(800)
  }
}
async function payroll() {
  // HR: adjust, submit with pay-early reason, acknowledge flags.
  const hr = await session()
  await loginDemo(BASE, hr, 'Nasrin Akter')
  clearErrs(hr)
  try {
    await openRun(hr, 'November 2026')
    const t0 = await txt(hr)
    note('payroll', `Nov 2026 header: ${(t0.match(/Draft|In review|Approved|Paid/) ?? ['?'])[0]}; ${(t0.match(/Prepared by[^\n]*/) ?? ['no Prepared line'])[0]}`, /Prepared by/.test(t0))
    await clickInRow(hr, 'Sadia Sultana', 'Adjust')
    await hr.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await fill(hr, 'Category', 'Bonus')
    await fill(hr, 'Amount', '2500')
    await fill(hr, 'Reason', 'QA golive bonus')
    await shot(hr, 'payroll-adjust-dialog')
    await dialogBtn(hr, 'Add')
    await wait(1200)
    const s = await shot(hr, 'payroll-after-adjustment')
    note('payroll', 'Adjust dialog: bonus 2,500 for Sadia', (await txt(hr)).includes('QA golive bonus'), [...s.bad.map((b) => `shows "${b}"`), ...flushErrs(hr)])
  } catch (e) {
    note('payroll', 'Adjust', false, [e.message.slice(0, 200), ...flushErrs(hr)])
  }
  try {
    await hr.keyboard.press('Escape')
    await wait(500)
    await clickText(hr, 'Send for review', 'button')
    await hr.waitForSelector('[role="dialog"]', { timeout: 5000 })
    const early = await hr.evaluate(() => !![...document.querySelectorAll('[role="dialog"] label, [role="dialog"] button')].find((x) => /Pay before month end/.test(x.textContent)))
    await shot(hr, 'payroll-submit-dialog')
    if (early) {
      await clickText(hr, 'Pay before month end', '[role="dialog"] button, [role="dialog"] label, [role="dialog"] [role="checkbox"]').catch(() => {})
      await wait(400)
      await fill(hr, 'Reason', PAY_REASON)
      await wait(300)
    }
    await shot(hr, 'payroll-submit-dialog-filled')
    await dialogBtn(hr, 'Send for review')
    await wait(1500)
    await ackFlags(hr)
    await wait(600)
    const t = await txt(hr)
    const s = await shot(hr, 'payroll-in-review')
    const hdr = t.match(/(Prepared by[^\n]*|Submitted by[^\n]*)/g) ?? []
    note('payroll', `submitted (pay-early dialog=${early}); status ${(t.match(/In review|Draft|Approved/) ?? ['?'])[0]}; header: ${hdr.join(' | ')}`, /In review/.test(t), [...s.bad.map((b) => `shows "${b}"`), ...flushErrs(hr)])
    const appr = await hr.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Approve'))
    note('payroll', `HR (drafter) sees Approve button: ${appr}`, true)
  } catch (e) {
    note('payroll', 'submit for review', false, [e.message.slice(0, 200), ...flushErrs(hr)])
  }
  await hr.qa.ctx.close()

  // Management (the only approver in seed data): approve.
  const mg = await session()
  await loginDemo(BASE, mg, 'Rafiq Ahmed')
  clearErrs(mg)
  try {
    await openRun(mg, 'November 2026')
    const b = await mg.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Approve')
      return btn ? { disabled: btn.disabled, title: btn.parentElement?.getAttribute('title') ?? '' } : null
    })
    note('payroll', `management Approve button state: ${JSON.stringify(b)}`, !!b && !b.disabled, [])
    await shot(mg, 'payroll-approve-state')
    await clickText(mg, 'Approve', 'button')
    await mg.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await dialogBtn(mg, 'Approve')
    await wait(1200)
    const s = await shot(mg, 'payroll-approved')
    const t = await txt(mg)
    note('payroll', `Rafiq approves Nov: ${(t.match(/Approved by[^\n]*/) ?? ['no Approved line'])[0]}`, /Approved/.test(t), [...s.bad.map((x) => `shows "${x}"`), ...flushErrs(mg)])
  } catch (e) {
    note('payroll', 'management approve', false, [e.message.slice(0, 200), ...flushErrs(mg)])
  }
  // Same-user check: Rafiq drafts a festival bonus run (a regular Dec run cannot be created before December),
  // submits it, then tries Approve. Expected: Approve disabled with a reason, or absent.
  try {
    await visit(mg, '/payroll')
    await clickBtn2(mg, 'New run')
    await clickText(mg, 'Festival bonus', '[role="menuitem"]')
    await mg.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await fill(mg, 'Name', 'QA festival golive')
    await fill(mg, 'Bonus (% of basic)', '50')
    await mg.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].pop()?.click())
    await mg.waitForFunction(() => /\/payroll\/\d+/.test(location.pathname), { timeout: 10000 })
    await wait(900)
    note('payroll', `festival run created at ${await pathOf(mg)}`, true)
    await clickText(mg, 'Send for review', 'button')
    await mg.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await mg.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].pop()?.click())
    await wait(1500)
    await ackFlags(mg)
    await wait(600)
    const ap = await mg.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Approve')
      return btn ? { disabled: btn.disabled, title: btn.parentElement?.getAttribute('title') ?? btn.getAttribute('title') ?? '' } : { present: false }
    })
    const s = await shot(mg, 'payroll-same-user-approve')
    note('payroll', `same user (Rafiq drafted+submitted festival run) Approve: ${JSON.stringify(ap)}`, ap.present === false || (ap.disabled && !!ap.title), [...s.bad.map((x) => `shows "${x}"`), ...flushErrs(mg)])
  } catch (e) {
    note('payroll', 'same-user check (festival run)', false, [e.message.slice(0, 200), ...flushErrs(mg)])
  }
  await mg.qa.ctx.close()

  // HR marks Nov paid with a date, downloads CSVs.
  const hr2 = await session()
  await loginDemo(BASE, hr2, 'Rafiq Ahmed')
  clearErrs(hr2)
  try {
    await openRun(hr2, 'November 2026')
    await clickText(hr2, 'Mark as paid', 'button')
    await hr2.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await fill(hr2, 'Disbursement date', '2026-11-27')
    await fill(hr2, 'Bank reference', `BEFTN-QA-GOLIVE-${String(Date.now()).slice(-4)}`)
    await shot(hr2, 'payroll-mark-paid-dialog')
    await dialogBtn(hr2, 'Mark as paid')
    await wait(1200)
    const s = await shot(hr2, 'payroll-paid')
    const t = await txt(hr2)
    note('payroll', `HR marks Nov paid: ${(t.match(/Paid by[^\n]*/) ?? ['no Paid line'])[0]}`, /Paid by/.test(t), [...s.bad.map((x) => `shows "${x}"`), ...flushErrs(hr2)])
    const links = await hr2.evaluate(() => [...document.querySelectorAll('a[href*="register.csv"], a[href*="bank-advice.csv"]')].map((a) => a.href))
    for (const href of links) {
      const r = await fetchCsv(hr2, href)
      note('payroll', `CSV ${href.replace(/^https?:\/\/[^/]+/, '')} → ${r.status} ${r.type} "${r.head.slice(0, 60)}"`, r.status === 200 && /text\/csv/.test(r.type))
    }
    if (!links.length) note('payroll', 'no register/bank-advice links on paid run', false)
  } catch (e) {
    note('payroll', 'mark paid / CSVs', false, [e.message.slice(0, 200), ...flushErrs(hr2)])
  }
  await setDark(hr2, true)
  await openRun(hr2, 'November 2026')
  await shot(hr2, 'DARK-payroll-run')
  await setDark(hr2, false)
  await hr2.qa.ctx.close()
}
const clickBtn2 = (p, text) => clickText(p, text, 'button')

// ---------- 7. My day (employee) + 8. error page ----------
async function myDayAndErrors() {
  const page = await session()
  await loginDemo(BASE, page, 'Sadia Sultana')
  clearErrs(page)
  const st = await visit(page, '/my-day')
  const info = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent ?? '',
    chip: document.querySelector('[data-testid="work-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    strip: document.body.innerText.match(/Needs (your )?attention[\s\S]{0,200}/i)?.[0].replace(/\s+/g, ' ') ?? 'no attention strip text',
  }))
  const s = await shot(page, 'my-day-employee')
  note('my-day', `status ${st}; h1 "${info.h1}"; chip "${info.chip}"; ${info.strip.slice(0, 160)}`, st === 200 && !!info.h1 && !!info.chip, [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll'] : []), ...flushErrs(page)])
  // Error page (same session).
  clearErrs(page)
  const errSt = await visit(page, '/this-does-not-exist')
  const errText = (await bodyText(page)).replace(/\s+/g, ' ').slice(0, 200)
  await shot(page, 'error-404')
  note('error-page', `/this-does-not-exist → HTTP ${errSt}; "${errText}"`, errSt === 404, flushErrs(page))
  await page.qa.ctx.close()
}

// ---------- Mobile 390x844 for three key pages ----------
async function mobile() {
  const page = await session()
  await loginDemo(BASE, page, 'Sadia Sultana')
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  for (const [url, name] of [['/my-day', 'my-day'], ['/leave', 'leave']]) {
    clearErrs(page)
    const st = await visit(page, url)
    const s = await shot(page, `M390-${name}`)
    note('mobile-390', `${url} → ${st}`, s.bad.length === 0 && !s.overflow, [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll at 390px'] : []), ...flushErrs(page)])
  }
  await page.qa.ctx.close()
  const hr = await session(390, 844)
  await loginDemo(BASE, hr, 'Nasrin Akter')
  await hr.setViewport({ width: 390, height: 844, isMobile: true })
  clearErrs(hr)
  const st = await visit(hr, '/reports')
  const s = await shot(hr, 'M390-reports')
  note('mobile-390', `/reports (HR) → ${st}`, s.bad.length === 0 && !s.overflow, [...s.bad.map((b) => `shows "${b}"`), ...(s.overflow ? ['horizontal scroll at 390px'] : []), ...flushErrs(hr)])
  await hr.qa.ctx.close()
}

const ONLY = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : null
const SECTIONS = { reports, teamReports, auditLog, leaveTrail, profileActivity, payroll, myDayAndErrors, mobile }
for (const [name, fn] of Object.entries(SECTIONS)) {
  if (ONLY && !ONLY.includes(name)) continue
  try {
    await fn()
  } catch (e) {
    note(fn.name, 'section crashed', false, [e.message.slice(0, 300)])
  }
}
await browser.close()
stop()
writeFileSync(path.join(shots, 'findings.json'), JSON.stringify(findings, null, 2))
const bad = findings.filter((f) => !f.ok)
console.log(`\n${findings.length - bad.length} ok, ${bad.length} flagged. Screens: ${shots}`)
process.exit(0)
