// The app signs in through the browser by the device grant, and the page never hears the device code or the token.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Account, accountDoor, SAYS } from '../../shell/account.mjs'
import { Refused } from '../../shell/doors.mjs'
import { NOT_THE_PRESS } from '../../shell/press.mjs'
import { NO_SERVER, SERVER_DID_NOT_ANSWER } from '../../shell/server.mjs'

const SERVER = 'https://app.example.com'
const DEVICE_CODE = 'device-code-0123456789abcdef'
const USER_CODE = 'ABCD-1234'
const TOKEN = 'token-0123456789abcdefghij'
const PRESS = { gesture: true }
const GRANT = { status: 201, body: { device_code: DEVICE_CODE, user_code: USER_CODE, interval: 5, expires_in: 600 } }
const PENDING = { status: 428, body: { error: 'authorization_pending' } }
const GRANTED = { status: 200, body: { token: TOKEN, email: 'someone@example.com' } }

// Lets what was begun run as far as it can without a clock.
const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((done) => setImmediate(done))
}

/** An account over fakes: `answers` are handed out in order, one for each request. */
function made({ answers = [], kept = null, server = SERVER } = {}) {
  const calls = []
  const waits = []
  const opened = []
  const states = []
  const held = { token: kept, forgot: 0 }
  const vault = {
    read: async () => held.token,
    write: async (token) => void (held.token = token),
    forget: async () => {
      held.token = null
      held.forgot += 1
    },
  }
  const fetchIt = async (address, options) => {
    calls.push({ path: address.replace(SERVER, ''), method: options.method, headers: options.headers, body: options.body ? JSON.parse(options.body) : undefined, redirect: options.redirect })
    const answer = answers.shift()
    if (!answer) throw new Error('no answer')
    return { status: answer.status, json: async () => answer.body }
  }
  // The clock is the test's: each wait stands until `turn()` lets it go.
  const wait = (ms) => new Promise((done) => waits.push({ ms, done }))
  const turn = async () => {
    await settle()
    const next = waits.shift()
    assert.ok(next, 'the account is waiting for the clock')
    next.done()
    await settle()
    return next.ms
  }
  const account = new Account({ server, fetch: fetchIt, open: async (address) => void opened.push(address), vault, version: '1.2.3', wait, changed: (state) => states.push(state) })
  return { account, calls, waits, opened, states, held, turn }
}

const refusedWith = (code, sentence) => (error) => error instanceof Refused && error.code === code && error.message === sentence

test('it begins signed out', () => {
  assert.deepEqual(made().account.state, { state: 'signed_out' })
})

test('start is refused where it is not the person own press, and asks nothing', async () => {
  const { account, calls, opened } = made({ answers: [GRANT] })
  for (const who of [undefined, {}, { gesture: false }, { gesture: true, askedBy: 'agent' }]) {
    await assert.rejects(account.start(who), refusedWith('account.not_the_press', NOT_THE_PRESS))
  }
  assert.deepEqual(calls, [])
  assert.deepEqual(opened, [])
  assert.deepEqual(account.state, { state: 'signed_out' })
})

test('start with no server is refused', async () => {
  const { account } = made({ server: null })
  await assert.rejects(account.start(PRESS), refusedWith('account.no_server', NO_SERVER))
})

test('start asks for a request, waits with the user code and opens the approve page', async () => {
  const { account, calls, opened, states } = made({ answers: [GRANT] })
  const answer = await account.start(PRESS)
  assert.deepEqual(answer, { state: 'waiting', code: USER_CODE })
  assert.deepEqual(account.state, { state: 'waiting', code: USER_CODE })
  assert.deepEqual(states, [{ state: 'waiting', code: USER_CODE }])
  assert.deepEqual(opened, [`${SERVER}/device/approve#${USER_CODE}`])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/device/authorizations')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].redirect, 'error')
  assert.equal('Authorization' in calls[0].headers, false)
  assert.equal(calls[0].headers['User-Agent'], 'compound-stack-electron/1.2.3')
})

