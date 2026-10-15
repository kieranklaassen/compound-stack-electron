// One table says what a key does. The listener (keys/listen.ts) puts each press
// to `keyCommand` and runs the command it names through the same table of
// commands the menu and the controls use. A key is written nowhere else: a
// row's help shows its key from here.

export interface Press {
  key: string
  meta: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
  repeat: boolean
}

export type Focus = 'text' | 'other'

interface Binding {
  key: string
  mod?: boolean
  shift?: boolean
  command: string
  /** Also while text is typed. Undo and redo are left to the field. */
  inText?: boolean
}

export const BINDINGS: Binding[] = [
  { key: 'z', mod: true, command: 'undo' },
  { key: 'z', mod: true, shift: true, command: 'redo' },
  { key: 's', mod: true, command: 'save_document', inText: true },
  { key: 's', mod: true, shift: true, command: 'save_document_as', inText: true },
  { key: 'o', mod: true, command: 'open_document', inText: true },
  { key: 'n', mod: true, command: 'new_document', inText: true },
  { key: ',', mod: true, command: 'open_settings', inText: true },
  { key: '/', mod: true, command: 'help_mode', inText: true },
  { key: 'Escape', command: 'escape', inText: true },
]

/** A held key runs these once: a repeat of one is passed over. Everything that saves, opens or changes a mode is here. */
export const ONCE_A_PRESS = new Set(['save_document', 'save_document_as', 'open_document', 'new_document', 'open_settings', 'help_mode', 'escape'])

/** The command a press runs, or null. `mac` says which key is the modifier. */
export function keyCommand(press: Press, focus: Focus, mac: boolean): string | null {
  const mod = mac ? press.meta && !press.ctrl : press.ctrl && !press.meta
  if (press.alt) return null
  const found = BINDINGS.find(
    (binding) => binding.key.toLowerCase() === press.key.toLowerCase() && Boolean(binding.mod) === mod && Boolean(binding.shift) === press.shift,
  )
  if (!found) return null
  if (focus === 'text' && !found.inText) return null
  if (press.repeat && ONCE_A_PRESS.has(found.command)) return null
  return found.command
}

/** A command's key as the platform shows it, for the help card. */
export function keyShown(command: string, mac: boolean): string | undefined {
  const binding = BINDINGS.find((found) => found.command === command)
  if (!binding || binding.key === 'Escape') return binding ? 'Esc' : undefined
  const key = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key
  if (mac) return `${binding.shift ? '⇧' : ''}${binding.mod ? '⌘' : ''}${key}`
  return [binding.mod ? 'Ctrl' : null, binding.shift ? 'Shift' : null, key].filter(Boolean).join('+')
}
