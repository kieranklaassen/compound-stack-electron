// A document's file is named to the page by an id the shell made, never by its place on the disk.

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { Documents, documentsDoor, EXTENSION } from '../../shell/documents.mjs'
import { Refused } from '../../shell/doors.mjs'

let folder
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'documents-'))
})
afterEach(() => rm(folder, { recursive: true, force: true }))

/** Documents over fake dialogs: `picks` and `saves` are the places the person picks, in order. */
function made({ picks = [], saves = [] } = {}) {
  const asked = { pick: 0, pickToSave: [] }
  const documents = new Documents({
    pick: async () => {
      asked.pick += 1
      return picks.shift() ?? null
    },
    pickToSave: async (name) => {
      asked.pickToSave.push(name)
      return saves.shift() ?? null
    },
  })
  return { documents, asked }
}

const refusedWith = (code) => (error) => error instanceof Refused && error.code === code

test('the extension is the app own', () => {
  assert.match(EXTENSION, /^[a-z]+$/)
})

test('open answers an id, the file name and the document, and no place', async () => {
  const place = join(folder, 'plan.compound')
  await writeFile(place, '{"title":"Plan"}')
  const { documents } = made({ picks: [place] })
  const opened = await documents.open()
  assert.deepEqual(Object.keys(opened).sort(), ['document', 'id', 'name'])
  assert.match(opened.id, /^[0-9a-f-]{36}$/)
  assert.equal(opened.name, 'plan.compound')
  assert.deepEqual(opened.document, { title: 'Plan' })
  assert.ok(!JSON.stringify(opened).includes(folder))
})

test('a cancelled pick answers null', async () => {
  const { documents, asked } = made()
  assert.equal(await documents.open(), null)
  assert.equal(asked.pick, 1)
})

test('a file that cannot be read as a document is a Refused, with no place in its sentence', async () => {
  const notJson = join(folder, 'notes.compound')
  await writeFile(notJson, 'not json')
  const aFolder = join(folder, 'folder.compound')
  await mkdir(aFolder)
  const { documents } = made({ picks: [notJson, join(folder, 'gone.compound'), aFolder] })
  for (let n = 0; n < 3; n += 1) {
    await assert.rejects(documents.open(), (error) => refusedWith('documents.unreadable')(error) && !error.message.includes(folder) && error.message === 'That file could not be read as a document.')
  }
})

test('each open gives another id, also for the same file', async () => {
  const place = join(folder, 'plan.compound')
  await writeFile(place, '{}')
  const { documents } = made({ picks: [place, place] })
  assert.notEqual((await documents.open()).id, (await documents.open()).id)
})

test('save to an id writes the file it names and asks nowhere', async () => {
  const place = join(folder, 'plan.compound')
  await writeFile(place, '{"title":"Plan"}')
  const { documents, asked } = made({ picks: [place] })
  const { id } = await documents.open()
  const saved = await documents.save([id, { title: 'Plan', body: 'more' }, 'ignored'])
  assert.deepEqual(saved, { id, name: 'plan.compound' })
  assert.deepEqual(asked.pickToSave, [])
  assert.deepEqual(JSON.parse(await readFile(place, 'utf8')), { title: 'Plan', body: 'more' })
  assert.deepEqual(await readdir(folder), ['plan.compound'])
})

test('save with no id asks where, under the name, and answers a new id', async () => {
  const place = join(folder, 'new.compound')
  const { documents, asked } = made({ saves: [place] })
  const saved = await documents.save([null, { a: 1 }, 'New thing'])
  assert.deepEqual(asked.pickToSave, ['New thing'])
  assert.match(saved.id, /^[0-9a-f-]{36}$/)
  assert.equal(saved.name, 'new.compound')
  assert.ok(!JSON.stringify(saved).includes(folder))
  assert.deepEqual(JSON.parse(await readFile(place, 'utf8')), { a: 1 })
  // The id it answered saves there again without asking.
  assert.deepEqual(await documents.save([saved.id, { a: 2 }]), saved)
  assert.deepEqual(asked.pickToSave, ['New thing'])
  assert.deepEqual(JSON.parse(await readFile(place, 'utf8')), { a: 2 })
})

test('a name that is no text is Untitled, and a long one is cut', async () => {
  const { documents, asked } = made()
  await documents.save([null, {}, undefined])
  await documents.save([null, {}, 7])
  await documents.save([null, {}, 'n'.repeat(200)])
  assert.deepEqual(asked.pickToSave, ['Untitled', 'Untitled', 'n'.repeat(80)])
})

test('a cancelled save answers null and writes nothing', async () => {
  const { documents } = made()
  assert.equal(await documents.save([null, { a: 1 }, 'New']), null)
  assert.deepEqual(await readdir(folder), [])
})

test('an id that names nothing, and a place given as an id, ask where', async () => {
  const place = join(folder, 'plan.compound')
  const target = join(folder, 'picked.compound')
  const { documents, asked } = made({ saves: [target, null] })
  const saved = await documents.save([place, { a: 1 }, 'Plan'])
  assert.equal(asked.pickToSave.length, 1)
  assert.equal(saved.name, 'picked.compound')
  assert.deepEqual(await readdir(folder), ['picked.compound'])
  assert.equal(await documents.save(['00000000-0000-4000-8000-000000000000', { a: 1 }]), null)
  assert.equal(asked.pickToSave.length, 2)
})

test('a document too large to save is a Refused', async () => {
  const place = join(folder, 'big.compound')
  const { documents } = made({ saves: [place] })
  await assert.rejects(documents.save([null, { text: 'x'.repeat(8 * 1024 * 1024) }, 'Big']), refusedWith('documents.too_large'))
  assert.deepEqual(await readdir(folder), [])
})

test('a place that cannot be written is a Refused with no place in its sentence', async () => {
  const blocked = join(folder, 'blocked')
  await writeFile(blocked, 'a file where a folder is needed')
  const { documents } = made({ saves: [join(blocked, 'x.compound')] })
  await assert.rejects(documents.save([null, {}, 'X']), (error) => refusedWith('documents.not_saved')(error) && !error.message.includes(folder))
})

test('forget makes the old ids open nothing: a save with one asks where', async () => {
  const place = join(folder, 'plan.compound')
  await writeFile(place, '{"n":1}')
  const { documents, asked } = made({ picks: [place] })
  const { id } = await documents.open()
  documents.forget()
  assert.equal(await documents.save([id, { n: 2 }, 'Plan']), null)
  assert.deepEqual(asked.pickToSave, ['Plan'])
  assert.deepEqual(JSON.parse(await readFile(place, 'utf8')), { n: 1 })
})

test('the door drops the kept copy after a save, and not after a cancel', async () => {
  const place = join(folder, 'plan.compound')
  const { documents } = made({ saves: [null, place] })
  let dropped = 0
  const door = documentsDoor(documents, { drop: async () => void (dropped += 1) })
  assert.deepEqual(Object.keys(door), ['open', 'save'])
  assert.equal(await door.save([null, { a: 1 }, 'Plan']), null)
  assert.equal(dropped, 0)
  assert.equal((await door.save([null, { a: 1 }, 'Plan'])).name, 'plan.compound')
  assert.equal(dropped, 1)
  assert.equal(await door.open(), null)
  assert.equal(dropped, 1)
})
