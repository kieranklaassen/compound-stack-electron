# Module: help

Hover to learn. One set of listeners and one card for the whole window. Rest
the pointer on a control for its tip, hold Option for the whole card. All of
the text comes from the control's row.

## What this module is

- `watchHelp({ mode })` watches the document and sets one store, `helpShown`.
  It answers a function that stops watching and leaves nothing behind.
- A control is any element with `data-action`. Its help is `helpOf(row, part)`
  from `page/agent/rows.ts`. No component writes a `title` or help text of its
  own, and the coverage test fails one that does.
- Rest the pointer on a control for `REST_MS` (700 ms) and its tip shows: the
  row's name and its key.
- While the person is reading tips the next one shows after `WARM_MS`
  (150 ms): a tip is showing, or one went within the last `WARM_WITHIN_MS`
  (500 ms).
- Hold Option (Alt) while a tip shows and it grows into the whole card: the
  picture, `first`, `how`, `after`. Let go and it is the tip again. Option
  with another key, or a repeat, is not a question.
- The tip says "Hold ⌥ for more" until Option has been held on a tip `HINTS`
  (3) times. The count is kept in `localStorage`.
- Help mode (the Help button, the menu's What Is This?, Cmd or Ctrl with `/`)
  shows the whole card at once, with no rest. Escape leaves it.
- A control the keyboard reached (`:focus-visible`) shows its tip too. One the
  pointer pressed does not: a press hides the tip, except in Help mode.
- A control that is off shows why. The card draws the control's `data-says`
  (see [feedback](feedback.md)).
- The tip goes at Escape, at a scroll, at a resize and when the window loses
  the keyboard. Touch is passed over.
- `HelpCard` draws what the store says, under the control or over it where
  there is no room under, kept inside the window. Its key is `keyShown` from
  the key table.
- A row names its picture by a word. `PICTURES` in `pictures.tsx` draws every
  word as SVG from the theme's tokens: never a bitmap, a screenshot or a
  colour by number.
- Show me: `showControl(id, part)` opens the sheet that holds the control (the
  row's `holder`) through the view and rings the control for `RING_MS`
  (8 seconds). It presses nothing and runs no action. An agent points with it
  through the tool `show_control`.
- It keeps no timer at rest. One timeout runs only while the pointer rests on
  a control that has not shown its tip yet.

## Files (the module boundary)

- `page/help/watch.ts`: `watchHelp`, `helpShown`, `Shown`, `REST_MS`,
  `WARM_MS`, `WARM_WITHIN_MS`, `HINTS`.
- `page/help/card.tsx`: `HelpCard`.
- `page/help/pictures.tsx`: `PICTURES`, `PictureName`.
- `page/help/show.ts`: `showControl`, `RING_MS`.
- `page/help/watch.test.ts`.
- `page/theme/app.css`: the `.help-card` rules, the ring, the Help mode
  cursor.
- `page/agent/rows.ts`: where the text lives.

## Adopt into an existing app

1. Adopt [agent_surface](agent_surface.md): rows, and `data-action` on every
   control.
2. Copy the four files of `page/help/` and the card's rules from `app.css`.
3. Call `watchHelp({ mode: () => view.get().helpMode })` once for the window
   and stop it when the app goes. Render one `<HelpCard />` at the root.
4. Add a Help mode flag to your view and a command that turns it.
5. Draw a picture for each word a row names, from tokens.
6. Give each row whose control lives in a sheet a `holder`, and teach
   `showControl` to open it.
7. Delete every tooltip and `title` in your components.

## Verify adoption

- `npm run test:page` (`watch.test.ts`: the rest, the warm window, Option, the
  hint's three holds, Help mode, why a control is off, no timer at rest).
- `npm run test:e2e`: `launch.test.mjs` hovers Save, sees the tip, holds Alt
  and sees the whole card.

## Gotcha: `aria-disabled`, not `disabled`

A disabled button hears no pointer, so the card could not say why it is off.
The kit's button is turned off with `aria-disabled` and passes over the click
itself.

## Gotcha: the hint is counted by holds, not by tips shown

The count goes up when Option is pressed while a tip shows. A person who never
holds Option sees the hint on every tip.
