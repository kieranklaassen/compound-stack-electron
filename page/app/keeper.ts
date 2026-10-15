// Keeps the shell told. Whenever the document changes the shell hears whether
// it is unsaved (so a quit can ask) and is handed the document to keep (so a
// crash loses nothing). The shell writes it no more often than once a second;
// the page does not throttle and runs no clock.

import { shell } from '../shell'
import { editor, unsaved } from './editor'

export function keepShellTold(): () => void {
  let told: boolean | null = null
  let kept: unknown = null
  const tell = () => {
    const state = editor.get()
    const now = unsaved(state)
    if (now !== told) {
      told = now
      void shell().app.unsaved(now)
    }
    if (now && state.document !== kept) {
      kept = state.document
      void shell().recovery.keep(state.document)
    }
  }
  tell()
  return editor.subscribe(tell)
}
