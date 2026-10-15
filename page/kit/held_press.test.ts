import { describe, expect, it } from 'vitest'

import { heldPress, watchHeldPresses } from './held_press'

describe('a held key', () => {
  it('is no press of a button when it repeats', () => {
    const button = document.createElement('button')
    const input = document.createElement('input')
    expect(heldPress({ key: 'Enter', repeat: true, target: button })).toBe(true)
    expect(heldPress({ key: ' ', repeat: true, target: button })).toBe(true)
    expect(heldPress({ key: 'Enter', repeat: false, target: button })).toBe(false)
    expect(heldPress({ key: 'Enter', repeat: true, target: input })).toBe(false)
    expect(heldPress({ key: 'a', repeat: true, target: button })).toBe(false)
  })

  it('is kept from the button by the one listener', () => {
    const stop = watchHeldPresses()
    const button = document.body.appendChild(document.createElement('button'))
    const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true })
    button.dispatchEvent(repeat)
    expect(repeat.defaultPrevented).toBe(true)
    stop()
    const after = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true })
    button.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
    button.remove()
  })
})
