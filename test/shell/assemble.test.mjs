// The doors a page can reach are the ones written in shell/doors.json, and throwing kept work away is the person's own press.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { assemble } from '../../shell/assemble.mjs'
import { NOT_THE_PRESS } from '../../shell/press.mjs'
import { SETTING_DEFAULTS } from '../../shell/settings.mjs'

const written = JSON.parse(readFileSync(fileURLToPath(new URL('../../shell/doors.json', import.meta.url)), 'utf8'))

/** The doors over the smallest fakes that note what they were asked. */
function made() {
  const did = []
  const note = (what, value) => (...args) => {
    did.push([what, ...args])
    return value
  }
  let kept = { ...SETTING_DEFAULTS }
  const doors = assemble({
    account: { state: { state: 'signed_out' }, start: note('account.start', { state: 'waiting', code: 'ABCD-1234' }), openAgain: note('account.openAgain'), cancel: note('account.cancel'), signOut: note('account.signOut') },
    documents: { open: note('documents.open', null), save: note('documents.save', { id: 'an-id', name: 'plan.compound' }) },
    recovery: { keep: note('recovery.keep', true), take: note('recovery.take', { state: 'none' }), drop: note('recovery.drop') },
    settings: { kept: { read: async () => kept, write: async (changes) => (kept = { ...kept, ...changes }) }, changed: note('settings.changed') },
    updater: { state: { state: 'current' }, check: note('updater.check', { state: 'current' }), download: note('updater.download'), restart: note('updater.restart') },
    app: { about: note('app.about', { name: 'Compound', version: '1.2.3' }), unsaved: note('app.unsaved', true), openOutside: note('app.openOutside', true) },
    log: (line) => did.push(['log', line]),
  })
  return { doors, did }
}

test('the list of doors is the one written in doors.json', () => {
  assert.deepEqual(made().doors.list(), written)
})

test('every door and method of doors.json answers', async () => {
  const { doors } = made()
  for (const [door, methods] of Object.entries(written)) {
    for (const method of methods) {
      const answer = await doors.answer({ door, method, args: ['scheme', 'dark'] }, { gesture: true })
      assert.notEqual(answer.code, 'no_such_door', `${door}.${method}`)
    }
  }
})

test('recovery.drop is refused unless it is the person own press', async () => {
  const { doors, did } = made()
  const ask = { door: 'recovery', method: 'drop', args: [] }
  for (const who of [undefined, {}, { gesture: false }, { gesture: false, askedBy: 'agent' }, { gesture: true, askedBy: 'agent' }, { gesture: 'true' }]) {
    assert.deepEqual(await doors.answer(ask, who), { ok: false, refused: NOT_THE_PRESS, code: 'recovery.not_the_press' })
  }
  assert.deepEqual(did, [])
  assert.deepEqual(await doors.answer(ask, { gesture: true }), { ok: true, value: true })
  assert.deepEqual(did, [['recovery.drop']])
})

test('recovery.keep and take are passed on', async () => {
  const { doors, did } = made()
  assert.deepEqual(await doors.answer({ door: 'recovery', method: 'keep', args: [{ title: 'x' }] }), { ok: true, value: true })
  assert.deepEqual(await doors.answer({ door: 'recovery', method: 'take', args: [] }), { ok: true, value: { state: 'none' } })
  assert.deepEqual(did, [['recovery.keep', { title: 'x' }], ['recovery.take']])
})

test('app.unsaved is told true only for true', async () => {
  const { doors, did } = made()
  for (const value of [true, 'true', 1, undefined]) await doors.answer({ door: 'app', method: 'unsaved', args: [value] })
  assert.deepEqual(did, [['app.unsaved', true], ['app.unsaved', false], ['app.unsaved', false], ['app.unsaved', false]])
})

test('app.about and openOutside are passed on', async () => {
  const { doors, did } = made()
  assert.deepEqual(await doors.answer({ door: 'app', method: 'about' }), { ok: true, value: { name: 'Compound', version: '1.2.3' } })
  assert.deepEqual(await doors.answer({ door: 'app', method: 'openOutside', args: ['https://example.com/'] }), { ok: true, value: true })
  assert.deepEqual(did, [['app.about'], ['app.openOutside', 'https://example.com/']])
})

test('the press travels to the account and the updater as the shell read it', async () => {
  const { doors, did } = made()
  await doors.answer({ door: 'account', method: 'start', args: [] }, { gesture: true, askedBy: undefined, extra: 1 })
  await doors.answer({ door: 'updates', method: 'restart', args: [] }, { gesture: 'yes', askedBy: 'agent' })
  assert.deepEqual(did, [['account.start', { gesture: true, askedBy: undefined }], ['updater.restart', { gesture: false, askedBy: 'agent' }]])
})

test('a save drops the kept copy, and settings tell what changed', async () => {
  const { doors, did } = made()
  assert.deepEqual(await doors.answer({ door: 'documents', method: 'save', args: [null, {}, 'Plan'] }), { ok: true, value: { id: 'an-id', name: 'plan.compound' } })
  assert.deepEqual(did.map(([what]) => what), ['documents.save', 'recovery.drop'])
  const set = await doors.answer({ door: 'settings', method: 'set', args: ['scheme', 'dark'] })
  assert.deepEqual(set, { ok: true, value: { ...SETTING_DEFAULTS, scheme: 'dark' } })
  assert.deepEqual(did.at(-1), ['settings.changed', { ...SETTING_DEFAULTS, scheme: 'dark' }])
  assert.deepEqual(await doors.answer({ door: 'settings', method: 'set', args: ['nothing', 1] }), { ok: false, refused: 'That is not a setting.', code: 'settings.unknown' })
})
