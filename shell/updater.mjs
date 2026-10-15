// The app updates itself. This is the one seam: it holds where an update
// stands and decides what happens next. What looks, what fetches and what
// installs are hands of their own (update-look, update-fetch, update-install),
// and the clock, the settings and the quit are handed in, so the whole of it
// runs in a Node test.
//
// Looking and fetching are the app's own doing. Restarting to update and a
// download asked for by hand are the person's own press, and nothing is ever
// installed over work that is unsaved or under way.

import { Refused } from './doors.mjs'
import { mustAsk, NOT_THE_PRESS } from './press.mjs'

export const LOOK_EVERY_MS = 6 * 60 * 60 * 1000
export const AWAY_MS = 60 * 60 * 1000
export const AGENT_LOOK_MS = 5 * 60 * 1000

export const SAYS = {
  look: 'The app could not check for updates. Try again.',
  fetch: 'The update did not download. Try again.',
  check: 'The download was not the update it should be, and was removed.',
  install: 'The update could not be put in place. The version you have is still here.',
  signedOut: 'Sign in to get updates.',
}

export class Updater {
  #running
  #hands
  #settings
  #busy
  #quit
  #now
  #changed
  #state = 'current'
  #newer = null
  #image = null
  #fetched = 0
  #seen = null
  #failed = null
  #cannot = null
  #told = ''
  #looking = null
  #armed = null
  #failedBuild = null

  /**
   * `hands`: `{ look(), fetch(update, progress), prepare(image, update), exchange(next), relaunch() }`.
   * `settings()` answers `{ fetchUpdates, installAtQuit }`. `busy()` answers a
   * sentence while something must not be interrupted, or null.
   */
  constructor({ running, hands, settings, busy = () => null, quit = () => {}, now = Date.now, changed = () => {}, cannot = null }) {
    this.#running = running
    this.#hands = hands
    this.#settings = settings
    this.#busy = busy
    this.#quit = quit
    this.#now = now
    this.#changed = changed
    this.#cannot = cannot
    if (cannot) this.#state = 'off'
  }

  /** What the page hears: versions, sizes, states and the updater's own sentences. Never an address, a checksum or a place. */
  get state() {
    return {
      state: this.#state,
      running: this.#running,
      newer: this.#newer ? { version: this.#newer.version, size: this.#newer.size } : null,
      fetched: this.#fetched,
      seen: this.#seen,
      failed: this.#failed,
      cannot: this.#cannot,
      waits: this.#state === 'ready' ? this.#busy() : null,
    }
  }

  #tell(changes = {}) {
    if ('state' in changes) this.#state = changes.state
    if ('failed' in changes) this.#failed = changes.failed
    const next = JSON.stringify(this.state)
    // The page is told only what is another state than the last it was told.
    if (next === this.#told) return
    this.#told = next
    this.#changed(this.state)
  }

