// The app's menu as plain data, so a test can read it. `main.mjs` turns it into
// Electron's menu; an item with `ask` is sent to the page, which runs the same
// action its own button runs. The menu never runs a second copy of an action.

export function menuOf({ name, mac, dev = false }) {
  const app = {
    label: name,
    submenu: [
      { role: 'about' },
      { label: 'Check for Updates…', ask: 'check_for_updates' },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', ask: 'open_settings' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }
  const file = {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', ask: 'new_document' },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', ask: 'open_document' },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', ask: 'save_document' },
      { label: 'Save As…', accelerator: 'Shift+CmdOrCtrl+S', ask: 'save_document_as' },
      // Off the Mac there is no app menu, so Settings and Quit are here.
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', ask: 'open_settings' }, { type: 'separator' }, { role: 'quit' }]),
    ],
  }
  const edit = {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', ask: 'undo' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', ask: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  }
  const help = {
    label: 'Help',
    submenu: [
      { label: 'What Is This?', accelerator: 'CmdOrCtrl+/', ask: 'help_mode' },
      ...(mac ? [] : [{ label: 'Check for Updates…', ask: 'check_for_updates' }]),
    ],
  }
  // A checkout can load the page again and open the inspector. A packaged build cannot.
  const develop = { label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] }
  return [...(mac ? [app] : []), file, edit, ...(dev ? [develop] : []), { role: 'windowMenu' }, help]
}

/** Every `ask` a menu sends, for the test that holds each to a page command. */
export const asksOf = (menu) => menu.flatMap((top) => (top.submenu ?? []).map((item) => item.ask).filter(Boolean))
