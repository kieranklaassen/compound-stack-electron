// Looking for a newer build. The backend answers `GET /device/update` with the
// newest build's version, size, SHA-256 and an address good for a few minutes.
// Every field is held to its shape before anything is believed, and nothing the
// server wrote as text is ever shown to the person.

import { onThisMachine } from './server.mjs'

const VERSION = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/
const SHA256 = /^[0-9a-f]{64}$/
export const MOST_BYTES = 2 * 1024 ** 3

/** -1, 0 or 1 as version `a` is lower than, the same as or higher than `b`. Null where either is no version. */
export function compareVersions(a, b) {
  const left = VERSION.exec(a ?? '')
  const right = VERSION.exec(b ?? '')
  if (!left || !right) return null
  for (let part = 1; part <= 3; part += 1) {
    const difference = Number(left[part]) - Number(right[part])
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

/**
 * What an answer of the update door comes to:
 * `{ update: { version, size, sha256, url } }`, `{ update: null }` (nothing
 * newer), or `{ unreadable: true }`.
 */
export function readAnswer(body, { running, server }) {
  if (body === null || typeof body !== 'object' || !('update' in body)) return { unreadable: true }
  if (body.update === null) return { update: null }
  const { version, size, sha256, url } = body.update ?? {}
  // Text only: a pattern would take a list of one text for the text itself.
  if (![version, sha256, url].every((field) => typeof field === 'string')) return { unreadable: true }
  const newer = compareVersions(version, running)
  if (newer === null) return { unreadable: true }
  if (!Number.isInteger(size) || size <= 0 || size > MOST_BYTES) return { unreadable: true }
  if (!SHA256.test(sha256 ?? '')) return { unreadable: true }
  if (!fetchable(url, server)) return { unreadable: true }
  // Only a strictly higher version is an update: a server never moves an app back.
  if (newer <= 0) return { update: null }
  return { update: { version, size, sha256, url } }
}

// A build is fetched over https. Plain http is taken only from this machine,
// and only where the app's own server is on this machine too (development).
function fetchable(address, server) {
  let url
  try {
    url = new URL(address)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && onThisMachine(url.origin) && onThisMachine(server)
}

/** One look. `askServer(path, options)` is the shell's request with the device's token. */
export async function lookForUpdate(askServer, { running, server }) {
  const { status, body } = await askServer('/device/update')
  if (status === 401) return { signedOut: true }
  if (status !== 200) return { noAnswer: true }
  return readAnswer(body, { running, server })
}
