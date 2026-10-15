// Where a dialog of the system's stands. One hung from the window is a sheet in
// the middle of it, where the person is looking. One hung from nothing stands
// wherever the system puts it, often behind the app in front: a dialog nobody
// sees. So every dialog asks here for its window, and `main.mjs` is the only
// file that shows one (test/shell/dialog-place-holds.test.mjs holds it to that).
//
// The rule knows no Electron: it is handed what the window says of itself.

/**
 * What to do before a dialog is shown.
 * `window`: `{ there, minimized, visible }`. `inTheWay`: something of the
 * shell's own is over the screen on purpose, and nothing may come forward.
 */
export function dialogPlace({ window, inTheWay = false }) {
  if (!window?.there) return { parent: false, ready: [] }
  if (inTheWay) return { parent: window.visible && !window.minimized, ready: [] }
  const ready = []
  if (window.minimized) ready.push('restore')
  if (!window.visible) ready.push('show')
  ready.push('focus')
  return { parent: true, ready }
}
