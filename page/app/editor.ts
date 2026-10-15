// The editor's state and every way it changes. One state, and each action a
// plain function over it that a control, a key, the menu and an agent's tool
// all call. Nothing here knows React.
//
// Undo is one step for one gesture: a drag changes the document many times
// while the pointer moves and is one step when it is let go.

import { createStore } from '../store'
import type { DocumentFile } from '../shell'
import { newPoster, type NumberKey, NUMBERS, type Poster, posterIssue, rangeSays, TITLE_MOST } from './document'

export interface EditorState {
  document: Poster
  /** The document as its file holds it, to say whether there are unsaved changes. */
  saved: Poster
  file: DocumentFile | null
  undo: Poster[]
  redo: Poster[]
  /** The gesture the latest undo step belongs to, while it is under way. */
  gesture: number | null
}

const fresh = (): EditorState => {
  const document = newPoster()
  return { document, saved: document, file: null, undo: [], redo: [], gesture: null }
}

export const editor = createStore<EditorState>(fresh())

const same = (a: Poster, b: Poster) => a.title === b.title && a.size === b.size && a.opacity === b.opacity && a.turn === b.turn

export const unsaved = (state: EditorState = editor.get()) => !same(state.document, state.saved)

let gestures = 0
/** Begin a gesture: every change made with its number is one undo step. */
export const beginGesture = () => (gestures += 1)

/** End the gesture under way, so the next change is a step of its own. `undo` and `redo` end it first. */
export function letGo() {
  editor.set((state) => (state.gesture === null ? state : { ...state, gesture: null }))
}

export type Changed = { ok: true } | { ok: false; says: string }

/**
 * Change the document. A change that leaves it as it is does nothing and is no
 * undo step. A change an agent made never joins the person's gesture.
 */
export function change(changes: Partial<Poster>, { gesture = null, by }: { gesture?: number | null; by?: string } = {}): Changed {
  const state = editor.get()
  const next = { ...state.document, ...changes }
  const issue = posterIssue(next)
  if (issue) return { ok: false, says: issue }
  if (same(next, state.document)) return { ok: true }
  const joins = !by && gesture !== null && state.gesture === gesture
  editor.set({ ...state, document: next, undo: joins ? state.undo : [...state.undo, state.document], redo: [], gesture: by ? null : gesture })
  return { ok: true }
}

export function setNumber(key: NumberKey, value: number, options?: { gesture?: number | null; by?: string }): Changed {
  if (!Object.hasOwn(NUMBERS, key)) return { ok: false, says: 'That is not a number of the document.' }
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, says: rangeSays(key) }
  return change({ [key]: value }, options)
}

export function setTitle(title: string, options?: { gesture?: number | null; by?: string }): Changed {
  if (typeof title !== 'string' || title.length > TITLE_MOST) return { ok: false, says: `The title is text of at most ${TITLE_MOST} characters.` }
  return change({ title }, options)
}

export function undo(): Changed {
  const state = editor.get()
  const before = state.undo.at(-1)
  if (!before) return { ok: false, says: 'There is nothing to undo.' }
  editor.set({ ...state, document: before, undo: state.undo.slice(0, -1), redo: [...state.redo, state.document], gesture: null })
  return { ok: true }
}

export function redo(): Changed {
  const state = editor.get()
  const after = state.redo.at(-1)
  if (!after) return { ok: false, says: 'There is nothing to redo.' }
  editor.set({ ...state, document: after, redo: state.redo.slice(0, -1), undo: [...state.undo, state.document], gesture: null })
  return { ok: true }
}

/** Put a whole document in the editor: a new one, an opened file or a recovered one. */
export function place(document: Poster, file: DocumentFile | null, { savedAs = document }: { savedAs?: Poster } = {}) {
  editor.set({ document, saved: savedAs, file, undo: [], redo: [], gesture: null })
}

export const startNew = () => place(newPoster(), null)

/** The file took the document as it stands. */
export function savedTo(file: DocumentFile, document: Poster) {
  editor.set((state) => ({ ...state, file, saved: document }))
}