test('start is refused where the server does not answer or answers what cannot be read', async () => {
  const noAnswer = made({ answers: [{ status: 500, body: null }] })
  await assert.rejects(noAnswer.account.start(PRESS), refusedWith('account.no_answer', SERVER_DID_NOT_ANSWER))
  const away = made({ answers: [] })
  await assert.rejects(away.account.start(PRESS), refusedWith('account.no_answer', SERVER_DID_NOT_ANSWER))
  const bodies = [null, {}, { device_code: 'short', user_code: USER_CODE }, { device_code: DEVICE_CODE, user_code: 'abcd-1234' }, { device_code: DEVICE_CODE, user_code: 'ABCD1234' }, { device_code: `${DEVICE_CODE}/../x`, user_code: USER_CODE }]
  for (const body of bodies) {
    const { account, opened, waits } = made({ answers: [{ status: 201, body }] })
    await assert.rejects(account.start(PRESS), refusedWith('account.unreadable', SAYS.unreadable), JSON.stringify(body))
    assert.deepEqual(opened, [])
    assert.deepEqual(waits, [])
    assert.deepEqual(account.state, { state: 'signed_out' })
  }
})

test('the whole grant: pending, then a token, then signed in with the token kept in the vault', async () => {
  const { account, calls, states, held, turn, waits } = made({ answers: [GRANT, PENDING, PENDING, GRANTED] })
  await account.start(PRESS)
  assert.equal(await turn(), 5000)
  assert.deepEqual(account.state, { state: 'waiting', code: USER_CODE })
  assert.equal(await turn(), 5000)
  assert.equal(held.token, null)
  assert.equal(await turn(), 5000)
  assert.deepEqual(account.state, { state: 'signed_in', email: 'someone@example.com' })
  assert.equal(held.token, TOKEN)
  assert.equal(await account.token(), TOKEN)
  assert.deepEqual(states.map((state) => state.state), ['waiting', 'signed_in'])
  const polls = calls.slice(1)
  assert.equal(polls.length, 3)
  for (const poll of polls) {
    assert.equal(poll.path, '/device/authorizations/token')
    assert.equal(poll.method, 'POST')
    assert.deepEqual(poll.body, { device_code: DEVICE_CODE })
    assert.equal('Authorization' in poll.headers, false)
  }
  // The polling has ended: nothing waits for the clock.
  await assert.rejects(turn())
  assert.deepEqual(waits, [])
})

test('the page never hears the device code or the token', async () => {
  const { account, states, turn } = made({ answers: [GRANT, PENDING, GRANTED] })
  const door = accountDoor(account)
  const heard = [await door.start([], PRESS)]
  await turn()
  heard.push(door.state())
  await turn()
  heard.push(door.state())
  const text = JSON.stringify([heard, states])
  assert.ok(!text.includes(DEVICE_CODE))
  assert.ok(!text.includes(TOKEN))
  assert.deepEqual(door.state(), { state: 'signed_in', email: 'someone@example.com' })
})

test('the interval is held between one second and thirty, and slow_down adds five', async () => {
  const quick = made({ answers: [{ status: 201, body: { ...GRANT.body, interval: 0 } }, { status: 428, body: { error: 'slow_down' } }, { status: 429, body: null }, PENDING] })
  await quick.account.start(PRESS)
  assert.equal(await quick.turn(), 1000)
  assert.equal(await quick.turn(), 6000)
  assert.equal(await quick.turn(), 11000)
  const slow = made({ answers: [{ status: 201, body: { ...GRANT.body, interval: 3600 } }] })
  await slow.account.start(PRESS)
  assert.equal(slow.waits[0].ms, 30000)
  const none = made({ answers: [{ status: 201, body: { device_code: DEVICE_CODE, user_code: USER_CODE } }] })
  await none.account.start(PRESS)
  assert.equal(none.waits[0].ms, 5000)
})

