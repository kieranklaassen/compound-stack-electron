// Lines the shell prints or keeps hold no place on the disk and no credential.
// Whatever a library, a helper or the system wrote goes through here first.

const HOME = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s'"`:]+/g
const PLACE = /(?:\/(?:Volumes|private|var|tmp|Applications|opt|etc)\/)[^\s'"`:]+/g
const BEARER = /\b(Bearer|token|key|secret|password)([=:\s]+)[^\s'"`,;]{6,}/gi
const ADDRESS_QUERY = /(https?:\/\/[^\s?'"`]+)\?[^\s'"`]+/g

/** `text` with places, credentials and the query of an address taken out. */
export function redact(text) {
  return String(text)
    .replace(ADDRESS_QUERY, '$1?…')
    .replace(BEARER, '$1$2…')
    .replace(HOME, '<place>')
    .replace(PLACE, '<place>')
    .slice(0, 400)
}
