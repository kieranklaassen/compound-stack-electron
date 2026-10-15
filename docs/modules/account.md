# Module: account

The app signs in through the person's browser, by the device grant (RFC 8628),
against a Rails app built on compound-stack-rails. The token is kept by the
shell and never reaches the page.

The server side (the routes, the approve page, the token) is in
[docs/rails-backend.md](../rails-backend.md).

## What this module is

- `serverOf(address)` answers the backend's origin, or null. It takes https,
  or plain http on this machine (`localhost`, `127.0.0.1`, `[::1]`). A
  packaged build reads `appServer` from its `package.json`. A checkout reads
  `APP_SERVER`. With no server the account's state is `off` and says
  `NO_SERVER`.
- `ask(fetch, server, path, options)` is the one request to the device API:
  JSON in and out, `redirect: 'error'`, no cache, a time limit of 8 seconds, a
  bearer token where one is given. It answers `{ status, body }`, with status
  0 where nothing answered.
- `Account#start(who)` is the person's own press (`mustAsk`). It posts
  `/device/authorizations`, holds the answer's `device_code` and `user_code`
  to their shapes, sets the state to `waiting` with the code to show, and
  opens `<server>/device/approve#<user code>` in the browser. The code travels
  after the `#`.
- It then asks `POST /device/authorizations/token` every `interval` seconds
  until it is answered. 428 means wait (and `slow_down` adds 5 seconds). 400
  with `access_denied` says the sign-in was refused. Any other 400, or the
  end of `expires_in`, says it took too long. A 200 with a token writes the
  vault and sets `signed_in`.
- `Account#openAgain(who)` opens the approve page again. `cancel()` gives a
  waiting sign-in up. A token that arrives after a cancel is ended at the
  server (`DELETE /device`).
- `Account#resume()` runs at launch: `GET /device` with the kept token. 200 is
  `signed_in`. 401 forgets the token. No answer keeps the token and says the
  state is `unknown`.
- `Account#signOut()` asks the server to end the token and forgets it whatever
  the server said.
- The states a page hears are `off`, `signed_out`, `waiting` (with `code`),
  `signed_in` (with `email`) and `unknown`. The page never hears the device
  code or the token. `Account#token()` is for the shell's own requests and is
  on no door.
- The door (`accountDoor`) answers `state`, `start`, `openAgain`, `cancel`,
  `signOut`. The page's rows mark Sign in, Open the browser again and Sign out
  as the person's own, with no tool.
- When the account's state changes, `main.mjs` tells the page and has the
  updater look.

## Files (the module boundary)

- `shell/account.mjs`: `Account`, `accountDoor`, `SAYS`.
- `shell/server.mjs`: `serverOf`, `onThisMachine`, `ask`, `NO_SERVER`,
  `SERVER_DID_NOT_ANSWER`.
- `shell/vault.mjs`: where the token is kept (see [storage](storage.md)).
- `page/app/settings_sheet.tsx`: the Account section.
- `page/app/actions.ts`: `signIn`, `openSignInAgain`, `cancelSignIn`,
  `signOut`.
- `page/app/words.ts`: `accountSays`.
- `test/shell/account.test.mjs`, `test/shell/server.test.mjs`.

## Adopt into an existing app

1. Build the server side first, from [docs/rails-backend.md](../rails-backend.md).
2. Adopt [bridge](bridge.md) and [storage](storage.md).
3. Copy `server.mjs` and `account.mjs`. Make one `Account` in the main file
   with `net.fetch`, `shell.openExternal`, a `Vault`, and the app's version.
4. Add the door. Call `account.resume()` once the window is open.
5. In the page, show the state in one line, the code while it waits, and the
   buttons. Keep the three presses that open the browser or end the token off
   the agent's tools.
6. Send every request that needs the token from the shell, through `ask`.
   Give the page no way to make one.

## Verify adoption

- `npm run test:shell` (`account.test.mjs`, `server.test.mjs`). They hand in
  a fetch and a clock and ask no server.
- `npm run test:page` ("signs in through the browser: a code to check, then
  signed in by itself").

## Gotcha: the polling outlives the press

`start` answers at once with the code. The polling runs on. Each start has an
attempt number, and an answer for an older attempt is dropped (and its token
ended), so a cancel followed by a second start cannot be signed in by the
first.

## Gotcha: `signOut` and `cancel` are not held to the press

Only `start` and `openAgain` ask `mustAsk`. Sign out has no tool in the page,
which is what keeps an agent from it. A new caller of the door is not refused.

Not run yet: no sign-in has run against a real backend. The tests answer the
device API from memory.
