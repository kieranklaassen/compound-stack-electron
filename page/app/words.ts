// Every sentence the example app says is written once, here. A component and a
// tool both read them; neither writes one of its own.

import type { AccountState, UpdateState } from '../shell'

const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1_000_000))} MB`
const clock = (time: number) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Where the updater stands, as the line under Check for updates. */
export function updateSays(state: UpdateState | null): { says: string; tone: 'plain' | 'good' | 'bad' } {
  if (!state) return { says: '', tone: 'plain' }
  switch (state.state) {
    case 'off':
      return { says: state.cannot ?? 'This build does not update itself.', tone: 'plain' }
    case 'looking':
      return { says: 'Checking…', tone: 'plain' }
    case 'current':
      return { says: state.seen ? `Up to date. Last checked ${clock(state.seen)}.` : 'Not checked yet.', tone: state.seen ? 'good' : 'plain' }
    case 'available':
      return { says: `Version ${state.newer?.version} is out (${megabytes(state.newer?.size ?? 0)}).`, tone: 'plain' }
    case 'fetching':
      return { says: `Downloading version ${state.newer?.version}: ${megabytes(state.fetched)} of ${megabytes(state.newer?.size ?? 0)}.`, tone: 'plain' }
    case 'ready':
      return { says: state.waits ?? `Version ${state.newer?.version} is ready. It is installed when you restart.`, tone: 'good' }
    case 'installing':
      return { says: 'Restarting to update…', tone: 'plain' }
    case 'failed':
      return { says: state.failed?.says ?? 'The update did not work.', tone: 'bad' }
  }
}

export function accountSays(state: AccountState): string {
  switch (state.state) {
    case 'off':
    case 'unknown':
      return state.says
    case 'signed_out':
      return state.says ?? 'Not signed in.'
    case 'waiting':
      return 'Check that your browser shows this code, then approve there.'
    case 'signed_in':
      return `Signed in as ${state.email}.`
  }
}

export const SAVE_FIRST = 'Save the document first, or undo your changes.'
export const NOT_SAVED = 'Not saved.'
export const KEPT_FROM_LAST_TIME = 'The app closed before this document was saved. Your work was kept.'
export const KEPT_UNREAD = 'Work was kept from last time, and this version cannot read it. It was set aside, not removed.'
export const ONLY_YOUR_PRESS = 'That is done with your own press in the app.'
