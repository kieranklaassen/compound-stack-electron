# Module: keys

One table says what a key does. A key, a menu item and a toolbar button run
the same command. A held key runs what saves, opens or changes a mode once.

## What this module is

- `BINDINGS` in `page/keys/keys.ts` is the table: a key, whether it takes the
  platform's modifier and Shift, and the command it names. A key is written
  nowhere else.
- `keyCommand(press, focus, mac)` answers the command a press runs, or null.
  The modifier is Cmd on a Mac and Ctrl elsewhere. A press with Alt is none.
- While text is typed (`focus` is `text`) only a binding marked `inText` runs.
  Undo and redo are left to the field. Save, open, new, settings and Help mode
  still run from a field.
- `ONCE_A_PRESS` names the commands a held key runs once: save, save as, open,
  new, settings, Help mode, escape. A repeat of one is passed over. Undo and
  redo repeat. Add to it every new command that saves, opens, removes or
  changes a mode.
- `keyShown(command, mac)` is a command's key as the platform writes it, for
  the help card.
- `listenForKeys(run, mac)` is the one key listener. It puts each press to
  `keyCommand` and runs the command. It takes every key it runs from the
  browser except Escape, which a field and a sheet also use.
- `COMMANDS` in `page/app/commands.ts` is the one table of what a command
  does. `runCommand(name)` runs one. Each command calls the action functions
  of `page/app/actions.ts` and `page/app/editor.ts`.
- The menu runs the same commands. A menu item's `ask` is a command's name,
  sent to the page over `shell:tell`, and `followShell` hands it to
  `runCommand`. `test/shell/menu.test.mjs` holds every `ask` of the menu to a
  name in `COMMANDS` and fails an accelerator given twice.
- A row names its command, and the coverage test holds that name to
  `COMMANDS`.
- A held Return or Space on a button is no press. `heldPress(event)` says
  whether a key event is a repeat that would press a button, a link or a
  summary. `watchHeldPresses()` is one capturing listener for the whole page
  that prevents it. A key in a text field and the app's own commands are
  untouched.

## Files (the module boundary)

- `page/keys/keys.ts`: `BINDINGS`, `ONCE_A_PRESS`, `keyCommand`, `keyShown`,
  `Press`, `Focus`.
- `page/keys/listen.ts`: `listenForKeys`.
- `page/app/commands.ts`: `COMMANDS`, `runCommand`.
- `page/kit/held_press.ts`: `heldPress`, `watchHeldPresses`.
- `shell/menu.mjs`: the menu's `ask` names and accelerators.
- `page/keys/keys.test.ts`, `page/kit/held_press.test.ts`,
  `test/shell/menu.test.mjs`.

## Adopt into an existing app

1. Write `COMMANDS`: one entry for each thing a key or a menu item runs, each
   calling the function its button calls.
2. Copy `keys.ts` and `listen.ts`. Write your bindings. Remove every other
   `keydown` handler that runs an action.
3. Put each command that saves, opens, removes or changes a mode in
   `ONCE_A_PRESS`.
4. Copy `held_press.ts` and call `watchHeldPresses()` once for the window.
5. Give each menu item an `ask` that is a command's name, and run it in the
   page (see [shell](shell.md)).
6. Copy the three tests.

## Verify adoption

- `npm run test:page` (`keys.test.ts`, `held_press.test.ts`, and "runs what
  the menu asks through the same commands" in `app.test.tsx`).
- `npm run test:shell` (`menu.test.mjs`).

## Gotcha: an accelerator and a binding both exist for one key

The menu's accelerator and the page's binding name the same command for the
same key. Where the menu takes the key first, the page's listener does not
hear it, and the command runs once. `menu.test.mjs` reads the commands from
the page's source, so a command renamed on one side fails it.

## Gotcha: why the held press matters

A press can move the keyboard: it opens a sheet whose main button takes the
focus. The key is still down, the system repeats it, and the repeat presses
the button the keyboard just landed on. One listener keeps every such repeat
from every button.
