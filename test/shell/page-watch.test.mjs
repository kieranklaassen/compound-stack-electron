// A page that died is loaded again, but not in a loop: three times in a minute, then it is left.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PageWatch, RELOADS, WITHIN_MS } from '../../shell/page-watch.mjs'

test('the first deaths within the minute reload, the next one stops', () => {
  const watch = new PageWatch()
  for (let n = 0; n < RELOADS; n += 1) assert.equal(watch.gone(1000 + n), 'reload')
  assert.equal(watch.gone(1000 + RELOADS), 'stop')
  assert.equal(watch.gone(1000 + RELOADS + 1), 'stop')
})

test('deaths further apart than the window always reload', () => {
  const watch = new PageWatch()
  for (let n = 0; n < 10; n += 1) assert.equal(watch.gone(n * WITHIN_MS), 'reload')
})

test('a death is forgotten once it is a minute old', () => {
  const watch = new PageWatch()
  assert.equal(watch.gone(0), 'reload')
  assert.equal(watch.gone(10), 'reload')
  assert.equal(watch.gone(20), 'reload')
  assert.equal(watch.gone(WITHIN_MS + 5), 'reload')
  assert.equal(watch.gone(WITHIN_MS + 15), 'reload')
})

test('the clock is the real one where none is given', () => {
  assert.equal(new PageWatch().gone(), 'reload')
})
