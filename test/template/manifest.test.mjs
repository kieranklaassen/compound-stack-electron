// The manifest is the contract an upgrade agent reads. It parses, its version
// is the package's, and no module was adopted at a version that is not out yet.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compare, manifest, SEMVER, text } from './support.mjs'

const { version, modules } = manifest()

test('the manifest names a semver template_version', () => {
  assert.match(version ?? '', SEMVER)
})

test('the template_version is the version in package.json', () => {
  assert.equal(version, JSON.parse(text('package.json')).version)
})

test('the manifest lists modules', () => {
  assert.ok(Object.keys(modules).length > 0, 'no module was read from the manifest')
})

test('each module was adopted at a semver version no higher than the template_version', () => {
  for (const [name, adopted] of Object.entries(modules)) {
    assert.match(adopted, SEMVER, `${name} is adopted at "${adopted}"`)
    assert.ok(compare(adopted, version) <= 0, `${name} is adopted at ${adopted}, past ${version}`)
  }
})
