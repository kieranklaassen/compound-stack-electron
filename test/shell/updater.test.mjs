// The updater looks and fetches by itself, installs only on the person's press or at a quit they allowed, and never over work under way.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Refused } from '../../shell/doors.mjs'
import { NOT_THE_PRESS } from '../../shell/press.mjs'
import { AGENT_LOOK_MS, AWAY_MS, LOOK_EVERY_MS, lookTimes, SAYS, updateDoor, Updater } from '../../shell/updater.mjs'

const PRESS = { gesture: true }
const AGENT = { gesture: false, askedBy: 'agent' }
const SHA = 'a'.repeat(64)
const URL_OF_BUILD = 'https://downloads.example.com/build.dmg?signature=abc'
const UPDATE = { version: '1.3.0', size: 1000, sha256: SHA, url: URL_OF_BUILD }
const IMAGE = '/updates/build.dmg'
const NEXT = '/Applications/.compound-update-0000/Compound.app'
const BUSY = 'The update waits until the document is saved.'

const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((done) => setImmediate(done))
}

/** An updater over fake hands. `found` is what a look finds; each hand's answer can be changed by the test. */
function made({ settings = {}, cannot = null, found = { update: UPDATE } } = {}) {
  const did = []
  const states = []
  const world = {
    found,
    fetched: { path: IMAGE },
    prepared: { next: NEXT },
    exchanged: { old: '/Applications/.compound-update-0000/old-Compound.app' },
    busy: null,
    now: 1_000_000,
    settings: { fetchUpdates: true, installAtQuit: true, ...settings },
    quits: 0,
  }
  const hands = {
    look: async () => {
      did.push('look')
      return world.found
    },
    fetch: async (update, progress) => {
      did.push('fetch')
      assert.equal(update.sha256, SHA)
      if (world.fetched.path) {
        progress(400)
        progress(1000)
      }
      return world.fetched
    },
    prepare: async (image, update) => {
      did.push('prepare')
      assert.equal(image, IMAGE)
      assert.equal(update.version, '1.3.0')
      if (world.prepared instanceof Error) throw world.prepared
      return world.prepared
    },
    discard: async (next) => void did.push(`discard ${next}`),
    exchange: async (next) => {
      did.push(`exchange ${next}`)
      return world.exchanged
    },
    relaunch: async () => void did.push('relaunch'),
  }
  const updater = new Updater({
    running: '1.2.3',
    hands,
    settings: async () => world.settings,
    busy: () => world.busy,
    quit: () => (world.quits += 1),
    now: () => world.now,
    changed: (state) => states.push(state),
    cannot,
  })
  // The states the page was told, with repeats of one state (progress) folded.
  const told = () => states.map((state) => state.state).filter((state, index, all) => state !== all[index - 1])
  const count = (what) => did.filter((name) => name === what).length
  return { updater, world, did, states, told, count }
}

const refusedWith = (code, sentence) => (error) => error instanceof Refused && error.code === code && error.message === sentence

test('it begins current, with the version that runs', () => {
  const { updater } = made()
  assert.deepEqual(updater.state, { state: 'current', running: '1.2.3', newer: null, fetched: 0, seen: null, failed: null, cannot: null, waits: null })
})

test('a look that finds a build goes current, looking, available, fetching, ready', async () => {
  const { updater, states, told, did, world } = made()
  const answer = await updater.check()
  assert.deepEqual(told(), ['looking', 'available', 'fetching', 'ready'])
  assert.deepEqual(did, ['look', 'fetch'])
  assert.deepEqual(answer, { state: 'ready', running: '1.2.3', newer: { version: '1.3.0', size: 1000 }, fetched: 1000, seen: world.now, failed: null, cannot: null, waits: null })
  assert.deepEqual(states.filter((state) => state.state === 'fetching').map((state) => state.fetched), [0, 400, 1000])
})

test('a look that finds nothing newer is current, and says when it looked', async () => {
  const { updater, told, did, world } = made({ found: { update: null } })
  const answer = await updater.check()
  assert.deepEqual(told(), ['looking', 'current'])
  assert.deepEqual(did, ['look'])
  assert.equal(answer.seen, world.now)
  assert.equal(answer.newer, null)
})

test('the page is told only a state that is another one than the last', async () => {
  const { updater, states } = made({ found: { update: null } })
  await updater.check()
  await updater.check()
  for (let index = 1; index < states.length; index += 1) assert.notDeepEqual(states[index], states[index - 1])
})