test('a server that is away during the wait is asked again', async () => {
  const { account, turn } = made({ answers: [GRANT, { status: 503, body: null }, GRANTED] })
  await account.start(PRESS)
  await turn()
  assert.equal(account.state.state, 'waiting')
  await turn()
  assert.equal(account.state.state, 'signed_in')
})

test('access_denied ends signed out with its sentence', async () => {
  const { account, held, turn, waits } = made({ answers: [GRANT, PENDING, { status: 400, body: { error: 'access_denied' } }] })
  await account.start(PRESS)
  await turn()
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out', says: SAYS.refused })
  assert.equal(held.token, null)
  assert.deepEqual(waits, [])
})

test('expired_token ends signed out with its sentence', async () => {
  const { account, turn, waits } = made({ answers: [GRANT, { status: 400, body: { error: 'expired_token' } }] })
  await account.start(PRESS)
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out', says: SAYS.expired })
  assert.deepEqual(waits, [])
})

test('a request nobody answered in its time ends signed out as expired', async () => {
  const { account, calls, turn, waits } = made({ answers: [{ status: 201, body: { ...GRANT.body, interval: 5, expires_in: 10 } }, PENDING, PENDING] })
  await account.start(PRESS)
  await turn()
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out', says: SAYS.expired })
  assert.equal(calls.length, 3)
  assert.deepEqual(waits, [])
})

test('a token that is not one is not kept', async () => {
  const { account, held, turn } = made({ answers: [GRANT, { status: 200, body: { token: 'short' } }, { status: 200, body: { token: `has a space ${TOKEN}` } }] })
  await account.start(PRESS)
  await turn()
  await turn()
  assert.equal(account.state.state, 'waiting')
  assert.equal(held.token, null)
})

test('cancel while waiting signs out, and the next answer changes nothing', async () => {
  const { account, calls, states, held, turn, waits } = made({ answers: [GRANT, PENDING] })
  await account.start(PRESS)
  assert.deepEqual(account.cancel(), { state: 'signed_out' })
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out' })
  assert.deepEqual(states.map((state) => state.state), ['waiting', 'signed_out'])
  assert.equal(held.token, null)
  assert.equal(calls.length, 2)
  assert.deepEqual(waits, [])
})

test('a token that arrives after cancel is revoked with DELETE /device and never kept', async () => {
  const { account, calls, held, turn } = made({ answers: [GRANT, GRANTED, { status: 204, body: null }] })
  await account.start(PRESS)
  account.cancel()
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out' })
  assert.equal(held.token, null)
  assert.equal(calls.length, 3)
  assert.equal(calls[2].path, '/device')
  assert.equal(calls[2].method, 'DELETE')
  assert.equal(calls[2].headers.Authorization, `Bearer ${TOKEN}`)
})

test('a second start gives up the first: only the newer request signs in', async () => {
  const second = { status: 201, body: { ...GRANT.body, device_code: 'second-device-code-0123456789', user_code: 'WXYZ-9876' } }
  const { account, calls, held, turn } = made({ answers: [GRANT, second, GRANTED, { status: 204, body: null }, PENDING] })
  await account.start(PRESS)
  await account.start(PRESS)
  assert.deepEqual(account.state, { state: 'waiting', code: 'WXYZ-9876' })
  await turn()
  assert.equal(held.token, null)
  assert.equal(calls[3].method, 'DELETE')
  assert.deepEqual(account.state, { state: 'waiting', code: 'WXYZ-9876' })
})

test('cancel when nothing waits changes nothing', () => {
  const { account, states } = made()
  assert.deepEqual(account.cancel(), { state: 'signed_out' })
  assert.deepEqual(states, [])
})

