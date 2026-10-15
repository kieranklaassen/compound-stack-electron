// Settings are a closed list of keys, each held to its own check, behind one door.

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { Refused } from '../../shell/doors.mjs'
import { Kept } from '../../shell/kept.mjs'
import { SETTING_DEFAULTS, SETTINGS, settingsDoor, settled } from '../../shell/settings.mjs'

let folder
let path
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'settings-'))
  path = join(folder, 'settings.json')
})
afterEach(() => rm(folder, { recursive: true, force: true }))

test('the defaults are one for each setting, and each is a value its key takes', () => {
  assert.deepEqual(SETTING_DEFAULTS, { scheme: 'system', fetchUpdates: true, installAtQuit: true })
  for (const [key, setting] of Object.entries(SETTINGS)) assert.ok(setting.takes(SETTING_DEFAULTS[key]), key)
})

test('settled drops unknown keys and puts the default where a value is not one the key takes', () => {
  assert.deepEqual(settled({ scheme: 'dark', fetchUpdates: false, installAtQuit: false, extra: 1 }), { scheme: 'dark', fetchUpdates: false, installAtQuit: false })
  assert.deepEqual(settled({ scheme: 'purple', fetchUpdates: 'yes', installAtQuit: 0 }), SETTING_DEFAULTS)
  assert.deepEqual(settled({}), SETTING_DEFAULTS)
  assert.deepEqual(settled(null), SETTING_DEFAULTS)
  assert.deepEqual(settled(undefined), SETTING_DEFAULTS)
  assert.deepEqual(settled('text'), SETTING_DEFAULTS)
})

test('the door reads what is kept, settled', async () => {
  await writeFile(path, '{"scheme":"light","fetchUpdates":"no","other":true}')
  const door = settingsDoor(new Kept(path, { defaults: SETTING_DEFAULTS }))
  assert.deepEqual(await door.read(), { scheme: 'light', fetchUpdates: true, installAtQuit: true })
})

test('the door sets a setting, keeps it and tells what changed', async () => {
  const told = []
  const door = settingsDoor(new Kept(path, { defaults: SETTING_DEFAULTS }), (next) => told.push(next))
  const next = await door.set(['scheme', 'dark'])
  assert.deepEqual(next, { scheme: 'dark', fetchUpdates: true, installAtQuit: true })
  assert.deepEqual(told, [next])
  assert.deepEqual(await door.set(['fetchUpdates', false]), { scheme: 'dark', fetchUpdates: false, installAtQuit: true })
  assert.equal(told.length, 2)
  assert.equal(JSON.parse(await readFile(path, 'utf8')).scheme, 'dark')
  assert.deepEqual(await settingsDoor(new Kept(path, { defaults: SETTING_DEFAULTS })).read(), { scheme: 'dark', fetchUpdates: false, installAtQuit: true })
})

test('the door refuses an unknown key or a value of the wrong type, and writes and tells nothing', async () => {
  const told = []
  const door = settingsDoor(new Kept(path, { defaults: SETTING_DEFAULTS }), (next) => told.push(next))
  const tries = [['colour', 'red'], ['scheme', 'purple'], ['scheme', true], ['fetchUpdates', 'true'], ['installAtQuit', 1], ['toString', 'x'], ['__proto__', {}], ['constructor', true], [undefined, undefined], []]
  for (const args of tries) {
    await assert.rejects(door.set(args), (error) => error instanceof Refused && error.code === 'settings.unknown' && error.message === 'That is not a setting.', JSON.stringify(args))
  }
  assert.deepEqual(told, [])
  await assert.rejects(readFile(path), { code: 'ENOENT' })
})
