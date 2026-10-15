// A dialog hangs from the window, which is readied first, unless something of the shell's is in the way.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dialogPlace } from '../../shell/dialog-place.mjs'

const CASES = [
  // there, minimized, visible, inTheWay -> parent, ready
  [false, false, false, false, false, []],
  [false, false, false, true, false, []],
  [true, false, true, false, true, ['focus']],
  [true, true, true, false, true, ['restore', 'focus']],
  [true, false, false, false, true, ['show', 'focus']],
  [true, true, false, false, true, ['restore', 'show', 'focus']],
  [true, false, true, true, true, []],
  [true, true, true, true, false, []],
  [true, false, false, true, false, []],
  [true, true, false, true, false, []],
]

test('dialogPlace truth table', () => {
  for (const [there, minimized, visible, inTheWay, parent, ready] of CASES) {
    assert.deepEqual(dialogPlace({ window: { there, minimized, visible }, inTheWay }), { parent, ready }, JSON.stringify({ there, minimized, visible, inTheWay }))
  }
})

test('with no window at all the dialog stands by itself', () => {
  assert.deepEqual(dialogPlace({ window: null }), { parent: false, ready: [] })
  assert.deepEqual(dialogPlace({ window: undefined }), { parent: false, ready: [] })
})

test('inTheWay is false where it is not said', () => {
  assert.deepEqual(dialogPlace({ window: { there: true, minimized: true, visible: false } }), { parent: true, ready: ['restore', 'show', 'focus'] })
})
