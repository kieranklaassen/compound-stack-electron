// The window shows its own page only, and a link out goes to the browser only where it is https or the app's server.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { opensOutside, staysInTheWindow } from '../../shell/navigation.mjs'

test('only the page of the app stays in the window', () => {
  assert.equal(staysInTheWindow('app://page/index.html'), true)
  assert.equal(staysInTheWindow('app://page/'), true)
  for (const address of ['app://other/index.html', 'https://example.com/', 'http://localhost:3000/', 'file:///etc/hosts', 'about:blank', 'javascript:alert(1)', 'data:text/html,hi', '', 'nonsense', null, undefined]) {
    assert.equal(staysInTheWindow(address), false, String(address))
  }
})

test('plain https opens outside, with or without a server', () => {
  assert.equal(opensOutside('https://example.com/docs', null), true)
  assert.equal(opensOutside('https://example.com/docs', 'https://app.example.com'), true)
})

test('http opens outside only where it is the server the app is set to', () => {
  assert.equal(opensOutside('http://localhost:3000/device/approve', 'http://localhost:3000'), true)
  assert.equal(opensOutside('http://localhost:3001/', 'http://localhost:3000'), false)
  assert.equal(opensOutside('http://example.com/', 'http://localhost:3000'), false)
  assert.equal(opensOutside('http://localhost:3000/', null), false)
  assert.equal(opensOutside('http://localhost:3000/', 'not an address'), false)
})

test('credentials in an address and every other scheme are refused', () => {
  assert.equal(opensOutside('https://user:pass@example.com/', null), false)
  assert.equal(opensOutside('https://user@example.com/', null), false)
  for (const address of ['file:///etc/hosts', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:someone@example.com', 'app://page/index.html', 'compound://open/abc', 'ftp://example.com/', '', 'nonsense', null, undefined]) {
    assert.equal(opensOutside(address, 'https://app.example.com'), false, String(address))
  }
})
