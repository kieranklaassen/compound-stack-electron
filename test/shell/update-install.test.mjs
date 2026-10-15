// Only a checked copy of a real folder out of the fetched image takes the app's place, and a failed exchange leaves the old app.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { handsFor, standInHands } from '../../shell/update-hands.mjs'
import { CANNOT, exchange, HIDDEN, placeOf, prepare, sweep } from '../../shell/update-install.mjs'

const BUNDLE = 'com.example.compound'
const IMAGE = 'the bytes of a disk image'
const SHA = createHash('sha256').update(IMAGE).digest('hex')

let folder
let app
let image
let mount
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'update-install-'))
  // The app that runs.
  app = join(folder, 'Applications', 'Compound.app')
  await mkdir(app, { recursive: true })
  await writeFile(join(app, 'info.json'), JSON.stringify({ bundleId: BUNDLE, version: '1.0.0' }))
  await writeFile(join(app, 'which'), 'old')
  // The image, and what the stand-in hands find when they attach it.
  image = join(folder, 'updates', 'build.dmg')
  mount = join(folder, 'updates', 'build.mount')
  await mkdir(dirname(image), { recursive: true })
  await writeFile(image, IMAGE)
})
afterEach(() => rm(folder, { recursive: true, force: true }))

/** Put a build in the image: a folder with the app's name and its info. */
async function build(info = {}, name = 'Compound.app') {
  const built = join(mount, name)
  await mkdir(built, { recursive: true })
  await writeFile(join(built, 'info.json'), JSON.stringify({ bundleId: BUNDLE, version: '1.1.0', minimumSystem: '12.0', ...info }))
  await writeFile(join(built, 'which'), 'new')
  return built
}

const asked = (changes = {}) => ({ image, update: { version: '1.1.0', sha256: SHA, size: IMAGE.length }, app, running: '1.0.0', bundleId: BUNDLE, ...changes })
const beside = () => readdir(dirname(app))

test('placeOf: a checkout does not update itself', () => {
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/Applications/Compound.app/Contents/MacOS/Compound', packaged: false }), { cannot: CANNOT.checkout })
  assert.deepEqual(placeOf({ platform: 'linux', exePath: '/usr/bin/electron', packaged: false }), { cannot: CANNOT.checkout })
})

test('placeOf: only a Mac app is exchanged', () => {
  assert.deepEqual(placeOf({ platform: 'win32', exePath: 'C:\\Program Files\\Compound\\Compound.exe', packaged: true }), { cannot: CANNOT.platform })
  assert.deepEqual(placeOf({ platform: 'linux', exePath: '/opt/Compound/compound', packaged: true }), { cannot: CANNOT.platform })
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/usr/local/bin/compound', packaged: true }), { cannot: CANNOT.platform })
})

test('placeOf: the app is the folder that holds the running program', () => {
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/Applications/Compound.app/Contents/MacOS/Compound', packaged: true }), { app: '/Applications/Compound.app' })
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/Users/someone/Apps/My Compound.app/Contents/MacOS/Compound', packaged: true }), { app: '/Users/someone/Apps/My Compound.app' })
})

test('placeOf: an app run from a disk image or translocated is asked to move', () => {
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/Volumes/Compound/Compound.app/Contents/MacOS/Compound', packaged: true }), { cannot: CANNOT.place })
  assert.deepEqual(placeOf({ platform: 'darwin', exePath: '/private/var/folders/ab/T/AppTranslocation/1234/d/Compound.app/Contents/MacOS/Compound', packaged: true }), { cannot: CANNOT.place })
})

test('the stand-in hands are for the harness only, and a checkout has none', () => {
  assert.equal(handsFor({ platform: 'linux', packaged: false, harness: false }), null)
  assert.equal(handsFor({ platform: 'darwin', packaged: false, harness: false }), null)
  assert.equal(handsFor({ platform: 'win32', packaged: true, harness: false }), null)
  assert.deepEqual(handsFor({ platform: 'linux', packaged: false, harness: true }).noted, [])
})

test('prepare copies a good build beside the app, under the hidden name, and checks the copy', async () => {
  await build()
  const hands = standInHands()
  const { next, failed } = await prepare(asked(), hands)
  assert.equal(failed, undefined)
  assert.equal(basename(next), 'Compound.app')
  assert.equal(dirname(dirname(next)), dirname(app))
  assert.ok(basename(dirname(next)).startsWith(HIDDEN))
  assert.equal(await readFile(join(next, 'which'), 'utf8'), 'new')
  // The running app is untouched until the exchange.
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'old')
  const did = hands.noted.map(([what]) => what)
  assert.deepEqual(did, ['attach', 'copy', 'detach', 'info', 'verify'])
  // What is checked is the copy, not the image.
  assert.deepEqual(hands.noted[3], ['info', next])
  assert.deepEqual(hands.noted[4], ['verify', next])
  assert.deepEqual(hands.noted[2], ['detach', mount])
})

test('two prepares stand under two names', async () => {
  await build()
  const first = await prepare(asked(), standInHands())
  const second = await prepare(asked(), standInHands())
  assert.notEqual(first.next, second.next)
})

const failsClean = async (changes, hands = standInHands()) => {
  assert.deepEqual(await prepare(asked(changes), hands), { failed: 'check' })
  assert.deepEqual(await beside(), ['Compound.app'], 'nothing is left beside the app')
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'old')
  return hands
}

