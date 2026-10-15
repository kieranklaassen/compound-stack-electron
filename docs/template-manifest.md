# The template manifest

`.template-manifest.yml`, at the root, records which version of the template an
app is on and which modules it has adopted. An upgrade agent reads it first.

## Schema

```yaml
template_version: "0.1.0"   # semver: the template version this app is on
modules:                    # module name -> the version it was adopted at
  shell: "0.1.0"
  bridge: "0.1.0"
```

- `template_version` is a semver string in quotes. In the template it is the
  current version, and it equals `version` in `package.json`. In a downstream
  app it is the version the app was last upgraded to.
- `modules` maps a module's name to the `template_version` at which the app
  adopted it. A module's name is the file name of its doc: `docs/modules/<name>.md`.

Keep the file in this plain shape: one `key: "value"` a line, two spaces before
a module. The tests read it with a pattern and no YAML package.

`test/template/manifest.test.mjs` and `test/template/modules.test.mjs` hold it:
the version is semver and is the package's, no module is adopted at a higher
version, and in the template the keys match `docs/modules/*.md` one to one.

## Born complete

The template ships its own manifest, with each module listed at the current
version. A new app cloned from the template inherits that file. It starts with
all modules adopted and has nothing to wire up.

## Partial adoption

An app that did not start from the template lists only the modules it took.
To adopt one, follow "Adopt into an existing app" in its doc, run the doc's
"Verify adoption", and add the module's key at the template's current version.
Set `template_version` to that version too if the app had none.

Such an app can drop `test/template/modules.test.mjs`, or keep only the docs of
the modules it lists. The one-to-one rule is the template's own.

## Renaming a clone

The example app is called Compound. A new app changes:

- `name`, `productName` and `appId` in `package.json`;
- `LINK_SCHEME` in `shell/app-link.mjs`, the app's own address;
- `EXTENSION` in `shell/documents.mjs`, the ending of a document's file;
- the `COMPOUND_` names of the launch tests' harness, in `shell/main.mjs` and
  `test/e2e/support.mjs`, if the app wants its own;
- the words of the example page under `page/app/`.

The manifest and the changelog do not hold the app's name and need no change.

## How an upgrade flows

An upgrade agent is given the app's repository and the template's:

1. It reads the app's `.template-manifest.yml`: the version and the modules.
2. It selects the entries of `docs/changelog/` with a higher `template_version`
   that name `all` or a module the app lists.
3. It applies them in order, on a new branch, and runs each entry's Verify.
4. It bumps `template_version` in the app's manifest.
5. It opens a pull request. A person reviews and merges it.

An upgrade is never a direct push. The full algorithm is in
[`docs/changelog/README.md`](changelog/README.md).
