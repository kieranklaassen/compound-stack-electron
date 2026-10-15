// A fetched build is a build only once the whole of it, read back from the disk, has the size and checksum that were named.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, afterEach, before, beforeEach, test } from 'node:test'

import { clearUpdates, fetchUpdate, hashOf, imagePath, keptImage } from '../../shell/update-fetch.mjs'

const BUILD = Buffer.alloc(200_000, 'compound build ')
const SHA = createHash('sha256').update(BUILD).digest('hex')

let server
let origin
let requests
before(async () => {
  server = createServer((request, answer) => {
    requests.push(request.url)
    if (request.url === '/build.dmg') return answer.writeHead(200, { 'content-length': BUILD.length }).end(BUILD)
    if (request.url === '/long.dmg') return answer.writeHead(200).end(Buffer.concat([BUILD, Buffer.from('more')]))
    if (request.url === '/short.dmg') return answer.writeHead(200).end(BUILD.subarray(0, 1000))
    if (request.url === '/other.dmg') return answer.writeHead(200).end(Buffer.alloc(BUILD.length, 'x'))
    if (request.url === '/moved.dmg') return answer.writeHead(302, { location: '/build.dmg' }).end()
    if (request.url === '/headers') return answer.writeHead(200).end(JSON.stringify(request.headers))
    return answer.writeHead(404).end('not here')
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise((done) => server.close(done)))

let folder
let updates
beforeEach(async () => {
  requests = []
  folder = await mkdtemp(join(tmpdir(), 'update-fetch-'))
  updates = join(folder, 'updates')
})
afterEach(() => rm(folder, { recursive: true, force: true }))

const update = (path = '/build.dmg', changes = {}) => ({ version: '1.3.0', size: BUILD.length, sha256: SHA, url: `${origin}${path}`, ...changes })
const left = () => readdir(updates).catch(() => [])

test('imagePath is the checksum under the folder', () => {
  assert.equal(imagePath('/updates', SHA), join('/updates', `${SHA}.dmg`))
})

test('hashOf is the SHA-256 of a file, and fails for one that is not there', async () => {
  const path = join(folder, 'file')
  await writeFile(path, BUILD)
  assert.equal(await hashOf(path), SHA)
  await assert.rejects(hashOf(join(folder, 'nothing')))
})

test('it fetches the build, verifies it and keeps it whole under its checksum', async () => {
  const seen = []
  const got = await fetchUpdate(update(), updates, { progress: (bytes) => seen.push(bytes) })
  assert.deepEqual(got, { path: imagePath(updates, SHA) })
  assert.ok((await readFile(got.path)).equals(BUILD))
  assert.deepEqual(await left(), [`${SHA}.dmg`])
  assert.deepEqual(requests, ['/build.dmg'])
  assert.equal(seen.at(-1), BUILD.length)
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b))
})

test('a wrong checksum is a failed check, and no file is left', async () => {
  assert.deepEqual(await fetchUpdate(update('/other.dmg'), updates), { failed: 'check' })
  assert.deepEqual(await left(), [])
  assert.deepEqual(await fetchUpdate(update('/build.dmg', { sha256: 'b'.repeat(64) }), updates), { failed: 'check' })
  assert.deepEqual(await left(), [])
})

test('a body longer than the named size stops as a failed check, and no file is left', async () => {
  assert.deepEqual(await fetchUpdate(update('/long.dmg'), updates), { failed: 'check' })
  assert.deepEqual(await left(), [])
  // Also where the size named is far smaller than what comes.
  const seen = []
  assert.deepEqual(await fetchUpdate(update('/build.dmg', { size: 10 }), updates, { progress: (bytes) => seen.push(bytes) }), { failed: 'check' })
  assert.deepEqual(seen, [])
  assert.deepEqual(await left(), [])
})

test('a body shorter than the named size is a failed check', async () => {
  assert.deepEqual(await fetchUpdate(update('/short.dmg'), updates), { failed: 'check' })
  assert.deepEqual(await left(), [])
})

test('a 404 is a failed fetch, and no file is left', async () => {
  assert.deepEqual(await fetchUpdate(update('/nothing.dmg'), updates), { failed: 'fetch' })
  assert.deepEqual(await left(), [])
})

test('a redirect is not followed', async () => {
  assert.deepEqual(await fetchUpdate(update('/moved.dmg'), updates), { failed: 'fetch' })
  assert.deepEqual(requests, ['/moved.dmg'])
  assert.deepEqual(await left(), [])
})

test('a server that is not there is a failed fetch', async () => {
  assert.deepEqual(await fetchUpdate(update('/build.dmg', { url: 'http://127.0.0.1:1/build.dmg' }), updates), { failed: 'fetch' })
  assert.deepEqual(await left(), [])
})

test('a signal that is aborted ends the fetch', async () => {
  assert.deepEqual(await fetchUpdate(update(), updates, { signal: AbortSignal.abort() }), { failed: 'fetch' })
  assert.deepEqual(await left(), [])
})

test('the request carries no token and asks for no redirect', async () => {
  const asked = []
  const fetchIt = (address, options) => {
    asked.push(options)
    return fetch(address, options)
  }
  await fetchUpdate(update(), updates, { fetch: fetchIt })
  assert.equal(asked.length, 1)
  assert.equal(asked[0].redirect, 'error')
  assert.equal(asked[0].cache, 'no-store')
  assert.equal(asked[0].headers, undefined)
})

test('a whole image that is kept is used again without a request', async () => {
  const first = await fetchUpdate(update(), updates)
  const again = await fetchUpdate(update('/nothing.dmg'), updates, { fetch: () => assert.fail('fetched again') })
  assert.deepEqual(again, first)
  assert.deepEqual(requests, ['/build.dmg'])
})

test('a kept image of another size or content is not the build, and is fetched over', async () => {
  await mkdir(updates, { recursive: true })
  await writeFile(imagePath(updates, SHA), Buffer.alloc(BUILD.length, 'x'))
  assert.equal(await keptImage(updates, update()), null)
  await writeFile(imagePath(updates, SHA), 'short')
  assert.equal(await keptImage(updates, update()), null)
  assert.equal(await keptImage(join(folder, 'nowhere'), update()), null)
  const got = await fetchUpdate(update(), updates)
  assert.equal(await keptImage(updates, update()), got.path)
  assert.ok((await readFile(got.path)).equals(BUILD))
})

test('a partial file left by an earlier try is not in the way', async () => {
  await mkdir(updates, { recursive: true })
  await writeFile(join(updates, `${SHA}.part`), 'half of an earlier try')
  assert.deepEqual(await fetchUpdate(update(), updates), { path: imagePath(updates, SHA) })
  assert.deepEqual(await left(), [`${SHA}.dmg`])
})

test('clearUpdates removes every file and folder but the one kept', async () => {
  await mkdir(join(updates, 'a-folder'), { recursive: true })
  await writeFile(join(updates, 'a-folder', 'inside'), 'x')
  await writeFile(join(updates, 'old.dmg'), 'x')
  await writeFile(join(updates, 'half.part'), 'x')
  const keep = join(updates, 'keep.dmg')
  await writeFile(keep, 'kept')
  await clearUpdates(updates, keep)
  assert.deepEqual(await left(), ['keep.dmg'])
  await clearUpdates(updates)
  assert.deepEqual(await left(), [])
  await clearUpdates(join(folder, 'nowhere'))
})
