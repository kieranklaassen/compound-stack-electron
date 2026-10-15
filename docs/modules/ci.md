# Module: ci

One workflow, two jobs. The first runs the gate and needs no Electron binary
and no display. The second launches the app whole on a virtual display.

## What this module is

- `.github/workflows/ci.yml` runs on a push to `main` and on every pull
  request. Its permissions are `contents: read`. A newer run of the same ref
  cancels the one under way.
- Every Action is pinned to a whole commit SHA, with the version in a comment.
  `test/template/conventions.test.mjs` fails a `uses:` that is not.
- Node is the version in `.node-version`, read by `setup-node` through
  `node-version-file`. The npm cache is on.
- The job `check`:
  1. `npm ci` with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, so Electron's binary is
     not fetched.
  2. `npm run check`: types, the page tests, the shell tests (which include
     `test/template/`).
  3. `npm audit --omit=dev --audit-level=high`.
- Nothing in `check` needs Electron's binary or a display. Keep it so: a test
  that needs either goes in `test/e2e/`.
- The job `launch` needs `check`. It runs `npm ci` (with the binary),
  `npm run page`, then `xvfb-run -a npm run test:e2e` with
  `ELECTRON_DISABLE_SANDBOX=1`.
- CI builds no package, signs nothing and publishes nothing.

## Files (the module boundary)

- `.github/workflows/ci.yml`: the workflow.
- `.node-version`: the Node version.
- `package.json`: the `check` and `test:e2e` scripts.
- `package-lock.json`: what `npm ci` installs.
- `test/template/conventions.test.mjs`: the pin check.

## Adopt into an existing app

1. Copy `.github/workflows/ci.yml` and `.node-version`.
2. Make `npm run check` your gate, and make sure it passes with
   `ELECTRON_SKIP_BINARY_DOWNLOAD=1` set at install (see
   [testing](testing.md)).
3. Pin every Action to a commit SHA. Keep the version in a comment beside it.
4. Keep `npm audit`. Fix a finding by updating the dependency, not by removing
   the step.
5. Keep the launch job if your launch tests pass under `xvfb-run -a` on
   Linux. Drop it otherwise, and run them where they do.
6. Protect `main` and require `check`.

## Verify adoption

- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && npm run check && npm audit --omit=dev --audit-level=high`
  passes on a clean checkout.
- `npm run test:shell` runs the pin check.

Not run yet: the workflow itself has not run on GitHub. Its commands have run
by hand: the gate, and the launch tests under xvfb on Linux.

## Gotcha: the audit leaves dev dependencies out

`--omit=dev` audits `react` and `react-dom` only: what is carried into the
page. Electron, the builder and the test tools are dev dependencies and are
not audited by this step.

## Gotcha: a pin is not updated by itself

A SHA does not move. Update the pins on purpose, and change the comment with
the SHA.
