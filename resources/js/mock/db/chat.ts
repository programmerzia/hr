import { subMinutes } from 'date-fns'
import type { Conversation, ConversationMember, Message } from '../../types'
import { teamMembers, teams } from './people'
import { projectMembers, projects } from './work'

const now = new Date()
const emp = (n: number) => `emp-${n}`

export const conversations: Conversation[] = []
export const conversationMembers: ConversationMember[] = []
export const messages: Message[] = []

// ---------- conversations ----------

teams.forEach((t) => {
  conversations.push({ id: `cv-team-${t.id.replace('team-', '')}`, type: 'team', name: t.name, team_id: t.id, project_id: null })
})
projects.forEach((p) => {
  conversations.push({ id: `cv-prj-${p.key.toLowerCase()}`, type: 'project', name: p.key, team_id: null, project_id: p.id })
})

const dms: [string, number, number][] = [
  ['cv-dm-1', 101, 103],
  ['cv-dm-2', 102, 117],
  ['cv-dm-3', 107, 108],
  ['cv-dm-4', 103, 107],
  ['cv-dm-5', 104, 115],
  ['cv-dm-6', 105, 119],
  ['cv-dm-7', 101, 102],
  ['cv-dm-8', 110, 116],
]
dms.forEach(([id]) => conversations.push({ id, type: 'dm', name: null, team_id: null, project_id: null }))
conversations.push({ id: 'cv-grp-release', type: 'group', name: 'Release 2.4 war room', team_id: null, project_id: null })
conversations.push({ id: 'cv-grp-leads', type: 'group', name: 'Leadership', team_id: null, project_id: null })

const members: Record<string, string[]> = {}
teams.forEach((t) => {
  members[`cv-team-${t.id.replace('team-', '')}`] = teamMembers.filter((m) => m.team_id === t.id).map((m) => m.employee_id)
})
projects.forEach((p) => {
  const ids = new Set(projectMembers.filter((m) => m.project_id === p.id).map((m) => m.employee_id))
  ids.add(p.lead_employee_id)
  members[`cv-prj-${p.key.toLowerCase()}`] = [...ids]
})
dms.forEach(([id, a, b]) => {
  members[id] = [emp(a), emp(b)]
})
members['cv-grp-release'] = [103, 105, 107, 108, 110, 114, 119].map(emp)
members['cv-grp-leads'] = [101, 102, 103, 104, 105, 106].map(emp)

// ---------- messages: [conversation, author, hours ago, text] ----------

