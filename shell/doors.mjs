// What a page may ask of the shell is a closed list. A door is a name and the
// methods it answers; the one IPC channel (`shell:ask`) is put to this registry
// and nothing else is listened to. A door is plain Node with no Electron in it,
// so a Node test can read exactly what a page can reach.
//
// Every answer is `{ ok: true, value }` or `{ ok: false, refused }`, where
// `refused` is a sentence written for a person. An error's own words never
// reach the page: a library may have put a path, an address or a token in them.

export const DID_NOT_WORK = 'That did not work.'

/** A refusal with its sentence. Throw one from a door's method to say why not. */
export class Refused extends Error {
  constructor(sentence, code) {
    super(sentence)
    this.name = 'Refused'
    this.code = code
  }
}

export class Doors {
  #doors = new Map()
  #log

  constructor({ log = () => {} } = {}) {
    this.#log = log
  }

  /** Add a door: `methods` maps each method's name to `(args, who) => value`. */
  add(name, methods) {
    if (this.#doors.has(name)) throw new Error(`The door ${name} is added twice.`)
    this.#doors.set(name, new Map(Object.entries(methods)))
    return this
  }

  /** What a page can reach: each door with its methods, for the preload and for the tests. */
  list() {
    return Object.fromEntries([...this.#doors].map(([name, methods]) => [name, [...methods.keys()]]))
  }

  /** Answer one ask. `who` is the preload's word on the press, never the page's. */
  async answer(ask, who = {}) {
    const { door, method, args } = ask ?? {}
    const found = typeof door === 'string' && typeof method === 'string' ? this.#doors.get(door)?.get(method) : undefined
    if (!found) return { ok: false, refused: DID_NOT_WORK, code: 'no_such_door' }
    try {
      const value = await found(Array.isArray(args) ? args : [], { gesture: who.gesture === true, askedBy: who.askedBy })
      return { ok: true, value: value ?? null }
    } catch (error) {
      if (error instanceof Refused) return { ok: false, refused: error.message, code: error.code }
      this.#log(`${door}.${method} failed: ${error?.name ?? 'Error'}`)
      return { ok: false, refused: DID_NOT_WORK, code: 'failed' }
    }
  }
}
