// Which backend the app talks to. The address is baked into a packaged build
// and named by APP_SERVER in a checkout. It is https, or plain http on this
// machine for development: the device's token is never sent anywhere else.

const THIS_MACHINE = new Set(['localhost', '127.0.0.1', '[::1]'])

/** The server's origin, or null where `address` is not one the app may talk to. */
export function serverOf(address) {
  if (typeof address !== 'string' || address === '') return null
  let url
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.protocol === 'https:') return url.origin
  if (url.protocol === 'http:' && THIS_MACHINE.has(url.hostname)) return url.origin
  return null
}

export const onThisMachine = (origin) => {
  try {
    return THIS_MACHINE.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

export const SERVER_DID_NOT_ANSWER = 'The server did not answer. Try again.'
export const NO_SERVER = 'This build is not set to a server.'

/**
 * One request to the backend's device API. JSON in and out, no redirect
 * followed (a redirect would carry the token to another place), a time limit,
 * and nothing of the answer trusted beyond its status and its parsed body.
 */
export async function ask(fetchIt, server, path, { method = 'GET', token, body, version = '0.0.0', within = 8_000 } = {}) {
  const headers = { Accept: 'application/json', 'User-Agent': `compound-stack-electron/${version}` }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let answer
  try {
    answer = await fetchIt(`${server}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(within),
    })
  } catch {
    return { status: 0, body: null }
  }
  let parsed = null
  try {
    parsed = await answer.json()
  } catch {
    // An answer with no JSON is its status alone.
  }
  return { status: answer.status, body: parsed }
}
