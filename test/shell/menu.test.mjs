// The menu is data, and every item that asks the page asks for a command the page has.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { asksOf, menuOf } from '../../shell/menu.mjs'

// commands.ts is TypeScript, so it is read as text: the keys of the literal assigned to COMMANDS.
function commandNames() {
  const text = readFileSync(fileURLToPath(new URL('../../page/app/commands.ts', import.meta.url)), 'utf8')
  const lines = text.split('\n')
  const from = lines.findIndex((line) => line.startsWith('export const COMMANDS'))
  assert.notEqual(from, -1, 'commands.ts exports COMMANDS')
  const to = lines.findIndex((line, index) => index > from && line.startsWith('}'))
  return lines
    .slice(from + 1, to)
    .map((line) => /^ {2}([A-Za-z_$][\w$]*):/.exec(line)?.[1])
    .filter(Boolean)
}

const mac = menuOf({ name: 'X', mac: true })
const other = menuOf({ name: 'X', mac: false })

test('the commands are read from the page', () => {
  const names = commandNames()
  assert.ok(names.includes('undo'))
  assert.ok(names.includes('save_document'))
  assert.equal(new Set(names).size, names.length)
})

test('every ask of the menu is a command of the page', () => {
  const names = new Set(commandNames())
  for (const menu of [mac, other]) {
    const asks = asksOf(menu)
    assert.ok(asks.length >= 8)
    for (const ask of asks) assert.ok(names.has(ask), `the menu asks for ${ask}, which is no command`)
  }
})

test('a menu off the Mac asks for nothing the Mac menu does not', () => {
  const onMac = new Set(asksOf(mac))
  for (const ask of asksOf(other)) assert.ok(onMac.has(ask), ask)
  for (const ask of ['new_document', 'open_document', 'save_document', 'save_document_as', 'undo', 'redo', 'help_mode', 'check_for_updates']) {
    assert.ok(asksOf(mac).includes(ask), ask)
    assert.ok(asksOf(other).includes(ask), ask)
  }
})

test('the Mac has the app menu under the name, and the others have Quit under File', () => {
  assert.equal(mac[0].label, 'X')
  assert.deepEqual(mac.map((top) => top.label ?? top.role), ['X', 'File', 'Edit', 'windowMenu', 'Help'])
  assert.deepEqual(other.map((top) => top.label ?? top.role), ['File', 'Edit', 'windowMenu', 'Help'])
  const quits = (menu) => menu.flatMap((top) => top.submenu ?? []).filter((item) => item.role === 'quit').length
  assert.equal(quits(mac), 1)
  assert.equal(quits(other), 1)
})

test('an item is a role, a separator, or a label that asks; never a click of its own', () => {
  for (const menu of [mac, other]) {
    for (const item of menu.flatMap((top) => top.submenu ?? [])) {
      assert.equal('click' in item, false)
      assert.ok(item.role || item.type === 'separator' || (item.label && item.ask), JSON.stringify(item))
    }
  }
})

test('no accelerator is given twice', () => {
  for (const menu of [mac, other]) {
    const keys = menu.flatMap((top) => top.submenu ?? []).map((item) => item.accelerator).filter(Boolean)
    assert.equal(new Set(keys).size, keys.length)
  }
})
