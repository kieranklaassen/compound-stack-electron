// The coverage rows: one for everything a person can do in the window.
//
// A row is the one place a control is described. It carries its help (what the
// tooltip, the help card and `find_tools` all show), its key by way of the key
// table, and the tool an agent runs to do the same thing. A control names its
// row with `data-action`; where several controls share a row, each names its
// part with `data-help`.
//
// So: no help text and no `title` in a component, and no control without a row.
// `agent/coverage.test.ts` fails on either.

import type { PictureName } from '../help/pictures'

export interface Help {
  /** Two or three words. */
  name: string
  /** One to three plain sentences: what it does. */
  how: string
  /** What to do next, where that helps. */
  after?: string
  /** What to do before the control is there or on, where that helps. */
  first?: string
  picture?: PictureName
}

export interface Row extends Help {
  id: string
  /** The command whose key is shown with the row (keys/keys.ts). */
  command?: string
  /** The tool that does what the control does. */
  tool?: string
  /** Why no tool does it: a sentence. A row has a tool or this, never neither. */
  personOnly?: string
  /** The sheet that holds the control, so Show me can open it. */
  holder?: 'settings'
  parts?: Record<string, Help>
}

const PRESS = 'It acts for you outside the app, so it is your own press.'

export const ROWS: Row[] = [
  { id: 'set_title', name: 'Title', how: 'The words on the poster. Type, then press Return.', tool: 'set_title' },
  {
    id: 'set_number',
    name: 'A number',
    how: 'Drag up or to the right for more, down or to the left for less. Hold Shift for finer steps. Click to type a number instead.',
    after: 'A whole drag is one step of Undo.',
    picture: 'drag-number',
    tool: 'set_number',
    parts: {
      size: { name: 'Size', how: 'How large the title is drawn, in points. Drag it, or click to type.', picture: 'drag-number' },
      opacity: { name: 'Opacity', how: 'How solid the title is, from 0 to 100 percent. Drag it, or click to type.', picture: 'drag-number' },
      turn: { name: 'Turn', how: 'How far the title is turned, in degrees. Drag it, or click to type.', picture: 'drag-number' },
    },
  },
  { id: 'undo', name: 'Undo', how: 'Takes back the last change. A whole drag is one step.', command: 'undo', picture: 'undo-step', tool: 'undo' },
  { id: 'redo', name: 'Redo', how: 'Makes the change that Undo took back.', command: 'redo', tool: 'redo' },
  { id: 'new_document', name: 'New', how: 'Starts a new poster.', first: 'Save the open one first: nothing is thrown away for a new one.', command: 'new_document', tool: 'new_document' },
  { id: 'open_document', name: 'Open', how: 'Opens a poster you pick in the system dialog.', command: 'open_document', tool: 'open_document' },
  {
    id: 'save_document',
    name: 'Save',
    how: 'Saves the poster. The first save asks where.',
    after: 'What came of it is said beside the button.',
    command: 'save_document',
    tool: 'save_document',
  },
  { id: 'help_mode', name: 'Help mode', how: 'Shows the whole help card as soon as the pointer is on a control. Press it again, or Escape, to leave.', command: 'help_mode', tool: 'set_view' },
  { id: 'open_settings', name: 'Settings', how: 'Opens the settings: how the app looks, your account and updates.', command: 'open_settings', tool: 'set_view' },
  { id: 'close_settings', name: 'Done', how: 'Closes the settings. Escape does the same.', tool: 'set_view', holder: 'settings' },
  {
    id: 'set_scheme',
    name: 'Appearance',
    how: 'Light, dark, or whatever the computer is set to.',
    tool: 'set_setting',
    holder: 'settings',
    parts: {
      system: { name: 'System', how: 'Follows the computer: light by day and dark by night, where it is set so.' },
      light: { name: 'Light', how: 'Always light.' },
      dark: { name: 'Dark', how: 'Always dark.' },
    },
  },
  {
    id: 'sign_in',
    name: 'Sign in',
    how: 'Opens your browser, where you approve this app. The app shows a code; check that the browser shows the same one.',
    after: 'When you have approved, the app is signed in by itself.',
    personOnly: PRESS,
    holder: 'settings',
  },
  { id: 'open_sign_in_again', name: 'Open the browser again', how: 'Opens the approval page again, for the same code.', personOnly: PRESS, holder: 'settings' },
  { id: 'cancel_sign_in', name: 'Cancel', how: 'Stops waiting for your approval. Nothing is signed in.', tool: 'cancel_sign_in', holder: 'settings' },
  { id: 'sign_out', name: 'Sign out', how: 'Signs this app out. Your documents stay on this computer.', personOnly: PRESS, holder: 'settings' },
  {
    id: 'check_for_updates',
    name: 'Check for updates',
    how: 'Asks the server whether a newer version is out. The line beside it says what was found and when.',
    first: 'Sign in: updates come from your account’s server.',
    picture: 'update',
    tool: 'check_for_updates',
    holder: 'settings',
  },
  {
    id: 'download_update',
    name: 'Download',
    how: 'Downloads the newer version now. It is checked before it is ever installed.',
    personOnly: 'It fetches a new build of the app, so it is your own press.',
    holder: 'settings',
  },
  {
    id: 'restart_to_update',
    name: 'Restart to update',
    how: 'Quits the app, puts the new version in its place and opens it again.',
    first: 'Save your document: nothing is installed over unsaved work.',
    picture: 'update',
    personOnly: 'It quits the app, so it is your own press.',
    holder: 'settings',
  },
  { id: 'set_fetch_updates', name: 'Download updates', how: 'When on, a newer version is downloaded by itself when it is found. Nothing is installed until you restart or quit.', tool: 'set_setting', holder: 'settings' },
  { id: 'set_install_at_quit', name: 'Install when I quit', how: 'When on, a downloaded version is put in place as you quit, so the next launch is the new one.', tool: 'set_setting', holder: 'settings' },
  { id: 'recover_document', name: 'Recover', how: 'Opens the work that was kept, as it was when the app closed. It is unsaved until you save it.', personOnly: 'What is done with kept work is yours to say.' },
  {
    id: 'discard_kept',
    name: 'Discard',
    how: 'Throws the kept work away. It asks first, and cannot be undone.',
    picture: 'ask-first',
    personOnly: 'It throws work away for good.',
    parts: { keep: { name: 'Keep', how: 'Leaves the kept work where it is.' } },
  },
  { id: 'discard_kept_answer', name: 'Discard', how: 'Throws the kept work away for good.', personOnly: 'It throws work away for good.' },
  { id: 'notice_action', name: 'Notice action', how: 'Does what the notice offers, such as Undo.', tool: 'run_notice_action' },
  { id: 'dismiss_notice', name: 'Dismiss', how: 'Puts the notice away.', tool: 'dismiss_notice' },
]

const BY_ID = new Map(ROWS.map((row) => [row.id, row]))

export const rowOf = (id: string): Row | undefined => BY_ID.get(id)

/** A row's help as a control shows it: the part's where the control names one. */
export function helpOf(id: string, part?: string): (Help & { command?: string }) | undefined {
  const row = BY_ID.get(id)
  if (!row) return undefined
  const own = part ? row.parts?.[part] : undefined
  return own ? { ...own, command: row.command } : row
}
