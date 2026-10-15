// A packaged app holds the shell, the bridge, the page and its version, and no tests or docs.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bundleProblems, NEEDS } from '../../shell/bundle-check.mjs'

const FILES = ['shell/main.mjs', 'shell/preload.cjs', 'shell/doors.mjs', 'page/dist/index.html', 'page/dist/assets/index-abc123.js', 'page/dist/assets/index-abc123.css', 'package.json']
const META = { version: '1.2.3', appServer: 'https://app.example.com' }
const without = (...names) => FILES.filter((file) => !names.includes(file))

test('a whole bundle has no problem, set to a server or to none', () => {
  assert.deepEqual(bundleProblems({ files: FILES, meta: META }), [])
  assert.deepEqual(bundleProblems({ files: FILES, meta: { version: '0.1.0' } }), [])
})

test('each file a bundle needs is named, with why, when it is missing', () => {
  for (const { file, why } of NEEDS) {
    assert.deepEqual(bundleProblems({ files: without(file), meta: META }), [`The bundle has no ${file} (${why}).`])
  }
})

test('a bundle with no script of the page says to build the page', () => {
  const problems = bundleProblems({ files: without('page/dist/assets/index-abc123.js'), meta: META })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no script of the page/)
  // A script somewhere else is not the page's.
  assert.equal(bundleProblems({ files: [...without('page/dist/assets/index-abc123.js'), 'page/src/index.js'], meta: META }).length, 1)
})

test('tests or docs in a bundle are a problem', () => {
  for (const extra of ['test/shell/doors.test.mjs', 'docs/README.md']) {
    const problems = bundleProblems({ files: [...FILES, extra], meta: META })
    assert.deepEqual(problems, ['The bundle holds tests or docs: check the files list.'])
  }
})

test('a version that is not three numbers is a problem', () => {
  for (const version of ['1.2', '1.2.3-beta', 'v1.2.3', '', undefined, null]) {
    const problems = bundleProblems({ files: FILES, meta: { version } })
    assert.equal(problems.length, 1, String(version))
    assert.match(problems[0], /version is not three numbers/)
  }
  assert.equal(bundleProblems({ files: FILES, meta: undefined }).length, 1)
})

test('a packaged build is set to an https server or to none', () => {
  for (const appServer of ['http://localhost:3000', 'http://example.com', 'example.com', '', null]) {
    const problems = bundleProblems({ files: FILES, meta: { version: '1.2.3', appServer } })
    assert.deepEqual(problems, ['A packaged build is set to an https server or to none.'], String(appServer))
  }
})

test('every problem of an empty bundle is said at once', () => {
  const problems = bundleProblems({ files: [], meta: {} })
  assert.equal(problems.length, NEEDS.length + 2)
  for (const problem of problems) assert.match(problem, /^[A-Z].+\.$/)
})
