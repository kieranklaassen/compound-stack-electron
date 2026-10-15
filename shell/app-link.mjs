// The app's own address (`compound://open/<id>`). Any page, mail or process on
// the computer can send one, so it is read by one strict function, carries an
// id and nothing else, and does only what a person could do from the window by
// pressing. What reads as nothing opens nothing and says nothing, and no part
// of an address is kept or logged.

export const LINK_SCHEME = 'compound'

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** What an address asks for: `{ open: id }`, or null. */
export function linkOf(address) {
  if (typeof address !== 'string' || address.length > 200) return null
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== `${LINK_SCHEME}:` || url.host !== 'open') return null
  if (url.search || url.hash || url.username || url.password || url.port) return null
  const id = url.pathname.slice(1)
  return ID.test(id) ? { open: id } : null
}

/** The address among a launch's arguments, where Windows and Linux hand one over. */
export const linkAmong = (argv) => argv.map(linkOf).find(Boolean) ?? null
