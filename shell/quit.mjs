// Leaving the app. Two rules.
//
// A window that closes with unsaved work asks first: Save, Don't Save, Cancel.
// The decision is this pure function; `main.mjs` shows the dialog.
//
// A quit ends in time. What the shell must finish (a last write of the
// recovery, an update's exchange) is waited for here, with a limit, before the
// quit is handed on: nothing is left to finish "after" a quit.

export const QUIT_WITHIN_MS = 5_000

/** What closing the window does: `close`, or `ask` first. A shutdown that cannot ask drops nothing. */
export function leaving({ unsaved, canAsk }) {
  if (!unsaved) return 'close'
  return canAsk ? 'ask' : 'close'
}

/** The dialog's buttons, in the order macOS draws them, and what each index means. */
export const QUIT_BUTTONS = ['Save', 'Cancel', "Don't Save"]
export const answerOf = (index) => ['save', 'cancel', 'discard'][index] ?? 'cancel'

/** Wait for everything in `last`, each given the chance to finish, and never longer than the limit. */
export async function quitWhenDone(last, { within = QUIT_WITHIN_MS, wait = (ms) => new Promise((done) => setTimeout(done, ms)) } = {}) {
  const all = Promise.allSettled(last.map((step) => Promise.resolve().then(step)))
  return Promise.race([all.then(() => 'done'), wait(within).then(() => 'in_time')])
}
