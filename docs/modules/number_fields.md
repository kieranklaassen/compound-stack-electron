# Module: number_fields

A number field is dragged as well as typed in. Typing and dragging end in the
same action, and a whole drag is one undo step.

## What this module is

- The arithmetic is stated once and is pure (`page/kit/scrub.ts`).
  `scrubbed(start, dx, dy, field, fine)` answers the value of a drag: up or to
  the right is more, `PIXELS_A_STEP` (2) pixels are one step of the field's
  `step`, and it stops at the field's `min` and `max` and says nothing of it.
- Shift makes a step a tenth (`FINE`). The value is rounded to the step's own
  decimals, so no float shows.
- A press that moves less than `CLICK_WITHIN` (3) pixels is a click
  (`isClick`): the field takes the keyboard and its text is selected, to type.
- `useScrub({ field, value, begin, onScrub, end })` hears the pointer. Spread
  what it returns on the input. A field that has the keyboard is being typed
  in and is not dragged.
- A whole drag is one undo step. The hook calls `begin()` at the first move
  past a click and hands the gesture's number to every `onScrub` of that drag.
  The editor joins changes of one gesture into one step (`beginGesture`,
  `change`, `letGo` in `page/app/editor.ts`). `end()` lets the gesture go.
- A move that lands on the number already there calls nothing.
- A value a drag passes that is refused changes nothing and is not said. A
  typed value that is no number of the field is said in a brief notice.
- `NumberInput` shows the number with its unit, a draft while it is typed in,
  commits on Return and on blur, and drops the draft on Escape.
- A drag has no action, tool or row of its own. The field's row and tool
  (`set_number`) cover both.
- Undo and Redo let a drag go first, so undo takes back the whole of it.

## Files (the module boundary)

- `page/kit/scrub.ts`: `scrubbed`, `isClick`, `ScrubField`, `PIXELS_A_STEP`,
  `CLICK_WITHIN`, `FINE`.
- `page/kit/use_scrub.ts`: `useScrub`.
- `page/kit/number_field.tsx`: `NumberInput`.
- `page/app/editor.ts`: `beginGesture`, `letGo`, `change`, `setNumber`.
- `page/app/document.ts`: `NUMBERS` (each field's min, max, step, unit),
  `parseNumber`, `shown`, `rangeSays`.
- `page/kit/scrub.test.ts`, `page/app/editor.test.ts`, and the drag cases in
  `page/app/app.test.tsx`.
- `page/theme/app.css`: the cursor of a field that is dragged.

## Adopt into an existing app

1. Copy `scrub.ts`, `use_scrub.ts` and `scrub.test.ts`.
2. Give your undo a gesture: a function that begins one and answers its
   number, a change that joins the latest step when it carries the same
   number, and a function that lets it go. Copy the three from `editor.ts`.
3. Never let a change that names an agent join a gesture.
4. In each number field, call `useScrub` with the field's bounds, its value,
   and your three functions. Spread the result on the `<input>`.
5. Send a step of a drag through the field's own setter, the one typing uses.
6. Call the let-go before undo and before redo.

## Verify adoption

- `npm run test:page` (`scrub.test.ts`, `editor.test.ts`, and "drags a number
  field, and the whole drag is one undo step").
- `npm run test:e2e`: `launch.test.mjs` drags Size 40 pixels to the right,
  reads `84pt`, presses Undo once and reads `64pt`.

## Gotcha: the press is held back from focusing

`onPointerDown` prevents the default, so the field does not take the keyboard
until the press is known to be a click. Without that, every drag would start
by focusing the field, and a focused field is not dragged.