test('with fetchUpdates off it stops at available', async () => {
  const { updater, told, did } = made({ settings: { fetchUpdates: false } })
  const answer = await updater.check()
  assert.deepEqual(told(), ['looking', 'available'])
  assert.deepEqual(did, ['look'])
  assert.deepEqual(answer.newer, { version: '1.3.0', size: 1000 })
})

test('download needs the person press, and then fetches the build that is out', async () => {
  const { updater, told, did } = made({ settings: { fetchUpdates: false } })
  await updater.check()
  for (const who of [undefined, {}, { gesture: false }, AGENT, { gesture: true, askedBy: 'agent' }]) {
    await assert.rejects(updater.download(who), refusedWith('update.not_the_press', NOT_THE_PRESS))
  }
  assert.deepEqual(did, ['look'])
  assert.equal((await updater.download(PRESS)).state, 'ready')
  assert.deepEqual(told(), ['looking', 'available', 'fetching', 'ready'])
  assert.deepEqual(did, ['look', 'fetch'])
})

test('download with nothing out does nothing', async () => {
  const { updater, did } = made({ found: { update: null } })
  assert.equal((await updater.download(PRESS)).state, 'current')
  await updater.check()
  assert.equal((await updater.download(PRESS)).state, 'current')
  assert.deepEqual(did, ['look'])
})

test('a look that fails says so: no answer, unreadable, a hand that throws, signed out', async () => {
  for (const found of [{ noAnswer: true }, { unreadable: true }]) {
    const { updater, told } = made({ found })
    const answer = await updater.check()
    assert.deepEqual(told(), ['looking', 'failed'])
    assert.deepEqual(answer.failed, { at: 'look', says: SAYS.look })
    assert.equal(answer.seen, null)
  }
  const thrown = { updater: null }
  thrown.updater = new Updater({ running: '1.2.3', hands: { look: async () => { throw new Error('ECONNRESET https://app.example.com/device/update?token=abc') } }, settings: async () => ({}) })
  const failed = await thrown.updater.check()
  assert.deepEqual(failed.failed, { at: 'look', says: SAYS.look })
  assert.doesNotMatch(JSON.stringify(failed), /ECONNRESET|token/)
  const signedOut = made({ found: { signedOut: true } })
  assert.deepEqual((await signedOut.updater.check()).failed, { at: 'look', says: SAYS.signedOut })
})

test('a look that answers at once, without a promise, is read the same', async () => {
  const updater = new Updater({ running: '1.2.3', hands: { look: () => ({ signedOut: true }) }, settings: async () => ({}) })
  assert.deepEqual((await updater.check()).failed, { at: 'look', says: SAYS.signedOut })
  const throws = new Updater({ running: '1.2.3', hands: { look: () => { throw new Error('no') } }, settings: async () => ({}) })
  assert.deepEqual((await throws.check()).failed, { at: 'look', says: SAYS.look })
})

test('a failed fetch says so, and the next look fetches again by itself', async () => {
  const { updater, world, count } = made()
  world.fetched = { failed: 'fetch' }
  const answer = await updater.check()
  assert.equal(answer.state, 'failed')
  assert.deepEqual(answer.failed, { at: 'fetch', says: SAYS.fetch })
  assert.deepEqual(answer.newer, { version: '1.3.0', size: 1000 })
  world.fetched = { path: IMAGE }
  assert.equal((await updater.check()).state, 'ready')
  assert.equal(count('fetch'), 2)
})

test('a fetch hand that throws is a failed fetch', async () => {
  const updater = new Updater({ running: '1.2.3', hands: { look: async () => ({ update: UPDATE }), fetch: async () => { throw new Error('disk full at /Users/someone') } }, settings: async () => ({ fetchUpdates: true }) })
  const answer = await updater.check()
  assert.deepEqual(answer.failed, { at: 'fetch', says: SAYS.fetch })
  assert.doesNotMatch(JSON.stringify(answer), /someone|disk full/)
})

test('a build that failed its check is not fetched again by itself, only on a press', async () => {
  const { updater, world, count } = made()
  world.fetched = { failed: 'check' }
  const first = await updater.check()
  assert.deepEqual(first.failed, { at: 'check', says: SAYS.check })
  assert.equal(count('fetch'), 1)
  // The shell's own look, and an agent's after a while, find it again and leave it.
  assert.equal((await updater.check()).state, 'available')
  world.now += AGENT_LOOK_MS
  assert.equal((await updater.check(AGENT)).state, 'available')
  assert.equal(count('look'), 3)
  assert.equal(count('fetch'), 1)
  // The person's press tries it again.
  world.fetched = { path: IMAGE }
  assert.equal((await updater.check(PRESS)).state, 'ready')
  assert.equal(count('fetch'), 2)
})

