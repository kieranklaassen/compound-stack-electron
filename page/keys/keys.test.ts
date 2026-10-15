import { describe, expect, it } from 'vitest'

import { COMMANDS } from '../app/commands'
import { BINDINGS, keyCommand, keyShown, ONCE_A_PRESS, type Press } from './keys'

const press = (key: string, more: Partial<Press> = {}): Press => ({ key, meta: false, ctrl: false, shift: false, alt: false, repeat: false, ...more })

describe('the key table', () => {
  it('names a command for a press, by the platform’s own modifier', () => {
    expect(keyCommand(press('z', { meta: true }), 'other', true)).toBe('undo')
    expect(keyCommand(press('z', { ctrl: true }), 'other', false)).toBe('undo')
    expect(keyCommand(press('z', { ctrl: true }), 'other', true)).toBeNull()
    expect(keyCommand(press('Z', { meta: true, shift: true }), 'other', true)).toBe('redo')
    expect(keyCommand(press('z'), 'other', true)).toBeNull()
  })

  it('leaves undo to a text field and still saves from one', () => {
    expect(keyCommand(press('z', { meta: true }), 'text', true)).toBeNull()
    expect(keyCommand(press('s', { meta: true }), 'text', true)).toBe('save_document')
  })

  it('runs what saves or changes a mode once for a held key', () => {
    expect(keyCommand(press('s', { meta: true, repeat: true }), 'other', true)).toBeNull()
    expect(keyCommand(press('z', { meta: true, repeat: true }), 'other', true)).toBe('undo')
  })

  it('binds only commands there are, and no press twice', () => {
    for (const binding of BINDINGS) expect(COMMANDS, binding.command).toHaveProperty(binding.command)
    for (const command of ONCE_A_PRESS) expect(COMMANDS, command).toHaveProperty(command)
    const presses = BINDINGS.map((binding) => `${binding.mod ? 'mod+' : ''}${binding.shift ? 'shift+' : ''}${binding.key}`)
    expect(new Set(presses).size).toBe(presses.length)
  })

  it('shows a key as the platform writes it', () => {
    expect(keyShown('redo', true)).toBe('⇧⌘Z')
    expect(keyShown('redo', false)).toBe('Ctrl+Shift+Z')
    expect(keyShown('nothing', true)).toBeUndefined()
  })
})
