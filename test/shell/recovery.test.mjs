// The open document is kept beside the settings, no more often than once a second, and goes only on the person's word.

import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { KEEP_EVERY_MS, MOST_BYTES, Recovery } from '../../shell/recovery.mjs'

let folder
let path
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recovery-'))
  path = join(folder, 'recovery.json')
})
afterEach(() => rm(folder, { recursive: true, force: true }))

/** A recovery whose clock and timer are the test's. */
function made() {
  const clock = { now: 10_000, timers: [], cancelled: 0 }
  const later = (run, ms) => {
    const timer = { run, ms }
    clock.timers.push(timer)
    return () => {
      clock.cancelled += 1
      clock.timers = clock.timers.filter((other) => other !== timer)
    }
  }
  return { clock, recovery: new Recovery(path, { now: () => clock.now, later }) }
}

const onDisk = async () => JSON.parse(await readFile(path, 'utf8'))

test('the first keep is written at once', async () => {
  const { clock, recovery } = made()
  assert.equal(recovery.keep({ title: 'one' }), true)
  assert.deepEqual(clock.timers, [])
  await recovery.flush()
  assert.deepEqual(await onDisk(), { version: 1, document: { title: 'one' } })
  assert.deepEqual(await readdir(folder), ['recovery.json'])
})

test('keeps within the second wait for one timer, and the last one is what is written', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  await recovery.flush()
  clock.now += 300
  recovery.keep({ n: 2 })
  clock.now += 300
  recovery.keep({ n: 3 })
  recovery.keep({ n: 4 })
  assert.equal(clock.timers.length, 1)
  assert.equal(clock.timers[0].ms, KEEP_EVERY_MS - 300)
  // Nothing is written until the second is over.
  await new Promise((done) => setImmediate(done))
  assert.deepEqual((await onDisk()).document, { n: 1 })
  clock.now += 400
  clock.timers.shift().run()
  await recovery.flush()
  assert.deepEqual((await onDisk()).document, { n: 4 })
})

test('a keep after the second is over is written at once', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  await recovery.flush()
  clock.now += KEEP_EVERY_MS
  recovery.keep({ n: 2 })
  assert.deepEqual(clock.timers, [])
  await recovery.flush()
  assert.deepEqual((await onDisk()).document, { n: 2 })
})

test('flush writes what is held now and cancels the timer', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  clock.now += 10
  recovery.keep({ n: 2 })
  assert.equal(clock.timers.length, 1)
  await recovery.flush()
  assert.equal(clock.cancelled, 1)
  assert.deepEqual(clock.timers, [])
  assert.deepEqual((await onDisk()).document, { n: 2 })
})

test('flush with nothing held writes nothing', async () => {
  const { recovery } = made()
  await recovery.flush()
  assert.deepEqual(await readdir(folder), [])
})

test('take gives none where nothing was kept', async () => {
  assert.deepEqual(await made().recovery.take(), { state: 'none' })
})

test('take gives what was kept, held or already written, also to another launch', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  clock.now += 10
  recovery.keep({ n: 2, list: [1, 2], text: 'héllo' })
  assert.deepEqual(await recovery.take(), { state: 'kept', document: { n: 2, list: [1, 2], text: 'héllo' } })
  assert.deepEqual(await made().recovery.take(), { state: 'kept', document: { n: 2, list: [1, 2], text: 'héllo' } })
  // Taking is not the answer: it is still kept.
  assert.equal((await recovery.take()).state, 'kept')
})

test('a kept document may be null', async () => {
  const { recovery } = made()
  recovery.keep(null)
  assert.deepEqual(await recovery.take(), { state: 'kept', document: null })
})

test('a file this build cannot read is unread and set aside, never removed', async () => {
  for (const text of ['{half', '{"version":2,"document":{}}', '{"version":1}', 'null']) {
    await writeFile(path, text)
    const taken = await made().recovery.take()
    assert.equal(taken.state, 'unread', text)
    assert.match(taken.aside, /^recovery\.json\.unread-\d+$/)
    assert.equal(await readFile(join(folder, taken.aside), 'utf8'), text)
    await rm(join(folder, taken.aside))
  }
})

test('drop removes what was kept, held or written', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  clock.now += 10
  recovery.keep({ n: 2 })
  await recovery.drop()
  assert.equal(clock.cancelled, 1)
  assert.deepEqual(await readdir(folder), [])
  await recovery.flush()
  assert.deepEqual(await readdir(folder), [])
  assert.deepEqual(await recovery.take(), { state: 'none' })
})

test('drop right after a keep leaves nothing, though the write was under way', async () => {
  const { recovery } = made()
  recovery.keep({ n: 1 })
  await recovery.drop()
  assert.deepEqual(await readdir(folder), [])
})

test('drop with nothing kept is fine, and keeping goes on after it', async () => {
  const { clock, recovery } = made()
  await recovery.drop()
  clock.now += KEEP_EVERY_MS
  recovery.keep({ n: 3 })
  assert.deepEqual(await recovery.take(), { state: 'kept', document: { n: 3 } })
})

test('a document that is too large is not kept, and what was kept before stays', async () => {
  const { clock, recovery } = made()
  recovery.keep({ n: 1 })
  await recovery.flush()
  clock.now += KEEP_EVERY_MS
  assert.equal(recovery.keep({ text: 'x'.repeat(MOST_BYTES) }), false)
  assert.deepEqual(clock.timers, [])
  assert.deepEqual(await recovery.take(), { state: 'kept', document: { n: 1 } })
})

test('a write that fails does not break the next one', async () => {
  const { clock } = made()
  const clockNow = () => clock.now
  const blocked = join(folder, 'blocked')
  await writeFile(blocked, 'a file where a folder is needed')
  const recovery = new Recovery(join(blocked, 'recovery.json'), { now: clockNow, later: () => () => {} })
  assert.equal(recovery.keep({ n: 1 }), true)
  await recovery.flush()
  assert.equal(await readFile(blocked, 'utf8'), 'a file where a folder is needed')
})
