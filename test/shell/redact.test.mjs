// A line the shell prints holds no place on the disk, no credential and no query of an address.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { redact } from '../../shell/redact.mjs'

test('a place under a home folder is taken out', () => {
  assert.equal(redact('ENOENT: open /Users/someone/Documents/plan.compound failed'), 'ENOENT: open <place> failed')
  assert.equal(redact('open /home/someone/.config/app/settings.json'), 'open <place>')
  assert.equal(redact('open C:\\Users\\someone\\file.txt now'), 'open <place> now')
})

test('a place of the system is taken out', () => {
  for (const place of ['/Volumes/Disk/App.app', '/private/var/folders/x', '/var/log/x.log', '/tmp/a/b', '/Applications/App.app/Contents', '/opt/thing/bin', '/etc/hosts']) {
    assert.equal(redact(`at ${place} end`), 'at <place> end', place)
  }
})

test('a credential is taken out and its label is kept', () => {
  assert.equal(redact('Authorization: Bearer abcdef0123456789'), 'Authorization: Bearer …')
  assert.equal(redact('token=abcdef0123456789, next'), 'token=…, next')
  assert.equal(redact('password: hunter2hunter2'), 'password: …')
  assert.doesNotMatch(redact('secret=s3cr3t-value-here key=another-value'), /s3cr3t|another-value/)
})

test('the query of an address is taken out', () => {
  assert.equal(redact('GET https://example.com/build.dmg?signature=abc123&expires=9 failed'), 'GET https://example.com/build.dmg?… failed')
})

test('what is not text is made text, and a line is 400 characters at most', () => {
  assert.equal(redact(42), '42')
  assert.equal(redact(null), 'null')
  assert.equal(redact('x'.repeat(1000)).length, 400)
  assert.equal(redact('plain words stay'), 'plain words stay')
})
