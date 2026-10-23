import { chromium } from '@playwright/test'
const base = 'http://localhost:3199'
const j = (r) => r.json()
const post = (path, body, token) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body ?? {}) }).then(j)

const { token } = await post('/api/users/login', { username: 'demo', password: 'demo1234' })
const created = await post('/api/presentations', { title: 'Spring kickoff' }, token)
const id = created.data.id ?? created.data._id
const current = await fetch(`${base}/api/presentations/${id}`, { headers: { authorization: `Bearer ${token}` } }).then(j)
const slide = { questionType: 'multiple-choice', question: 'Which topic first?', options: [{ id: crypto.randomUUID(), text: 'Roadmap' }, { id: crypto.randomUUID(), text: 'Budget' }] }
await fetch(`${base}/api/presentations/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ title: 'Spring kickoff', theme: 'iris', baseStructureRevision: current.data.structureRevision ?? 0, slides: [slide] }) })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
async function page(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript((t) => { localStorage.setItem('livepoll.token', t); localStorage.setItem('livepoll.user', JSON.stringify({ id: 'demo', username: 'demo', name: 'Demo' })) }, token)
  return ctx.newPage()
}
// Report page: end -> archive -> delete dialog
for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 800, 'mobile']]) {
  const run = await post(`/api/presentations/${id}/sessions`, {}, token)
  const p = await page(w, h)
  await p.goto(`${base}/report/${id}`, { waitUntil: 'networkidle' })
  const item = p.locator('li', { hasText: `code ${run.data.code}` })
  await item.getByRole('button', { name: 'End' }).click()
  await item.getByRole('button', { name: 'Archive' }).click()
  await item.getByRole('button', { name: 'Delete' }).click()
  await p.getByRole('dialog', { name: 'Delete this session?' }).waitFor()
  await p.screenshot({ path: `/tmp/shot-dialog-report-${tag}.png` })
  await p.close()
}
// Editor: delete-presentation dialog
for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 800, 'mobile']]) {
  const p = await page(w, h)
  await p.goto(`${base}/edit/${id}`, { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'Delete', exact: true }).click()
  await p.getByRole('dialog', { name: 'Delete this presentation?' }).waitFor()
  await p.screenshot({ path: `/tmp/shot-dialog-editor-${tag}.png` })
  await p.close()
}
await browser.close()
console.log('done', id)
