# Module: shell

The Electron main process. One file wires Electron together. Everything it
decides is asked of a small module beside it that knows no Electron and has a
Node test.

## What this module is

- Only `shell/main.mjs` imports Electron. `shell/preload.cjs` requires it, and
  no other file of `shell/` names it. `test/shell/dialog-place-holds.test.mjs`
  scans the folder and fails on a third.
- Each module beside `main.mjs` is plain Node with its dependencies handed in
  (a fetch, a clock, a dialog function), so `npm run test:shell` runs it with
  no Electron binary.
- The page is served on a scheme of its own, `app://page/index.html`
  (`SCHEME`, `HOST`, `PAGE_URL` in `page-scheme.mjs`). It is never loaded from
  `file://` or from a server. `fileFor(root, address)` answers a file only
  inside the page's folder and only of a known type. Anything else is a 404.
- Every answer of the scheme carries the policy `CSP`: `default-src 'none'`,
  scripts, styles and fonts from `'self'`, no inline script, no eval. It also
  carries `x-content-type-options: nosniff`.
- The window's `webPreferences` are locked: `contextIsolation: true`,
  `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- The window goes nowhere but its own page. `staysInTheWindow(address)` holds
  `will-navigate`. `setWindowOpenHandler` always denies, and hands an address
  to the person's browser only where `opensOutside(address, server)` takes it:
  plain https, or the origin of the backend the app is set to. `<webview>` is
  refused.
- `PageWatch#gone()` answers `reload` or `stop` when the page's process dies.
  The shell writes the recovery first, then loads the page again. A page that
  dies more than `RELOADS` (3) times within `WITHIN_MS` (a minute) is left.
- `menuOf({ name, mac, dev })` is the menu as plain data. An item is a role, a
  separator, or a label with `ask`. `main.mjs` sends an `ask` to the page,
  which runs the command of that name. The menu runs no copy of an action.
  `asksOf(menu)` lists every `ask` for the test.
- Every system dialog is shown in one of three functions of `main.mjs`: `pick`,
  `pickToSave`, `askDialog`. Each asks `dialogWindow()`, which asks
  `dialogPlace({ window, inTheWay })`. A window that is there is restored,
  shown and focused, and the dialog hangs from it. `inTheWay` is for a shell
  that has put something of its own over the screen on purpose: nothing comes
  forward then.
- Closing the window with unsaved work asks Save, Cancel, Don't Save
  (`leaving`, `QUIT_BUTTONS`, `answerOf` in `quit.mjs`). The recovery is
  flushed before the question is shown. Save asks the page to save and waits
  for it to say the document is saved. Don't Save drops the recovery.
- A quit ends in time. `will-quit` is prevented once, `quitWhenDone(last)`
  waits for the last things (the recovery's flush, `updater.atQuit()`) and
  never longer than `QUIT_WITHIN_MS` (5 seconds), and then `main.mjs` ends
  with `app.exit(0)`.
- The page is given no permission. The session's request handler answers
  false and its check handler answers false.
- One instance runs (`requestSingleInstanceLock`). A second launch brings the
  window forward.
- `redact(text)` takes places on the disk, credentials and the query of an
  address out of a line, and cuts it to 400 characters.

## Files (the module boundary)

- `shell/main.mjs`: the wiring. The window, the scheme, the channel, the menu,
  the dialogs, the quit.
- `shell/page-scheme.mjs`: `SCHEME`, `HOST`, `PAGE_URL`, `CSP`, `fileFor`.
- `shell/navigation.mjs`: `staysInTheWindow`, `opensOutside`.
- `shell/page-watch.mjs`: `PageWatch`, `RELOADS`, `WITHIN_MS`.
- `shell/menu.mjs`: `menuOf`, `asksOf`.
- `shell/dialog-place.mjs`: `dialogPlace`.
- `shell/quit.mjs`: `leaving`, `QUIT_BUTTONS`, `answerOf`, `quitWhenDone`,
  `QUIT_WITHIN_MS`.
- `shell/redact.mjs`: `redact`.
- `bin/dev.mjs`: `npm run dev`. Builds the page, watches it, starts the app.
- `test/shell/page-scheme.test.mjs`, `navigation.test.mjs`,
  `page-watch.test.mjs`, `menu.test.mjs`, `dialog-place.test.mjs`,
  `dialog-place-holds.test.mjs`, `quit.test.mjs`, `redact.test.mjs`,
  `shell-parses.test.mjs`.

## Adopt into an existing app

1. Move every decision out of your main file into a module that imports no
   Electron and takes what it needs as arguments. Leave the wiring.
2. Copy `page-scheme.mjs`. Register the scheme as privileged before the app is
   ready, and answer it with `protocol.handle`, sending `CSP` on every answer.
   Load `PAGE_URL` in the window.
3. Set the four `webPreferences` above. Remove any `nodeIntegration` and any
   `remote` use.
4. Copy `navigation.mjs`. Hold `will-navigate` to `staysInTheWindow`, deny
   every `window.open`, and prevent `will-attach-webview`.
5. Copy `dialog-place.mjs` and the three functions `pick`, `pickToSave`,
   `askDialog` with `dialogWindow`. Route every `dialog.show…` through them.
6. Copy `quit.mjs` and the `close` and `will-quit` handlers. Put whatever must
   finish at a quit in the list `quitWhenDone` waits for.
7. Copy `menu.mjs` and build the menu from its data. Give each item an `ask`
   that names a command of the page (see [keys](keys.md)).
8. Refuse every permission in the session's two handlers.
9. Copy the tests named above and make them pass.

## Verify adoption

- `npm run test:shell`
- `npm run test:e2e` (needs Electron and a display). `test/e2e/launch.test.mjs`
  checks the scheme, the policy, a path outside the page, and that the window
  goes nowhere else.

## Gotcha: `app.exit(0)` ends the quit

After a prevented `will-quit`, a second `app.quit()` is not answered on every
platform. So `main.mjs` calls `app.exit(0)` once the last things are done.
Anything added after `quitWhenDone` does not run.

## Gotcha: a page that keeps dying is left with nothing said

`PageWatch` answers `stop` after the third reload in a minute, and `main.mjs`
then does not reload. Nothing tells the person. Add what your app should show
there.

## Gotcha: `redact` is not wired in

`main.mjs` does not import `redact.mjs`. The doors log only an error's name.
Put a line a library, a helper or the system wrote through `redact` before you
print or keep it.

## Gotcha: the dialog scan reads top-level functions

`dialog-place-holds.test.mjs` finds the function a `dialog.show` line stands
in by a line that starts with `function` or `async function` and one that
starts with `}`. A dialog in a nested function or an arrow at the top level
fails it. That is the intent: add a dialog as a fourth top-level function and
the test tells you to route it through the three.
