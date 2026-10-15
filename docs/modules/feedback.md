# Module: feedback

A press says what came of it where the press was. A press that cannot be
undone asks first in its own place. What happens elsewhere is a notice. A
control that cannot be used is shown, off, and says why.

## What this module is

- `usePressed()` answers `{ busy, said, run, say }`. `run(work)` runs the work
  of a press: `busy` is true until it ends, then `said` holds what the work
  answered (a sentence, or `{ says, tone }`). A second press while the first
  works is no press.
- Only a sentence written for a person is shown. Work that throws a `Sentence`
  is said in its words, with the tone `bad`. Any other error says "That did
  not work.", since an error's own words may hold a path or an address.
- `<Said said busy working />` is the line the answer stands in, beside the
  control. It says `working` while busy. It keeps its room while it says
  nothing, so no control moves when a sentence arrives. It is a `status`
  region.
- `<AskFirst />` is the control for a press that cannot be undone. Pressed, it
  turns into the question: Keep where the control stood, then the sentence,
  then the answering button. So the second click of a double click lands on
  Keep. The answering button passes over a click whose `detail` is over 1.
  Escape keeps. It is never a dialog of the system's or the browser's.
- The answering button is a control with a row of its own (`answerAction`).
- Notices are for what happened where the person is not looking.
  `brief(text)` goes by itself after `BRIEF_MS` (4 seconds). `keep(text,
  { code, action })` stays until it is dismissed and may carry one action
  (Undo is the usual one). The same sentence is said once, and at most
  `NOTICES_MOST` (3) show.
- `<NoticesView />` draws them at the foot of the window, over the page:
  nothing moves when one comes or goes.
- A control that cannot be used now is shown, never hidden. `<Button off="…">`
  and `<Switch off="…">` set `aria-disabled` and `data-says`, and the one help
  card shows the sentence (see [help](help.md)).
- `<Button busy>` is off and sets `aria-busy` while its press works.

## Files (the module boundary)

- `page/feedback/said.tsx`: `usePressed`, `Said`, `Saying`, `Tone`.
- `page/feedback/ask_first.tsx`: `AskFirst`.
- `page/feedback/notices.ts`: `notices`, `brief`, `keep`, `dismiss`,
  `BRIEF_MS`, `NOTICES_MOST`.
- `page/feedback/notices_view.tsx`: `NoticesView`.
- `page/feedback/sentence.ts`: `Sentence`.
- `page/kit/button.tsx`: `Button`.
- `page/kit/switch.tsx`: `Switch`.
- `page/feedback/feedback.test.tsx`.
- `page/theme/app.css`: the `.said`, `.ask-first` and `.notices` rules.

## Adopt into an existing app

1. Copy `page/feedback/` and the kit's `button.tsx` and `switch.tsx`.
2. Have every action answer a sentence or throw a `Sentence` (see
   [agent_surface](agent_surface.md)).
3. For each button whose press takes time or can fail: `const pressed =
   usePressed()`, `onPress={() => pressed.run(action)}`, and a `<Said />`
   beside it.
4. Replace every `confirm()` and every confirming dialog with `<AskFirst />`.
5. Replace every control that is hidden when it cannot be used with one that
   is `off` with its sentence.
6. Render one `<NoticesView />` at the root. Use `keep` with an Undo action
   for a change the person did not make.

## Verify adoption

- `npm run test:page` (`feedback.test.tsx`, and in `app.test.tsx` "shows Undo
  turned off, with why, rather than hiding it" and "checks for updates and
  says what was found, where the press was").
- `npm run test:e2e`: a save says "Saved as poster.compound." beside the
  button.

## Gotcha: what a press answered is not a notice

Say it in the `<Said />` beside the press. A notice for it is read somewhere
the person is not looking. The commands a key or the menu runs have no button
to stand beside, so those use `brief`.

## Gotcha: a kept notice's action runs once

Pressing a notice's action dismisses the notice. The Undo that `sayWithUndo`
offers undoes only while its step is still the latest, and says so otherwise.