test('a build that failed its check is tried again by a press on download', async () => {
  const { updater, world, count } = made()
  world.fetched = { failed: 'check' }
  await updater.check()
  world.fetched = { path: IMAGE }
  assert.equal((await updater.download(PRESS)).state, 'ready')
  assert.equal(count('fetch'), 2)
})

test('another build than the one that failed its check is fetched by itself', async () => {
  const other = { ...UPDATE, version: '1.4.0', sha256: 'c'.repeat(64) }
  const fetched = []
  let out = UPDATE
  const updater = new Updater({
    running: '1.2.3',
    settings: async () => ({ fetchUpdates: true }),
    hands: {
      look: async () => ({ update: out }),
      fetch: async (update) => {
        fetched.push(update.sha256)
        return update.sha256 === SHA ? { failed: 'check' } : { path: IMAGE }
      },
    },
  })
  assert.equal((await updater.check()).state, 'failed')
  out = other
  assert.equal((await updater.check()).state, 'ready')
  assert.deepEqual(fetched, [SHA, other.sha256])
})

test('an agent check within five minutes is answered from what is known', async () => {
  const { updater, world, count } = made({ found: { update: null } })
  await updater.check()
  assert.equal(count('look'), 1)
  world.now += AGENT_LOOK_MS - 1
  const known = await updater.check(AGENT)
  assert.equal(known.state, 'current')
  assert.equal(count('look'), 1)
  world.now += 1
  await updater.check(AGENT)
  assert.equal(count('look'), 2)
})

test('an agent check before any look, and the person press at any time, ask the server', async () => {
  const { updater, count } = made({ found: { update: null } })
  await updater.check(AGENT)
  assert.equal(count('look'), 1)
  await updater.check(PRESS)
  await updater.check(PRESS)
  assert.equal(count('look'), 3)
  // A press that names an agent is the agent's.
  await updater.check({ gesture: true, askedBy: 'agent' })
  assert.equal(count('look'), 3)
})

test('two checks at once are one look', async () => {
  const { updater, count } = made({ found: { update: null } })
  await Promise.all([updater.check(PRESS), updater.check(), updater.check(PRESS)])
  assert.equal(count('look'), 1)
})

test('a check while a build is fetched does not look again', async () => {
  let arrive
  const looks = []
  const updater = new Updater({
    running: '1.2.3',
    settings: async () => ({ fetchUpdates: true }),
    hands: { look: async () => (looks.push(1), { update: UPDATE }), fetch: () => new Promise((done) => (arrive = done)) },
  })
  const first = updater.check()
  await settle()
  assert.equal(updater.state.state, 'fetching')
  assert.equal((await updater.check(PRESS)).state, 'fetching')
  assert.equal(looks.length, 1)
  arrive({ path: IMAGE })
  assert.equal((await first).state, 'ready')
})

test('a look that finds the ready build again leaves it ready and fetches nothing', async () => {
  const { updater, count } = made()
  await updater.check()
  assert.equal((await updater.check(PRESS)).state, 'ready')
  assert.equal(count('fetch'), 1)
})

test('a look that finds nothing after a build was ready is current again', async () => {
  const { updater, world } = made()
  await updater.check()
  world.found = { update: null }
  const answer = await updater.check(PRESS)
  assert.equal(answer.state, 'current')
  assert.equal(answer.newer, null)
})

test('restart needs the person press', async () => {
  const { updater, did, world } = made()
  await updater.check()
  for (const who of [undefined, {}, AGENT, { gesture: true, askedBy: 'agent' }]) {
    await assert.rejects(updater.restart(who), refusedWith('update.not_the_press', NOT_THE_PRESS))
  }
  assert.deepEqual(did, ['look', 'fetch'])
  assert.equal(world.quits, 0)
  assert.equal(updater.state.state, 'ready')
})

test('restart with no build ready does nothing', async () => {
  const { updater, did, world } = made({ settings: { fetchUpdates: false } })
  assert.equal((await updater.restart(PRESS)).state, 'current')
  await updater.check()
  assert.equal((await updater.restart(PRESS)).state, 'available')
  assert.deepEqual(did, ['look'])
  assert.equal(world.quits, 0)
})

