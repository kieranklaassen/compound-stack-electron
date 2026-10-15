// A kept file is whole or the one from before, and one that cannot be read is set aside, never removed.

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { readKept, writeWhole } from '../../shell/whole-file.mjs'

let folder
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'whole-file-'))
})
afterEach(() => rm(folder, { recursive: true, force: true }))

test('writeWhole writes the file and leaves no partial file beside it', async () => {
  const path = join(folder, 'deep', 'kept.json')
  await writeWhole(path, 'first')
  await writeWhole(path, 'second')
  assert.equal(await readFile(path, 'utf8'), 'second')
  assert.deepEqual(await readdir(join(folder, 'deep')), ['kept.json'])
})

test('writeWhole writes a file only the person can read', { skip: process.platform === 'win32' }, async () => {
  const path = join(folder, 'kept.json')
  await writeWhole(path, 'x')
  assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test('a write that cannot take its place leaves what was there and no partial file', async () => {
  const path = join(folder, 'taken')
  await mkdir(path)
  await writeFile(join(path, 'inside'), 'old')
  await assert.rejects(writeWhole(path, 'new'))
  assert.deepEqual(await readdir(folder), ['taken'])
  assert.equal(await readFile(join(path, 'inside'), 'utf8'), 'old')
})

test('readKept answers none where there is no file', async () => {
  assert.deepEqual(await readKept(join(folder, 'nothing.json')), { state: 'none' })
})

test('readKept answers read with the value', async () => {
  const path = join(folder, 'kept.json')
  await writeFile(path, '{"a":1}')
  assert.deepEqual(await readKept(path), { state: 'read', value: { a: 1 } })
})

test('a file that is not JSON is moved aside, not removed', async () => {
  const path = join(folder, 'kept.json')
  await writeFile(path, '{half')
  const answer = await readKept(path, () => true, () => 42)
  assert.deepEqual(answer, { state: 'unread', aside: 'kept.json.unread-42' })
  assert.deepEqual(await readdir(folder), ['kept.json.unread-42'])
  assert.equal(await readFile(join(folder, 'kept.json.unread-42'), 'utf8'), '{half')
})

test('a file the check does not take is moved aside with what it held', async () => {
  const path = join(folder, 'kept.json')
  await writeFile(path, '{"version":9}')
  const answer = await readKept(path, (value) => value.version === 1, () => 7)
  assert.deepEqual(answer, { state: 'unread', aside: 'kept.json.unread-7' })
  assert.equal(await readFile(join(folder, 'kept.json.unread-7'), 'utf8'), '{"version":9}')
})

test('a place that cannot be read as a file is unread and is left where it is', async () => {
  const path = join(folder, 'a-folder')
  await mkdir(path)
  assert.deepEqual(await readKept(path), { state: 'unread', aside: null })
  assert.deepEqual(await readdir(folder), ['a-folder'])
})
