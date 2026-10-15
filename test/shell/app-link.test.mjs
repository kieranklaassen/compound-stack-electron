// The app's own address is read strictly: compound://open/<id> and nothing else.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LINK_SCHEME, linkAmong, linkOf } from '../../shell/app-link.mjs'

test('the scheme is the one the addresses below are written with', () => {
  assert.equal(LINK_SCHEME, 'compound')
})

test('an address with an id opens it', () => {
  assert.deepEqual(linkOf('compound://open/abc'), { open: 'abc' })
  assert.deepEqual(linkOf('compound://open/0a-b-9'), { open: '0a-b-9' })
  assert.deepEqual(linkOf(`compound://open/${'a'.repeat(64)}`), { open: 'a'.repeat(64) })
})

test('anything else is null', () => {
  const tries = [
    'compound://open/',
    'compound://open',
    'compound://open/-abc',
    'compound://open/ABC',
    'compound://open/a_b',
    'compound://open/a.b',
    'compound://open/abc/',
    'compound://open/abc/def',
    'compound://open/../abc/def',
    'compound://open/a%62c',
    'compound://open/abc?x=1',
    'compound://open/abc#x',
    'compound://user@open/abc',
    'compound://user:pass@open/abc',
    'compound://open:80/abc',
    'compound://close/abc',
    'compound://open.example.com/abc',
    'compound:open/abc',
    'compound:/open/abc',
    'compound:///open/abc',
    'https://open/abc',
    'app://open/abc',
    'file:///open/abc',
    `compound://open/${'a'.repeat(65)}`,
    `compound://open/abc?${'x'.repeat(200)}`,
    'open/abc',
    'abc',
    '',
    null,
    undefined,
    42,
    { open: 'abc' },
    ['compound://open/abc'],
  ]
  for (const address of tries) assert.equal(linkOf(address), null, String(address))
})

test('linkAmong finds the address among the arguments of a launch, or null', () => {
  assert.deepEqual(linkAmong(['/path/to/app', '--flag', 'compound://open/abc', 'compound://open/def']), { open: 'abc' })
  assert.equal(linkAmong(['/path/to/app', '--flag', 'compound://close/abc']), null)
  assert.equal(linkAmong([]), null)
})
