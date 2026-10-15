// Where the device's token is kept. It is the one credential the shell holds
// for the backend, so it is encrypted with the system's own keychain where the
// build can use it (Electron's `safeStorage`), and kept in a file only the
// person's account can read otherwise.
//
// An ad hoc signed build is another app to macOS at every rebuild, and the
// keychain would ask again each time: such a build keeps the plain file. That
// is a deliberate trade for development builds, said in docs/modules/account.md.

import { chmod, readFile, rm } from 'node:fs/promises'

import { writeWhole } from './whole-file.mjs'

/**
 * `safe`: `{ isEncryptionAvailable, encryptString, decryptString }` or null.
 * The file holds `{ sealed: base64 }` or `{ plain: token }`.
 */
export class Vault {
  #path
  #safe

  constructor(path, safe = null) {
    this.#path = path
    this.#safe = safe?.isEncryptionAvailable?.() ? safe : null
  }

  async read() {
    let kept
    try {
      kept = JSON.parse(await readFile(this.#path, 'utf8'))
    } catch {
      return null
    }
    if (typeof kept?.plain === 'string') return kept.plain
    if (typeof kept?.sealed === 'string' && this.#safe) {
      try {
        return this.#safe.decryptString(Buffer.from(kept.sealed, 'base64'))
      } catch {
        return null
      }
    }
    return null
  }

  async write(token) {
    const kept = this.#safe ? { sealed: this.#safe.encryptString(token).toString('base64') } : { plain: token }
    await writeWhole(this.#path, JSON.stringify(kept))
    await chmod(this.#path, 0o600)
  }

  async forget() {
    await rm(this.#path, { force: true })
  }
}
