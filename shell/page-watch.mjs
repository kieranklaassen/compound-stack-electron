// When the page's process dies the shell loads the page again, so a person is
// never left with a white window. It does not do so in a loop: a page that dies
// three times in a minute is left, and the window says so.

export const RELOADS = 3
export const WITHIN_MS = 60_000

export class PageWatch {
  #gone = []

  /** The page's process ended at `now`. Answers what to do: `reload`, or `stop`. */
  gone(now = Date.now()) {
    this.#gone = this.#gone.filter((at) => now - at < WITHIN_MS)
    this.#gone.push(now)
    return this.#gone.length > RELOADS ? 'stop' : 'reload'
  }
}
