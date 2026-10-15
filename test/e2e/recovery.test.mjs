// Work survives a launch that ended without a save: the next launch offers it.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { answerDialogs, launch } from './support.mjs'

test('unsaved work is kept, offered at the next launch, and recovered', async () => {
  const first = await launch()
  await first.page.getByLabel('Title').fill('Not saved yet')
  await first.page.getByLabel('Title').press('Enter')
  // The quit's question is answered Cancel by nobody: the process is ended, as a crash ends it.
  await first.page.waitForTimeout(1200)
  await first.app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  await first.close({ keep: true })

  const second = await launch({ userData: first.userData })
  try {
    const kept = second.page.getByRole('alertdialog', { name: 'Kept work' })
    await kept.waitFor()
    await kept.getByRole('button', { name: 'Recover' }).click()
    assert.equal(await second.page.getByLabel('Title').inputValue(), 'Not saved yet')
    await second.page.getByText('Edited').waitFor()
    // Leaving with it unsaved asks; Don't Save is the person's word, and the app goes.
    await answerDialogs(second.app, { message: 2 })
  } finally {
    await second.close()
  }
})