test('an image with another checksum is not attached', async () => {
  await build()
  const hands = await failsClean({ update: { version: '1.1.0', sha256: 'b'.repeat(64) } })
  assert.deepEqual(hands.noted, [])
  const gone = await failsClean({ image: join(folder, 'updates', 'nothing.dmg') })
  assert.deepEqual(gone.noted, [])
})

test('an image changed after it was fetched fails the check', async () => {
  await build()
  await writeFile(image, `${IMAGE} and more`)
  await failsClean()
})

test('a build with another bundle id fails the check and leaves nothing', async () => {
  await build({ bundleId: 'com.example.other' })
  const hands = await failsClean()
  assert.ok(hands.noted.some(([what]) => what === 'detach'))
  assert.ok(!hands.noted.some(([what]) => what === 'verify'))
})

test('a build that is not higher than the running one fails the check', async () => {
  await build({ version: '1.0.0' })
  await failsClean({ update: { version: '1.0.0', sha256: SHA } })
  await rm(mount, { recursive: true })
  await build({ version: '0.9.0' })
  await failsClean({ update: { version: '0.9.0', sha256: SHA } })
})

test('a build of another version than the one named fails the check', async () => {
  await build({ version: '1.2.0' })
  await failsClean()
})

test('a build whose version is no version fails the check', async () => {
  await build({ version: 'next' })
  await failsClean({ update: { version: 'next', sha256: SHA } })
})

test('a link in place of the app folder fails the check and is not copied', { skip: process.platform === 'win32' }, async () => {
  const real = await build({}, 'Elsewhere.app')
  await symlink(real, join(mount, 'Compound.app'))
  const hands = await failsClean()
  assert.deepEqual(hands.noted.map(([what]) => what), ['attach', 'detach'])
})

test('a file in place of the app folder, or no app in the image, fails the check', async () => {
  await mkdir(mount, { recursive: true })
  await failsClean()
  await writeFile(join(mount, 'Compound.app'), 'a file')
  await failsClean()
})

test('a build with no info fails the check and leaves nothing', async () => {
  const built = await build()
  await rm(join(built, 'info.json'))
  await failsClean()
})

test('a build this system does not take, one that does not verify, or of another team fails the check', async () => {
  await build()
  await failsClean({}, { ...standInHands(), systemTakes: async () => false })
  await failsClean({}, { ...standInHands(), verify: async () => false })
  await failsClean({}, { ...standInHands(), verify: async () => { throw new Error('codesign') } })
  await failsClean({}, { ...standInHands(), team: async (which) => (which === app ? 'TEAMAAAAAA' : 'TEAMBBBBBB') })
  await failsClean({}, { ...standInHands(), team: async (which) => (which === app ? 'TEAMAAAAAA' : null) })
})

test('a build of the same team, or over an app with no team, is prepared', async () => {
  await build()
  assert.ok((await prepare(asked(), { ...standInHands(), team: async () => 'TEAMAAAAAA' })).next)
  assert.ok((await prepare(asked(), { ...standInHands(), team: async (which) => (which === app ? null : 'TEAMBBBBBB') })).next)
})

test('hands that fail to attach or to copy fail the check and leave nothing', async () => {
  await build()
  await failsClean({}, { ...standInHands(), attach: async () => { throw new Error('hdiutil') } })
  const detached = []
  await failsClean({}, { ...standInHands(), copy: async () => { throw new Error('ditto') }, detach: async (where) => void detached.push(where) })
  assert.deepEqual(detached, [mount])
})

test('exchange puts the new app in the place of the old and answers where the old one lies', async () => {
  await build()
  const { next } = await prepare(asked(), standInHands())
  const exchanged = await exchange(app, next)
  assert.deepEqual(exchanged, { old: join(dirname(next), 'old-Compound.app') })
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'new')
  assert.equal(await readFile(join(exchanged.old, 'which'), 'utf8'), 'old')
  assert.equal(await sweep(dirname(exchanged.old)), true)
  assert.deepEqual(await beside(), ['Compound.app'])
})

test('exchange rolls back where the second move fails: the old app stands', async () => {
  const hidden = join(dirname(app), `${HIDDEN}0000`)
  await mkdir(hidden)
  const next = join(hidden, 'Compound.app')
  assert.deepEqual(await exchange(app, next), { failed: 'install' })
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'old')
  assert.deepEqual(await readdir(hidden), [])
})

test('exchange fails with the old app untouched where the first move cannot be made', async () => {
  const next = join(dirname(app), `${HIDDEN}gone`, 'Compound.app')
  assert.deepEqual(await exchange(app, next), { failed: 'install' })
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'old')
  assert.deepEqual(await exchange(join(folder, 'Applications', 'Nothing.app'), next), { failed: 'install' })
})

test('sweep removes only a folder under the hidden name', async () => {
  const other = join(folder, 'Applications', 'Documents')
  await mkdir(other)
  await writeFile(join(other, 'keep'), 'x')
  assert.equal(await sweep(other), false)
  assert.equal(await sweep(app), false)
  assert.equal(await sweep(dirname(app)), false)
  assert.equal(await sweep(join(other, '..', 'Compound.app')), false)
  assert.equal(await readFile(join(other, 'keep'), 'utf8'), 'x')
  assert.equal(await readFile(join(app, 'which'), 'utf8'), 'old')
  const hidden = join(folder, 'Applications', `${HIDDEN}abcd`)
  await mkdir(join(hidden, 'old-Compound.app'), { recursive: true })
  assert.equal(await sweep(hidden), true)
  assert.deepEqual((await beside()).sort(), ['Compound.app', 'Documents'])
  // One that is already gone is swept all the same.
  assert.equal(await sweep(hidden), true)
})
