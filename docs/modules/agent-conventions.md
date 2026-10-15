# Module: agent-conventions

The files an agent reads before it changes anything, and the flow by which a
change in the template reaches the apps cloned from it. Tests hold the
conventions an edit can quietly break.

## What this module is

- `AGENTS.md` is the guide for agents and people: the architecture in one
  line, how to run and test, the rules every change keeps, and where the
  detail is. `CLAUDE.md` is a symlink to it, so every tool reads one file.
- `CONCEPTS.md` is the vocabulary: each word with one meaning.
- `docs/modules/` has one doc a module, each with its file boundary and its
  "Adopt into an existing app" steps. It is one to one with the manifest's
  keys.
- `docs/solutions/` holds dated write-ups of solved problems, one file each,
  with YAML frontmatter and the sections its README names.
- `docs/patterns/SUMMARY.md` lists the recurring patterns, one line each, with
  the file that shows each best.
- `.template-manifest.yml` records `template_version` and, for each module,
  the version it was adopted at. A clone inherits it whole. An app that
  adopted some modules lists only those. `docs/template-manifest.md` explains
  it.
- `docs/changelog/` holds upgrade entries an agent runs, named
  `<version>-<NNN>-<slug>.md`, each with frontmatter (`template_version`,
  `modules`, `type`) and the sections `## Instructions` and `## Verify`.
  `CHANGELOG.md` is the index for people.
- The upgrade flow: an agent reads the entries newer than the app's
  `template_version`, filtered to the app's modules, applies them in order,
  bumps the manifest and opens a pull request. Never a direct push.
- Say what ran. A doc that describes something that has not run says so in a
  "Not run yet" line, and the line changes in the same change that proves it.
- The tests in `test/template/` run with `npm run test:shell`, so with
  `npm run check`:
  - `manifest.test.mjs`: the version is semver and is the package's, and no
    module is adopted at a higher version.
  - `modules.test.mjs`: `docs/modules/` is one to one with the manifest, each
    doc starts with `# Module: <name>` and has the four sections, and each
    path a doc's Files section lists exists (a line marked `(you add)` or the
    like is passed over).
  - `changelog.test.mjs`: each entry's name, frontmatter and sections, and a
    heading in `CHANGELOG.md` for the manifest's version.
  - `conventions.test.mjs`: `CLAUDE.md` is a symlink to `AGENTS.md`, each
    Action is pinned to a commit, and the doors typed in `page/shell.ts` are
    the doors in `shell/doors.json`.

## Files (the module boundary)

- `AGENTS.md`: the guide.
- `CLAUDE.md`: a symlink to `AGENTS.md`.
- `CONCEPTS.md`: the vocabulary.
- `.template-manifest.yml`: the manifest.
- `docs/template-manifest.md`: the manifest explained.
- `docs/modules/README.md`: the modules' index.
- `docs/solutions/README.md`: the format of a write-up.
- `docs/patterns/SUMMARY.md`: the patterns.
- `docs/changelog/README.md`: the format of an entry and the upgrade
  algorithm.
- `CHANGELOG.md`: the index for people.
- `test/template/manifest.test.mjs`, `modules.test.mjs`, `changelog.test.mjs`,
  `conventions.test.mjs`, `support.mjs`.

## Adopt into an existing app

1. Write `AGENTS.md` for your app: the one-line architecture, the commands,
   the rules. Keep it short. Put an area's detail in that area's module doc.
2. Make `CLAUDE.md` a symlink: `ln -s AGENTS.md CLAUDE.md`.
3. Write `CONCEPTS.md` with the words your code uses.
4. Add `.template-manifest.yml` listing the modules you adopted, each at the
   template's current version, with `template_version` set to that version.
5. Copy `docs/solutions/README.md` and `docs/changelog/README.md`. Write a
   solution when a problem cost more than an hour.
6. Copy `test/template/` and add its pattern to your shell test script.
7. Hold upgrades to pull requests.

## Verify adoption

- `npm run test:shell` runs `test/template/*.test.mjs`.
- `readlink CLAUDE.md` prints `AGENTS.md`.

## Gotcha: the manifest is read with a pattern

The tests use no YAML package. Keep the file in its plain shape: one
`key: "value"` a line, two spaces before a module, the version in quotes.

## Gotcha: a doc's Files section is checked

`modules.test.mjs` takes the first backticked path of each bullet in a Files
section and fails if it is not there. A path the adopter adds is marked
`(you add)` on the same line as the path.
