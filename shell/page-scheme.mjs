// The page is carried inside the app and served on a scheme of its own
// (`app://page/…`), never from `file://` and never from a server. A scheme gives
// the page a real origin, so storage, the CSP's `'self'` and fetch behave as on
// the web, and nothing on the disk is reachable by its place.

import { extname, join, normalize, sep } from 'node:path'

export const SCHEME = 'app'
export const HOST = 'page'
export const PAGE_URL = `${SCHEME}://${HOST}/index.html`

/**
 * The policy every answer of the scheme carries. No inline script, no eval,
 * nothing loaded from the network: a request the page makes to the backend goes
 * through the shell, which holds the token.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

/** The file under `root` an address of the scheme names, or null where it names none. */
export function fileFor(root, address) {
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== `${SCHEME}:` || url.host !== HOST) return null
  let path
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (path.includes('\0')) return null
  const file = normalize(join(root, path === '/' ? 'index.html' : path))
  const inside = file === root || file.startsWith(root.endsWith(sep) ? root : root + sep)
  if (!inside) return null
  const type = TYPES[extname(file).toLowerCase()]
  return type ? { file, type } : null
}
