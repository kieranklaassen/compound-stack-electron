# Distributing

How a build is made, signed and published. The Rails side of publishing is in
[rails-backend.md](rails-backend.md).

**Not run yet.** `bin/package.mjs` was written without a Mac to hand. It has
made no build. The signing plan and the bundle check are pure functions with
tests; the call into electron-builder, the signature, notarization and the
disk image are untried. Say so until a build it made has been opened on a Mac.

## Make a build

```sh
APP_SERVER=https://app.example.com npm run package
```

1. The page is built (`npm run page`).
2. `signingPlan(process.env)` decides how the build is signed (`shell/signing.mjs`).
3. `bundleProblems` checks what will be packed (`shell/bundle-check.mjs`):
   the shell, the preload, the built page, a three-number version, an https
   server or none, and no tests or docs. Packaging stops on a problem.
4. electron-builder writes the app and its disk image to `dist/`.

`APP_SERVER` is written into the packed `package.json` as `appServer`. A build
with none has no account and no updates, and says so in Settings.

## Signing

Decided from the environment. Nothing is ever written in the repository.

| Environment | Result |
| --- | --- |
| nothing set | Signed ad hoc. No keychain is looked in. Good for your own machine. |
| `CSC_NAME` | Signed with that Developer ID, not notarized. |
| `CSC_NAME` and one notarization set | Signed and notarized. |

A notarization set is one of:

- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_KEYCHAIN_PROFILE`

A set that is half given, two sets at once, or a set with no `CSC_NAME` is an
error said before anything is built.

An ad hoc build is another app to macOS each time it is made: permissions the
person gave the last build do not carry over, and the updater will not exchange
it for a build signed by a team. Ship Developer ID builds to other people.

## Fuses

A packaged app cannot be run as plain Node, takes no Node options from the
environment, cannot be inspected, loads only from its asar, and checks the
asar's integrity (`electronFuses` in `bin/package.mjs`).

## Publish

Publishing is the backend's: one task uploads the disk image under `releases/`
with its SHA-256 and refuses a version that is not higher than the newest
(`desktop:publish` in [rails-backend.md](rails-backend.md)). Signed-in apps
find it at their next look.

Order for a release:

1. Bump `version` in `package.json`.
2. `npm run check`, then the launch tests.
3. Package with the server and the signing environment set.
4. Open the build on a clean machine. Sign in. Check for updates.
5. Publish.

## Never

- Never commit an identity, a certificate, a provisioning profile or a notary
  credential.
- Never set a signing variable in an agent's run. An agent packages ad hoc.
- Never publish a build nobody opened.
