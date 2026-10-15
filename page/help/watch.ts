// Help on hover, and Option for more. One set of listeners and one card for the
// whole window: no component shows a tooltip of its own.
//
//   rest the pointer on a control      a small tip: its name and its key
//   hold Option (Alt) while it shows   the whole card: a picture, what it does,
//                                      what to do first and what comes next
//   Help mode                          the whole card at once, with no rest
//
// The tip waits 700 ms, so it does not flicker as the pointer crosses the
// window, and 150 ms once the person is reading tips (one was shown in the last
// half second). A control the keyboard reached shows its tip too; one the
// pointer pressed does not. The first three times a tip shows it says that
// Option shows more, and then it stops saying so.
//
// It keeps no timer at rest: one timeout runs only while the pointer rests on a
// control that has not shown its tip yet.

import { helpOf } from '../agent/rows'
import { createStore } from '../store'

export const REST_MS = 700
export const WARM_MS = 150
export const WARM_WITHIN_MS = 500
export const HINTS = 3
const HOLDS_KEY = 'help.option-holds'

export interface Shown {
  row: string
  part?: string
  /** Why the control is off, in its own words. */
  says?: string
  rect: { top: number; bottom: number; left: number; right: number }
  level: 'tip' | 'card'
  /** Whether the tip still says that Option shows more. */
  hint: boolean
}

export const helpShown = createStore<Shown | null>(null)

const controlOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>('[data-action]') : null

function holds(): number {
  try {
    return Number(localStorage.getItem(HOLDS_KEY) ?? 0) || 0
  } catch {
    return HINTS
  }
}

function countHold() {
  try {
    localStorage.setItem(HOLDS_KEY, String(Math.min(HINTS, holds() + 1)))
  } catch {
    // No storage: the hint is simply not counted.
  }
}

interface Options {
  /** Whether Help mode is on, asked at each move. */
  mode(): boolean
  doc?: Document
  win?: Window
}

/** Watch a document. Answers a function that stops watching and leaves nothing behind. */
export function watchHelp({ mode, doc = document, win = window }: Options): () => void {
  let over: HTMLElement | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let hiddenAt = -Infinity
  let option = false

  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const hide = () => {
    cancel()
    over = null
    if (helpShown.get()) hiddenAt = performance.now()
    helpShown.set(null)
  }

  const show = (control: HTMLElement) => {
    const row = control.dataset.action
    if (!row || !helpOf(row, control.dataset.help)) return
    const { top, bottom, left, right } = control.getBoundingClientRect()
    helpShown.set({
      row,
      part: control.dataset.help,
      says: control.dataset.says,
      rect: { top, bottom, left, right },
      level: option || mode() ? 'card' : 'tip',
      hint: holds() < HINTS,
    })
  }

  const rest = (control: HTMLElement) => {
    cancel()
    over = control
    if (mode()) return show(control)
    const warm = helpShown.get() !== null || performance.now() - hiddenAt < WARM_WITHIN_MS
    helpShown.set(null)
    timer = setTimeout(
      () => {
        timer = null
        if (over === control && control.isConnected) show(control)
      },
      warm ? WARM_MS : REST_MS,
    )
  }

  const pointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const control = controlOf(event.target)
    if (control === over) return
    if (control) rest(control)
    else hide()
  }
  // A press ends a tip: the person is doing, not reading. In Help mode the card stays.
  const pointerDown = () => {
    if (!mode()) hide()
  }
  const focusIn = (event: FocusEvent) => {
    const control = controlOf(event.target)
    // Only where the keyboard brought the focus: a click that focuses is no question.
    if (control && control.matches(':focus-visible')) rest(control)
  }
  const focusOut = () => {
    if (over && !over.matches(':hover')) hide()
  }
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') return hide()
    // Option alone, and not a repeat: with another key it is a shortcut, not a question.
    if (event.key !== 'Alt' || event.repeat || event.metaKey || event.ctrlKey || event.shiftKey) return
    option = true
    const now = helpShown.get()
    if (now && now.level === 'tip') {
      countHold()
      helpShown.set({ ...now, level: 'card', hint: false })
    }
  }
  const keyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Alt') return
    option = false
    const now = helpShown.get()
    if (now && now.level === 'card' && !mode()) helpShown.set({ ...now, level: 'tip' })
  }
  // The window lost the keyboard: an Option that is let go elsewhere is never heard.
  const blurred = () => {
    option = false
    hide()
  }

  doc.addEventListener('pointerover', pointerOver)
  doc.addEventListener('pointerdown', pointerDown, true)
  doc.addEventListener('focusin', focusIn)
  doc.addEventListener('focusout', focusOut)
  doc.addEventListener('keydown', keyDown)
  doc.addEventListener('keyup', keyUp)
  doc.addEventListener('scroll', hide, true)
  win.addEventListener('blur', blurred)
  win.addEventListener('resize', hide)
  return () => {
    hide()
    doc.removeEventListener('pointerover', pointerOver)
    doc.removeEventListener('pointerdown', pointerDown, true)
    doc.removeEventListener('focusin', focusIn)
    doc.removeEventListener('focusout', focusOut)
    doc.removeEventListener('keydown', keyDown)
    doc.removeEventListener('keyup', keyUp)
    doc.removeEventListener('scroll', hide, true)
    win.removeEventListener('blur', blurred)
    win.removeEventListener('resize', hide)
  }
}
