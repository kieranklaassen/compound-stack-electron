// Work that survives a crash. The page hands the shell the open document
// whenever it changes, and the shell keeps it in a file of its own beside the
// settings, no more often than once a second. It is never the document's own
// file, and it goes only on the person's word: a save, or their Discard.
//
// At the next launch a kept document is offered: Recover, or Discard. One this
// build cannot read is set aside under another name, never removed.

import { rm } from 'node:fs/promises'

import { readKept, writeWhole } from './whole-file.mjs'

export const KEEP_EVERY_MS = 1_000
export const MOST_BYTES = 8 * 1024 * 1024

export class Recovery {
  #path
  #now
  #later
  #held = null
  #timer = null
  #wroteAt = -Infinity
  #writing = Promise.resolve()

  /** `later(run, ms)` returns a cancel function: the timer, handed in so a test owns the clock. */
  constructor(path, { now = Date.now, later } = {}) {
    this.#path = path
    this.#now = now
    this.#later =
      later ??
      ((run, ms) => {
        const timer = setTimeout(run, ms)
        return () => clearTimeout(timer)
      })
  }

  /** Keep `document` (plain data). Answers false where it is not kept: too large to be one. */
  keep(document) {
    const text = JSON.stringify({ version: 1, document })
    if (Buffer.byteLength(text) > MOST_BYTES) return false
    this.#held = text
    const due = this.#wroteAt + KEEP_EVERY_MS - this.#now()
    if (due <= 0) void this.flush()
    else this.#timer ??= this.#later(() => void this.flush(), due)
    return true
  }

  /** Write what is held now. A quit and a page that died both call this first. */
  flush() {
    this.#timer?.()
    this.#timer = null
    const text = this.#held
    if (text === null) return this.#writing
    this.#held = null
    this.#wroteAt = this.#now()
    this.#writing = this.#writing.then(() => writeWhole(this.#path, text)).catch(() => {})
    return this.#writing
  }

  /** What was kept: `{ state: 'none' }`, `{ state: 'kept', document }`, or `{ state: 'unread', aside }`. */
  async take() {
    await this.flush()
    const kept = await readKept(this.#path, (value) => value?.version === 1 && 'document' in value)
    if (kept.state === 'read') return { state: 'kept', document: kept.value.document }
    return kept
  }

  /** The person saved, or chose Discard: nothing is kept any more. */
  async drop() {
    this.#timer?.()
    this.#timer = null
    this.#held = null
    await this.#writing
    await rm(this.#path, { force: true })
  }
}
