# Module: deep_links

The app's own address, `compound://open/<id>`. Any page, mail or process on
the computer can send one, so it is read by one strict function, carries an id
and nothing else, and does only what a press in the app could do.

## What this module is

- `LINK_SCHEME` is `compound`.
- `linkOf(address)` answers `{ open: id }` or null. It takes only the host
  `open`, an id of lowercase letters, digits and hyphens up to 64 characters,
  and an address of at most 200 characters. A query, a fragment, a user, a
  password or a port makes it null.
- `linkAmong(argv)` finds the address among a launch's arguments, where
  Windows and Linux hand one over.
- What reads as nothing opens nothing and says nothing. No part of an address
  is kept or logged.
- `main.mjs` hears a link three ways: `open-url`, the arguments of a second
  instance, and the arguments of the launch. `follow(link)` holds a link until
  the page has loaded, then tells the page (`shell:tell` with `about: 'link'`).
- The page decides what a link does. In the template `linkFollowed(id)` closes
  any sheet and shows a kept notice that names the id. It opens nothing.
- Only a packaged build takes the scheme for the whole computer
  (`app.setAsDefaultProtocolClient` behind `app.isPackaged`). The package
  script declares it in `protocols`.

## Files (the module boundary)

- `shell/app-link.mjs`: `LINK_SCHEME`, `linkOf`, `linkAmong`.
- `shell/main.mjs`: `follow`, the `open-url` and `second-instance` handlers.
- `page/app/session.ts`: `followShell` hands a link to the page's function.
- `page/app/actions.ts`: `linkFollowed`.
- `bin/package.mjs`: the `protocols` entry.
- `test/shell/app-link.test.mjs`.

## Adopt into an existing app

1. Copy `app-link.mjs`. Set `LINK_SCHEME` to your scheme and the host to the
   one thing your link does.
2. In the main file, read every address through `linkOf` and nothing else.
   Handle `open-url`, `second-instance` and the launch's arguments.
3. Hold a link until the page has loaded, then tell the page the id.
4. In the page, run the same action a button runs for that id, behind the same
   refusals. Add no power a press does not have.
5. Declare the scheme in the package's `protocols`. Register it at run time
   only in a packaged build.

## Verify adoption

- `npm run test:shell` (`app-link.test.mjs`).

## Gotcha: a link is not a credential and not a command

Never put a token, a path or an account in the address, and never let a link
do what would be the person's own press (see [bridge](bridge.md)). The id is a
name the page looks up among what the signed-in person can already open.

Not run yet: no packaged build has registered the scheme, and no address has
been followed from a browser. The reader is tested in Node.
