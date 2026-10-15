// The app signs in through the browser (the device grant, RFC 8628). The app
// asks the backend for a request, shows the request's short code, and opens the
// backend's approve page in the person's own browser, where they are already
// signed in. The app then asks for its token until the person has answered.
//
// The page hears the code to show, a state and the account's address: never
// the device code or the token. The Rails side is in docs/rails-backend.md.

import { Refused } from './doors.mjs'
import { mustAsk, NOT_THE_PRESS } from './press.mjs'
import { ask, NO_SERVER, SERVER_DID_NOT_ANSWER } from './server.mjs'

const USER_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
const DEVICE_CODE = /^[A-Za-z0-9_-]{20,200}$/
const TOKEN = /^[\x21-\x7e]{20,2000}$/

export const SAYS = {
  refused: 'The sign-in was refused in the browser.',
  expired: 'The sign-in took too long. Start it again.',
  unreadable: 'The server answered something this version does not understand.',
}

export class Account {
  #server
  #fetch
  #open
  #vault
  #version
  #wait
  #changed
  #state = { state: 'signed_out' }
  #attempt = 0

  /**
   * `open(address)` opens the person's browser. `wait(ms)` is the clock between
   * two asks. `changed(state)` is told what the page may hear.
   */
  constructor({ server, fetch: fetchIt = fetch, open, vault, version = '0.0.0', wait, changed = () => {} }) {
    this.#server = server
    this.#fetch = fetchIt
    this.#open = open
    this.#vault = vault
    this.#version = version
    this.#wait = wait ?? ((ms) => new Promise((done) => setTimeout(done, ms)))
    this.#changed = changed
  }

  /** What the page may hear. */
  get state() {
    return this.#state
  }

  /** The token, for the shell's own requests. Never handed to a door. */
  token() {
    return this.#vault.read()
  }

  #set(state) {
    this.#state = state
    this.#changed(state)
    return state
  }

  #ask(path, options) {
    return ask(this.#fetch, this.#server, path, { version: this.#version, ...options })
  }

  /** At launch: is the kept token still good? */
  async resume() {
    if (!this.#server) return this.#set({ state: 'off', says: NO_SERVER })
    const token = await this.#vault.read()
    if (!token) return this.#set({ state: 'signed_out' })
    const { status, body } = await this.#ask('/device', { token })
    if (status === 200 && typeof body?.email === 'string') return this.#set({ state: 'signed_in', email: body.email })
    if (status === 401) {
      await this.#vault.forget()
      return this.#set({ state: 'signed_out' })
    }
    // The server is away: the token is kept, and the app says it could not ask.
    return this.#set({ state: 'unknown', says: SERVER_DID_NOT_ANSWER })
  }

  /** Start a sign-in: the person's own press, since it opens their browser. */
  async start(who) {
    if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, 'account.not_the_press')
    if (!this.#server) throw new Refused(NO_SERVER, 'account.no_server')
    const attempt = ++this.#attempt
    const { status, body } = await this.#ask('/device/authorizations', { method: 'POST', body: {} })
    if (status !== 201) throw new Refused(SERVER_DID_NOT_ANSWER, 'account.no_answer')
    const { device_code: deviceCode, user_code: userCode } = body ?? {}
    const interval = Number.isInteger(body?.interval) ? Math.min(Math.max(body.interval, 1), 30) : 5
    const expiresIn = Number.isInteger(body?.expires_in) ? Math.min(body.expires_in, 900) : 600
    if (!DEVICE_CODE.test(deviceCode ?? '') || !USER_CODE.test(userCode ?? '')) throw new Refused(SAYS.unreadable, 'account.unreadable')
    // The code travels after the #, which no server's log ever sees.
    const page = `${this.#server}/device/approve#${userCode}`
    this.#set({ state: 'waiting', code: userCode })
    await this.#open(page)
    // The polling outlives this call: the press is answered with the code at once.
    void this.#poll(attempt, deviceCode, interval, expiresIn)
    return this.#state
  }

  /** Open the approve page again, for a browser tab that was closed. */
  async openAgain(who) {
    if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, 'account.not_the_press')
    if (this.#state.state !== 'waiting') return this.#state
    await this.#open(`${this.#server}/device/approve#${this.#state.code}`)
    return this.#state
  }

  /** Give up a sign-in that is waiting. A token that arrives after this is revoked. */
  cancel() {
    if (this.#state.state !== 'waiting') return this.#state
    this.#attempt += 1
    return this.#set({ state: 'signed_out' })
  }

  async #poll(attempt, deviceCode, interval, expiresIn) {
    let every = interval
    let waited = 0
    while (waited < expiresIn) {
      await this.#wait(every * 1000)
      waited += every
      const { status, body } = await this.#ask('/device/authorizations/token', { method: 'POST', body: { device_code: deviceCode } })
      if (status === 200 && TOKEN.test(body?.token ?? '')) {
        if (attempt !== this.#attempt) {
          await this.#ask('/device', { method: 'DELETE', token: body.token })
          return
        }
        await this.#vault.write(body.token)
        const email = typeof body.email === 'string' ? body.email : ''
        this.#set({ state: 'signed_in', email })
        return
      }
      if (attempt !== this.#attempt) return
      if (status === 428) {
        if (body?.error === 'slow_down') every += 5
        continue
      }
      if (status === 400 && body?.error === 'access_denied') return void this.#set({ state: 'signed_out', says: SAYS.refused })
      if (status === 400) return void this.#set({ state: 'signed_out', says: SAYS.expired })
      // No answer, a 429 or a 5xx: ask again at the next turn, more slowly.
      if (status === 429) every += 5
    }
    if (attempt === this.#attempt) this.#set({ state: 'signed_out', says: SAYS.expired })
  }

  /** Sign out: the server ends the token, and the Mac forgets it whatever the server said. */
  async signOut() {
    this.#attempt += 1
    const token = await this.#vault.read()
    if (token && this.#server) await this.#ask('/device', { method: 'DELETE', token })
    await this.#vault.forget()
    return this.#set({ state: 'signed_out' })
  }
}

/** The account door: what a page may ask. */
export const accountDoor = (account) => ({
  state: () => account.state,
  start: (_args, who) => account.start(who),
  openAgain: (_args, who) => account.openAgain(who),
  cancel: () => account.cancel(),
  signOut: () => account.signOut(),
})
