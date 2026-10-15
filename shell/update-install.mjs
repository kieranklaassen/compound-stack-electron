// Putting a fetched build in the app's place. What is installed is only a real
// folder with the app's own name out of the fetched image, and only after the
// copy that stands beside the app has been checked: the image may change
// between a check and a copy, the copy cannot.
//
// The exchange is two renames with the way back kept: the running app is moved
// to a hidden name beside itself, the new one takes its name, and where the
// second move fails the first is undone, so the old app stands. There is no
// other way a build is put in the app's place.
//
// Everything that touches the system is behind `hands` (update-hands.mjs).

import { randomBytes } from 'node:crypto'
import { lstat, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { hashOf } from './update-fetch.mjs'
import { compareVersions } from './update-look.mjs'

export const HIDDEN = '.compound-update-'

export const CANNOT = {
  platform: 'This version updates by itself on a Mac only. Download the new version from the website.',
  checkout: 'A build run from a checkout does not update itself.',
  place: 'Move the app to Applications to let it update by itself.',
}

/** Where the running app is, as `{ app }`, or `{ cannot }` with why it cannot be exchanged there. */
export function placeOf({ platform, exePath, packaged }) {
  if (!packaged) return { cannot: CANNOT.checkout }
  if (platform !== 'darwin') return { cannot: CANNOT.platform }
  const at = exePath.indexOf('.app/Contents/MacOS/')
  if (at === -1) return { cannot: CANNOT.platform }
  const app = exePath.slice(0, at + 4)
  // A disk image and macOS's translocation both run the app from a place that
  // is read-only or is not where the person keeps it.
  if (app.startsWith('/Volumes/') || app.includes('/AppTranslocation/')) return { cannot: CANNOT.place }
  return { app }
}

/**
 * Copy the build out of the image and check the copy. Answers `{ next }`, the
 * checked copy beside the app, or `{ failed: 'check' }` with nothing left behind.
 */
export async function prepare({ image, update, app, running, bundleId }, hands) {
  if ((await hashOf(image).catch(() => null)) !== update.sha256) return { failed: 'check' }
  const next = join(dirname(app), `${HIDDEN}${randomBytes(16).toString('hex')}`, basename(app))
  let mount = null
  try {
    mount = await hands.attach(image)
    const from = join(mount, basename(app))
    // Only a real folder: a link in the image could name anything on this Mac.
    if (!(await lstat(from)).isDirectory()) return await discard(next, { failed: 'check' })
    await hands.copy(from, next)
  } catch {
    return discard(next, { failed: 'check' })
  } finally {
    if (mount) await hands.detach(mount).catch(() => {})
  }
  try {
    const info = await hands.info(next)
    const ours = info.bundleId === bundleId && info.version === update.version && compareVersions(info.version, running) === 1
    const fits = ours && (await hands.systemTakes(info.minimumSystem))
    const signed = fits && (await hands.verify(next))
    // A build signed with a Developer ID is replaced only by one of the same team.
    const team = signed && (await hands.team(app))
    const sameTeam = signed && (!team || team === (await hands.team(next)))
    if (!sameTeam) return discard(next, { failed: 'check' })
  } catch {
    return discard(next, { failed: 'check' })
  }
  return { next }
}

async function discard(next, answer) {
  await rm(dirname(next), { recursive: true, force: true })
  return answer
}

/**
 * Exchange the app at `app` for the checked copy at `next`. Answers
 * `{ old }`, where the app that ran now lies, or `{ failed: 'install' }` with
 * the old app back in its place.
 */
export async function exchange(app, next) {
  const old = join(dirname(next), `old-${basename(app)}`)
  try {
    await rename(app, old)
  } catch {
    return { failed: 'install' }
  }
  try {
    await rename(next, app)
    return { old }
  } catch {
    await rename(old, app).catch(() => {})
    return { failed: 'install' }
  }
}

/** Remove what an update left beside the app: only a folder under the updater's own name. */
export async function sweep(folder) {
  if (!basename(folder).startsWith(HIDDEN)) return false
  await rm(folder, { recursive: true, force: true })
  return true
}
