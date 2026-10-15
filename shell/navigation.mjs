// The window shows the app's own page and goes nowhere else. A link that leads
// out is opened in the person's browser, and only where it is plain https, or
// the backend the app is set to (which may be http on this machine in
// development).

import { HOST, SCHEME } from './page-scheme.mjs'

/** Whether the app's window may load `address`: only its own page. */
export function staysInTheWindow(address) {
  try {
    const url = new URL(address)
    return url.protocol === `${SCHEME}:` && url.host === HOST
  } catch {
    return false
  }
}

/** Whether `address` may be handed to the person's browser. */
export function opensOutside(address, server) {
  let url
  try {
    url = new URL(address)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  if (url.protocol === 'https:') return true
  if (!server) return false
  try {
    return url.origin === new URL(server).origin
  } catch {
    return false
  }
}
