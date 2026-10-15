// Leaving asks first where work is unsaved, and a quit finishes what it must within a limit.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { answerOf, leaving, QUIT_BUTTONS, QUIT_WITHIN_MS, quitWhenDone } from '../../shell/quit.mjs'

const never = () => new Promise(() => {})

test('leaving: asks only where there is unsaved work and it can ask', () => {
  assert.equal(leaving({ unsaved: false, canAsk: true }), 'close')
  assert.equal(leaving({ unsaved: false, canAsk: false }), 'close')
  assert.equal(leaving({ unsaved: true, canAsk: true }), 'ask')
  assert.equal(leaving({ unsaved: true, canAsk: false }), 'close')
})

test('answerOf reads the buttons in their order, and anything else is a cancel', () => {
  assert.deepEqual(QUIT_BUTTONS.map((_label, index) => answerOf(index)), ['save', 'cancel', 'discard'])
  assert.equal(QUIT_BUTTONS[0], 'Save')
  assert.equal(QUIT_BUTTONS[1], 'Cancel')
  for (const index of [-1, 3, 99, undefined, null, 'save']) assert.equal(answerOf(index), 'cancel')
})

test('quitWhenDone waits for every step, and a step that fails does not stop the others', async () => {
  const ran = []
  const steps = [
    () => ran.push('plain'),
    async () => {
      await null
      ran.push('later')
    },
    () => {
      throw new Error('no')
    },
    async () => {
      throw new Error('no')
    },
  ]
  assert.equal(await quitWhenDone(steps, { wait: never }), 'done')
  assert.deepEqual(ran, ['plain', 'later'])
})

test('quitWhenDone with nothing to do is done', async () => {
  assert.equal(await quitWhenDone([], { wait: never }), 'done')
})

test('quitWhenDone stops at the limit where a step never ends', async () => {
  const waited = []
  const wait = async (ms) => void waited.push(ms)
  assert.equal(await quitWhenDone([never], { wait }), 'in_time')
  assert.deepEqual(waited, [QUIT_WITHIN_MS])
  assert.equal(await quitWhenDone([never], { within: 20 }), 'in_time')
})
