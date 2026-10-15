# Patterns

The habits that recur in this code, each in one sentence, with the file that
shows it best. Read the file before writing something of the same kind.

| Pattern | What it is | Where to see it |
|---|---|---|
| Doors and hands | A page asks the shell through a closed list of doors on one channel, and whatever touches the system is a hand that is handed in, so each decision runs in a Node test. | `shell/doors.mjs`, `shell/assemble.mjs`, `shell/update-hands.mjs` |
| Ids, not paths | The page is told an id and a name for a file, never its place on the disk, and an id from before a reload opens nothing. | `shell/documents.mjs` |
| The person's own press | Some things only the person does, and the preload, not the page, says whether a press was behind an ask. | `shell/press.mjs`, `shell/preload.cjs` |
| Whole-file writes | A kept file is written under a partial name, flushed and moved over the last one, and a file that cannot be read is set aside, never written over. | `shell/whole-file.mjs`, `shell/kept.mjs` |
| A sentence where the press was | A press says what came of it beside its button, in a line that keeps its room so nothing moves. | `page/feedback/said.tsx` |
| Off says why | A control that cannot be used now is shown, turned off with `aria-disabled`, and says why; it is never hidden. | `page/kit/button.tsx` |
| One row carries its help | A control names a coverage row, and the row holds its name, its help, its key and its tool, so no component writes a tooltip. | `page/agent/rows.ts`, `page/agent/coverage.test.ts` |
| One action for a control and its tool | A control, a key, a menu item and an agent's tool call the same plain function, and a tool call goes through `runTool` into the call log. | `page/app/actions.ts`, `page/agent/tools.ts`, `page/agent/run.ts` |
| A drag is one undo step | A drag changes the document many times while the pointer moves and is one gesture, so one Undo takes it all back. | `page/kit/use_scrub.ts`, `page/app/editor.ts` |
| Nothing at rest | Standing still, the page runs no timer and no clock: the help card's one timeout runs only while the pointer rests on a control, and the keeper hears changes. | `page/help/watch.ts`, `page/app/keeper.ts` |
| Stand-ins for each hand | The page runs on a stand-in shell in tests, and a launch test puts stand-ins where a real launch shows a dialog or touches the system. | `page/stand_in_bridge.ts`, `shell/update-hands.mjs`, `test/e2e/support.mjs` |

## Smaller habits

- A refusal is a sentence for a person. An error's own words never reach the
  page (`shell/doors.mjs`), and a printed line holds no place and no credential
  (`shell/redact.mjs`).
- A press that cannot be undone asks first in its own place, with the safe
  answer where the control stood (`page/feedback/ask_first.tsx`).
- One table says what a key does, and a held key is no second press
  (`page/keys/keys.ts`, `page/kit/held_press.ts`).
- A colour, a size or a time is a token stated once (`page/theme/tokens.css`).
- `shell/main.mjs` is the only file that imports Electron, and it decides
  nothing (`test/shell/shell-parses.test.mjs`, `test/shell/dialog-place-holds.test.mjs`).
