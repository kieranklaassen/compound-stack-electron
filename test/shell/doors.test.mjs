// A page reaches a closed list of doors, and an error's own words never reach the page.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DID_NOT_WORK, Doors, Refused } from '../../shell/doors.mjs'

const made = () => {
  const lines = []
  const doors = new Doors({ log: (line) => lines.push(line) }).add('thing', {
    echo: (args, who) => ({ args, who }),
    nothing: () => undefined,
    refuse: () => {
      throw new Refused('Not while it rains.', 'thing.rain')
    },
    fail: () => {
      throw new Error('ENOENT /home/someone/secret token=abcdef123456')
    },
    failLater: async () => {
      throw new TypeError('the words of a library')
    },
  })
  return { doors, lines }
}

test('list names each door with its methods', () => {
  assert.deepEqual(made().doors.list(), { thing: ['echo', 'nothing', 'refuse', 'fail', 'failLater'] })
})

test('an unknown door or method is refused with the generic sentence', async () => {
  const { doors } = made()
  const no = { ok: false, refused: DID_NOT_WORK, code: 'no_such_door' }
  assert.deepEqual(await doors.answer({ door: 'nowhere', method: 'echo', args: [] }), no)
  assert.deepEqual(await doors.answer({ door: 'thing', method: 'nowhere', args: [] }), no)
  assert.deepEqual(await doors.answer({ door: 'thing', method: 'constructor' }), no)
  assert.deepEqual(await doors.answer({ door: '__proto__', method: 'toString' }), no)
  assert.deepEqual(await doors.answer({ door: ['thing'], method: 'echo' }), no)
  assert.deepEqual(await doors.answer({ door: 'thing', method: 7 }), no)
  assert.deepEqual(await doors.answer(null), no)
  assert.deepEqual(await doors.answer(undefined), no)
  assert.deepEqual(await doors.answer('thing.echo'), no)
})

test('an answer is ok with its value, and nothing is answered as null', async () => {
  const { doors } = made()
  assert.deepEqual(await doors.answer({ door: 'thing', method: 'nothing', args: [] }), { ok: true, value: null })
  const answer = await doors.answer({ door: 'thing', method: 'echo', args: [1, 'two'] }, { gesture: true })
  assert.deepEqual(answer, { ok: true, value: { args: [1, 'two'], who: { gesture: true, askedBy: undefined } } })
})

test('args that are no list are an empty list', async () => {
  const { doors } = made()
  for (const args of [undefined, null, 'text', { 0: 'a', length: 1 }]) {
    const answer = await doors.answer({ door: 'thing', method: 'echo', args })
    assert.deepEqual(answer.value.args, [])
  }
})

test('who is normalised: gesture is true or false, and only askedBy is passed beside it', async () => {
  const { doors } = made()
  const whoOf = async (who) => (await doors.answer({ door: 'thing', method: 'echo' }, who)).value.who
  assert.deepEqual(await whoOf(undefined), { gesture: false, askedBy: undefined })
  assert.deepEqual(await whoOf({}), { gesture: false, askedBy: undefined })
  assert.deepEqual(await whoOf({ gesture: 'yes' }), { gesture: false, askedBy: undefined })
  assert.deepEqual(await whoOf({ gesture: 1 }), { gesture: false, askedBy: undefined })
  assert.deepEqual(await whoOf({ gesture: true, askedBy: 'agent', admin: true }), { gesture: true, askedBy: 'agent' })
})

test('a thrown Refused gives its sentence and its code', async () => {
  const { doors, lines } = made()
  assert.deepEqual(await doors.answer({ door: 'thing', method: 'refuse' }), { ok: false, refused: 'Not while it rains.', code: 'thing.rain' })
  assert.deepEqual(lines, [])
})

test('any other error gives the generic sentence and never its own words', async () => {
  const { doors, lines } = made()
  for (const method of ['fail', 'failLater']) {
    const answer = await doors.answer({ door: 'thing', method })
    assert.deepEqual(answer, { ok: false, refused: DID_NOT_WORK, code: 'failed' })
  }
  assert.deepEqual(lines, ['thing.fail failed: Error', 'thing.failLater failed: TypeError'])
  assert.doesNotMatch(lines.join('\n'), /secret|token|library/)
})

test('adding a door twice throws', () => {
  const { doors } = made()
  assert.throws(() => doors.add('thing', {}), /added twice/)
})

test('a Refused is an Error with a name and a code', () => {
  const refused = new Refused('No.', 'a.code')
  assert.ok(refused instanceof Error)
  assert.equal(refused.name, 'Refused')
  assert.equal(refused.message, 'No.')
  assert.equal(refused.code, 'a.code')
})
