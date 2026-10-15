// What the launch tests share. A launch test starts the real shell, with the
// harness on: the app's files go in a folder the test made, and nothing of the
// person's own account or settings is read.
//
// Launch tests need Electron and a display (`xvfb-run -a` on Linux), so they
// are not part of `npm run check` and CI's first job never needs them.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron } from 'playwright-core'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export async function launch({ env = {}, userData } = {}) {
  const made = userData ?? (await mkdtemp(join(tmpdir(), 'compound-e2e-')))
  const app = await electron.launch({
    args: [root, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    cwd: root,
    env: { ...process.env, COMPOUND_HARNESS: '1', COMPOUND_USER_DATA: made, APP_SERVER: '', ...env },
  })
  const page = await app.firstWindow()
  await page.waitForSelector('.app')
  return {
    app,
    page,
    userData: made,
    async close({ keep = false } = {}) {
      await app.close().catch(() => {})
      if (!keep) await rm(made, { recursive: true, force: true })
    },
  }
}

/** Put a stand-in in a dialog's place, so no test waits on a dialog nobody can answer. */
export const answerDialogs = (app, { save = null, open = null, message = 1 } = {}) =>
  app.evaluate(({ dialog }, answers) => {
    dialog.showSaveDialog = async () => ({ canceled: answers.save === null, filePath: answers.save ?? undefined })
    dialog.showOpenDialog = async () => ({ canceled: answers.open === null, filePaths: answers.open ? [answers.open] : [] })
    dialog.showMessageBox = async () => ({ response: answers.message })
  }, { save, open, message })
