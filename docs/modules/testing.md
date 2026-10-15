# Module: testing

Three layers. The page is tested in jsdom on a stand-in shell. The shell is
tested in Node with no Electron. The whole app is launched in a real Electron
by the launch tests. No test touches the real system.

## What this module is

- `npm run test:page`: Vitest, in jsdom, over `page/**/*.test.{ts,tsx}`
  (`vitest.config.ts`). The page runs on `standInBridge()`: with no
  `window.shell`, `theBridge()` makes one, and a test puts its own in with
  `useBridge`. `page/test_setup.ts` cleans the document and `localStorage`
  after each test.
- A page test steers the stand-in through `standIn`: `asks` (every ask, with
  `askedBy`), `account`, `updates`, `settings`, `kept`, `saved`, `nextUpdate`,
  `pressed` (whether an ask counts as the person's press), `approve(email)`
  and `tell(told)`.
- `npm run test:shell`: `node --test` over `test/shell/*.test.mjs` and
  `test/template/*.test.mjs`. No Electron binary and no display. Each shell
  module takes its dependencies as arguments (a fetch, a clock, a dialog
  function, the hands), and the test hands in its own.
- `npm run types`: `tsc` twice, for the page (`tsconfig.app.json`) and for the
  two config files (`tsconfig.node.json`).
- `npm run check` is the gate: types, the page tests, the shell tests. It
  needs no Electron binary and no display.
- `npm run test:e2e`: builds the page, then launches the real shell through
  `playwright-core` (`_electron.launch`), one test file at a time. It needs
  Electron's binary and a display. On Linux run it as
  `xvfb-run -a npm run test:e2e`.
- The harness is the launch tests' word. `launch()` in `test/e2e/support.mjs`
  sets `COMPOUND_HARNESS=1`, `COMPOUND_USER_DATA` to a temp folder the test
  made, and `APP_SERVER` to nothing. Under the harness `main.mjs` keeps the
  app's files in that folder, hands the vault no keychain, and does not show
  the window (`COMPOUND_HARNESS_SHOW=1` shows it). A packaged app never reads
  the harness.
- `answerDialogs(app, { save, open, message })` puts a stand-in in each system
  dialog's place, so no test waits on a dialog nobody can answer.
- `launch()` answers `{ app, page, userData, close }`. `close({ keep: true })`
  leaves the folder, so a second launch can read what the first kept.
- Stand-ins for every hand. The updater's hands under the harness are
  `standInHands()`, which copy folders, say yes and note every ask. The
  account's browser, fetch and clock are handed in. No test, script or agent
  mounts a disk image, runs `codesign`, opens a browser or asks a server.
- Some tests read source instead of running it: `coverage.test.ts` (controls,
  rows, tools), `dialog-place-holds.test.mjs` (who imports Electron, who shows
  a dialog), `menu.test.mjs` (the menu's asks against the page's commands),
  `shell-parses.test.mjs` (every shell file parses).

## Files (the module boundary)

- `vitest.config.ts`: jsdom, the include pattern, the setup file.
- `page/test_setup.ts`: jest-dom, cleanup.
- `page/stand_in_bridge.ts`: the stand-in shell.
- `page/shell.ts`: `theBridge`, `useBridge`.
- `test/shell/shell-parses.test.mjs`: one of the shell tests. The others sit
  beside it, one a module.
- `test/e2e/support.mjs`: `launch`, `answerDialogs`, `root`.
- `test/e2e/launch.test.mjs`, `test/e2e/recovery.test.mjs`.
- `shell/update-hands.mjs`: `standInHands`, `handsFor`.
- `shell/main.mjs`: the harness lines.
- `tsconfig.app.json`, `tsconfig.node.json`.
- `package.json`: the scripts.

## Adopt into an existing app

1. Split the scripts as in `package.json`: `types`, `test:page`, `test:shell`,
   `check`, `test:e2e`. Keep `test:e2e` out of `check`.
2. Give the page a bridge it can be handed (see [bridge](bridge.md)) and copy
   the stand-in. Answer every door in it.
3. Make every shell module take what touches the system as an argument. Write
   its test with `node:test` and nothing of Electron.
4. Add the harness to the main file: the two variables, read only where the
   app is not packaged. Put a stand-in wherever a launch would touch the
   system.
5. Copy `test/e2e/support.mjs`. Start each launch test with `launch()` and
   answer dialogs with `answerDialogs`.
6. Add `playwright-core` as a dev dependency. It drives Electron itself and
   downloads no browser.

## Verify adoption

- `npm run check` passes with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` set at
  `npm ci`.
- `xvfb-run -a npm run test:e2e` passes on Linux.

What has run: the page tests and the shell tests pass. The launch tests passed
in Electron on Linux under xvfb. Not run yet: the launch tests on any other
platform.

## Gotcha: `--no-sandbox` on Linux

`launch()` passes `--no-sandbox` to Electron on Linux, where a container often
cannot give Chromium its sandbox. That is the process sandbox of the test run.
The window's `sandbox: true` is unchanged.

## Gotcha: a refused navigation hangs Playwright

Playwright waits on a navigation the shell refused. The test that sets
`window.location` is last in its file on purpose, and nothing is asked of the
page after it. `docs/solutions/` has the write-up.

## Gotcha: no launch test drives an update

`COMPOUND_HARNESS_APP` names a folder to stand in the app's place and turns
the stand-in hands on. No launch test sets it yet. The updater is covered by
the Node tests alone.
