# AGENTS.md

Canonical, tool-agnostic guide for agents and humans working in this repo.
`CLAUDE.md` is a symlink to this file.

## Architecture in one line

The shell owns the system; the page asks it through one bridge of named doors.
A page never touches the disk, the network's credentials or Electron, and the
shell never draws.

## Local development

```sh
npm install
npm run dev                                        # builds the page, watches it, starts the app
APP_SERVER=http://localhost:3100 npm run dev       # with a Rails backend on this machine
```

- Gate before a PR: `npm run check` (tsc twice, Vitest, node:test). It needs no
  Electron binary and no display.
- Launch tests: `npm run test:e2e` (`xvfb-run -a` in front on Linux). Run them
  when the shell, the bridge or a whole flow changes.
- Node is the version in `.node-version`.

## Git workflow guardrail

**Never commit or push to `main`.** Branch first (`feat/…`, `fix/…`), commit
there, and open a PR.

## The rules every change keeps

Each has a module doc with the detail. Read the doc before changing the area.

**Shell** ([shell](docs/modules/shell.md), [bridge](docs/modules/bridge.md))

- Only `shell/main.mjs` imports Electron. Everything else in `shell/` is plain
  Node with what it needs passed in, so `node --test` covers it.
- The window is locked: `contextIsolation`, `sandbox`, no Node in the page, the
  page on its own scheme under a CSP header, no navigation away, no new
  windows, every permission refused. Loosen none of it for convenience.
- A new thing a page may ask is a method of a door: in `shell/doors.json`, in
  `shell/assemble.mjs`, typed in `page/shell.ts`. There is no second channel.
- The page hears ids, names, sizes, states and sentences. Never a path, a
  token, a signed address or a library's error text.
- What must be the person's own press is checked in the shell (`mustAsk`),
  with the press read in the preload. A page's word that it was pressed counts
  for nothing.
- Every system dialog goes through the three call sites in `main.mjs` and
  hangs from the window. A test fails a fourth.
- A file the shell keeps is written whole: partial name, flush, rename
  (`shell/whole-file.mjs`). Write none another way.
- What touches the system is a hand: passed in, real only when packaged,
  a stand-in under the harness. No test, script or agent runs a real one.

**Page** ([agent_surface](docs/modules/agent_surface.md), [help](docs/modules/help.md), [feedback](docs/modules/feedback.md))

- Everything a person can do is an action (`page/app/actions.ts`) that a
  control and a tool both call. A new control needs its row in
  `page/agent/rows.ts`, `data-action="<row id>"`, and a tool or the mark that
  it is the person's own. `npm run check` fails without them.
- A row carries its help. Write no help text and no `title` in a component.
- A press says what came of it where the press was: busy, then a sentence
  (`usePressed`, `Said`). No spinner without words, no silent success.
- A control that cannot be used stays where it is, off, and says why
  (`aria-disabled`, `data-says`). Never hide it.
- A question is asked in place (`AskFirst`). Never `confirm()` or `alert()`.
- Every sentence a person reads is written once (`page/app/words.ts`, the
  rows). Never show an error's own message.
- A number field is typed in and dragged, and a drag is one step of Undo
  ([number_fields](docs/modules/number_fields.md)). A new number field gets
  its drag in the build that adds it.
- One table says what a key does (`page/keys/keys.ts`). A held key runs
  once what opens a dialog or changes a mode ([keys](docs/modules/keys.md)).
- A window that stands still does no work: no timer and no animation frame at
  rest ([at_rest](docs/modules/at_rest.md)).
- Colours and sizes are tokens (`page/theme/tokens.css`). Light, dark and
  reduced motion all work ([theme](docs/modules/theme.md)).

**Account, updates, links** ([account](docs/modules/account.md), [updates](docs/modules/updates.md), [deep_links](docs/modules/deep_links.md))

- The app signs in through the browser with the device grant. The token stays
  in the shell and goes to the one server the build is set to.
- An update is fetched, held to its checksum, checked on a copy and exchanged
  in one step. Restart to update is the person's press. Nothing installs over
  unsaved work.
- An address (`compound://open/<id>`) carries an id and nothing else, and does
  only what a press in the app could do.

**Honesty**

- Say what ran and where. Packaging, signing, notarization and the updater's
  real hands have never run. Nothing has run on a Mac. Keep saying so in the
  docs until it has, then change the sentence in the same PR that proves it.
- Never put an identity, a certificate, a key or a token in the repository.

## The Rails backend

This template pairs with
[compound-stack-rails](https://github.com/kieranklaassen/compound-stack-rails).
[docs/rails-backend.md](docs/rails-backend.md) has the wire between them and
the Ruby to build on the Rails side. Change the wire, the Ruby sketch and the
app's tests together.

## Documented knowledge

- **[docs/modules/](docs/modules/)**: one doc per module, each with its file
  boundary and an "Adopt into an existing app" section.
- **[docs/rails-backend.md](docs/rails-backend.md)**: the pairing.
- **[docs/distributing.md](docs/distributing.md)**: packaging, signing, publishing.
- **[docs/solutions/](docs/solutions/)**: dated write-ups of solved problems.
- **[docs/patterns/SUMMARY.md](docs/patterns/SUMMARY.md)**: the recurring patterns, one line each.
- **[CONCEPTS.md](CONCEPTS.md)**: the vocabulary.
- **[docs/changelog/](docs/changelog/)**: agent-executable upgrade entries.

## Template upgrades

A clone carries `.template-manifest.yml`. An upgrade agent reads the changelog
entries newer than the app's `template_version`, filtered to its modules,
applies them in order, bumps the manifest and opens a PR. Upgrades land as
reviewable PRs, **never direct pushes**. See
[docs/template-manifest.md](docs/template-manifest.md).