test('openAgain opens the approve page again while waiting, and only on the person own press', async () => {
  const { account, opened } = made({ answers: [GRANT] })
  await assert.rejects(account.openAgain({ gesture: true, askedBy: 'agent' }), refusedWith('account.not_the_press', NOT_THE_PRESS))
  assert.deepEqual(await account.openAgain(PRESS), { state: 'signed_out' })
  assert.deepEqual(opened, [])
  await account.start(PRESS)
  assert.deepEqual(await account.openAgain(PRESS), { state: 'waiting', code: USER_CODE })
  assert.deepEqual(opened, [`${SERVER}/device/approve#${USER_CODE}`, `${SERVER}/device/approve#${USER_CODE}`])
})

test('resume with no server is off', async () => {
  const { account, calls } = made({ server: null, kept: TOKEN })
  assert.deepEqual(await account.resume(), { state: 'off', says: NO_SERVER })
  assert.deepEqual(calls, [])
})

test('resume with nothing kept is signed out and asks nothing', async () => {
  const { account, calls } = made()
  assert.deepEqual(await account.resume(), { state: 'signed_out' })
  assert.deepEqual(calls, [])
})

test('resume with a kept token asks GET /device with it and is signed in', async () => {
  const { account, calls, states } = made({ kept: TOKEN, answers: [{ status: 200, body: { email: 'someone@example.com' } }] })
  assert.deepEqual(await account.resume(), { state: 'signed_in', email: 'someone@example.com' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/device')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`)
  assert.deepEqual(states, [{ state: 'signed_in', email: 'someone@example.com' }])
})

test('resume answered 401 forgets the token', async () => {
  const { account, held } = made({ kept: TOKEN, answers: [{ status: 401, body: null }] })
  assert.deepEqual(await account.resume(), { state: 'signed_out' })
  assert.equal(held.token, null)
  assert.equal(held.forgot, 1)
})

test('resume with the server away keeps the token and says it could not ask', async () => {
  for (const answers of [[], [{ status: 503, body: null }], [{ status: 200, body: { email: 7 } }]]) {
    const { account, held } = made({ kept: TOKEN, answers })
    assert.deepEqual(await account.resume(), { state: 'unknown', says: SERVER_DID_NOT_ANSWER })
    assert.equal(held.token, TOKEN)
  }
})

test('signOut ends the token at the server and forgets it', async () => {
  const { account, calls, held } = made({ kept: TOKEN, answers: [{ status: 200, body: { email: 'someone@example.com' } }, { status: 204, body: null }] })
  await account.resume()
  assert.deepEqual(await account.signOut(), { state: 'signed_out' })
  assert.equal(held.token, null)
  assert.equal(calls[1].path, '/device')
  assert.equal(calls[1].method, 'DELETE')
  assert.equal(calls[1].headers.Authorization, `Bearer ${TOKEN}`)
})

test('signOut forgets the token whatever the server said, and asks nothing with none kept', async () => {
  const away = made({ kept: TOKEN, answers: [] })
  assert.deepEqual(await away.account.signOut(), { state: 'signed_out' })
  assert.equal(away.held.token, null)
  const none = made()
  assert.deepEqual(await none.account.signOut(), { state: 'signed_out' })
  assert.deepEqual(none.calls, [])
})

test('signOut during a wait gives the sign-in up', async () => {
  const { account, held, turn } = made({ answers: [GRANT, GRANTED, { status: 204, body: null }] })
  await account.start(PRESS)
  await account.signOut()
  await turn()
  assert.deepEqual(account.state, { state: 'signed_out' })
  assert.equal(held.token, null)
})

test('the door passes the press on and names the five methods', async () => {
  const { account } = made({ answers: [GRANT] })
  const door = accountDoor(account)
  assert.deepEqual(Object.keys(door), ['state', 'start', 'openAgain', 'cancel', 'signOut'])
  await assert.rejects(door.start([], { gesture: false }), Refused)
  assert.deepEqual(await door.start([], PRESS), { state: 'waiting', code: USER_CODE })
  assert.deepEqual(door.cancel(), { state: 'signed_out' })
})
