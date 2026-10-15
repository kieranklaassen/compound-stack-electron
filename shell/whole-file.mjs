// A file the shell keeps is whole or it is the one from before: written under
// a partial name, flushed to the disk, then moved over the last one. A crash or
// a pulled plug in the middle leaves the old file, never half of the new one.
// Every file the shell writes for itself goes through here.

import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/** Write `text` as the whole of the file at `path`. */
export async function writeWhole(path, text) {
  const folder = dirname(path)
  await mkdir(folder, { recursive: true })
  const partial = join(folder, `.${basename(path)}.${randomBytes(6).toString('hex')}.partial`)
  const file = await open(partial, 'wx', 0o600)
  try {
    await file.writeFile(text)
    await file.sync()
  } catch (error) {
    await file.close()
    await rm(partial, { force: true })
    throw error
  }
  await file.close()
  try {
    await rename(partial, path)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  await flushFolder(folder)
}

// The rename is in the folder's own record, which is flushed apart from the
// file. Not every platform lets a folder be opened for it, so a refusal here is
// passed over: the file itself is already whole.
async function flushFolder(folder) {
  let handle
  try {
    handle = await open(folder, 'r')
    await handle.sync()
  } catch {
    // Windows refuses, and the file is whole without it.
  } finally {
    await handle?.close()
  }
}

/**
 * Read a JSON file the shell kept. Three answers, and they are never mixed up:
 * `none` (no such file), `read` with its value, and `unread`: the file is there
 * and is not what `check` takes. An unread file is moved aside under another
 * name, never written over and never removed, so a person's data is not lost
 * to a bug in the build that could not read it.
 */
export async function readKept(path, check = () => true, now = Date.now) {
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'none' }
    return { state: 'unread', aside: null }
  }
  try {
    const value = JSON.parse(text)
    if (check(value)) return { state: 'read', value }
  } catch {
    // Falls through to the setting aside.
  }
  const aside = `${path}.unread-${now()}`
  try {
    await rename(path, aside)
    return { state: 'unread', aside: basename(aside) }
  } catch {
    return { state: 'unread', aside: null }
  }
}
