// Conventions a clone inherits and an edit can quietly break.

import assert from 'node:assert/strict'
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

import { at, filesOf, root, text, there } from './support.mjs'

test('CLAUDE.md is a symlink to AGENTS.md', () => {
  assert.ok(there('AGENTS.md'), 'no AGENTS.md')
  const stat = lstatSync(at('CLAUDE.md'), { throwIfNoEntry: false })
  assert.ok(stat?.isSymbolicLink(), 'CLAUDE.md is not a symlink')
  assert.equal(readlinkSync(at('CLAUDE.md')), 'AGENTS.md')
})

test('each action of a workflow is pinned to a whole commit', () => {
  const workflows = [...filesOf('.github/workflows', '.yml'), ...filesOf('.github/workflows', '.yaml')]
  assert.ok(workflows.length > 0, 'no workflow')
  const loose = []
  for (const workflow of workflows) {
    for (const line of text('.github/workflows', workflow).split('\n')) {
      const used = /^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)/.exec(line)?.[1]
      // An action of the repository's own is at the commit that is checked out.
      if (!used || used.startsWith('./')) continue
      if (!/@[0-9a-f]{40}$/.test(used)) loose.push(`${workflow}: ${used}`)
    }
  }
  assert.deepEqual(loose, [])
})

test('the doors the page types are the doors the shell lists', () => {
  const listed = JSON.parse(text('shell/doors.json'))
  const block = /\nexport interface Shell \{\n([\s\S]*?)\n\}\n/.exec(text('page/shell.ts'))?.[1]
  assert.ok(block, 'page/shell.ts has no Shell interface')
  const typed = {}
  let door = null
  for (const line of block.split('\n')) {
    const opened = /^  ([A-Za-z]+): \{$/.exec(line)
    if (opened) typed[(door = opened[1])] = []
    else if (line === '  }') door = null
    else if (door) {
      const method = /^    ([A-Za-z]+)[<(]/.exec(line)?.[1]
      if (method) typed[door].push(method)
    }
  }
  assert.deepEqual(typed, listed)
})

test('no file names a product this template was drawn from', () => {
  // Built here, so this file does not hold what it looks for.
  const needles = [['every', 'cut'], ['cut', 'room']].map((parts) => parts.join(''))
  const SKIP = new Set(['node_modules', 'dist', '.git', 'package-lock.json'])
  const found = []
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue
      const path = join(folder, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) {
        const lower = readFileSync(path, 'utf8').toLowerCase()
        if (needles.some((needle) => lower.includes(needle) || entry.name.toLowerCase().includes(needle))) found.push(relative(root, path))
      }
    }
  }
  walk(root)
  assert.deepEqual(found, [])
})
