// A stand-in for the shell, so the page runs in Vitest and in a plain browser
// with nothing of Electron. It answers every door of
// `shell/doors.json` from memory, with the shell's own shapes and sentences.
// A test steers it through `standIn`.

import type { AccountState, Answer, Bridge, Kept, Settings, Told, UpdateState } from './shell'

const NOT_THE_PRESS = 'That is done with your own press in the app.'

export interface StandIn extends Bridge {
  standIn: {
    asks: Array<{ door: string; method: string; args: unknown[]; askedBy?: string }>
    account: AccountState
    updates: UpdateState
    settings: Settings
    kept: Kept
    saved: Map<string, unknown>
    /** What the next check finds: a version, or null for nothing newer. */
    nextUpdate: { version: string; size: number } | null
    /** Whether an ask with no agent named counts as the person's press. Tests set it. */
    pressed: boolean
    approve(email?: string): void
    tell(told: Told): void
  }
}

export function standInBridge(): StandIn {
  const listeners = new Set<(told: Told) => void>()
  const tell = (told: Told) => listeners.forEach((listener) => listener(told))
  const state: StandIn['standIn'] = {
    asks: [],
    account: { state: 'signed_out' },
    updates: { state: 'current', running: '0.1.0', newer: null, fetched: 0, seen: null, failed: null, cannot: null, waits: null },
    settings: { scheme: 'system', fetchUpdates: true, installAtQuit: true },
    kept: { state: 'none' },
    saved: new Map(),
    nextUpdate: null,
    pressed: true,
    approve(email = 'you@example.com') {
      state.account = { state: 'signed_in', email }
      tell({ about: 'account', value: state.account })
    },
    tell,
  }
  const updates = (changes: Partial<UpdateState>) => {
    state.updates = { ...state.updates, ...changes }
    tell({ about: 'updates', value: state.updates })
    return state.updates
  }
  const account = (next: AccountState) => {
    state.account = next
    tell({ about: 'account', value: next })
    return next
  }
  let files = 0

  const doors: Record<string, Record<string, (args: unknown[], own: boolean) => unknown>> = {
    app: {
      about: () => ({ name: 'Compound', version: '0.1.0', server: null, platform: 'browser' }),
      unsaved: () => true,
      openOutside: () => true,
    },
    account: {
      state: () => state.account,
      start: (_args, own) => (own ? account({ state: 'waiting', code: 'WXYZ-2345' }) : refuse(NOT_THE_PRESS)),
      openAgain: () => state.account,
      cancel: () => account({ state: 'signed_out' }),
      signOut: () => account({ state: 'signed_out' }),
    },
    documents: {
      open: () => null,
      save: ([id, document]) => {
        const file = typeof id === 'string' ? id : `file-${(files += 1)}`
        state.saved.set(file, document)
        state.kept = { state: 'none' }
        return { id: file, name: 'Untitled.compound' }
      },
    },
    recovery: {
      keep: ([document]) => {
        state.kept = { state: 'kept', document }
        return true
      },
      take: () => state.kept,
      drop: (_args, own) => {
        if (!own) return refuse(NOT_THE_PRESS)
        state.kept = { state: 'none' }
        return true
      },
    },
    settings: {
      read: () => state.settings,
      set: ([key, value]) => {
        state.settings = { ...state.settings, [key as string]: value }
        tell({ about: 'settings', value: state.settings })
        return state.settings
      },
    },
    updates: {
      state: () => state.updates,
      check: () => {
        updates({ state: 'looking', failed: null })
        return state.nextUpdate
          ? updates({ state: 'ready', newer: state.nextUpdate, seen: Date.now() })
          : updates({ state: 'current', newer: null, seen: Date.now() })
      },
      download: (_args, own) => (own ? updates({ state: 'ready' }) : refuse(NOT_THE_PRESS)),
      restart: (_args, own) => (own ? updates({ state: 'installing' }) : refuse(NOT_THE_PRESS)),
    },
  }

  return {
    standIn: state,
    async ask(door, method, args, askedBy) {
      state.asks.push({ door, method, args, askedBy })
      const found = doors[door]?.[method]
      if (!found) return { ok: false, refused: 'That did not work.', code: 'no_such_door' }
      try {
        return { ok: true, value: found(args, state.pressed && !askedBy) ?? null } as Answer<unknown>
      } catch (error) {
        if (error instanceof Refusal) return { ok: false, refused: error.message }
        return { ok: false, refused: 'That did not work.' }
      }
    },
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

class Refusal extends Error {}
function refuse(sentence: string): never {
  throw new Refusal(sentence)
}
