import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROWS } from '../agent/rows'
import { helpShown, HINTS, REST_MS, WARM_MS, watchHelp } from './watch'

let stop: () => void
let mode = false
let control: HTMLButtonElement
let other: HTMLButtonElement

const over = (target: Element) => target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit) => document.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }))

beforeEach(() => {
  vi.useFakeTimers()
  mode = false
  control = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'Undo' }))
  control.dataset.action = 'undo'
  other = document.body.appendChild(document.createElement('button'))
  other.dataset.action = 'redo'
  stop = watchHelp({ mode: () => mode })
})

afterEach(() => {
  stop()
  control.remove()
  other.remove()
  vi.useRealTimers()
})

describe('help on hover', () => {
  it('shows a tip once the pointer has rested, not before', () => {
    over(control)
    vi.advanceTimersByTime(REST_MS - 1)
    expect(helpShown.get()).toBeNull()
    vi.advanceTimersByTime(1)
    expect(helpShown.get()).toMatchObject({ row: 'undo', level: 'tip', hint: true })
  })

  it('shows the next tip sooner while the person is reading tips', () => {
    over(control)
    vi.advanceTimersByTime(REST_MS)
    over(other)
    vi.advanceTimersByTime(WARM_MS)
    expect(helpShown.get()).toMatchObject({ row: 'redo' })
  })

  it('grows into the whole card while Option is held, and back when it is let go', () => {
    over(control)
    vi.advanceTimersByTime(REST_MS)
    key('keydown', { key: 'Alt', altKey: true })
    expect(helpShown.get()).toMatchObject({ level: 'card', hint: false })
    key('keyup', { key: 'Alt' })
    expect(helpShown.get()).toMatchObject({ level: 'tip' })
  })

  it('does not take Option with another key, or a repeat, for a question', () => {
    over(control)
    vi.advanceTimersByTime(REST_MS)
    key('keydown', { key: 'Alt', altKey: true, metaKey: true })
    expect(helpShown.get()).toMatchObject({ level: 'tip' })
    key('keydown', { key: 'Alt', altKey: true, repeat: true })
    expect(helpShown.get()).toMatchObject({ level: 'tip' })
  })

  it('stops saying that Option shows more after three holds', () => {
    for (let hold = 0; hold < HINTS; hold += 1) {
      over(control)
      vi.advanceTimersByTime(REST_MS)
      key('keydown', { key: 'Alt', altKey: true })
      key('keyup', { key: 'Alt' })
      over(document.body)
      vi.advanceTimersByTime(REST_MS)
    }
    over(control)
    vi.advanceTimersByTime(REST_MS)
    expect(helpShown.get()).toMatchObject({ level: 'tip', hint: false })
  })

  it('shows the whole card at once in Help mode', () => {
    mode = true
    over(control)
    expect(helpShown.get()).toMatchObject({ row: 'undo', level: 'card' })
  })

  it('says why a control is off', () => {
    control.dataset.says = 'There is nothing to undo.'
    over(control)
    vi.advanceTimersByTime(REST_MS)
    expect(helpShown.get()?.says).toBe('There is nothing to undo.')
  })

  it('goes at a press, at Escape and when the window loses the keyboard', () => {
    for (const leave of [() => control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), () => key('keydown', { key: 'Escape' }), () => window.dispatchEvent(new Event('blur'))]) {
      over(control)
      vi.advanceTimersByTime(REST_MS)
      expect(helpShown.get()).not.toBeNull()
      leave()
      expect(helpShown.get()).toBeNull()
      over(document.body)
      vi.advanceTimersByTime(REST_MS)
    }
  })

  it('keeps no timer at rest', () => {
    over(control)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(REST_MS)
    expect(vi.getTimerCount()).toBe(0)
    over(document.body)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('has help for every row it could be asked about', () => {
    for (const row of ROWS) expect(row.name.length, row.id).toBeGreaterThan(0)
  })
})
