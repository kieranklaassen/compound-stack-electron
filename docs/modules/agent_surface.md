# Module: agent_surface

Everything a person can do in the window is described by a row, and what an
agent may do too is a tool that runs the same action. A test reads the page's
source and holds controls, rows and tools to each other.

## What this module is

- A row (`Row` in `page/agent/rows.ts`) is the one place a control is
  described. It carries its help (`name` of two or three words, `how` in one
  to three sentences, and where they help `after`, `first` and a `picture`),
  the `command` whose key is shown with it, and its `tool`.
- A control names its row with `data-action="<row id>"`. Where several
  controls share a row, each names its part with `data-help`, and the row
  carries that part's help under `parts`.
- A row has a `tool` or a `personOnly` sentence, never both and never neither.
  `personOnly` says why no tool does it: signing in, restarting to update,
  throwing kept work away.
- `rowOf(id)` finds a row. `helpOf(id, part)` answers the help a control
  shows.
- A tool (`Tool` in `page/agent/run.ts`) has a name, a description, a closed
  schema (`additionalProperties: false`) and `run(args, { by })`.
- Every call goes through `runTool(tools, name, args, by)`. It checks the
  arguments (`argsIssue`), runs the tool and writes the call in `callLog`
  (the last `LOG_MOST`, 200, with the result cut to 400 characters). Never
  call a tool's `run` yourself.
- An answer is `{ ok: true, value }` or `{ ok: false, refused }`. A tool that
  throws a `Sentence` is refused with that sentence. Any other error says only
  `<tool> failed.`
- `PAGE_TOOLS` in `page/agent/tools.ts` is the list. A tool runs the action
  its control runs: the functions of `page/app/actions.ts`, `page/app/editor.ts`
  and `setView`. It is never a copy.
- A tool asks the shell as an agent (`shellFor(by)`), so nothing it asks
  counts as the person's press (see [bridge](bridge.md)).
- A change an agent made to the document is said in a kept notice with Undo
  (`sayWithUndo`), and never joins the person's drag as one undo step.
- Three tools are for finding the way: `get_state`, `find_tools` (rows by
  words, each with its tool or why there is none) and `show_control` (see
  [help](help.md)).
- `get_state` holds no place on the disk, no token and no address: the file's
  name, and for the account its state alone.
- `window.pageAgent` is the page's door for an agent: `tools()` lists them
  with `inputSchema`, and `run(name, args, by)` is `runTool`. It is the seam a
  local MCP bridge would attach to (see [mcp_bridge](mcp_bridge.md)).

## Files (the module boundary)

- `page/agent/rows.ts`: `ROWS`, `Row`, `Help`, `rowOf`, `helpOf`.
- `page/agent/run.ts`: `runTool`, `argsIssue`, `callLog`, `LOG_MOST`, `Tool`,
  `Schema`, `Call`, `Result`.
- `page/agent/tools.ts`: `PAGE_TOOLS`, `pageAgent`.
- `page/agent/coverage.test.ts`: the rules, held by reading the source.
- `page/agent/tools.test.ts`.
- `page/app/actions.ts`, `page/app/editor.ts`, `page/app/view.ts`: the action
  functions a control and its tool both call.
- `page/main.tsx`: sets `window.pageAgent`.
- `page/feedback/sentence.ts`: `Sentence`.

## Adopt into an existing app

1. Move what each control does into a plain function outside the component.
   Have it answer a sentence or throw a `Sentence`.
2. Copy `run.ts` and `sentence.ts`.
3. Write a row for every control and put `data-action` on the control, as a
   string literal so the test can read it.
4. Write a tool for each row an agent may run. Have it call the same function.
   Mark the rest `personOnly` with the reason.
5. Copy `coverage.test.ts`. Set the folder it scans and the least number of
   controls it expects.
6. Set `window.pageAgent` in the page's entry.
7. Remove every `title` attribute from the components. Help is the row's.

## Verify adoption

- `npm run test:page`. `coverage.test.ts` fails on a control with no row, a
  row with no control, a row with neither a tool nor a reason, a `title` in a
  component, a schema left open, and a tool argument named like a path or a
  credential.
- `npm run test:e2e`: `launch.test.mjs` runs `get_state` through
  `window.pageAgent` and checks that it holds no folder.

## Gotcha: the coverage test reads text

It matches `data-action="…"`, `action="…"` and `answerAction="…"` in `.tsx`
files. A row named through a variable is not seen. Only the files under
`kit/` and `ask_first.tsx` may pass a row through, and the test fails any
other file that writes `action={…}`.

## Gotcha: a row for a notice's button

The buttons of a notice are controls too (`notice_action`, `dismiss_notice`),
with tools that take the notice's id from `get_state`.
