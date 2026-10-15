# Module: bridge

How the page reaches the shell: one IPC channel in, one out, and a closed list
of what a page may ask. The preload, not the page, says whether a press was
behind an ask.

## What this module is

- Two channels. `shell:ask` carries one ask of a door and is answered.
  `shell:tell` carries what the shell tells the page with nothing asked.
  `main.mjs` listens to nothing else.
- `shell/preload.cjs` exposes `window.shell` with two functions, `ask` and
  `on`, and nothing of Electron or Node.
- A door is a name and its methods (`Doors#add`). `Doors#answer(ask, who)`
  finds the method and answers `{ ok: true, value }` or
  `{ ok: false, refused, code }`. `refused` is a sentence written for a
  person.
- An error's own words never reach the page. A door's method throws
  `Refused(sentence, code)` to say why not. Any other error is answered with
  `DID_NOT_WORK` ("That did not work.") and only its name is logged.
- `shell/doors.json` is the closed list: door names and method names.
  `assemble(parts)` builds every door in one place. `test/shell/assemble.test.mjs`
  holds `Doors#list()` to the file, and `page/shell.test.ts` holds the page's
  typed side to the same file.
- `main.mjs` answers `shell:ask` only for the window's main frame, and only
  where that frame's address is the app's own page. Anything else is refused
  with the code `not_the_page`.
- Whose press it was: the preload reads `navigator.userActivation.isActive` in
  its isolated world and sends it as `who.gesture`. An ask a tool made names
  the agent as `who.askedBy`. `ownPress(who)` is true only for a gesture with
  no agent named. `mustAsk(who)` is its opposite. A door that needs the
  person's press refuses with `NOT_THE_PRESS`.
- What needs the press in the template: `account.start`, `account.openAgain`,
  `recovery.drop`, `updates.download`, `updates.restart`.
- The page's side is typed in `page/shell.ts`: `Shell`, `Answer<T>`, `Told`,
  `shell()` for the person's page, `shellFor(agent)` for a tool, and
  `valueOf(answer)`, which throws the refusal's sentence as a `Sentence`.
  Import from there. Nothing else reads `window.shell`.
- `page/stand_in_bridge.ts` answers every door from memory, so the page runs
  in Vitest and in a plain browser. A test steers it through `standIn`.
- The page hears ids and names, never a place on the disk, a token or an
  address into the backend.

## Files (the module boundary)

- `shell/doors.mjs`: `Doors`, `Refused`, `DID_NOT_WORK`.
- `shell/doors.json`: the closed list.
- `shell/assemble.mjs`: `assemble`.
- `shell/preload.cjs`: `window.shell.ask`, `window.shell.on`.
- `shell/press.mjs`: `ownPress`, `mustAsk`, `NOT_THE_PRESS`.
- `shell/main.mjs`: the `ipcMain.handle('shell:ask', …)` block and `tell`.
- `page/shell.ts`: the typed bridge.
- `page/stand_in_bridge.ts`: `standInBridge`.
- `test/shell/doors.test.mjs`, `assemble.test.mjs`, `press.test.mjs`,
  `page/shell.test.ts`.

## Adopt into an existing app

1. Copy `doors.mjs`, `press.mjs` and `preload.cjs`. Set the preload in the
   window's `webPreferences`.
2. Replace every `ipcMain.handle` and `ipcMain.on` with the one handler for
   `shell:ask`. Keep its check of the sender's frame.
3. Write each thing a page may ask as a method of a door. Have it throw
   `Refused` with a sentence for what it will not do.
4. List the doors in `doors.json` and build them in `assemble.mjs`. Copy
   `assemble.test.mjs` so the list and the code cannot part.
5. For each method, decide whether it must be the person's own press. Where it
   must, begin it with `if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, …)`.
6. Copy `page/shell.ts` and `page/stand_in_bridge.ts`. Type each door in
   `Shell` and answer it in the stand-in. Copy `page/shell.test.ts`.
7. Replace every read of `window` for the shell with `shell()`.

## Verify adoption

- `npm run test:shell` (doors, assemble, press).
- `npm run test:page` (`page/shell.test.ts`).
- `npm run test:e2e`: `launch.test.mjs` checks that `window.shell` has the
  keys `ask` and `on` only, that `require` and `process` are undefined, and
  that a door off the list is refused.

## Gotcha: a new door is written in four places

`doors.json`, `assemble.mjs`, the `Shell` interface in `page/shell.ts`, and
the stand-in. The two tests catch a missing name in the list, the shell and
the stand-in. Nothing catches a wrong type in `Shell`.

## Gotcha: a sandboxed preload is CommonJS

`preload.cjs` is the one CommonJS file. A sandboxed preload cannot be an ES
module.

## Gotcha: the stand-in's refusal reads differently

The stand-in refuses a press that was not the person's with its own sentence,
not the shell's `NOT_THE_PRESS`. Assert on `ok: false`, not on the words, in a
test that must hold against both.
