// The app, launched whole: the real shell, the built page on its own scheme,
// the one bridge. Run with `npm run test:e2e` (under `xvfb-run -a` on Linux).

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { answerDialogs, launch } from './support.mjs'

let running

before(async () => {
  running = await launch()
})
after(() => running?.close())

test('the page is served on the app’s own scheme, under its policy', async () => {
  const { page } = running
  assert.equal(new URL(page.url()).protocol, 'app:')
  const answer = await page.evaluate(async () => {
    const got = await fetch('app://page/index.html')
    return { csp: got.headers.get('content-security-policy'), type: got.headers.get('content-type') }
  })
  assert.match(answer.csp, /default-src 'none'/)
  assert.doesNotMatch(answer.csp, /unsafe-inline|unsafe-eval/)
  assert.match(answer.type, /text\/html/)
})

test('the page is given two functions and nothing of Node or Electron', async () => {
  const { page } = running
  const seen = await page.evaluate(() => ({
    shell: Object.keys(window.shell).sort(),
    require: typeof window.require,
    process: typeof window.process,
  }))
  assert.deepEqual(seen, { shell: ['ask', 'on'], require: 'undefined', process: 'undefined' })
})

test('a door that is not on the list is refused, and a path outside the page is not served', async () => {
  const { page } = running
  const refused = await page.evaluate(() => window.shell.ask('fs', 'readFile', ['/etc/passwd']))
  assert.equal(refused.ok, false)
  const status = await page.evaluate(async () => (await fetch('app://page/../../package.json')).status)
  assert.equal(status, 404)
})

test('a number is dragged, and the drag is one step of Undo', async () => {
  const { page } = running
  const size = page.getByLabel('Size')
  const box = await size.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  assert.equal(await size.inputValue(), '84pt')
  await page.getByRole('button', { name: 'Undo' }).click()
  assert.equal(await size.inputValue(), '64pt')
})

test('resting on a control shows its tip, and Option shows the whole card', async () => {
  const { page } = running
  await page.getByRole('button', { name: 'Save' }).hover()
  const card = page.getByRole('tooltip')
  await card.waitFor()
  assert.equal(await card.getAttribute('data-level'), 'tip')
  assert.match(await card.innerText(), /Save/)
  await page.keyboard.down('Alt')
  assert.equal(await card.getAttribute('data-level'), 'card')
  assert.match(await card.innerText(), /The first save asks where/)
  await page.keyboard.up('Alt')
  assert.equal(await card.getAttribute('data-level'), 'tip')
  await page.mouse.move(2, 200)
})

test('Check for updates says what came of it where the press was', async () => {
  const { page } = running
  await page.getByRole('button', { name: 'Settings' }).click()
  const updates = page.getByRole('region', { name: 'Updates' })
  // A checkout has no server and no place to exchange: the control is there, off, and says why.
  const check = updates.getByRole('button', { name: 'Check for updates' })
  assert.equal(await check.getAttribute('aria-disabled'), 'true')
  assert.match(await check.getAttribute('data-says'), /not set to a server/)
  await page.getByRole('button', { name: 'Done' }).click()
})

test('a save asks where once, writes the file whole, and says so beside the button', async () => {
  const { app, page, userData } = running
  const place = join(userData, 'poster.compound')
  await answerDialogs(app, { save: place })
  await page.getByLabel('Title').fill('Launched')
  await page.getByLabel('Title').press('Enter')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByText('Saved as poster.compound.').waitFor()
  assert.equal(JSON.parse(await readFile(place, 'utf8')).title, 'Launched')
  // The page was told a name and an id, never the place.
  const state = await page.evaluate(() => window.pageAgent.run('get_state', {}))
  assert.equal(state.value.file, 'poster.compound')
  assert.ok(!JSON.stringify(state).includes(userData))
})

// Last on purpose: Playwright waits on the navigation the shell refused, so nothing is asked of the page after it.
test('the window goes nowhere but its own page', async () => {
  const { page } = running
  await page.evaluate(() => {
    window.location.href = 'https://example.com/'
  })
  await page.waitForTimeout(300)
  assert.equal(new URL(page.url()).protocol, 'app:')
})