  #fail(at, state = 'failed') {
    this.#tell({ state, failed: { at, says: SAYS[at] } })
    return this.state
  }

  /**
   * Look for a newer build. The person's press always asks the server and
   * waits for what it began; an agent's ask within five minutes of the last
   * look is answered from what is known.
   */
  async check(who = {}) {
    if (this.#cannot) return this.state
    const own = !mustAsk(who)
    if (!own && who.askedBy && this.#seen !== null && this.#now() - this.#seen < AGENT_LOOK_MS) return this.state
    if (['fetching', 'installing'].includes(this.#state)) return this.state
    if (own) this.#failedBuild = null
    this.#looking ??= this.#look().finally(() => (this.#looking = null))
    await this.#looking
    return this.state
  }

  async #look() {
    const was = this.#state
    this.#tell({ state: 'looking', failed: null })
    const found = await Promise.resolve()
      .then(() => this.#hands.look())
      .catch(() => ({ noAnswer: true }))
    if (found.signedOut) return void this.#tell({ state: 'failed', failed: { at: 'look', says: SAYS.signedOut } })
    if (found.noAnswer || found.unreadable) return void this.#fail('look')
    this.#seen = this.#now()
    if (!found.update) {
      this.#newer = null
      return void this.#tell({ state: 'current' })
    }
    const same = this.#newer?.sha256 === found.update.sha256
    this.#newer = found.update
    if (same && was === 'ready' && this.#image) return void this.#tell({ state: 'ready' })
    this.#tell({ state: 'available' })
    // A build that failed its check is not fetched again by itself: only a press tries it.
    const { fetchUpdates } = await this.#settings()
    if (fetchUpdates && this.#failedBuild !== found.update.sha256) await this.#fetch()
  }

  /** Download the build that is out: the person's own press. */
  async download(who) {
    if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, 'update.not_the_press')
    if (this.#state !== 'available' && !(this.#state === 'failed' && this.#newer)) return this.state
    this.#failedBuild = null
    await this.#fetch()
    return this.state
  }

  async #fetch() {
    this.#fetched = 0
    this.#tell({ state: 'fetching', failed: null })
    const got = await this.#hands
      .fetch(this.#newer, (bytes) => {
        this.#fetched = bytes
        this.#tell()
      })
      .catch(() => ({ failed: 'fetch' }))
    if (got.failed) {
      if (got.failed === 'check') this.#failedBuild = this.#newer.sha256
      return void this.#fail(got.failed)
    }
    this.#image = got.path
    this.#tell({ state: 'ready' })
  }

  /** Restart to update: the person's own press, and never over work under way. */
  async restart(who) {
    if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, 'update.not_the_press')
    if (this.#state !== 'ready') return this.state
    const waits = this.#busy()
    if (waits) throw new Refused(waits, 'update.waits')
    if (!(await this.#prepare())) return this.state
    this.#armed = { ...this.#armed, relaunch: true }
    this.#quit()
    return this.state
  }

  async #prepare() {
    this.#tell({ state: 'installing', failed: null })
    const prepared = await this.#hands.prepare(this.#image, this.#newer).catch(() => ({ failed: 'check' }))
    if (prepared.failed) {
      this.#failedBuild = this.#newer.sha256
      this.#image = null
      this.#fail(prepared.failed)
      return false
    }
    // Busy is asked again: preparing takes a while, and work may have begun meanwhile.
    if (this.#busy()) {
      await this.#hands.discard?.(prepared.next)
      this.#tell({ state: 'ready' })
      return false
    }
    this.#armed = { next: prepared.next }
    return true
  }

  /**
   * The last thing a quit does. An armed restart is exchanged; otherwise a
   * ready build is installed where the person has that setting on and nothing
   * is busy. A quit decides once: a second call does nothing.
   */
  async atQuit({ shutdown = false } = {}) {
    if (this.#state === 'done') return null
    if (!this.#armed) {
      const { installAtQuit } = await this.#settings()
      if (shutdown || !installAtQuit || this.#state !== 'ready' || this.#busy()) return null
      if (!(await this.#prepare())) return null
    }
    const armed = this.#armed
    this.#armed = null
    const exchanged = await this.#hands.exchange(armed.next).catch(() => ({ failed: 'install' }))
    if (exchanged.failed) {
      this.#fail('install')
      return null
    }
    this.#state = 'done'
    if (armed.relaunch) await this.#hands.relaunch?.()
    return exchanged
  }
}

/** What a page may ask of the updater. */
export const updateDoor = (updater) => ({
  state: () => updater.state,
  check: (_args, who) => updater.check(who),
  download: (_args, who) => updater.download(who),
  restart: (_args, who) => updater.restart(who),
})

/** When the shell looks by itself: at launch, every six hours, and on coming to the front after an hour away. */
export function lookTimes({ check, later = setInterval, now = Date.now }) {
  let leftAt = null
  later(() => void check(), LOOK_EVERY_MS)
  return {
    launched: () => void check(),
    left: () => (leftAt = now()),
    cameBack: () => {
      if (leftAt !== null && now() - leftAt >= AWAY_MS) void check()
      leftAt = null
    },
  }
}
