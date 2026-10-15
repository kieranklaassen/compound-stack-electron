import { keyCommand } from './keys'

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))

/** Hear the keys of a document and run the command each names. Answers a function that stops. */
export function listenForKeys(run: (command: string) => void, mac: () => boolean, doc: Document = document): () => void {
  const heard = (event: KeyboardEvent) => {
    const command = keyCommand(
      { key: event.key, meta: event.metaKey, ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, repeat: event.repeat },
      typing(event.target) ? 'text' : 'other',
      mac(),
    )
    if (!command) return
    // Escape is only heard, never taken: a field and a sheet both use it.
    if (command !== 'escape') event.preventDefault()
    run(command)
  }
  doc.addEventListener('keydown', heard)
  return () => doc.removeEventListener('keydown', heard)
}
