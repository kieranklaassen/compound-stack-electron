# Module: helpers

How to add a native helper: a process of its own (Swift, or anything that
compiles for the target) that the shell starts for work the page and Node
cannot do. This module is a doc. The template ships no helper and no code for
one.

## What this module is

The rules a helper is built to.

- The shell starts it. A page asks through a door (see [bridge](bridge.md))
  and never starts a process. The shell writes the command line.
- The command line is a contract. It is written in a README beside the
  helper's source: the arguments, each line the helper writes to its standard
  output, what its standard error is for, and how it ends. The README, the
  shell's module and the stand-in are changed together, in one change.
- A stand-in speaks the same contract. It is a Node script the tests start in
  the helper's place. No test starts the real helper.
- The shell strips places from what a helper says. A line a helper wrote goes
  through `redact` (`shell/redact.mjs`) before it is printed or kept, and the
  page hears names, sizes, counts, states and sentences, never a path.
- A helper that ends without being told to is said once. The shell tells the
  page one sentence where its work is shown. It may start the helper again
  once. A second end soon after the first is not answered with another start:
  only the person's press starts it then. Never restart in a loop.
- An end the shell asked for (it sent the signal, or the work was cancelled)
  is not an unasked end and is said nowhere.
- A helper is kept out of the build list until it has been built and tried on
  the target machine. Until then it is not packed, the bundle check does not
  ask for it, and where it is not found the control that needs it is there,
  off, with one sentence that says why (see [feedback](feedback.md)).
- A helper never holds a credential it was not handed for one request, and it
  writes nothing typed or private to its standard error.

## Files (the module boundary)

No file of a helper exists. Where the files of a first one go:

- `native/<name>/` (you add): the helper's source and its `README.md`, the
  contract.
- `shell/<name>-helper.mjs` (you add): finds the binary, writes the command
  line, reads the lines, says an unasked end. No Electron in it. Dependencies
  handed in (the spawn function, the clock).
- `test/stand-ins/<name>.mjs` (you add): the stand-in.
- `test/shell/<name>-helper.test.mjs` (you add): runs the shell's module on
  the stand-in.
- `shell/redact.mjs`: what every line a helper wrote goes through.
- `shell/bundle-check.mjs`: a line in `NEEDS`, added only once the helper has
  been built and tried.
- `bin/package.mjs`: the binary among what is packed, at the same time.

## Adopt into an existing app

1. Write the README first: the command line, the lines out, the end. Keep
   every line one JSON object, so the shell parses and never guesses.
2. Write the stand-in to that README.
3. Write `shell/<name>-helper.mjs` against the stand-in, with a test for each
   line and each way of ending: done, failed with its own error line, killed,
   not found.
4. Add the door. Answer the page with ids and states. Put every line the
   helper wrote through `redact`.
5. Write the unasked-end rule into the module: one sentence, one restart, then
   the person's press.
6. Write the helper. Build it and try it on the target machine.
7. Only then add it to `NEEDS` and to what `bin/package.mjs` packs.

## Verify adoption

- The stand-in's test passes under `npm run test:shell`.
- With the binary absent, the control is shown, off, and says why.
- The helper's README, the shell's module and the stand-in name the same
  arguments and the same lines.

## Gotcha: a helper that was never run is not shipped as if it were

A helper written without the target machine to hand compiles in nobody's
hands. Keep it outside the build list and say "not run yet" wherever it is
described, until it has built and done its work there once.
