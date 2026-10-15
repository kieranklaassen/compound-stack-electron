// The app talks to an https server, or to plain http on this machine, and one request never follows a redirect.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ask, NO_SERVER, onThisMachine, SERVER_DID_NOT_ANSWER, serverOf } from '../../shell/server.mjs'

test('serverOf takes https anywhere and answers the origin', () => {
  assert.equal(serverOf('https://app.example.com'), 'https://app.example.com')
  assert.equal(serverOf('https://app.example.com/some/path?x=1'), 'https://app.example.com')
  assert.equal(serverOf('https://app.example.com:8443/'), 'https://app.example.com:8443')
})

test('serverOf takes http only on this machine', () => {
  assert.equal(serverOf('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(serverOf('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000')
  assert.equal(serverOf('http://[::1]:3000'), 'http://[::1]:3000')
  for (const address of ['http://example.com', 'http://localhost.example.com', 'http://127.0.0.1.example.com', 'http://192.168.1.10:3000', 'http://0.0.0.0:3000']) {
    assert.equal(serverOf(address), null, address)
  }
})

test('serverOf refuses credentials, other schemes and what is no address', () => {
  for (const address of ['https://user:pass@example.com', 'https://user@example.com', 'http://user@localhost:3000', 'ftp://example.com', 'file:///etc/hosts', 'app://page/', 'ws://localhost:3000', 'example.com', 'localhost:3000', '', null, undefined, 42, {}]) {
    assert.equal(serverOf(address), null, String(address))
  }
})

test('onThisMachine', () => {
  assert.equal(onThisMachine('http://localhost:3000'), true)
  assert.equal(onThisMachine('https://127.0.0.1'), true)
  assert.equal(onThisMachine('http://[::1]:9'), true)
  assert.equal(onThisMachine('https://example.com'), false)
  assert.equal(onThisMachine('nonsense'), false)
  assert.equal(onThisMachine(null), false)
})

test('the sentences are sentences', () => {
  assert.match(SERVER_DID_NOT_ANSWER, /\.$/)
  assert.match(NO_SERVER, /\.$/)
})

const fakeFetch = (answer) => {
  const calls = []
  const fetchIt = async (address, options) => {
    calls.push({ address, options })
    if (answer instanceof Error) throw answer
    return answer
  }
  return { calls, fetchIt }
}

test('ask sends the bearer token and JSON, and follows no redirect', async () => {
  const { calls, fetchIt } = fakeFetch({ status: 200, json: async () => ({ email: 'someone@example.com' }) })
  const answer = await ask(fetchIt, 'https://app.example.com', '/device', { token: 'tok-123', version: '1.2.3' })
  assert.deepEqual(answer, { status: 200, body: { email: 'someone@example.com' } })
  assert.equal(calls.length, 1)
  const { address, options } = calls[0]
  assert.equal(address, 'https://app.example.com/device')
  assert.equal(options.method, 'GET')
  assert.equal(options.redirect, 'error')
  assert.equal(options.cache, 'no-store')
  assert.equal(options.body, undefined)
  assert.ok(options.signal instanceof AbortSignal)
  assert.deepEqual(options.headers, { Accept: 'application/json', 'User-Agent': 'compound-stack-electron/1.2.3', Authorization: 'Bearer tok-123' })
})

test('ask with no token sends no Authorization, and a body is sent as JSON', async () => {
  const { calls, fetchIt } = fakeFetch({ status: 201, json: async () => ({ ok: true }) })
  await ask(fetchIt, 'http://localhost:3000', '/device/authorizations', { method: 'POST', body: { a: 1 } })
  const { options } = calls[0]
  assert.equal(options.method, 'POST')
  assert.equal(options.body, '{"a":1}')
  assert.equal(options.redirect, 'error')
  assert.equal('Authorization' in options.headers, false)
  assert.equal(options.headers['Content-Type'], 'application/json')
})

test('a fetch that throws is status 0 with no body, and its words go nowhere', async () => {
  const { fetchIt } = fakeFetch(new Error('getaddrinfo ENOTFOUND app.example.com'))
  assert.deepEqual(await ask(fetchIt, 'https://app.example.com', '/device', { token: 'tok-123' }), { status: 0, body: null })
})

test('an answer with no JSON is its status alone', async () => {
  const { fetchIt } = fakeFetch({ status: 502, json: async () => { throw new SyntaxError('Unexpected token <') } })
  assert.deepEqual(await ask(fetchIt, 'https://app.example.com', '/device'), { status: 502, body: null })
})
