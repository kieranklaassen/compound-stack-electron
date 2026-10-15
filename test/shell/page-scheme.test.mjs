// The page's scheme serves files inside its root and nothing else, under a policy with no inline script and no eval.

import assert from 'node:assert/strict'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'

import { CSP, fileFor, HOST, PAGE_URL, SCHEME } from '../../shell/page-scheme.mjs'

const root = resolve(sep, 'srv', 'page', 'dist')

test('the page address is on the scheme and the host', () => {
  assert.equal(PAGE_URL, `${SCHEME}://${HOST}/index.html`)
})

test('an address resolves to a file inside the root, with its type', () => {
  assert.deepEqual(fileFor(root, 'app://page/index.html'), { file: join(root, 'index.html'), type: 'text/html; charset=utf-8' })
  assert.deepEqual(fileFor(root, 'app://page/'), { file: join(root, 'index.html'), type: 'text/html; charset=utf-8' })
  assert.deepEqual(fileFor(root, 'app://page/assets/main-abc.js'), { file: join(root, 'assets', 'main-abc.js'), type: 'text/javascript; charset=utf-8' })
  assert.deepEqual(fileFor(root, 'app://page/assets/a%20b.CSS?v=1#top'), { file: join(root, 'assets', 'a b.CSS'), type: 'text/css; charset=utf-8' })
  assert.equal(fileFor(root, 'app://page/font.woff2').type, 'font/woff2')
})

test('a root written with a trailing separator serves the same files', () => {
  assert.deepEqual(fileFor(root + sep, 'app://page/index.html'), { file: join(root, 'index.html'), type: 'text/html; charset=utf-8' })
})

test('no address reaches a file outside the root', () => {
  const tries = [
    'app://page/../secret.js',
    'app://page/../../secret.js',
    'app://page/%2e%2e/secret.js',
    'app://page/%2e%2e/%2e%2e/secret.js',
    'app://page/..%2fsecret.js',
    'app://page/..%2f..%2fsecret.js',
    'app://page/%2e%2e%2fsecret.js',
    'app://page/assets/..%2f..%2f..%2fsecret.js',
    'app://page/%2e%2e%2f%2e%2e%2fdist-other/secret.js',
    'app://page/..%2fdist-other%2fsecret.js',
    'app://page//etc/secret.js',
  ]
  for (const address of tries) {
    const found = fileFor(root, address)
    assert.ok(found === null || found.file.startsWith(root + sep), `${address} gave ${found?.file}`)
  }
  // The ones that are not folded away by the address itself are refused outright.
  for (const address of ['app://page/..%2fsecret.js', 'app://page/..%2f..%2fsecret.js', 'app://page/%2e%2e%2fsecret.js', 'app://page/..%2fdist-other%2fsecret.js']) {
    assert.equal(fileFor(root, address), null, address)
  }
})

test('a NUL or a bad escape is refused', () => {
  assert.equal(fileFor(root, 'app://page/index%00.html'), null)
  assert.equal(fileFor(root, 'app://page/a%00/index.html'), null)
  assert.equal(fileFor(root, 'app://page/%E0%A4%A.html'), null)
})

test('another host or scheme is refused', () => {
  for (const address of ['app://other/index.html', 'app://page.example.com/index.html', 'app://page:80/index.html', 'file:///index.html', 'https://page/index.html', 'http://page/index.html', 'app:index.html', 'index.html', '', null, undefined]) {
    assert.equal(fileFor(root, address), null, String(address))
  }
})

test('an extension the scheme does not know is refused', () => {
  for (const address of ['app://page/notes.txt', 'app://page/run.sh', 'app://page/index', 'app://page/main.js.map', 'app://page/.env']) {
    assert.equal(fileFor(root, address), null, address)
  }
})

test("the policy has no 'unsafe-inline' and no 'unsafe-eval', and loads nothing from elsewhere", () => {
  assert.ok(!CSP.includes("'unsafe-inline'"))
  assert.ok(!CSP.includes("'unsafe-eval'"))
  assert.doesNotMatch(CSP, /https?:|\*/)
  const parts = CSP.split('; ')
  assert.ok(parts.includes("default-src 'none'"))
  assert.ok(parts.includes("script-src 'self'"))
  assert.ok(parts.includes("frame-ancestors 'none'"))
})
