# Module: recovery

Unsaved work survives a crash. The shell keeps the open document in a file of
its own, and that file goes only on the person's word.

## What this module is

- The page hands the shell the document whenever it changes
  (`keepShellTold()` in `page/app/keeper.ts`). It also says whether the
  document is unsaved (`app.unsaved`), so a quit can ask. The page does not
  throttle and runs no clock.
- `Recovery#keep(document)` holds the latest document and writes it no more
  often than once in `KEEP_EVERY_MS` (a second). It answers false for a
  document over `MOST_BYTES` (8 MiB), which is not kept.
- `Recovery#flush()` writes what is held now. A quit, the quit's question and
  a page that died all call it first.
- The file is `recovery.json` in the app's own folder. It is never the
  document's file. It is written with `writeWhole`.
- `Recovery#take()` answers `{ state: 'none' }`, `{ state: 'kept', document }`
  or `{ state: 'unread', aside }`. A file this build cannot read is set aside
  under another name, never removed.
- `Recovery#drop()` removes the kept copy. It is called in three places: a
  save that wrote a file, Don't Save at the quit's question, and Discard on
  the recovery screen.
- The door's `drop` is the person's own press (`mustAsk`). No tool throws kept
  work away.
- At launch the page asks once (`lookForKept()`), and `RecoveryScreen` offers
  kept work before anything else: Recover, or Discard. Discard asks first in
  its own place (see [feedback](feedback.md)). Recovered work is placed as
  unsaved, with no file.
- A kept copy the page cannot read as a document shows one sentence and
  Continue. Nothing is removed.

## Files (the module boundary)

- `shell/recovery.mjs`: `Recovery`, `KEEP_EVERY_MS`, `MOST_BYTES`.
- `shell/assemble.mjs`: the `recovery` door (`keep`, `take`, `drop`).
- `shell/main.mjs`: the flush at `render-process-gone`, before the quit's
  question, and in `will-quit`.
- `page/app/keeper.ts`: `keepShellTold`.
- `page/app/recovery_screen.tsx`: `waiting`, `lookForKept`, `RecoveryScreen`.
- `test/shell/recovery.test.mjs`, `test/e2e/recovery.test.mjs`, and the two
  recovery cases in `page/app/app.test.tsx`.

## Adopt into an existing app

1. Adopt [storage](storage.md) first: `writeWhole` and `readKept`.
2. Copy `recovery.mjs`. Make one `Recovery` on a file under `userData`.
3. Add the door with `keep`, `take` and `drop`, and hold `drop` to `mustAsk`.
4. Call `recovery.drop()` after a save that wrote a file.
5. Call `recovery.flush()` when the page's process is gone, before the quit's
   question is shown, and in what `quitWhenDone` waits for.
6. In the page, subscribe to the document's store and hand each new document
   to `recovery.keep`, as `keeper.ts` does.
7. At launch, ask `recovery.take()` once and show a screen with Recover and
   Discard before the person can do anything else.

## Verify adoption

- `npm run test:shell` (`recovery.test.mjs`).
- `npm run test:page` ("offers kept work before anything else, and Discard
  asks first").
- `npm run test:e2e`: `recovery.test.mjs` types a title, ends the process
  without a save, launches again on the same folder and recovers it.

## Gotcha: the kept copy holds the document and nothing else

The file is `{ version: 1, document }`. The file id, the undo steps and the
view are not kept. Recovered work has no file until it is saved.

## Gotcha: a write that fails is passed over

`flush()` catches a failed write and says nothing. The next change writes
again. If your app must say that work is not being kept, add it there.
