# Module: packaging

`npm run package` makes the app and its disk image. How it is signed is
decided from the environment by one pure function. No identity is in the
repository.

Signing, notarizing and what to do with a build are in
[docs/distributing.md](../distributing.md).

Not run yet: `bin/package.mjs` has built nothing. No app has been packaged,
signed, notarized or opened. The signing plan and the bundle check pass in
Node tests.

## What this module is

- `signingPlan(env)` answers `{ kind }` or `{ error }`.
  - Nothing set: `ad-hoc`. No keychain is looked in.
  - `CSC_NAME` set: `signed`, with that identity.
  - `CSC_NAME` and one whole notarization set: `signed-notarized`.
- The notarization sets are `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` +
  `APPLE_TEAM_ID`, or `APPLE_API_KEY` + `APPLE_API_KEY_ID` +
  `APPLE_API_ISSUER`, or `APPLE_KEYCHAIN_PROFILE`.
- A set that is half given is an error, said before anything is built. So are
  two sets at once, and a set with no `CSC_NAME`.
- `bundleProblems({ files, meta })` answers every problem of a bundle as
  sentences: a missing file of `NEEDS` (`shell/main.mjs`, `shell/preload.cjs`,
  `page/dist/index.html`, `package.json`), no script of the page's, tests or
  docs among the files, a version that is not three numbers, an `appServer`
  that is not https.
- `bin/package.mjs` runs both before it builds, and stops on either.
- The build is set to its backend when it is built: `APP_SERVER` is written
  into the packed `package.json` as `appServer`. With none the build has no
  server, and the account and the updater say so.
- What is packed: `package.json`, `shell/**`, `page/dist/**` without source
  maps, in an asar.
- The fuses the script sets: `runAsNode` off, the `NODE_OPTIONS` variable off,
  the inspect arguments off, asar integrity validation on, load only from the
  asar on. An ad hoc build resets the ad hoc signature.
- The Mac target is a `dmg`. The hardened runtime is on for a signed build.
  The script also names an AppImage for Linux and an NSIS installer for
  Windows.
- The script publishes nothing (`publish: 'never'`).
- The app's scheme is declared in `protocols` (see [deep_links](deep_links.md)).

## Files (the module boundary)

- `bin/package.mjs`: the package script.
- `shell/signing.mjs`: `signingPlan`.
- `shell/bundle-check.mjs`: `NEEDS`, `bundleProblems`.
- `package.json`: `appId`, `productName`, the `package` script.
- `test/shell/signing.test.mjs`, `test/shell/bundle-check.test.mjs`.

## Adopt into an existing app

1. Copy `signing.mjs`, `bundle-check.mjs` and their tests.
2. List in `NEEDS` every file without which your app launches into a blank
   window.
3. Copy `bin/package.mjs`. Set the `files` list, the targets and the category.
   Keep the two checks before the build and keep the fuses.
4. Put `appId` and `productName` in `package.json`.
5. Remove any identity, certificate or notary credential from the repository
   and from any script. Supply them in the environment of the machine that
   builds.
6. Follow [docs/distributing.md](../distributing.md) for a signed build.

## Verify adoption

- `npm run test:shell` (`signing.test.mjs`, `bundle-check.test.mjs`).
- `npm run package` with nothing set prints `Signing: ad-hoc, no server` and
  then builds. That step has not run.

## Gotcha: an ad hoc build is another app at every rebuild

The system knows an ad hoc signed app by its hash. Each build is a new app to
the keychain and to any permission it was given. The updater checks the
running app's team only where it has one, so an ad hoc build is replaced by
any build whose signature verifies.

## Gotcha: the bundle check reads the source tree

The script lists `shell/` and `page/dist/` on the disk and puts that list to
`bundleProblems` before the build. It does not open the finished asar. Run the
page build first (`npm run package` does).
