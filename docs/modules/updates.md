# Module: updates

The app updates itself from a build the backend names. One seam holds where an
update stands. What looks, what fetches and what installs are hands of their
own, and whatever touches the system is behind stand-ins outside a packaged
app.

The server side (`GET /device/update`, where builds are published) is in
[docs/rails-backend.md](../rails-backend.md).

Not run yet: the real hands (`hdiutil`, `ditto`, `plutil`, `sw_vers`,
`codesign`) have never run. No build has been fetched from a real server,
checked or exchanged. The seam, the look, the fetch and the install's
arithmetic pass in Node tests on stand-ins.

## What this module is

- `Updater` is the seam. Its states are `off`, `current`, `looking`,
  `available`, `fetching`, `ready`, `installing`, `failed`. The page hears
  versions, sizes, states and the updater's own sentences (`SAYS`). It never
  hears an address, a checksum or a place.
- Looking: `lookForUpdate(askServer, { running, server })` asks
  `GET /device/update` with the device's token. `readAnswer` holds every field
  to its shape: a three-number version, a size up to `MOST_BYTES` (2 GiB), a
  SHA-256, an https address (http only where both the address and the server
  are on this machine). Only a strictly higher version is an update.
- When the shell looks by itself: `lookTimes({ check })`. At launch, every
  `LOOK_EVERY_MS` (six hours), and on coming to the front after `AWAY_MS` (an
  hour) away. The timer is the shell's. The page does not poll.
- `Updater#check(who)`: the person's press always asks the server. An agent's
  ask within `AGENT_LOOK_MS` (five minutes) of the last look is answered from
  what is known. Two checks at once are one look.
- Fetching: `fetchUpdate(update, folder, options)`. No token, no redirect. The
  file is written under a partial name, never past the size named, and is a
  build only once the whole of it, read back from the disk, has the checksum
  named. A stall of `STALL_MS` (a minute) ends it. `keptImage` finds a build
  already fetched. `clearUpdates` removes the rest.
- With the setting `fetchUpdates` on, a found build is fetched by itself. A
  build that failed its check is not fetched again by itself. Only a press on
  Download tries it.
- Installing: `prepare({ image, update, app, running, bundleId }, hands)`
  hashes the image again, attaches it, takes only a real folder with the app's
  own name, copies it beside the app under the hidden name `HIDDEN`, and
  checks the copy: the bundle id, the named version and a higher one than
  runs, a system this computer has, a signature that verifies, and the running
  app's team where it has one. A failure removes the copy.
- `exchange(app, next)` is two renames with the way back kept. Where the
  second fails the first is undone and the old app stands. There is no other
  way a build is put in the app's place.
- `sweep(folder)` removes what the last update left beside the app, at the
  next launch, and only a folder under the updater's own name.
- `placeOf({ platform, exePath, packaged })` says where the running app is, or
  why it cannot be exchanged (`CANNOT`): a checkout, a platform that is not a
  Mac, an app run from a disk image or a translocated place.
- Restart to update (`Updater#restart(who)`) and Download
  (`Updater#download(who)`) are the person's own press. Restart is refused
  while `busy()` answers a sentence (the template: an unsaved document). Busy
  is asked again after the copy is prepared.
- `Updater#atQuit()` is the last thing a quit does. An armed restart is
  exchanged and the app is launched again. Otherwise a ready build is
  installed where `installAtQuit` is on and nothing is busy. A quit decides
  once.
- `handsFor({ platform, packaged, harness })` answers `realHands()` only in a
  packaged app on a Mac outside the harness, `standInHands()` under the
  harness, and null otherwise. With no hands the updater is `off` and says
  why.

## Files (the module boundary)

- `shell/updater.mjs`: `Updater`, `updateDoor`, `lookTimes`, `SAYS`,
  `LOOK_EVERY_MS`, `AWAY_MS`, `AGENT_LOOK_MS`.
- `shell/update-look.mjs`: `lookForUpdate`, `readAnswer`, `compareVersions`.
- `shell/update-fetch.mjs`: `fetchUpdate`, `keptImage`, `hashOf`,
  `clearUpdates`, `imagePath`, `STALL_MS`.
- `shell/update-install.mjs`: `placeOf`, `prepare`, `exchange`, `sweep`,
  `HIDDEN`, `CANNOT`.
- `shell/update-hands.mjs`: `realHands`, `standInHands`, `handsFor`.
- `shell/main.mjs`: the `Updater`'s wiring, the sweep at launch, `looks`.
- `page/app/settings_sheet.tsx`: the Updates section.
- `page/app/words.ts`: `updateSays`.
- `test/shell/updater.test.mjs`, `update-look.test.mjs`,
  `update-fetch.test.mjs`, `update-install.test.mjs`.

## Adopt into an existing app

1. Build the server side from [docs/rails-backend.md](../rails-backend.md),
   and adopt [account](account.md): a look needs the device's token.
2. Copy the five `update*.mjs` files and their four tests.
3. In the main file, make the `Updater` as `main.mjs` does: `running`,
   `cannot`, `settings`, `busy`, `quit`, `changed` and the hands `look`,
   `fetch`, `prepare`, `discard`, `exchange`, `relaunch`.
4. Write `busy()` to answer a sentence for everything of your app that must
   not be interrupted.
5. Put `updater.atQuit()` in what `quitWhenDone` waits for (see
   [shell](shell.md)).
6. At launch, run the sweep the last update noted, clear the updates folder,
   and call `looks.launched()`. Call `looks.left()` and `looks.cameBack()` on
   the window's `blur` and `focus`.
7. Add the door and the two settings. Keep Download and Restart to update off
   the agent's tools.
8. Set `HIDDEN` and the bundle id to your app's.

## Verify adoption

- `npm run test:shell`
- `npm run test:page` ("checks for updates and says what was found, where the
  press was", "offers Restart to update when a build is ready").
- `npm run test:e2e`: in a checkout the Check for updates button is there,
  off, and says the build is not set to a server.

## Gotcha: the check is on the copy, not the image

The image may change between a check and a copy. The copy beside the app
cannot be swapped under the check in the same way. Do not move a check back to
the mounted image.

## Gotcha: only a Mac build updates itself

`placeOf` refuses every other platform with a sentence that says to download
the new version. The package script builds an AppImage and an NSIS installer
too. Neither updates itself.

## Gotcha: `main.mjs` never says a quit is a shutdown

`atQuit({ shutdown })` installs nothing on a shutdown, and the test holds it.
`main.mjs` calls `atQuit()` with nothing, so the case is not wired. Wire it
where your app can tell.
