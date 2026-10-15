# Changelog

What each version of the template holds, for people. The instructions an
upgrade agent runs are in [`docs/changelog/`](docs/changelog/README.md).

## 0.1.0

The first version: an Electron shell, a typed bridge, a React page and the
habits around them, as 20 modules.

What has run: the page's tests and the shell's tests pass. The launch tests
passed in Electron 44 on Linux under xvfb. Nothing has run on a Mac. Packaging,
signing and the updater's real hands have never run.

- **shell**: the one file that imports Electron (`shell/main.mjs`), a locked-down window, the page on its own scheme under a strict policy, the menu as data, dialogs that stand in the window, and a quit that ends in time.
- **bridge**: one IPC channel and a closed list of doors (`shell/doors.json`), typed for the page in `page/shell.ts`; each answer is a value or a sentence for a person.
- **storage**: files the shell keeps are written whole, checked when read, and set aside when they cannot be read; a document is named to the page by an id, never by its place.
- **recovery**: unsaved work is kept beside the settings, offered at the next launch, and dropped only on the person's word; a page that died is loaded again.
- **account**: the app signs in through the browser with a device grant, and keeps its token in the system's keychain where the build can use it.
- **updates**: the app looks for a newer build, fetches it to a checksum, checks the copy and exchanges the two apps; the real hands are for a packaged Mac app and have not run.
- **deep_links**: the app's own address (`compound://open/<id>`), read by one strict function, which does what a button does and no more.
- **packaging**: `npm run package`, a signing plan decided from the environment, and a check of what a bundle must hold; it has built nothing yet.
- **helpers**: the rules for a native helper the shell starts; no helper ships, and what one writes goes through `shell/redact.mjs` before it is printed or kept.
- **agent_surface**: a coverage row and a tool for each control, checked arguments, and a call log; a tool runs the action its control runs.
- **mcp_bridge**: the page's door for an outside agent (`pageAgent` in `page/agent/tools.ts`), where a local MCP bridge attaches.
- **help**: one help card for the whole window: a tip on hover, the whole card with Option, pictures drawn from the tokens, and Show me.
- **feedback**: a press says what came of it where the press was; a press that cannot be undone asks first in its own place; notices are for the rest.
- **number_fields**: a number field is dragged as well as typed in, and a whole drag is one step of Undo.
- **keys**: one table says what a key does; the menu, the buttons and the keys run one table of commands, and a held key is no second press.
- **at_rest**: an app that stands still does no work: no timer in the page at rest, and the shell looks for updates on a few stated occasions.
- **theme**: each colour, size and time is a token stated once; the dark scheme gives the same tokens other values.
- **testing**: Vitest for the page on a stand-in shell, Node tests for the shell with no Electron, and launch tests of the real app with stand-ins for dialogs and hands.
- **ci**: GitHub Actions with each action pinned to a commit: a check job that needs no Electron, then a launch job under xvfb; Dependabot weekly.
- **agent-conventions**: `AGENTS.md` with `CLAUDE.md` linked to it, the manifest, the changelog an agent runs, dated solutions, and the tests that hold them.