type Line = [string, number, number, string]
const lines: Line[] = [
  // Web platform
  ['cv-team-web', 103, 118, 'Morning all. Sprint planning is at 11:00 today, please have your estimates in before then.'],
  ['cv-team-web', 107, 117.5, 'Added mine. PULSE-2 is the big one, I put 12h on it.'],
  ['cv-team-web', 111, 117, 'Staging deploy is slow again, takes about 9 minutes. Looking at the image layers.'],
  ['cv-team-web', 109, 100, 'Does anyone have the VPN profile for the Harbor environment? Mine expired.'],
  ['cv-team-web', 112, 99.5, '@Imran Hossain check the wiki page under infra, the new profile is attached there.'],
  ['cv-team-web', 109, 99, 'Found it, thanks.'],
  ['cv-team-web', 103, 76, 'Reminder: code freeze for release 2.4 starts Thursday evening. Anything not in review by then waits.'],
  ['cv-team-web', 110, 75, 'PULSE-8 is in review, the clustering fix cuts the render time by 70 percent.'],
  ['cv-team-web', 107, 74.5, 'Nice. I will review it after lunch.'],
  ['cv-team-web', 113, 52, 'Question for the team, should I add the sitemap in SITE-4 as a static file or generate it at build time?'],
  ['cv-team-web', 110, 51, '@Fahim Reza build time is better, otherwise it goes stale. Happy to pair on it.'],
  ['cv-team-web', 113, 50.5, 'Great, let us do that after standup.'],
  ['cv-team-web', 111, 30, 'ERP-1 is blocked on the scanner SDK licence. Asked Mahbubur to chase it.'],
  ['cv-team-web', 103, 29, 'Okay. Pull ERP-4 forward in the meantime.'],
  ['cv-team-web', 112, 5, 'Staging is back after the DB restart, sorry for the noise.'],
  ['cv-team-web', 103, 3.5, '@Sadia Sultana can you take a look at PULSE-12 today? It is still blocking the release.'],
  ['cv-team-web', 108, 2, 'I can help on that one too, I touched the refresh code last month.'],

  // Product design
  ['cv-team-design', 104, 110, 'Design crit is moved to Wednesday 15:00. Bring whatever you have, rough is fine.'],
  ['cv-team-design', 116, 108, 'APEX-2 mobile layout is nearly done, will post it in the thread.'],
  ['cv-team-design', 115, 90, 'Anyone seen the updated brand colours from Northwind? They sent a PDF but the hex values look off.'],
  ['cv-team-design', 118, 89, 'I have the original file, uploading to the shared drive now.'],
  ['cv-team-design', 117, 70, 'First week notes: the design tokens doc is really helpful. Where do I find the icon source files?'],
  ['cv-team-design', 116, 69, '@Priya Das shared drive under Assets, then Icons. Ask if something is missing.'],
  ['cv-team-design', 104, 48, 'Priya, welcome properly. Let us have lunch on Thursday as a team.'],
  ['cv-team-design', 115, 26, 'PULSE-4 empty states are drafted, the three variants are in Figma.'],
  ['cv-team-design', 104, 25, 'Looks good. Go with the second variant, it is clearer.'],
  ['cv-team-design', 116, 4, 'APEX-5 icon set needs another round, @Arif Chowdhury can we sync?'],

  // Quality
  ['cv-team-qa', 105, 105, 'Regression suite for 2.4 starts Monday. Lamia, please keep the device farm booked.'],
  ['cv-team-qa', 121, 104, 'Booked for the full week, five Android and four iOS devices.'],
  ['cv-team-qa', 119, 80, 'PULSE-7 is half done. Found two layout bugs on small screens, logging them now.'],
  ['cv-team-qa', 120, 60, 'ERP-6 test plan is archived, the cycle count module shipped without issues.'],
  ['cv-team-qa', 105, 59, 'Good. Thanks Kamrul.'],
  ['cv-team-qa', 121, 28, 'ERP-7 smoke tests are green on CI for the third night in a row.'],
  ['cv-team-qa', 119, 6, 'Heads up, the flaky login test is back. I think it is the staging DB again.'],

  // Office operations
  ['cv-team-ops', 106, 112, 'New laptops arrive Wednesday. Jahangir, please prepare the asset tags.'],
  ['cv-team-ops', 122, 111, 'Will do. LT-0230 to LT-0236 are reserved for them.'],
  ['cv-team-ops', 123, 85, 'Month end close is next Tuesday. Send me any pending bills by Monday.'],
  ['cv-team-ops', 124, 84, 'Printer on the second floor is offline, I am on it.'],
  ['cv-team-ops', 106, 40, 'OPS-1 import needs the final leave sheet from HR. Shirin, can you ask Nasrin?'],
  ['cv-team-ops', 123, 39, 'Asked, she will send it tomorrow.'],
  ['cv-team-ops', 122, 8, 'Water dispenser filter replaced. Nothing else outstanding from facilities.'],

  // PULSE
  ['cv-prj-pulse', 103, 119, 'Release 2.4 scope is final: PULSE-1, PULSE-2, PULSE-6 and PULSE-7. Everything else slides to 2.5.'],
  ['cv-prj-pulse', 108, 118, 'PULSE-1 reproduced on a Pixel 6. The payload is null when the app starts cold from a tray tap.'],
  ['cv-prj-pulse', 107, 117, 'That matches what I saw in PULSE-12. Both go through the same token path.'],
  ['cv-prj-pulse', 114, 96, 'Deep link parsing for PULSE-6 is done. Waiting on PULSE-2 for the auth gate.'],
  ['cv-prj-pulse', 107, 95, 'PULSE-2 is on track, keychain storage is merged. Fallback to PIN is next.'],
  ['cv-prj-pulse', 110, 72, 'Offline cache (PULSE-3) design is ready for review: SQLite, last 200 shipments, 24h TTL.'],
  ['cv-prj-pulse', 103, 71, '@Rumana Haque 24h is too long for tracking data, make it 6h and check with the client.'],
  ['cv-prj-pulse', 110, 70, 'Will do, and I will update the doc.'],
  ['cv-prj-pulse', 119, 54, 'Starting the regression pass for 2.4 (PULSE-7). First build please.'],
  ['cv-prj-pulse', 108, 53, 'Build 2.4.0-rc1 is on TestFlight and the internal Android track.'],
  ['cv-prj-pulse', 119, 36, 'Found a crash when rotating the map while offline. Filed as a comment on PULSE-8.'],
  ['cv-prj-pulse', 110, 35, 'I see it, it is the marker pool not being released. Fix incoming.'],
  ['cv-prj-pulse', 103, 14, 'Status check: PULSE-12 still red. @Sadia Sultana what do you need?'],
  ['cv-prj-pulse', 107, 13, 'The staging auth service returns 500 after airplane mode. I need Shafiqul to look at the backend side.'],
  ['cv-prj-pulse', 111, 12, 'Looking now. It is a stale refresh token cache, should have a patch within the hour.'],
  ['cv-prj-pulse', 114, 3, 'PULSE-6 is ready for review. Sharing a short screen recording in a moment.'],
  ['cv-prj-pulse', 103, 1.5, '@Nusrat Jahan thanks, I will review it before 17:00.'],

  // ERP
  ['cv-prj-erp', 103, 114, 'Harbor asked for a demo of the goods receipt flow on Friday. Who can drive it?'],
  ['cv-prj-erp', 111, 113, 'I can, ERP-1 will be in a demo-able state by Thursday if the scanner SDK arrives.'],
  ['cv-prj-erp', 112, 92, 'Report export for ERP-3 now runs in 6 seconds with the new index.'],
  ['cv-prj-erp', 103, 91, 'Excellent. Also check ERP-8 since it uses the same query.'],
  ['cv-prj-erp', 109, 66, 'ERP-8 is a one-day off-by-one in the lead time calculation. Fix is merged.'],
  ['cv-prj-erp', 121, 47, 'Smoke tests for ERP-7 now cover the receipt flow end to end.'],
  ['cv-prj-erp', 120, 46, 'Great, I will add the negative cases next.'],
  ['cv-prj-erp', 107, 31, 'Permissions matrix for ERP-5: should store managers be able to approve their own transfers?'],
  ['cv-prj-erp', 103, 30, '@Sadia Sultana no, a second approver is required. I will confirm with Harbor.'],
  ['cv-prj-erp', 111, 10, 'ERP-12 audit log issue is reproducible, missing user on bulk edit. Working on it.'],
  ['cv-prj-erp', 112, 2.5, 'Pagination for ERP-3 is next. Estimating two hours.'],

  // APEX
  ['cv-prj-apex', 104, 120, 'Client call recap: they like the gallery direction, want bigger thumbnails.'],
  ['cv-prj-apex', 116, 101, 'APEX-1 desktop is signed off. Mobile (APEX-2) to follow.'],
  ['cv-prj-apex', 110, 100, 'Starting APEX-4 gallery component. Thumbnail strip first.'],
  ['cv-prj-apex', 115, 78, 'Checkout wireframes are final, APEX-3 closed.'],
  ['cv-prj-apex', 118, 56, 'Icon set draft attached, 24 icons so far. Feedback on stroke weight welcome.'],
  ['cv-prj-apex', 104, 55, 'Stroke is a bit heavy next to the typography. Try 1.5.'],
  ['cv-prj-apex', 119, 33, 'Cross-browser pass (APEX-7) will start once the gallery is in.'],
  ['cv-prj-apex', 110, 9, '@Farhana Yasmin gallery zoom needs a decision, pinch or double tap on mobile?'],
  ['cv-prj-apex', 104, 7, 'Double tap, with pinch as a bonus if it is cheap.'],

  // SITE
  ['cv-prj-site', 104, 102, 'Website refresh goals: faster, simpler, and the new case study template.'],
  ['cv-prj-site', 116, 82, 'SITE-2 template wireframe is in Figma.'],
  ['cv-prj-site', 110, 62, 'Lighthouse on home is 74. Biggest cost is the hero video, see SITE-3.'],
  ['cv-prj-site', 117, 34, 'Careers copy for SITE-1 is drafted, @Nasrin Akter please review the role descriptions.'],
  ['cv-prj-site', 113, 11, 'Sitemap generator works locally, opening a PR for SITE-4.'],

  // OPS
  ['cv-prj-ops', 106, 97, 'Internal tooling is paused until the month end close is done.'],
  ['cv-prj-ops', 123, 73, 'OPS-6: the expense export breaks on commas in descriptions. Quoting fields fixes it.'],
  ['cv-prj-ops', 122, 50, 'OPS-2 label printer test went fine, will roll out after the new laptops arrive.'],
  ['cv-prj-ops', 112, 19, 'OPS-5 restore drill notes are on the wiki. Restore took 22 minutes.'],

  // DMs
  ['cv-dm-1', 101, 90, 'Tanvir, how is the Northwind release looking?'],
  ['cv-dm-1', 103, 89, 'On track for Friday, one blocker (PULSE-12) which we should clear today.'],
  ['cv-dm-1', 101, 88, 'Good. Let me know if you need anyone from design.'],
  ['cv-dm-1', 101, 20, 'Can you send me the Harbor demo plan by end of day?'],
  ['cv-dm-1', 103, 19, 'Sure, I will draft it this afternoon.'],
  ['cv-dm-1', 101, 2, 'Thanks. Also, ERP-1 status for the board deck?'],

  ['cv-dm-2', 102, 44, 'Hi Priya, how are you settling in? Anything missing from your onboarding checklist?'],
  ['cv-dm-2', 117, 43, 'All good so far. I still need my access card, I think.'],
  ['cv-dm-2', 102, 42, 'I will ask Jahangir to bring it over tomorrow.'],
  ['cv-dm-2', 102, 6, 'Reminder to upload your signed contract in your profile when you can.'],

  ['cv-dm-3', 107, 15, 'Zahid, could you pair with me for 30 minutes on the refresh token flow?'],
  ['cv-dm-3', 108, 14.5, 'Sure, after standup works. I will share my branch for PULSE-1 as well.'],
  ['cv-dm-3', 107, 14, 'Perfect.'],

  ['cv-dm-4', 103, 23, 'Sadia, what is the realistic date for PULSE-2?'],
  ['cv-dm-4', 107, 22, 'Thursday noon if the PIN fallback does not surprise us.'],
  ['cv-dm-4', 103, 21, 'Okay. Please update the task when you hit a blocker, not after.'],
  ['cv-dm-4', 107, 1, 'Will do. PULSE-12 is the one I am worried about, to be honest.'],

  ['cv-dm-5', 104, 58, 'Mehedi, can you take over the Apex checkout spec while Tasnim finishes mobile?'],
  ['cv-dm-5', 115, 57, 'Yes. Is APEX-6 the cart drawer one?'],
  ['cv-dm-5', 104, 56, 'That is the one. Priya can help.'],

  ['cv-dm-6', 105, 38, 'Sumaiya, please prioritise PULSE-7 over APEX-7 this week.'],
  ['cv-dm-6', 119, 37, 'Understood. I will let the Apex team know.'],

  ['cv-dm-7', 101, 64, 'Nasrin, any news on the intern conversion for Fahim?'],
  ['cv-dm-7', 102, 63, 'Review is scheduled for next week. I will share notes with you.'],
  ['cv-dm-7', 102, 4, '@Rafiq Ahmed the November payroll draft will be ready tomorrow morning.'],

  ['cv-dm-8', 110, 27, 'Tasnim, can you export the new arrow icons as SVG for APEX-4?'],
  ['cv-dm-8', 116, 26, 'Done, they are in the shared folder.'],
  ['cv-dm-8', 110, 25, 'Got them, thanks.'],

  // Groups
  ['cv-grp-release', 103, 100, 'Created this room for release 2.4 coordination. Keep it to blockers and status.'],
  ['cv-grp-release', 105, 99, 'QA is ready from Monday. First RC needed by then.'],
  ['cv-grp-release', 108, 78, 'RC1 ready Sunday evening. PULSE-1 fix is in.'],
  ['cv-grp-release', 119, 46, 'Regression progress: 38 of 60 cases passed, 2 failures logged against PULSE-8.'],
  ['cv-grp-release', 114, 45, 'I will look at the PULSE-8 failures right after standup.'],
  ['cv-grp-release', 107, 16, 'PULSE-12 blocked on backend refresh token cache. ETA this afternoon.'],
  ['cv-grp-release', 103, 15, 'If PULSE-12 is not done by tomorrow noon we ship without the airplane mode fix and note it.'],
  ['cv-grp-release', 110, 4, 'PULSE-8 fix merged. Regression can re-run.'],
  ['cv-grp-release', 105, 3, '@Sumaiya Akter please re-run the failed cases when the build is up.'],

  ['cv-grp-leads', 101, 96, 'Weekly leads sync notes are in the shared doc. Main item: hiring plan for Q1.'],
  ['cv-grp-leads', 102, 95, 'I will open two requisitions for web, one for QA. Need headcount sign-off.'],
  ['cv-grp-leads', 101, 94, 'Approved for web, hold QA until we see the Q1 pipeline.'],
  ['cv-grp-leads', 106, 72, 'Office lease renewal papers need a signature by the 20th.'],
  ['cv-grp-leads', 101, 71, '@Mahbubur Rahman send it to me tomorrow morning.'],
  ['cv-grp-leads', 104, 40, 'Apex invoice for milestone 2 is ready from our side, billing please.'],
  ['cv-grp-leads', 101, 39, 'Noted, I will raise it this week.'],
  ['cv-grp-leads', 105, 22, 'QA needs two more test devices for iOS 18. Budget request incoming.'],
  ['cv-grp-leads', 102, 12, '@Tanvir Hossain @Farhana Yasmin @Tariqul Islam @Mahbubur Rahman please check the leave requests waiting on you, a few are over two days old.'],
  ['cv-grp-leads', 103, 11, 'On it.'],
  ['cv-grp-leads', 101, 1, 'Reminder: all-hands on Thursday 16:00. Agenda in the doc.'],
]

const sorted = lines
  .map((l, i) => ({ l, i }))
  .sort((a, b) => b.l[2] - a.l[2] || a.i - b.i)
  .map(({ l }) => l)

sorted.forEach(([conversation, author, hoursAgo, body], i) => {
  messages.push({
    id: `msg-${String(i + 1).padStart(5, '0')}`,
    conversation_id: conversation,
    author_id: emp(author),
    body,
    attachments: [],
    created_at: subMinutes(now, Math.round(hoursAgo * 60)).toISOString(),
  })
})

// ---------- read pointers ----------

function hash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

conversations.forEach((c) => {
  const ofConv = messages.filter((m) => m.conversation_id === c.id)
  ;(members[c.id] ?? []).forEach((employeeId) => {
    const h = hash(`${c.id}:${employeeId}`) % 10
    // 40% fully read, otherwise 1 to 5 messages behind.
    const behind = h < 4 ? 0 : (h % 5) + 1
    const idx = ofConv.length - 1 - behind
    conversationMembers.push({
      conversation_id: c.id,
      employee_id: employeeId,
      last_read_message_id: idx >= 0 ? ofConv[idx].id : null,
    })
  })
})
