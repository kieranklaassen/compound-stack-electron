---
title: A second quit after a prevented will-quit never ends
module: shell
date: 2026-10-15
problem_type: bug
component: shell/main.mjs
tags: [electron, quit, will-quit, linux, playwright]
applies_when: The shell prevents `will-quit` to finish its last writes and then has to end the app.
---

## Problem

The app did not end. The window was gone and the process stayed. In the launch
tests Playwright's `app.close()` hung until the test timed out.

This was seen under Electron 44 on Linux. Nothing has run on a Mac, so how
macOS behaves here is not known.

## Cause

The shell has work to finish at a quit: the last write of the recovery, and an
update's exchange. So its `will-quit` listener calls `event.preventDefault()`,
waits for that work with `quitWhenDone` (`shell/quit.mjs`), and then has to hand
the quit on.

The first version handed it on by calling `app.quit()` a second time. After a
prevented `will-quit`, that second quit was not answered. No second `will-quit`
came, and the app sat with no window.

## Solution

In `shell/main.mjs`, the app ends with `app.exit(0)` once the last work is done:

```js
app.on('will-quit', (event) => {
  if (lastDone) return
  event.preventDefault()
  lastDone = true
  void quitWhenDone([() => recovery.flush(), () => updater.atQuit()]).then(() => app.exit(0))
})
```

`app.exit` runs no more quit events, which is right here: the windows are
closed, the question about unsaved work was asked at the window's `close`, and
all that the shell must finish is in the list `quitWhenDone` waits for.
`quitWhenDone` has a limit of five seconds, so the exit always comes.

## Prevention

- What the shell must finish at a quit goes in the list handed to
  `quitWhenDone`, never after it. Nothing runs after `app.exit`.
- Do not call `app.quit()` from inside a `will-quit` that was prevented.
- The launch tests close the app at the end of each file. A quit that hangs
  shows there as a timeout.
