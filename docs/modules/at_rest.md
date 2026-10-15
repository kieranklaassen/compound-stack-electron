# Module: at_rest

A window that stands still does no work. Nothing runs on a timer or an
animation frame while the person does nothing. This module has no file of its
own: it is a rule, the places in the code that keep it, and the tests that
hold it.

## What this module is

- A store tells nobody when it is set to what it already holds.
  `createStore` in `page/store.ts` compares with `Object.is` and returns.
  `setView` answers the same object when nothing changed.
- The page asks the shell on no clock. `followShell` in `page/app/session.ts`
  fills the stores once and then hears `shell:tell`.
- The updater looks on a timer of the shell's: `lookTimes` in
  `shell/updater.mjs`, one interval of six hours, and a look on coming to the
  front after an hour away. The page does not poll.
- The updater tells the page only a state that is another one than the last
  it told (`Updater#tell` compares the state as JSON).
- The keeper runs no clock. `keepShellTold` in `page/app/keeper.ts` hears the
  editor's store and hands the document over only when it is another one. The
  shell writes it no more often than once a second (`KEEP_EVERY_MS` in
  `shell/recovery.mjs`), with one timeout that exists only while a document
  waits to be written.
- The help watch keeps no timer at rest. One timeout runs only while the
  pointer rests on a control that has not shown its tip.
- A drag that lands on the number already there calls nothing
  (`use_scrub.ts`).
- Every listener for the whole window is added once and put away when the app
  goes (`App` in `page/app/app.tsx`).
- The timers that do exist are one-shot and end by themselves: a brief
  notice's four seconds, a ring's eight seconds, a tip's rest, one animation
  frame after Show me opens a sheet and one after Escape in a number field.
- There is no `setInterval` and no animation-frame loop in the page.

## Files (the module boundary)

No dedicated file. The rule is kept in:

- `page/store.ts`: `createStore`.
- `page/app/view.ts`: `setView`.
- `page/app/session.ts`: `followShell`.
- `page/app/keeper.ts`: `keepShellTold`.
- `page/help/watch.ts`: the one timeout.
- `shell/updater.mjs`: `lookTimes`, `Updater#tell`.
- `shell/recovery.mjs`: `KEEP_EVERY_MS`.

And held by:

- `page/app/app.test.tsx`: "does no work when it stands still: no timer is
  left running".
- `page/help/watch.test.ts`: "keeps no timer at rest".
- `test/shell/updater.test.mjs`: "the page is told only a state that is
  another one than the last", and "lookTimes: at launch, every six hours, and
  on coming back after an hour away".
- `test/shell/recovery.test.mjs`: the once-a-second write.

## Adopt into an existing app

1. Search the page for `setInterval`, `requestAnimationFrame` and a
   `setTimeout` that sets itself again. For each, find the event that could
   start the work, and start it from that.
2. Move every poll of the backend or the system into the shell, on one timer,
   and tell the page only when the answer changed.
3. Make every store return early when it is set to what it holds.
4. Throttle a write in the place that writes, with a timeout that exists only
   while something waits.
5. Add the two page tests: mount the app, let every one-shot timer run out
   with fake timers, and assert that none is left.

## Verify adoption

- `npm run test:page`
- `npm run test:shell`
- In the app's inspector (a checkout has Develop > Toggle Developer Tools),
  record the page while nothing is touched. No task repeats.

## Gotcha: a loop that draws

An app that draws frames (a preview, a meter) needs a loop while something
moves. Have it stop when a frame is the same picture as the last, and start
again from the event that changes the picture. The template has no such loop,
so nothing in it shows how. The rule still holds: at rest, no frame is asked
for.