test('restart is refused with the busy sentence while busy, and the state says what it waits for', async () => {
  const { updater, did, world } = made()
  await updater.check()
  world.busy = BUSY
  assert.equal(updater.state.waits, BUSY)
  await assert.rejects(updater.restart(PRESS), refusedWith('update.waits', BUSY))
  assert.deepEqual(did, ['look', 'fetch'])
  assert.equal(world.quits, 0)
  assert.equal(updater.state.state, 'ready')
})

test('restart prepares, arms and calls quit, and atQuit then exchanges and relaunches', async () => {
  const { updater, did, world, told } = made()
  await updater.check()
  const answer = await updater.restart(PRESS)
  assert.equal(answer.state, 'installing')
  assert.deepEqual(did, ['look', 'fetch', 'prepare'])
  assert.equal(world.quits, 1)
  assert.deepEqual(await updater.atQuit(), world.exchanged)
  assert.deepEqual(did, ['look', 'fetch', 'prepare', `exchange ${NEXT}`, 'relaunch'])
  assert.deepEqual(told(), ['looking', 'available', 'fetching', 'ready', 'installing'])
  // A quit decides once.
  assert.equal(await updater.atQuit(), null)
  assert.equal(did.length, 5)
})

test('an armed restart is exchanged at the quit whatever the setting says', async () => {
  const { updater, did, world } = made({ settings: { installAtQuit: false } })
  await updater.check()
  await updater.restart(PRESS)
  assert.deepEqual(await updater.atQuit(), world.exchanged)
  assert.ok(did.includes('relaunch'))
})

test('a build that fails its check when prepared is not installed, and quit is not called', async () => {
  const { updater, did, world, count } = made()
  await updater.check()
  world.prepared = { failed: 'check' }
  const answer = await updater.restart(PRESS)
  assert.equal(answer.state, 'failed')
  assert.deepEqual(answer.failed, { at: 'check', says: SAYS.check })
  assert.equal(world.quits, 0)
  assert.equal(await updater.atQuit(), null)
  assert.ok(!did.some((what) => what.startsWith('exchange')))
  // It is not fetched again by itself, and a press on download tries it.
  await updater.check()
  assert.equal(count('fetch'), 1)
  world.prepared = { next: NEXT }
  assert.equal((await updater.download(PRESS)).state, 'ready')
  assert.equal(count('fetch'), 2)
})

test('a prepare hand that throws is a failed check', async () => {
  const { updater, world } = made()
  await updater.check()
  world.prepared = new Error('hdiutil: attach failed for /updates/build.dmg')
  const answer = await updater.restart(PRESS)
  assert.equal(answer.state, 'failed')
  assert.deepEqual(answer.failed, { at: 'check', says: SAYS.check })
  assert.doesNotMatch(JSON.stringify(answer), /hdiutil/)
  assert.equal(world.quits, 0)
})

test('work that began while the build was prepared stops the restart, and the copy is discarded', async () => {
  const { updater, did, world } = made()
  await updater.check()
  // Busy is asked before the prepare, which is under way when restart hands back, and again after it.
  const restarting = updater.restart(PRESS)
  world.busy = BUSY
  const answer = await restarting
  assert.equal(answer.state, 'ready')
  assert.equal(answer.waits, BUSY)
  assert.deepEqual(did, ['look', 'fetch', 'prepare', `discard ${NEXT}`])
  assert.equal(world.quits, 0)
  assert.equal(await updater.atQuit(), null)
})

test('atQuit installs a ready build where installAtQuit is on, and does not relaunch', async () => {
  const { updater, did, world } = made()
  await updater.check()
  assert.deepEqual(await updater.atQuit(), world.exchanged)
  assert.deepEqual(did, ['look', 'fetch', 'prepare', `exchange ${NEXT}`])
  assert.equal(world.quits, 0)
  assert.equal(await updater.atQuit(), null)
  assert.equal(await updater.atQuit({ shutdown: false }), null)
  assert.equal(did.length, 4)
})

test('atQuit installs nothing with installAtQuit off', async () => {
  const { updater, did } = made({ settings: { installAtQuit: false } })
  await updater.check()
  assert.equal(await updater.atQuit(), null)
  assert.deepEqual(did, ['look', 'fetch'])
})

test('atQuit installs nothing on a shutdown', async () => {
  const { updater, did } = made()
  await updater.check()
  assert.equal(await updater.atQuit({ shutdown: true }), null)
  assert.deepEqual(did, ['look', 'fetch'])
})

