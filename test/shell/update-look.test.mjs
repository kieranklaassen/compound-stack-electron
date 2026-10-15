// An answer about a newer build is held to its shape before anything is believed, and a server never moves an app back.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compareVersions, lookForUpdate, MOST_BYTES, readAnswer } from '../../shell/update-look.mjs'

const SHA = 'a'.repeat(64)
const SERVER = 'https://app.example.com'
const UPDATE = { version: '1.3.0', size: 1000, sha256: SHA, url: 'https://downloads.example.com/build.dmg?signature=abc' }
const at = { running: '1.2.3', server: SERVER }
const read = (changes, where = at) => readAnswer({ update: { ...UPDATE, ...changes } }, where)

test('compareVersions orders by number, not by text', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0)
  assert.equal(compareVersions('1.2.4', '1.2.3'), 1)
  assert.equal(compareVersions('1.2.3', '1.2.4'), -1)
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1)
  assert.equal(compareVersions('0.9.10', '0.10.9'), -1)
  assert.equal(compareVersions('01.2.3', '1.2.3'), 0)
})

test('compareVersions is null where either is no version', () => {
  for (const bad of ['1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '1.2.x', ' 1.2.3', '1.2.3\n', '', null, undefined, '123456.0.0']) {
    assert.equal(compareVersions(bad, '1.2.3'), null, String(bad))
    assert.equal(compareVersions('1.2.3', bad), null, String(bad))
  }
})

test('a higher version with every field in shape is an update, with those four fields only', () => {
  assert.deepEqual(readAnswer({ update: { ...UPDATE, notes: 'text the server wrote', extra: 1 } }, at), { update: UPDATE })
})

test('no update is no update', () => {
  assert.deepEqual(readAnswer({ update: null }, at), { update: null })
})

test('an equal or lower version is no update', () => {
  assert.deepEqual(read({ version: '1.2.3' }), { update: null })
  assert.deepEqual(read({ version: '1.2.2' }), { update: null })
  assert.deepEqual(read({ version: '0.99.99' }), { update: null })
})

test('an answer that is not the shape is unreadable', () => {
  for (const body of [null, undefined, 'text', 7, {}, [], { updates: null }, { update: 'yes' }, { update: 7 }, { update: {} }, { update: undefined }]) {
    assert.deepEqual(readAnswer(body, at), { unreadable: true }, JSON.stringify(body))
  }
})

test('a bad version is unreadable', () => {
  for (const version of ['1.3', 'v1.3.0', '1.3.0-beta', '', null, undefined, 130, ['1.3.0']]) {
    assert.deepEqual(read({ version }), { unreadable: true }, String(version))
  }
})

test('a bad size is unreadable', () => {
  for (const size of [0, -1, 1.5, '1000', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, MOST_BYTES + 1]) {
    assert.deepEqual(read({ size }), { unreadable: true }, String(size))
  }
  assert.deepEqual(read({ size: MOST_BYTES }), { update: { ...UPDATE, size: MOST_BYTES } })
})

test('a bad checksum is unreadable', () => {
  for (const sha256 of ['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), '', null, undefined, 7, [SHA]]) {
    assert.deepEqual(read({ sha256 }), { unreadable: true }, String(sha256))
  }
})

test('an address with credentials, of another scheme or that is none is unreadable', () => {
  for (const url of ['https://user:pass@downloads.example.com/build.dmg', 'https://user@downloads.example.com/build.dmg', 'file:///build.dmg', 'ftp://downloads.example.com/build.dmg', 'app://page/build.dmg', '/build.dmg', '', null, undefined, [UPDATE.url]]) {
    assert.deepEqual(read({ url }), { unreadable: true }, String(url))
  }
})

test('plain http is taken only where the address and the server are both on this machine', () => {
  const local = 'http://127.0.0.1:9000/build.dmg'
  assert.deepEqual(read({ url: local }, { running: '1.2.3', server: 'http://localhost:3000' }), { update: { ...UPDATE, url: local } })
  assert.deepEqual(read({ url: local }, at), { unreadable: true })
  assert.deepEqual(read({ url: local }, { running: '1.2.3', server: null }), { unreadable: true })
  assert.deepEqual(read({ url: 'http://downloads.example.com/build.dmg' }, { running: '1.2.3', server: 'http://localhost:3000' }), { unreadable: true })
  assert.deepEqual(read({ url: 'http://downloads.example.com/build.dmg' }, at), { unreadable: true })
})

test('a lower version in a bad shape is unreadable, not "nothing newer"', () => {
  assert.deepEqual(read({ version: '1.0.0', sha256: 'nope' }), { unreadable: true })
})

test('lookForUpdate asks GET /device/update and reads the answer', async () => {
  const asked = []
  const found = await lookForUpdate(async (path, options) => {
    asked.push([path, options])
    return { status: 200, body: { update: UPDATE } }
  }, at)
  assert.deepEqual(found, { update: UPDATE })
  assert.deepEqual(asked, [['/device/update', undefined]])
})

test('lookForUpdate maps 401 to signed out and any other status to no answer', async () => {
  const withStatus = (status) => lookForUpdate(async () => ({ status, body: { update: UPDATE } }), at)
  assert.deepEqual(await withStatus(401), { signedOut: true })
  for (const status of [0, 204, 302, 403, 404, 429, 500, 503]) assert.deepEqual(await withStatus(status), { noAnswer: true }, String(status))
  assert.deepEqual(await lookForUpdate(async () => ({ status: 200, body: null }), at), { unreadable: true })
  assert.deepEqual(await lookForUpdate(async () => ({ status: 200, body: { update: null } }), at), { update: null })
})
