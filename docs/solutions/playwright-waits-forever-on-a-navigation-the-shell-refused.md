---
title: Playwright waits forever on a navigation the shell refused
module: testing
date: 2026-10-15
problem_type: gotcha
component: test/e2e/launch.test.mjs
tags: [playwright, electron, will-navigate, e2e]
applies_when: A launch test sends the window to an outside address to show that the shell refuses it.
---

## Problem

One launch test sets `window.location.href` to an outside address. The shell
refuses, as it should: the window stays on the app's own page. But each
locator call after that in the same file hung, with Playwright reporting that
it was waiting for navigation to finish.

## Cause

The shell prevents the navigation in its `will-navigate` listener
(`shell/main.mjs`, by `staysInTheWindow` in `shell/navigation.mjs`). The page
never leaves. Playwright saw the navigation start and was never told that it
ended or failed, so it held later actions on that page behind it.

## Solution

The test is the last one in `test/e2e/launch.test.mjs`, and a comment there
says why. After it sets the address it asks nothing more of the page by a
locator. It waits a moment and reads `page.url()`, which is answered at once:

```js
await page.evaluate(() => {
  window.location.href = 'https://example.com/'
})
await page.waitForTimeout(300)
assert.equal(new URL(page.url()).protocol, 'app:')
```

## Prevention

- Keep that test last in its file. A new test in the file goes above it.
- A second test that makes the shell refuse a navigation gets a launch of its
  own (`launch()` in `test/e2e/support.mjs`), and is the last thing asked of it.
- The rule itself needs no launch: `test/shell/navigation.test.mjs` holds
  `staysInTheWindow` and `opensOutside` in plain Node.
