// Browser QA for access control: Access page renders, direct-URL 403, revoking a permission hides the menu and blocks the route.
import path from 'node:path'
import { clickText, launchBrowser, loginDemo, pathOf, root, signOut, startLaravel, track, wait } from './lib/laravel.mjs'

const PORT = Number(process.env.QA_PORT) || 8198
const { base: BASE, stop } = await startLaravel(PORT)
const shots = path.join(root, 'scripts', 'screens')
const out = []
const real = (errs) => errs.filter((e) => !/status of 403/.test(e))
const step = async (name, fn) => {
  try { const n = (await fn()) ?? []; out.push([n.length ? 'FAIL' : 'ok', name, n]) } catch (e) { out.push(['FAIL', name, [String(e.message).slice(0, 200)]]) }
}
const status = async (page, url) => { const r = await page.goto(BASE + url, { waitUntil: 'networkidle0' }); await wait(200); return r.status() }
const navHrefs = (page) => page.evaluate(() => [...document.querySelectorAll('aside a[href^="/"]')].map((a) => a.getAttribute('href')))
const h1 = (page) => page.evaluate(() => document.querySelector('h1')?.textContent ?? '')

let failures = 1
try {
  const browser = await launchBrowser()
  const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 900 }); const errors = track(page)

  await step('L.1 employee: /payroll, /settings/access, /reports direct URL → 403 No access page', async () => {
    await loginDemo(BASE, page, 'Imran Kabir')
    const n = []
    for (const u of ['/payroll', '/settings/access', '/reports', '/people/onboard', '/leave/approvals']) {
      const s = await status(page, u); const t = await h1(page)
      if (s !== 403 || !/no access/i.test(t)) n.push(`${u}: ${s} "${t}"`)
    }
    await page.screenshot({ path: path.join(shots, 'access-403.png') })
    await signOut(page, 'break'); return [...n, ...real(errors)]
  })
  await step('L.2 management opens Settings → Access; matrix lists roles and modules', async () => {
    errors.length = 0
    await loginDemo(BASE, page, 'Rafiq Ahmed')
    const s = await status(page, '/settings/access')
    const info = await page.evaluate(() => ({ text: document.body.innerText, boxes: document.querySelectorAll('[role="checkbox"], input[type="checkbox"]').length }))
    await page.screenshot({ path: path.join(shots, 'access-matrix.png'), fullPage: true })
    const n = []
    if (s !== 200) n.push(`status ${s}`)
    for (const w of ['Management', 'HR', 'Team lead', 'Payroll', 'Reports', 'Roles & permissions']) if (!info.text.includes(w)) n.push(`missing "${w}"`)
    if (info.boxes < 40) n.push(`only ${info.boxes} checkboxes`)
    return [...n, ...real(errors)]
  })
  await step('L.3 management revokes "view_reports" from HR and saves', async () => {
    errors.length = 0
    // find the HR column index, then the Reports row checkbox
    const ok = await page.evaluate(() => {
      const ths = [...document.querySelectorAll('table thead th')]
      const col = ths.findIndex((th) => /^HR\b/.test(th.innerText.trim()))
      const row = [...document.querySelectorAll('table tbody tr')].find((tr) => /reports and csv/i.test(tr.innerText))
      const cell = row?.children[col]; const box = cell?.querySelector('[role="checkbox"], input[type="checkbox"]')
      if (!box) return false
      if (box.getAttribute('aria-checked') === 'false' || box.checked === false) return 'already-off'
      box.click(); return true
    })
    if (ok !== true) return [`checkbox toggle: ${ok}`]
    await wait(300)
    // Save button in the HR column header
    const clicked = await page.evaluate(() => {
      const ths = [...document.querySelectorAll('table thead th')]
      const th = ths.find((t) => /^HR\b/.test(t.innerText.trim()))
      const b = [...(th?.querySelectorAll('button') ?? [])].find((x) => /save/i.test(x.innerText)); if (!b) return false; b.click(); return true
    })
    if (!clicked) return ['no Save button in HR column']
    await wait(1500)
    await page.screenshot({ path: path.join(shots, 'access-saved.png'), fullPage: true })
    await signOut(page, 'break'); return real(errors)
  })
  await step('L.4 HR: Reports gone from sidebar and /reports → 403', async () => {
    errors.length = 0
    await loginDemo(BASE, page, 'Nasrin Akter')
    const hrefs = await navHrefs(page)
    const n = []
    if (hrefs.includes('/reports')) n.push('Reports still in nav')
    const s = await status(page, '/reports'); if (s !== 403) n.push(`/reports status ${s}`)
    const ok = await status(page, '/payroll'); if (ok !== 200) n.push(`/payroll status ${ok} (should still work)`)
    await signOut(page, 'break'); return [...n, ...real(errors)]
  })
  await step('L.5 management restores view_reports; HR sees Reports again', async () => {
    errors.length = 0
    await loginDemo(BASE, page, 'Rafiq Ahmed'); await status(page, '/settings/access')
    await page.evaluate(() => {
      const ths = [...document.querySelectorAll('table thead th')]; const col = ths.findIndex((th) => /^HR\b/.test(th.innerText.trim()))
      const row = [...document.querySelectorAll('table tbody tr')].find((tr) => /reports and csv/i.test(tr.innerText))
      row.children[col].querySelector('[role="checkbox"], input[type="checkbox"]').click()
    })
    await wait(300)
    await page.evaluate(() => { const th = [...document.querySelectorAll('table thead th')].find((t) => /^HR\b/.test(t.innerText.trim())); [...th.querySelectorAll('button')].find((x) => /save/i.test(x.innerText)).click() })
    await wait(1500); await signOut(page, 'break')
    await loginDemo(BASE, page, 'Nasrin Akter')
    const hrefs = await navHrefs(page); const s = await status(page, '/reports')
    await signOut(page, 'break')
    return [...(hrefs.includes('/reports') ? [] : ['Reports not restored in nav']), ...(s === 200 ? [] : [`/reports ${s}`]), ...real(errors)]
  })
  await step('L.6 management People tab: change Imran to team lead, then back', async () => {
    errors.length = 0
    await loginDemo(BASE, page, 'Rafiq Ahmed'); await status(page, '/settings/access')
    await clickText(page, 'People', '[role="tab"], button')
    await wait(400)
    const responses = []
    page.on('response', (r) => { if (r.request().method() === 'PATCH') responses.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`) })
    const rowIdx = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].findIndex((tr) => /Imran Kabir/.test(tr.innerText)))
    if (rowIdx < 0) return ['no Imran row']
    const handle = await page.$(`table tbody tr:nth-child(${rowIdx + 1}) select`)
    if (!handle) return ['no select']
    await handle.select('team_lead')
    const sel = 'ok'
    if (sel !== 'ok') return [sel]
    await wait(1500)
    const after = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].find((tr) => /Imran Kabir/.test(tr.innerText))?.querySelector('select')?.value)
    const flash = await page.evaluate(() => document.body.innerText.match(/(cannot|not allowed|error)[^\n]*/i)?.[0] ?? '')
    await (await page.$(`table tbody tr:nth-child(${rowIdx + 1}) select`)).select('employee')
    await wait(1200); await signOut(page, 'break')
    return [...(after === 'team_lead' ? [] : [`role after change: ${after}; responses ${responses.join(', ')}; flash: ${flash}`]), ...real(errors)]
  })
  await browser.close()
  for (const [s, name, notes] of out) console.log(`${s.padEnd(4)} ${name}${notes.length ? '\n       ' + notes.join('\n       ') : ''}`)
  failures = out.filter((r) => r[0] === 'FAIL').length
  console.log(`\n${out.length - failures} ok, ${failures} failed`)
} finally { stop() }
process.exit(failures ? 1 : 0)
