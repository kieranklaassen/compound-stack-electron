// What the app does beyond changing the document. Each is a plain function
// that a control, a key, the menu and an agent's tool all call, and each
// answers the sentence that says what came of it (or throws one).
//
// `by` names an agent where a tool, not the person, runs the action. The shell
// is then asked as that agent, so nothing it asks counts as the person's press.

import { brief, keep } from '../feedback/notices'
import { Sentence } from '../feedback/sentence'
import { type Settings, shell, shellFor, valueOf } from '../shell'
import { type Poster, posterIssue } from './document'
import { editor, place, savedTo, startNew, undo, unsaved } from './editor'
import { account, updates } from './session'
import { setView } from './view'
import { accountSays, NOT_SAVED, SAVE_FIRST, updateSays } from './words'

const on = (by?: string) => (by ? shellFor(by) : shell())

export async function saveDocument({ as = false, by }: { as?: boolean; by?: string } = {}): Promise<string> {
  const { document, file } = editor.get()
  const saved = valueOf(await on(by).documents.save(as ? null : (file?.id ?? null), document, document.title || 'Untitled'))
  if (!saved) return NOT_SAVED
  savedTo(saved, document)
  return `Saved as ${saved.name}.`
}

export async function openDocument({ by }: { by?: string } = {}): Promise<string> {
  if (unsaved()) throw new Sentence(SAVE_FIRST)
  const opened = valueOf(await on(by).documents.open())
  if (!opened) return 'Nothing opened.'
  const issue = posterIssue(opened.document)
  if (issue) throw new Sentence(`${opened.name} could not be opened. ${issue}`)
  place(opened.document as Poster, { id: opened.id, name: opened.name })
  return `Opened ${opened.name}.`
}

export function newDocument(): string {
  if (unsaved()) throw new Sentence(SAVE_FIRST)
  startNew()
  return 'A new document.'
}

/** Look for a newer version. The answer is where the updater then stands, said by `updateSays`. */
export async function checkForUpdates({ by }: { by?: string } = {}): Promise<string> {
  const state = valueOf(await on(by).updates.check())
  updates.set(state)
  return updateSays(state).says
}

export async function downloadUpdate(): Promise<void> {
  updates.set(valueOf(await shell().updates.download()))
}

export async function restartToUpdate(): Promise<void> {
  updates.set(valueOf(await shell().updates.restart()))
}

export async function signIn(): Promise<string> {
  const state = valueOf(await shell().account.start())
  account.set(state)
  return accountSays(state)
}

export async function openSignInAgain(): Promise<void> {
  account.set(valueOf(await shell().account.openAgain()))
}

export async function cancelSignIn({ by }: { by?: string } = {}): Promise<void> {
  account.set(valueOf(await on(by).account.cancel()))
}

export async function signOut(): Promise<void> {
  account.set(valueOf(await shell().account.signOut()))
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K], { by }: { by?: string } = {}): Promise<void> {
  valueOf(await on(by).settings.set(key, value))
}

/** Undo from a notice: only while the step it names is still the latest. */
export function sayWithUndo(text: string) {
  const step = editor.get().undo.length
  keep(text, {
    action: {
      label: 'Undo',
      run: () => {
        if (editor.get().undo.length === step) undo()
        else brief('That step is no longer the latest. Use Undo.')
      },
    },
  })
}

/** A link to the app was followed. A link does what a button does, and no more: here it only says so. */
export function linkFollowed(id: string) {
  setView({ sheet: null })
  keep(`A link asked to open “${id}”.`, { code: 'link.followed' })
}
