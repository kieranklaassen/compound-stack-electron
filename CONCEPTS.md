# Concepts

The words this template uses, each with one meaning.

- **Shell.** The Electron main process: `shell/`. It owns the window, the disk,
  the network, the account and everything of the system. Only `shell/main.mjs`
  imports Electron.
- **Page.** What the window shows: `page/`, a React app built by Vite and
  carried inside the app. It has no Node, no Electron and no disk.
- **Bridge.** The one way between them: `window.shell.ask(door, method, args)`
  and `window.shell.on(listener)`, over one IPC channel each way.
- **Door.** A named group of things a page may ask (`account`, `documents`,
  `updates`). The list is closed and written once (`shell/doors.json`).
- **Hand.** Code that touches the system: opens a disk image, runs `codesign`,
  opens the browser. Hands are passed in, are real only in a packaged app, and
  are stand-ins under test.
- **Stand-in.** What a test puts in a hand's or the bridge's place. It notes
  what it was asked and touches nothing.
- **Harness.** A launch with `COMPOUND_HARNESS=1`: the app's files go where the
  test says, the window is not shown, and no real hand exists.
- **The person's own press.** A click or a key press the browser says the person
  made, read in the preload. Some things happen only behind one: starting a
  sign-in, restarting to update, dropping kept work.
- **Sentence.** What the app says to a person: one plain sentence, written once,
  never a library's error text.
- **Says.** Why a control is off (`data-says`).
- **Refused.** What the shell answers when it will not do a thing:
  `{ ok: false, refused, code }`, where `refused` is a sentence for the person.
- **Row.** One entry of the coverage table (`page/agent/rows.ts`): a control's
  id, its name, how it works, its key. Help and the agent both read it.
- **Action.** A plain function that does one thing a person can do
  (`page/app/actions.ts`). A control and its tool both call it.
- **Tool.** An action as an agent calls it (`page/agent/tools.ts`), run through
  `runTool`, which checks it and logs it.
- **Tip, card.** The two sizes of help for a control: a line after a rest, the
  whole card while Option is held.
- **Notice.** Something said at the foot of the window: brief (goes by itself)
  or kept (stays, with one action).
- **Gesture.** One drag, from press to let go. It is one step of Undo.
- **Kept.** A file the shell keeps for the person in the app's own folder:
  settings, the recovery.
- **Recovery.** The unsaved work the shell keeps so that a crash loses nothing.
- **Module.** A named part of the template with a doc in `docs/modules/` and a
  line in `.template-manifest.yml`.
- **Doc-first module.** A module that is a written practice with no code in the
  template yet (`helpers`, `mcp_bridge`).
