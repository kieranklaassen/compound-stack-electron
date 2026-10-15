---
title: A promise is always truthy
module: updates
date: 2026-10-15
problem_type: bug
component: shell/main.mjs
tags: [async, updater, account, token, wiring]
applies_when: A hand wired in `shell/main.mjs` reads something from the account or from a kept file.
---

## Problem

The updater's look hand read the device's token and went on only if there was
one. Signed out, it went on anyway. The request for an update went out with a
promise in the place of its bearer token.

## Cause

`Account#token()` (`shell/account.mjs`) answers what the vault reads, which is a
promise. The hand did not await it:

```js
look: () => {
  const token = account.token()          // a promise
  if (!token) return { signedOut: true } // never holds
  ...
}
```

A promise is an object, so `!token` is false whether or not a token is kept.

The line was in `shell/main.mjs`, the one file that imports Electron. No Node
test loads that file, so no test read the line. The modules beside it were all
tested and all right.

## Solution

The hand is `async` and awaits the token:

```js
look: async () => {
  const token = await account.token()
  if (!token) return { signedOut: true }
  return lookForUpdate(/* the shell's request with the token */)
}
```

## Prevention

- A hand that touches the account is `async`, and what it reads is awaited
  before it is tested.
- `shell/main.mjs` stays thin. It wires parts together and decides nothing. A
  line there with an `if` in it is a line no Node test reaches, so the decision
  belongs in a module beside it that has a test. `lookForUpdate` in
  `shell/update-look.mjs` already answers `signedOut` for a 401.
- `tsc` does not read the `.mjs` files of the shell, so nothing flags a promise
  used as a condition there. Read for it in review.
