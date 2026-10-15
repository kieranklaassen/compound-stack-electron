// Every file of the shell is JavaScript that Node parses.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const shell = fileURLToPath(new URL('../../shell/', import.meta.url))
const files = readdirSync(shell).filter((name) => /\.(mjs|cjs)$/.test(name))

test('there are files to check', () => {
  assert.ok(files.includes('main.mjs'))
  assert.ok(files.includes('preload.cjs'))
})

for (const name of files) {
  test(`${name} parses`, () => {
    const checked = spawnSync(process.execPath, ['--check', join(shell, name)], { encoding: 'utf8' })
    assert.equal(checked.status, 0, checked.stderr)
  })
}

test('doors.json is JSON', async () => {
  const { readFile } = await import('node:fs/promises')
  const doors = JSON.parse(await readFile(join(shell, 'doors.json'), 'utf8'))
  for (const methods of Object.values(doors)) assert.ok(Array.isArray(methods) && methods.every((method) => typeof method === 'string'))
})
