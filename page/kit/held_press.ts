// A held key repeats, and a repeated Return or Space on a button is no press.
//
// A press can move the keyboard: it opens a screen whose main button takes the
// focus. The key is still down, the system repeats it, and the repeat presses
// the button the keyboard just landed on. So one listener, for the whole page,
// keeps every repeat of the two keys from a button. A key in a text field and
// the app's own key commands are untouched.

const PRESSES = new Set(['Enter', ' '])

/** Whether a key event is a repeat that would press a button. */
export function heldPress(event: Pick<KeyboardEvent, 'key' | 'repeat' | 'target'>): boolean {
  if (!event.repeat || !PRESSES.has(event.key)) return false
  const target = event.target
  return target instanceof Element && target.closest('button, [role="button"], a[href], summary') !== null
}

/** Watch a document. Answers a function that stops watching. */
export function watchHeldPresses(doc: Document = document): () => void {
  const heard = (event: KeyboardEvent) => {
    if (heldPress(event)) event.preventDefault()
  }
  doc.addEventListener('keydown', heard, true)
  return () => doc.removeEventListener('keydown', heard, true)
}
