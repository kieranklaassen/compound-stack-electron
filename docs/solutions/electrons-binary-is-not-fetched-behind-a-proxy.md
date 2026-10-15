---
title: Electron's binary is not fetched behind a proxy
module: testing
date: 2026-10-15
problem_type: config
component: node_modules/electron
tags: [electron, npm, proxy, sandbox, e2e]
applies_when: "`npm ci` finished behind an agent or company proxy and the launch tests cannot start Electron."
---

## Problem

`npm ci` ended with no error, and `npm run check` passed. The launch tests
failed at once: Electron could not be started. `node_modules/electron/dist` was
empty or not there.

## Cause

The `electron` package holds no binary. Its install script downloads a release
zip. Behind some proxies that download does not arrive, and the install can
still end without an error. `npm run check` needs no binary, so nothing says so
until a launch test runs.

## Solution

Fetch the zip by hand, check it, and put it where the package looks.

```sh
cd node_modules/electron
VERSION=$(node -p "require('./package.json').version")
ZIP="electron-v$VERSION-linux-x64.zip"     # or darwin-arm64, darwin-x64, win32-x64

curl -fsSL -o "/tmp/$ZIP" "https://github.com/electron/electron/releases/download/v$VERSION/$ZIP"

# The package ships the checksum of each release file. The two must be the same.
sha256sum "/tmp/$ZIP"
node -p "require('./checksums.json')['$ZIP']"

rm -rf dist && mkdir dist && unzip -q "/tmp/$ZIP" -d dist
printf 'electron' > path.txt               # no newline; on a Mac: Electron.app/Contents/MacOS/Electron
```

Take the version from `node_modules/electron/package.json`, not from the range
in the app's `package.json`. Stop if the two checksums differ. `path.txt` names
the binary inside `dist` and must hold no newline.

Use the proxy as it is set up. Do not turn off TLS checks to get the file.

This was done on Linux. The Mac's `path.txt` value above is the package's own
and was not tried here.

## Prevention

- `npm run check` is kept free of Electron, so the first CI job installs with
  `ELECTRON_SKIP_BINARY_DOWNLOAD=1` and cannot fail this way.
- Only the launch job needs the binary. Where it fails to start Electron, look
  in `node_modules/electron/dist` first.
