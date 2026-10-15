// The page's tools: everything a person can do in the window that an agent may
// do too. A tool runs the same action its control runs, never a copy of it.
//
// A tool never takes a credential and never answers with one, takes no place on
// the disk, and none stands in for a press that is the person's own (signing
// in, restarting to update, throwing kept work away). Those rows say why.

import { cancelSignIn, checkForUpdates, newDocument, openDocument, saveDocument, sayWithUndo, setSetting } from '../app/actions'
import { type NumberKey, NUMBERS } from '../app/document'
import { editor, letGo, redo, setNumber, setTitle, undo, unsaved } from '../app/editor'
import { account, settings, updates } from '../app/session'
import { setView, view } from '../app/view'
import { updateSays } from '../app/words'
import { dismiss, notices } from '../feedback/notices'
import { Sentence } from '../feedback/sentence'
import { showControl } from '../help/show'
import { ROWS } from './rows'
import { runTool, type Tool } from './run'

const none = { type: 'object', properties: {}, additionalProperties: false } as const

const done = (result: { ok: true } | { ok: false; says: string }, changedBy?: string) => {
  if (!result.ok) throw new Sentence(result.says)
  // A change the person did not make is said, with the way back.
  if (changedBy && editor.get().undo.length > 0) sayWithUndo(`${changedBy} changed the poster.`)
  return state()
}

/** What the window holds, as an agent reads it. No place on the disk, no token, no address. */
function state() {
  const now = editor.get()
  const signedIn = account.get()
  return {
    document: now.document,
    file: now.file?.name ?? null,
    unsaved: unsaved(now),
    canUndo: now.undo.length > 0,
    canRedo: now.redo.length > 0,
    view: view.get(),
    settings: settings.get(),
    account: signedIn.state === 'signed_in' ? { state: 'signed_in' } : { state: signedIn.state },
    update: { state: updates.get()?.state ?? 'unknown', says: updateSays(updates.get()).says },
    notices: notices.get().map(({ id, text, kept, action }) => ({ id, text, kept, action: action?.label ?? null })),
  }
}

export const PAGE_TOOLS: Tool[] = [
  { name: 'get_state', description: 'Read the document, whether it is unsaved, the view, the settings and where the updater stands.', schema: none, readOnly: true, run: state },
  {
    name: 'find_tools',
    description: 'Find the control and the tool for something a person can do, by words. Answers each match with its help.',
    schema: { type: 'object', properties: { words: { type: 'string' } }, required: ['words'], additionalProperties: false },
    readOnly: true,
    run: ({ words }) => {
      const wanted = String(words).toLowerCase().split(/\s+/).filter(Boolean)
      return ROWS.filter((row) => wanted.every((word) => `${row.name} ${row.how} ${row.id}`.toLowerCase().includes(word))).map((row) => ({
        control: row.id,
        name: row.name,
        how: row.how,
        tool: row.tool ?? null,
        personOnly: row.personOnly ?? null,
      }))
    },
  },
  {
    name: 'show_control',
    description: 'Point at a control for the person: opens what holds it and rings it for a few seconds. It presses nothing.',
    schema: { type: 'object', properties: { control: { type: 'string' }, part: { type: 'string' } }, required: ['control'], additionalProperties: false },
    run: ({ control, part }) => {
      if (!showControl(String(control), typeof part === 'string' ? part : undefined)) throw new Sentence('There is no such control on the screen.')
      return { shown: control }
    },
  },
  {
    name: 'set_title',
    description: 'Set the words on the poster. One undo step.',
    schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'], additionalProperties: false },
    run: ({ title }, { by }) => done(setTitle(String(title), { by }), by),
  },
  {
    name: 'set_number',
    description: `Set one number of the poster: ${Object.entries(NUMBERS)
      .map(([key, field]) => `${key} (${field.min} to ${field.max}${field.unit})`)
      .join(', ')}. One undo step.`,
    schema: {
      type: 'object',
      properties: { field: { type: 'string', enum: Object.keys(NUMBERS) }, value: { type: 'number' } },
      required: ['field', 'value'],
      additionalProperties: false,
    },
    run: ({ field, value }, { by }) => done(setNumber(field as NumberKey, value as number, { by }), by),
  },
  { name: 'undo', description: 'Take back the last change.', schema: none, run: () => (letGo(), done(undo())) },
  { name: 'redo', description: 'Make the change that undo took back.', schema: none, run: () => (letGo(), done(redo())) },
  { name: 'new_document', description: 'Start a new poster. Refused while the open one is unsaved.', schema: none, run: () => ({ says: newDocument() }) },
  {
    name: 'open_document',
    description: 'Show the system dialog in which the person picks a poster to open. Takes no place: the person picks.',
    schema: none,
    run: async (_args, { by }) => ({ says: await openDocument({ by }) }),
  },
  {
    name: 'save_document',
    description: 'Save the poster. Where it has no file yet, the system dialog asks the person where. Takes no place.',
    schema: none,
    run: async (_args, { by }) => ({ says: await saveDocument({ by }) }),
  },
  {
    name: 'set_view',
    description: 'Open or close the settings sheet, or turn Help mode on or off.',
    schema: { type: 'object', properties: { sheet: { type: 'string', enum: ['settings', 'none'] }, helpMode: { type: 'boolean' } }, additionalProperties: false },
    run: ({ sheet, helpMode }) => {
      if (sheet !== undefined) setView({ sheet: sheet === 'settings' ? 'settings' : null })
      if (helpMode !== undefined) setView({ helpMode: helpMode === true })
      return view.get()
    },
  },
  {
    name: 'set_setting',
    description: 'Change a setting: scheme (system, light, dark), fetchUpdates or installAtQuit (true or false).',
    schema: {
      type: 'object',
      properties: { scheme: { type: 'string', enum: ['system', 'light', 'dark'] }, fetchUpdates: { type: 'boolean' }, installAtQuit: { type: 'boolean' } },
      additionalProperties: false,
    },
    run: async (args, { by }) => {
      for (const [key, value] of Object.entries(args)) await setSetting(key as 'scheme', value as 'system', { by })
      return settings.get()
    },
  },
  {
    name: 'check_for_updates',
    description: 'Ask whether a newer version is out. Downloading and restarting to update are the person’s own press.',
    schema: none,
    run: async (_args, { by }) => ({ says: await checkForUpdates({ by }) }),
  },
  { name: 'cancel_sign_in', description: 'Stop waiting for the person’s approval of a sign-in.', schema: none, run: async (_args, { by }) => (await cancelSignIn({ by }), state().account) },
  {
    name: 'dismiss_notice',
    description: 'Put a notice away, by its id from get_state.',
    schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'], additionalProperties: false },
    run: ({ id }) => (dismiss(id as number), state().notices),
  },
  {
    name: 'run_notice_action',
    description: 'Do what a notice offers (such as Undo), by the notice’s id from get_state.',
    schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'], additionalProperties: false },
    run: ({ id }) => {
      const notice = notices.get().find((found) => found.id === id)
      if (!notice?.action) throw new Sentence('That notice offers nothing to do.')
      notice.action.run()
      dismiss(notice.id)
      return state()
    },
  },
]

/** The page's door for an agent: the tools as a list, and the one way to run one. A local MCP bridge attaches here. */
export const pageAgent = {
  tools: () => PAGE_TOOLS.map(({ name, description, schema, readOnly }) => ({ name, description, inputSchema: schema, readOnly: readOnly === true })),
  run: (name: string, args: unknown, by?: string) => runTool(PAGE_TOOLS, name, args, by),
}
