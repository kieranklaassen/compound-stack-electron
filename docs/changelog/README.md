# docs/changelog: upgrade entries an agent runs

The entries here are instructions an agent carries out against a downstream
app. They are not release notes for people. An entry says what to change in an
app that adopted the modules it names, so an upgrade agent can apply it with
nobody watching and open a pull request for review.

## How an entry is named and written

One file an entry:

```
docs/changelog/<template_version>-<NNN>-<slug>.md
```

For example `0.1.0-001-initial-template.md`. `<NNN>` is a three-digit sequence
inside one version. An entry has YAML frontmatter and two sections:

```markdown
---
template_version: "0.2.0"   # the version this change ships in (semver)
modules: [updates]          # manifest keys, or [all]
type: fix                   # feature | fix | refactor
---

## Instructions

1. In `shell/update-look.mjs`, replace `...`.
2. Run `npm ci`.

## Verify

Run `npm run check`.
```

Write the body as orders: add, replace, run. It stands by itself. An agent
applies the change and confirms it without reading the template's own diff.

`modules: [all]` is for an entry that touches the whole template. It applies
to any app that has adopted one module or more.

## The filter and apply algorithm

Given a downstream app's `.template-manifest.yml`:

1. **Select** each entry whose `template_version` is higher than the app's
   `template_version`, and whose `modules` name `all` or a module the app lists.
2. **Order** the selected entries by `template_version`, then by `NNN`, lowest
   first. Compare versions as three numbers, not as text.
3. **Apply** each entry's Instructions in that order. Run its Verify before
   starting the next one.
4. **Bump** `template_version` in the app's manifest to the version of the
   newest entry applied. Leave each module's own adopted-at version as it is.
5. **Open a pull request** on the downstream app. Never push to its main branch.

An entry for a module the app has not adopted is skipped. An entry whose Verify
fails stops the upgrade: say which entry, and what failed, in the pull request.

## What the tests hold

`test/template/changelog.test.mjs` runs with `npm run check`. It holds each
entry to the name, the frontmatter and the two sections above. Each name in
`modules` is a key of `.template-manifest.yml` or `all`. No entry is newer than
the manifest's `template_version`.

## Index

The index people read is [`CHANGELOG.md`](../../CHANGELOG.md).
