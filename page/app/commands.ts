// The commands: what a key, a menu item and a toolbar button run. One table, so
// the menu never runs a second copy of an action (test/shell/menu.test.mjs
// holds every menu item to a name here).

import { brief } from '../feedback/notices'
import { Sentence } from '../feedback/sentence'
import { checkForUpdates, newDocument, openDocument, saveDocument } from './actions'
import { letGo, redo, undo } from './editor'
import { setView, view } from './view'

const said = async (work: () => Promise<string> | string) => {
  try {
    brief(await work())
  } catch (error) {
    brief(error instanceof Sentence ? error.message : 'That did not work.')
  }
}

const step = (run: () => { ok: true } | { ok: false; says: string }) => {
  // A drag under way is let go first, so undo takes back the whole of it.
  letGo()
  const result = run()
  if (!result.ok) brief(result.says)
}

export const COMMANDS: Record<string, () => void> = {
  undo: () => step(undo),
  redo: () => step(redo),
  new_document: () => void said(newDocument),
  open_document: () => void said(() => openDocument()),
  save_document: () => void said(() => saveDocument()),
  save_document_as: () => void said(() => saveDocument({ as: true })),
  open_settings: () => setView({ sheet: 'settings' }),
  help_mode: () => setView({ helpMode: !view.get().helpMode }),
  check_for_updates: () => {
    // The answer is said in the settings sheet, where the updater's line is.
    setView({ sheet: 'settings' })
    void checkForUpdates().catch(() => {})
  },
  escape: () => {
    const now = view.get()
    if (now.sheet) setView({ sheet: null })
    else if (now.helpMode) setView({ helpMode: false })
  },
}

export function runCommand(name: string) {
  COMMANDS[name]?.()
}
