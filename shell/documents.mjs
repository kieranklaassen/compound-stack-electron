// A document's file is named to the page by an id the shell made, never by its
// place on the disk. The person picks the place in the system's own dialog; the
// page hears an id and the file's name. A page that is loaded again holds ids
// that open nothing.

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { Refused } from './doors.mjs'
import { writeWhole } from './whole-file.mjs'

export const EXTENSION = 'compound'
const MOST_BYTES = 8 * 1024 * 1024

export class Documents {
  #places = new Map()
  #pick
  #pickToSave

  /** `pick()` and `pickToSave(name)` show the system's dialogs and answer a place or null. */
  constructor({ pick, pickToSave }) {
    this.#pick = pick
    this.#pickToSave = pickToSave
  }

  #idFor(place) {
    const id = randomUUID()
    this.#places.set(id, place)
    return { id, name: basename(place) }
  }

  /** Open a document the person picks. Null where they cancelled. */
  async open() {
    const place = await this.#pick()
    if (!place) return null
    let document
    try {
      const text = await readFile(place, 'utf8')
      if (Buffer.byteLength(text) > MOST_BYTES) throw new Error('too large')
      document = JSON.parse(text)
    } catch {
      throw new Refused('That file could not be read as a document.', 'documents.unreadable')
    }
    return { ...this.#idFor(place), document }
  }

  /** Save to the file an id names, or where the person picks when `id` is null. Null where they cancelled. */
  async save([id, document, name]) {
    let place = typeof id === 'string' ? this.#places.get(id) : null
    let file = place ? { id, name: basename(place) } : null
    if (!place) {
      place = await this.#pickToSave(typeof name === 'string' ? name.slice(0, 80) : 'Untitled')
      if (!place) return null
      file = this.#idFor(place)
    }
    const text = JSON.stringify(document, null, 2)
    if (Buffer.byteLength(text) > MOST_BYTES) throw new Refused('The document is too large to save.', 'documents.too_large')
    try {
      await writeWhole(place, text)
    } catch {
      throw new Refused('The document could not be saved there.', 'documents.not_saved')
    }
    return file
  }

  /** The page was loaded again: the ids it held open nothing. */
  forget() {
    this.#places.clear()
  }
}

export const documentsDoor = (documents, recovery) => ({
  open: () => documents.open(),
  save: async (args) => {
    const file = await documents.save(args)
    // A save is the person's word that the kept copy is no longer needed.
    if (file) await recovery.drop()
    return file
  },
})
