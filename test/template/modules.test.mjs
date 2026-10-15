// One doc a module, and one module a doc. A module's name is its doc's file
// name, and each doc has the sections an adopting agent looks for.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filesOf, manifest, text, there } from './support.mjs'

const SECTIONS = ['## What this module is', '## Files (the module boundary)', '## Adopt into an existing app', '## Verify adoption']
// A line that says its path is not in the template: the adopter adds it, or a build makes it.
const NOT_HERE = /\((?:you add|yours|you write|not shipped|not built|not in the template|made by|built by|generated)[^)]*\)/i
const PATH = /^[A-Za-z0-9_.@/-]+$/

const { modules } = manifest()
const docs = filesOf('docs/modules', '.md').filter((name) => name !== 'README.md')

test('docs/modules is 1:1 with the manifest', () => {
  assert.deepEqual(docs.map((name) => name.slice(0, -3)), Object.keys(modules).sort())
})

for (const doc of docs) {
  const name = doc.slice(0, -3)
  const source = text('docs/modules', doc)

  test(`${doc} starts with its name and has the sections`, () => {
    assert.equal(source.split('\n')[0], `# Module: ${name}`)
    for (const section of SECTIONS) assert.ok(source.split('\n').includes(section), `${doc} has no "${section}"`)
  })

  test(`${doc} lists files that exist`, () => {
    const files = /\n## Files \(the module boundary\)\n([\s\S]*?)(?=\n## |$)/.exec(source)?.[1] ?? ''
    const missing = []
    for (const line of files.split('\n')) {
      if (!line.startsWith('- `') || NOT_HERE.test(line)) continue
      const path = /^- `([^`]+)`/.exec(line)?.[1] ?? ''
      // Only what reads as a path of the repository: no glob, no placeholder, no command.
      if (!PATH.test(path) || !/[/.]/.test(path)) continue
      if (!there(path)) missing.push(path)
    }
    assert.deepEqual(missing, [])
  })
}
