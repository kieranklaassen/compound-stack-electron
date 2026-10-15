// A changelog entry is instructions an upgrade agent runs, so each one is held
// to its shape: a name that says its version, the modules it touches, and what
// to do and how to tell it worked.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compare, filesOf, frontmatter, listOf, manifest, SEMVER, text, there } from './support.mjs'

const NAME = /^(\d+\.\d+\.\d+)-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const TYPES = ['feature', 'fix', 'refactor']

const { version, modules } = manifest()
const entries = filesOf('docs/changelog', '.md').filter((name) => name !== 'README.md')

test('there is a changelog, with its README', () => {
  assert.ok(there('docs/changelog/README.md'))
  assert.ok(entries.length > 0, 'docs/changelog holds no entry')
})

for (const entry of entries) {
  test(`${entry} is an entry an agent can run`, () => {
    const named = NAME.exec(entry)
    assert.ok(named, 'the name is not <version>-<NNN>-<slug>.md')
    const read = frontmatter(text('docs/changelog', entry))
    assert.ok(read, 'no frontmatter')
    const { fields, body } = read
    assert.match(fields.template_version ?? '', SEMVER)
    assert.equal(fields.template_version, named[1], 'the name and the frontmatter name two versions')
    assert.ok(compare(fields.template_version, version) <= 0, `newer than the manifest's ${version}`)
    const touched = listOf(fields.modules)
    assert.ok(touched.length > 0, 'modules is empty')
    for (const name of touched) assert.ok(name === 'all' || name in modules, `${name} is no module of the manifest`)
    assert.ok(TYPES.includes(fields.type), `type is "${fields.type}"`)
    for (const section of ['## Instructions', '## Verify']) assert.ok(body.split('\n').includes(section), `no "${section}"`)
  })
}

test('no two entries of a version share a number', () => {
  const numbers = entries.map((entry) => entry.split('-').slice(0, 2).join('-'))
  assert.equal(new Set(numbers).size, numbers.length)
})

test('CHANGELOG.md says the manifest’s version', () => {
  assert.ok(there('CHANGELOG.md'), 'no CHANGELOG.md')
  assert.ok(text('CHANGELOG.md').split('\n').some((line) => line.startsWith('## ') && line.includes(version)), `no heading for ${version}`)
})
