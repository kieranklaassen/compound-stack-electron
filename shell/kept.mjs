// A small JSON file the shell keeps in the app's own folder: the settings, the
// account, the updater's notes. One class, so each is written whole, checked
// when read, and set aside (never written over) when it cannot be read.

import { readKept, writeWhole } from './whole-file.mjs'

export class Kept {
  #path
  #defaults
  #check
  #value = null
  #unread = null

  /** `check(value)` says whether a parsed file is one this build takes. */
  constructor(path, { defaults = {}, check = (value) => value !== null && typeof value === 'object' } = {}) {
    this.#path = path
    this.#defaults = defaults
    this.#check = check
  }

  /** What is kept, over the defaults. Read from the disk once. */
  async read() {
    if (this.#value) return this.#value
    const kept = await readKept(this.#path, this.#check)
    if (kept.state === 'unread') this.#unread = kept.aside ?? 'unread'
    this.#value = { ...this.#defaults, ...(kept.state === 'read' ? kept.value : {}) }
    return this.#value
  }

  /** The name the file was set aside under, when it was there and could not be read. */
  get unread() {
    return this.#unread
  }

  /** Change some keys and write the file whole. */
  async write(changes) {
    this.#value = { ...(await this.read()), ...changes }
    await writeWhole(this.#path, JSON.stringify(this.#value, null, 2))
    return this.#value
  }
}