test('atQuit installs nothing while busy', async () => {
  const { updater, did, world } = made()
  await updater.check()
  world.busy = BUSY
  assert.equal(await updater.atQuit(), null)
  assert.deepEqual(did, ['look', 'fetch'])
})

test('atQuit installs nothing that is not ready', async () => {
  const none = made({ found: { update: null } })
  await none.updater.check()
  assert.equal(await none.updater.atQuit(), null)
  const available = made({ settings: { fetchUpdates: false } })
  await available.updater.check()
  assert.equal(await available.updater.atQuit(), null)
  assert.deepEqual(available.did, ['look'])
  assert.equal(await made().updater.atQuit(), null)
})

test('an exchange that fails says so, and the version that runs is still the one', async () => {
  const { updater, did, world } = made()
  await updater.check()
  await updater.restart(PRESS)
  world.exchanged = { failed: 'install' }
  assert.equal(await updater.atQuit(), null)
  assert.ok(!did.includes('relaunch'))
  assert.deepEqual(updater.state.failed, { at: 'install', says: SAYS.install })
  assert.equal(updater.state.running, '1.2.3')
})

test('an updater that cannot update is off, says why and never looks', async () => {
  const { updater, did, states } = made({ cannot: 'A build run from a checkout does not update itself.' })
  assert.equal(updater.state.state, 'off')
  assert.equal(updater.state.cannot, 'A build run from a checkout does not update itself.')
  assert.equal((await updater.check(PRESS)).state, 'off')
  assert.equal((await updater.download(PRESS)).state, 'off')
  assert.equal((await updater.restart(PRESS)).state, 'off')
  assert.equal(await updater.atQuit(), null)
  assert.deepEqual(did, [])
  assert.deepEqual(states, [])
})

test('the state never holds an address, a checksum or a place', async () => {
  const { updater, states, world } = made()
  const heard = [updater.state]
  heard.push(await updater.check())
  world.busy = BUSY
  heard.push(updater.state)
  world.busy = null
  heard.push(await updater.restart(PRESS))
  await updater.atQuit()
  heard.push(updater.state)
  const failing = made()
  failing.world.fetched = { failed: 'check' }
  heard.push(await failing.updater.check(), ...failing.states)
  const text = JSON.stringify([heard, states])
  assert.ok(states.length >= 5)
  for (const secret of ['url', 'sha256', SHA, URL_OF_BUILD, 'downloads.example.com', 'signature', IMAGE, NEXT, '/Applications', '/updates']) {
    assert.ok(!text.includes(secret), `the state holds ${secret}`)
  }
  for (const state of [...heard, ...states]) {
    assert.deepEqual(Object.keys(state), ['state', 'running', 'newer', 'fetched', 'seen', 'failed', 'cannot', 'waits'])
    if (state.newer) assert.deepEqual(Object.keys(state.newer), ['version', 'size'])
  }
})

test('the door passes the press on', async () => {
  const { updater, world } = made()
  const door = updateDoor(updater)
  assert.deepEqual(Object.keys(door), ['state', 'check', 'download', 'restart'])
  assert.equal(door.state().state, 'current')
  assert.equal((await door.check([], PRESS)).state, 'ready')
  await assert.rejects(door.restart([], AGENT), Refused)
  await assert.rejects(door.download([], AGENT), Refused)
  assert.equal((await door.restart([], PRESS)).state, 'installing')
  assert.equal(world.quits, 1)
})

test('lookTimes: at launch, every six hours, and on coming back after an hour away', () => {
  const clock = { now: 0, every: [] }
  let checks = 0
  const looks = lookTimes({ check: () => (checks += 1), later: (run, ms) => clock.every.push({ run, ms }), now: () => clock.now })
  assert.equal(checks, 0)
  assert.equal(clock.every.length, 1)
  assert.equal(clock.every[0].ms, LOOK_EVERY_MS)
  looks.launched()
  assert.equal(checks, 1)
  clock.every[0].run()
  assert.equal(checks, 2)

  // Coming back with no leaving before it looks at nothing.
  looks.cameBack()
  assert.equal(checks, 2)
  // Away for less than the hour.
  looks.left()
  clock.now += AWAY_MS - 1
  looks.cameBack()
  assert.equal(checks, 2)
  // Away for the hour.
  looks.left()
  clock.now += AWAY_MS
  looks.cameBack()
  assert.equal(checks, 3)
  // The leaving is used once.
  clock.now += AWAY_MS
  looks.cameBack()
  assert.equal(checks, 3)
})
