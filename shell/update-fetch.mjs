// Fetching a build. The address was signed for this device, so the request
// carries no token and follows no redirect. The file is written under a partial
// name, never past the size the server named, and is a build only once the
// whole of it, read back from the disk, has the checksum the server named.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const STALL_MS = 60_000

export const imagePath = (folder, sha256) => join(folder, `${sha256}.dmg`)

/** The SHA-256 of a file, read from the disk. */
export function hashOf(path) {
  return new Promise((done, failed) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', failed)
      .on('end', () => done(hash.digest('hex')))
  })
}

/** The build already fetched and whole, or null. */
export async function keptImage(folder, { size, sha256 }) {
  const path = imagePath(folder, sha256)
  try {
    if ((await stat(path)).size !== size) return null
    return (await hashOf(path)) === sha256 ? path : null
  } catch {
    return null
  }
}

/**
 * Fetch `update` into `folder`. Answers `{ path }`, or `{ failed: 'fetch' | 'check' }`.
 * A file whose checksum is another one is removed: it is not a build.
 */
export async function fetchUpdate(update, folder, { fetch: fetchIt = fetch, progress = () => {}, signal, stallMs = STALL_MS } = {}) {
  const kept = await keptImage(folder, update)
  if (kept) return { path: kept }
  await mkdir(folder, { recursive: true })
  const partial = join(folder, `${update.sha256}.part`)
  await rm(partial, { force: true })
  const stalled = new AbortController()
  const both = signal ? AbortSignal.any([signal, stalled.signal]) : stalled.signal
  let timer
  const alive = () => {
    clearTimeout(timer)
    timer = setTimeout(() => stalled.abort(), stallMs)
  }
  let file
  try {
    alive()
    const answer = await fetchIt(update.url, { redirect: 'error', cache: 'no-store', signal: both })
    if (answer.status !== 200 || !answer.body) return { failed: 'fetch' }
    file = await open(partial, 'wx', 0o600)
    let got = 0
    for await (const chunk of answer.body) {
      alive()
      got += chunk.length
      // The first byte past the named size ends it: nothing longer is the build.
      if (got > update.size) return { failed: 'check' }
      await file.write(chunk)
      progress(got)
    }
    await file.sync()
    await file.close()
    file = null
    if (got !== update.size || (await hashOf(partial)) !== update.sha256) return { failed: 'check' }
    const path = imagePath(folder, update.sha256)
    await rename(partial, path)
    return { path }
  } catch {
    return { failed: 'fetch' }
  } finally {
    clearTimeout(timer)
    await file?.close().catch(() => {})
    await rm(partial, { force: true })
  }
}

/** One build is kept: every other file of the updates folder goes. */
export async function clearUpdates(folder, keep = null) {
  let names
  try {
    names = await readdir(folder)
  } catch {
    return
  }
  await Promise.all(names.filter((name) => join(folder, name) !== keep).map((name) => rm(join(folder, name), { force: true, recursive: true })))
}
