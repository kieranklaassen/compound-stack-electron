# compound-stack-electron

A starter for desktop apps on Electron, and a record of how to build one well.
It is the desktop sibling of
[compound-stack-rails](https://github.com/kieranklaassen/compound-stack-rails):
the same shape (modules, a manifest, agent-executable upgrades), and the two
are meant to be used as a pair, Rails as the backend and this as the app on
the person's machine.

It is a small working app, "Compound": one window, a document with a title and
three numbers, saved to a file. The document is not the point. Every practice
below is in it, working and under test, so that the next app starts with them.

## What is in it

**A shell that is locked down by default**

- Only one file imports Electron. The rest of the shell is plain Node with
  what it needs passed in, so it is tested with `node --test` and no Electron.
- The page runs sandboxed, with context isolation, on its own scheme, under a
  strict content security policy. It cannot navigate away, open a window or be
  given a permission.
- One bridge: the page asks named doors, from a closed list. It hears ids,
  names and sentences, never a path or a token.
- What must be the person's own press is checked in the shell.
- Files are written whole. Unsaved work survives a crash. Quitting asks, and
  ends in time.

**The parts every real app needs**

- Sign-in through the browser (the device grant) against the Rails backend.
- An updater of its own: look, fetch, check, exchange. Restart is a press.
- Deep links (`compound://open/<id>`) that carry an id and nothing else.
- Packaging with the signing decided from the environment, and a check of
  what a bundle must hold.

**UX habits worth keeping**

- **Hover to learn.** Rest on any control and a tip says what it is and its
  key. Hold Option and the tip grows into the whole card: how it works, what
  to do next. The text comes from one table, which the agent reads too.
- **A press says what came of it, where the press was.** Check for updates
  turns busy, then says "Up to date. Last checked 14:02." beside the button. No
  silent success and no toast across the screen.
- **Off says why.** A control that cannot be used stays in its place and says
  the reason. Nothing is hidden.
- **Ask first, in place.** A press that cannot be undone asks on the line
  where it was pressed. Never a system alert.
- **Numbers are dragged as well as typed.** Drag for more or less, Shift for
  fine steps, click to type. A whole drag is one step of Undo.
- **One table of keys.** The menu, the keys and the tips agree, and a held
  key never opens a second dialog or flips a mode twice.
- **Nothing happens at rest.** A window that stands still runs no timer.
- **Light, dark, reduced motion**, from tokens.

**Agent-native from the start**

- Everything a person can do is an action that a control and a tool both
  call. A test fails a control that has no row and no tool.

## Stack

| | |
| --- | --- |
| Shell | Electron 44, ES modules, no framework |
| Page | React 19, TypeScript, Vite |
| Tests | `node:test` for the shell, Vitest for the page, Playwright driving Electron for launches |
| Packaging | electron-builder, fuses on |
| Backend | [compound-stack-rails](https://github.com/kieranklaassen/compound-stack-rails) |

## Quickstart

```sh
git clone https://github.com/kieranklaassen/compound-stack-electron my-app
cd my-app
npm install
npm run dev
```

With a Rails backend on this machine:

```sh
APP_SERVER=http://localhost:3100 npm run dev
```

Checks:

```sh
npm run check        # types, page tests, shell tests: no Electron needed
npm run test:e2e     # launches the real app (xvfb-run -a in front on Linux)
```

## With the Rails stack

Rails owns accounts, data and the published builds. The app holds one device
token, in the shell, and talks to one server.

[docs/rails-backend.md](docs/rails-backend.md) has the whole pairing: the wire
under `/device`, the device-grant sign-in with the approve page, the update
door and the publish task, presigned uploads, and a deep link from a Rails
page. The Ruby there is a sketch to build from. compound-stack-rails does not
ship those endpoints yet.

## Modules

Each module has a doc in [docs/modules/](docs/modules/) with what it is, its
files, how to adopt it into an existing app and how to verify that.

| Module | What it is |
| --- | --- |
| [shell](docs/modules/shell.md) | The locked window, the page's scheme, menus, dialogs, quitting |
| [bridge](docs/modules/bridge.md) | Doors, the preload, the person's own press |
| [storage](docs/modules/storage.md) | Whole-file writes, settings, documents by id, the vault |
| [recovery](docs/modules/recovery.md) | Unsaved work survives a crash |
| [account](docs/modules/account.md) | Sign-in through the browser |
| [updates](docs/modules/updates.md) | The app updates itself |
| [deep_links](docs/modules/deep_links.md) | An address opens a thing by id |
| [packaging](docs/modules/packaging.md) | Builds, signing, the bundle check |
| [helpers](docs/modules/helpers.md) | Native helper processes (doc-first) |
| [agent_surface](docs/modules/agent_surface.md) | Rows, actions, tools, coverage |
| [mcp_bridge](docs/modules/mcp_bridge.md) | An outside agent reaches the page's tools (doc-first) |
| [help](docs/modules/help.md) | Hover to learn, Option for more, Show me |
| [feedback](docs/modules/feedback.md) | Said where pressed, ask first, notices, off says why |
| [number_fields](docs/modules/number_fields.md) | Typed and dragged |
| [keys](docs/modules/keys.md) | One key table |
| [at_rest](docs/modules/at_rest.md) | No work while nothing moves |
| [theme](docs/modules/theme.md) | Tokens, light and dark, reduced motion |
| [testing](docs/modules/testing.md) | Three layers and stand-ins |
| [ci](docs/modules/ci.md) | The gate |
| [agent-conventions](docs/modules/agent-conventions.md) | AGENTS.md, concepts, solutions, the manifest |

## How upgrades flow

As in the Rails stack. A clone carries `.template-manifest.yml` with the
template's version and the modules it adopted. Each change to the template
ships an entry in [docs/changelog/](docs/changelog/) that an agent can
execute. An upgrade agent applies the entries newer than the app's version,
for its modules, and opens a PR. Never a direct push.

## What has run, and what has not

- `npm run check` passes: types, the page's tests and the shell's tests.
- The launch tests pass in Electron 44 on Linux, under a virtual display.
- **Nothing has run on a Mac.** No build has been packaged, signed or
  notarized, and the updater's real hands (`hdiutil`, `codesign`, `ditto`)
  have never run. Those parts are written to be checked on a Mac first.
  [docs/distributing.md](docs/distributing.md) says what to try.

## For agents

Read [AGENTS.md](AGENTS.md) first, then the module doc for the area you are
changing. [CONCEPTS.md](CONCEPTS.md) has the vocabulary.

## License

MIT. See [LICENSE](LICENSE).
