// What the page knows of the shell's side: the account, the updater, the
// settings and the app itself. Each is a store the shell fills: once when the
// page starts, and again whenever the shell says it changed. Nothing here asks
// on a clock.

import { type About, type AccountState, type Settings, shell, type UpdateState } from '../shell'
import { createStore } from '../store'

export const about = createStore<About | null>(null)
export const account = createStore<AccountState>({ state: 'signed_out' })
export const updates = createStore<UpdateState | null>(null)
export const settings = createStore<Settings>({ scheme: 'system', fetchUpdates: true, installAtQuit: true })

/** Fill the stores and follow the shell. Answers a function that stops following. */
export function followShell(run: (command: string) => void, linked: (id: string) => void): () => void {
  const on = shell()
  void on.app.about().then((answer) => answer.ok && about.set(answer.value))
  void on.account.state().then((answer) => answer.ok && account.set(answer.value))
  void on.updates.state().then((answer) => answer.ok && updates.set(answer.value))
  void on.settings.read().then((answer) => answer.ok && settings.set(answer.value))
  return on.on((told) => {
    if (told.about === 'account') account.set(told.value)
    else if (told.about === 'updates') updates.set(told.value)
    else if (told.about === 'settings') settings.set(told.value)
    else if (told.about === 'ask') run(told.value)
    else if (told.about === 'link') linked(told.value.open)
  })
}
