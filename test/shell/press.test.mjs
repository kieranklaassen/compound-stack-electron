// A call is the person's own press only where the browser says so and no agent is named.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mustAsk, NOT_THE_PRESS, ownPress } from '../../shell/press.mjs'

const CASES = [
  [{ gesture: true }, false],
  [{ gesture: true, askedBy: undefined }, false],
  [{ gesture: true, askedBy: '' }, false],
  [{ gesture: true, askedBy: 'agent' }, true],
  [{ gesture: false }, true],
  [{ gesture: false, askedBy: 'agent' }, true],
  [{ gesture: 'true' }, true],
  [{ gesture: 1 }, true],
  [{}, true],
  [null, true],
  [undefined, true],
]

test('mustAsk: a gesture with no agent named is the only own press', () => {
  for (const [who, asks] of CASES) {
    assert.equal(mustAsk(who), asks, JSON.stringify(who))
    assert.equal(ownPress(who), !asks, JSON.stringify(who))
  }
})

test('the refusal is a sentence', () => {
  assert.match(NOT_THE_PRESS, /^[A-Z].+\.$/)
})
