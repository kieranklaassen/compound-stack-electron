// Only main.mjs shows a dialog, in three functions, and only main.mjs (and the preload) knows Electron.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const shell = fileURLToPath(new URL('../../shell/', import.meta.url))
const files = readdirSync(shell).filter((name) => /\.(mjs|cjs)$/.test(name))
const textOf = (name) => readFileSync(join(shell, name), 'utf8')

const SHOWS = ['pick', 'pickToSave', 'askDialog']

test('the scan reads the shell', () => {
  assert.ok(files.includes('main.mjs'))
  assert.ok(files.includes('preload.cjs'))
  assert.ok(files.length > 20)
})

test('no file but main.mjs names a dialog of the system', () => {
  for (const name of files.filter((name) => name !== 'main.mjs')) {
    const text = textOf(name)
    assert.ok(!text.includes('dialog.show'), `${name} shows a dialog`)
    assert.doesNotMatch(text, /\bshowErrorBox\b/, `${name} shows an error box`)
  }
})

test('main.mjs shows a dialog only inside pick, pickToSave and askDialog', () => {
  // Each line that names a dialog lies between a top-level function's first line and its closing brace.
  const inside = new Map()
  let current = null
  for (const line of textOf('main.mjs').split('\n')) {
    const begun = /^(?:async\s+)?function\s+(\w+)\s*\(/.exec(line)
    if (begun) current = begun[1]
    else if (line.startsWith('}')) current = null
    if (!line.includes('dialog.show')) continue
    assert.ok(SHOWS.includes(current), `a dialog is shown in ${current ?? 'no function'}: ${line.trim()}`)
    inside.set(current, (inside.get(current) ?? '') + line)
  }
  assert.deepEqual([...inside.keys()].sort(), [...SHOWS].sort())
  assert.match(inside.get('pick'), /dialog\.showOpenDialog/)
  assert.match(inside.get('pickToSave'), /dialog\.showSaveDialog/)
  assert.match(inside.get('askDialog'), /dialog\.showMessageBox/)
})

test('each of the three asks the one rule for its window', () => {
  const text = textOf('main.mjs')
  for (const name of SHOWS) {
    const body = new RegExp(`^async function ${name}\\([^)]*\\) \\{\\n([\\s\\S]*?)\\n\\}`, 'm').exec(text)?.[1]
    assert.ok(body, `${name} is a top-level function`)
    assert.match(body, /dialogWindow\(\)/, `${name} asks dialogWindow`)
  }
  assert.match(text, /function dialogWindow\(\) \{[\s\S]*?dialogPlace\(/)
})

test('main.mjs does not reach a dialog by another name', () => {
  const text = textOf('main.mjs')
  assert.doesNotMatch(text, /dialog\s*\[/)
  assert.doesNotMatch(text, /dialog\?\./)
  assert.doesNotMatch(text, /\{[^}]*\bshow\w*Dialog\b[^}]*\}\s*=\s*dialog/)
  assert.doesNotMatch(text, /=\s*dialog\b(?!\.)/)
})

test('no file but main.mjs imports Electron, and the preload requires it', () => {
  const electron = /from\s*['"]electron(?:\/[^'"]*)?['"]|import\s*\(\s*['"]electron(?:\/[^'"]*)?['"]\s*\)|require\s*\(\s*['"]electron(?:\/[^'"]*)?['"]\s*\)/
  const knows = files.filter((name) => electron.test(textOf(name)))
  assert.deepEqual(knows.sort(), ['main.mjs', 'preload.cjs'])
  assert.match(textOf('main.mjs'), /from 'electron'/)
  assert.match(textOf('preload.cjs'), /require\('electron'\)/)
})
