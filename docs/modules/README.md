# Modules

The template is cut into modules. Each one is a rule or a behaviour with a file
boundary, so an existing Electron app can adopt one without taking the rest.
Each doc has the same shape: what the module is, its files, how to adopt it,
how to verify the adoption, and the gotchas that can be seen in the code.

The example app is called Compound (appId `com.example.compound`). Its backend
is a Rails app built on compound-stack-rails.

## The rule

`docs/modules/` is one to one with the keys under `modules:` in
`.template-manifest.yml`. Every key has a doc of the same name, and every doc
has a key. `test/template/modules.test.mjs` holds both directions. Add a module
by adding its key and its doc in the same change.

## The modules

| Module | What it is | Kind |
| --- | --- | --- |
| [shell](shell.md) | The main process: one file knows Electron, the page on its own scheme, a locked window, dialogs, quit. | code |
| [bridge](bridge.md) | One IPC channel, a closed list of doors, and the preload's word on whose press it was. | code |
| [storage](storage.md) | Files written whole, small kept JSON files, settings, documents by id, the token's vault. | code |
| [recovery](recovery.md) | Unsaved work survives a crash and goes only on the person's word. | code |
| [account](account.md) | Sign-in through the browser against the Rails backend. The token stays in the shell. | code |
| [updates](updates.md) | The app updates itself: look, fetch, check the copy, one exchange, restart on a press. | code |
| [deep_links](deep_links.md) | `compound://open/<id>`, read by one strict function. | code |
| [packaging](packaging.md) | The package script, the signing plan, the bundle check, the fuses. | code |
| [helpers](helpers.md) | How to add a native helper process the shell starts. | doc-first |
| [agent_surface](agent_surface.md) | Coverage rows, page tools, the call log, and the test that holds them. | code |
| [mcp_bridge](mcp_bridge.md) | How an outside agent would reach the page's tools through a local MCP server. | doc-first |
| [help](help.md) | Help on hover, Option for the whole card, Help mode, Show me. | code |
| [feedback](feedback.md) | A press says what came of it where the press was. Ask first in place. Notices. | code |
| [number_fields](number_fields.md) | A number field is typed in and dragged. A drag is one undo step. | code |
| [keys](keys.md) | One key table. The menu, the keys and the buttons run the same commands. | code |
| [at_rest](at_rest.md) | A window that stands still does no work. A rule and the tests that hold it. | code |
| [theme](theme.md) | Tokens, light and dark, reduced motion. | code |
| [testing](testing.md) | Three layers: page tests, shell tests, launch tests. Stand-ins for every hand. | code |
| [ci](ci.md) | One workflow, two jobs: the gate with no Electron binary and no display, then the launch tests under xvfb. Actions pinned by SHA. | code |
| [agent-conventions](agent-conventions.md) | `AGENTS.md`, `CONCEPTS.md`, solutions, patterns, the manifest and changelog flow. | code |

A doc-first module ships no code. Its doc is the contract to build to, and it
names the seam in the template the code would attach to.

## What has run

The page tests (Vitest) and the shell tests (node:test) pass. The launch tests
passed in Electron on Linux under xvfb. Packaging, signing, notarization and
the updater's real hands (`hdiutil`, `codesign`, `ditto`) have never run. A
module that depends on those says so in a "Not run yet" line.
