# Module: storage

What the shell keeps on the disk and how. A file is whole or it is the one
from before. The page names a document by an id and never by its place.

## What this module is

- `writeWhole(path, text)` writes under a partial name in the same folder,
  flushes the file, renames it over the last one, then flushes the folder. A
  crash in the middle leaves the old file. Every file the shell writes for
  itself goes through it.
- `readKept(path, check)` has three answers that are never mixed up: `none`
  (no such file), `read` with its value, and `unread`. A file that is there
  and is not what `check` takes is moved aside as `<path>.unread-<time>`. It
  is never written over and never removed.
- `Kept` is a small JSON file over defaults: `read()` (from the disk once),
  `write(changes)` (merged, written whole), and `unread`, the name the file
  was set aside under.
- Settings are the person's on this computer, never part of a document.
  `SETTINGS` names each key with its default and its check. `settled(value)`
  keeps only known keys and replaces a bad value with the default.
  `settingsDoor(kept, changed)` answers `read` and `set`. An unknown key or a
  value the key does not take is refused. The template's keys are `scheme`,
  `fetchUpdates` and `installAtQuit`.
- `Documents` holds a map from an id it made to a place. `open()` shows the
  dialog the shell handed in, reads the file and answers `{ id, name,
  document }`. `save([id, document, name])` writes to the place the id names,
  or asks where when `id` is null. Both answer null where the person
  cancelled. `forget()` empties the map when the page is loaded again.
- A document is JSON of at most 8 MiB, with the extension `EXTENSION`
  (`compound`).
- A save drops the recovery (`documentsDoor`): a save is the person's word
  that the kept copy is no longer needed.
- `Vault` keeps the device's token in a file of mode 0600. With a `safe`
  handed in whose `isEncryptionAvailable()` is true (Electron's `safeStorage`)
  the file holds `{ sealed }`. Otherwise it holds `{ plain }`. `read()`,
  `write(token)`, `forget()`.

## Files (the module boundary)

- `shell/whole-file.mjs`: `writeWhole`, `readKept`.
- `shell/kept.mjs`: `Kept`.
- `shell/settings.mjs`: `SETTINGS`, `SETTING_DEFAULTS`, `settled`,
  `settingsDoor`.
- `shell/documents.mjs`: `Documents`, `documentsDoor`, `EXTENSION`.
- `shell/vault.mjs`: `Vault`.
- `test/shell/whole-file.test.mjs`, `kept.test.mjs`, `settings.test.mjs`,
  `documents.test.mjs`, `vault.test.mjs`.

## Adopt into an existing app

1. Copy `whole-file.mjs`. Replace every `writeFile` of a file the app keeps
   with `writeWhole`.
2. Copy `kept.mjs`. Keep each small JSON file (settings, notes) as a `Kept`
   under the app's `userData` folder.
3. Copy `settings.mjs`. List your settings in `SETTINGS`, each with a default
   and a `takes` check. Add the door (see [bridge](bridge.md)).
4. Copy `documents.mjs`. Hand it your `pick` and `pickToSave` from `main.mjs`.
   Call `documents.forget()` on `did-start-loading`. Remove every path from
   what the page is sent.
5. Copy `vault.mjs` for any secret the shell holds. Hand it `safeStorage`.
6. Copy the five tests.

## Verify adoption

- `npm run test:shell`
- `npm run test:e2e`: `launch.test.mjs` saves a document, reads the file back,
  and checks that `get_state` holds the file's name and not its folder.

## Gotcha: an unread file is the person's data

Do not "fix" `readKept` to overwrite a file it cannot parse. A newer build may
have written it. The file set aside is the only copy.

## Gotcha: the vault is plain under the harness and where there is no keychain

`main.mjs` hands the vault `null` under the launch tests' harness, and `Vault`
falls back to `{ plain }` wherever `isEncryptionAvailable()` is false. The
file's mode is the only guard then. A `sealed` file read by a build with no
`safe` answers null, which signs the app out.

Not run yet: the vault has sealed a token only with a fake `safe` in
`vault.test.mjs`. It has not run against a real keychain.
