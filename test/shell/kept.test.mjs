// A small file the shell keeps is read once over its defaults, written whole, and set aside when it cannot be read.

import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { Kept } from '../../shell/kept.mjs'

let folder
let path
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'kept-'))
  path = join(folder, 'kept.json')
})
afterEach(() => rm(folder, { recursive: true, force: true }))

test('with no file it reads the defaults and nothing is unread', async () => {
  const kept = new Kept(path, { defaults: { a: 1 } })
  assert.deepEqual(await kept.read(), { a: 1 })
  assert.equal(kept.unread, null)
  assert.deepEqual(await readdir(folder), [])
})

test('what is kept lies over the defaults', async () => {
  await writeFile(path, '{"b":2,"a":5}')
  assert.deepEqual(await new Kept(path, { defaults: { a: 1, c: 3 } }).read(), { a: 5, c: 3, b: 2 })
})

test('a write changes some keys, keeps the rest and is on the disk whole', async () => {
  const kept = new Kept(path, { defaults: { a: 1 } })
  assert.deepEqual(await kept.write({ b: 2 }), { a: 1, b: 2 })
  assert.deepEqual(await kept.write({ a: 9 }), { a: 9, b: 2 })
  assert.deepEqual(await kept.read(), { a: 9, b: 2 })
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { a: 9, b: 2 })
  assert.deepEqual(await readdir(folder), ['kept.json'])
  assert.deepEqual(await new Kept(path).read(), { a: 9, b: 2 })
})

test('the disk is read once', async () => {
  await writeFile(path, '{"a":1}')
  const kept = new Kept(path)
  assert.deepEqual(await kept.read(), { a: 1 })
  await writeFile(path, '{"a":2}')
  assert.deepEqual(await kept.read(), { a: 1 })
})

test('a file that cannot be read is set aside, and the defaults are read', async () => {
  await writeFile(path, 'not json')
  const kept = new Kept(path, { defaults: { a: 1 } })
  assert.deepEqual(await kept.read(), { a: 1 })
  assert.match(kept.unread, /^kept\.json\.unread-\d+$/)
  assert.deepEqual(await readdir(folder), [kept.unread])
  assert.equal(await readFile(join(folder, kept.unread), 'utf8'), 'not json')
})

test('JSON that is no object is not taken', async () => {
  for (const text of ['null', '7', '"text"']) {
    await writeFile(path, text)
    const kept = new Kept(path, { defaults: { a: 1 } })
    assert.deepEqual(await kept.read(), { a: 1 })
    assert.ok(kept.unread, text)
  }
})

test('a check of its own decides what is taken', async () => {
  await writeFile(path, '{"version":2}')
  const kept = new Kept(path, { defaults: { version: 1 }, check: (value) => value?.version === 1 })
  assert.deepEqual(await kept.read(), { version: 1 })
  assert.ok(kept.unread)
  // A write after it makes a new file and leaves the one set aside.
  await kept.write({ a: 1 })
  assert.deepEqual((await readdir(folder)).sort(), ['kept.json', kept.unread].sort())
})
