# Module: theme

Every colour, size and time the page uses is a token, stated once. The dark
scheme gives the same tokens other values. Less motion sets the one time to
zero.

## What this module is

- `page/theme/tokens.css` states the tokens on `:root`: surfaces
  (`--surface`, `--surface-back`, `--surface-sunk`), `--line`, `--ink`,
  `--ink-soft`, `--accent` with `--accent-ink` and `--accent-soft`,
  `--danger`, `--good`, `--shade`, the fonts and three text sizes, five
  spaces, `--row`, `--radius`, `--bar`, `--dock`, and one time, `--quick`.
- Each colour means one thing. `--accent` is the thing to press or the thing
  in hand. `--danger` is what cannot be undone or went wrong. `--good` is
  what is done.
- A component names a token and never a number. The help card's pictures are
  drawn from the same tokens.
- Dark is the same tokens with other values, in two places that hold the same
  numbers: `:root[data-scheme='dark']`, and
  `@media (prefers-color-scheme: dark)` on `:root:not([data-scheme='light'])`.
  There is no second set of rules for a dark page.
- The scheme is a setting: `system`, `light` or `dark`. The shell sets
  `nativeTheme.themeSource` for the whole window, and the page marks only a
  choice that is not the system's, as `data-scheme` on the root element
  (`App` in `page/app/app.tsx`).
- Less motion: under `prefers-reduced-motion: reduce`, `--quick` is `0ms`.
  Every transition in `app.css` is timed by `--quick`, so nothing moves and
  everything still happens.
- `page/theme/app.css` holds the page's rules: the title bar, the work area,
  fields, buttons, the off state, the ring, the said line, sheets, the help
  card, notices. Lines that say something keep their room, so nothing moves
  when a state changes.
- The policy allows styles from `'self'` only, so a style is a class in a
  stylesheet. Two elements have their style set by React on the element: the
  poster's title (its size, opacity and turn are the document) and the help
  card's place.

## Files (the module boundary)

- `page/theme/tokens.css`: the tokens, dark, reduced motion.
- `page/theme/app.css`: the page's rules.
- `page/main.tsx`: imports both.
- `page/app/app.tsx`: sets `data-scheme`.
- `shell/settings.mjs`: the `scheme` setting.
- `shell/main.mjs`: `nativeTheme.themeSource`, and the window's background
  colour before the page has drawn.

## Adopt into an existing app

1. Copy `tokens.css`. Change the values, keep the names and what each means.
2. Replace every colour, size and duration in your stylesheets with a token.
3. Delete any separate dark stylesheet. Give the tokens dark values in the two
   places.
4. Time every transition with `--quick`.
5. Add the `scheme` setting, set `nativeTheme.themeSource` from it at launch
   and when it changes, and mark `data-scheme` on the root in the page.
6. Set the window's `backgroundColor` to the two values of `--surface-back`,
   so the window does not flash before the page draws.

## Verify adoption

- `npm run types` and `npm run test:page` still pass.
- Search the stylesheets but `tokens.css` for `#` and `rgb(`: nothing is
  found.
- Set the scheme to Light, Dark and System in Settings. Each takes at once.

## Gotcha: the dark values are written twice

CSS has no way to share a block between a selector and a media query. Change a
dark value in both places. No test compares them.

## Gotcha: the window's background is a number in the shell

`main.mjs` writes `#17181a` and `#f6f5f2` for the window before the page
draws. They are the two values of `--surface-back`. Change them together.
