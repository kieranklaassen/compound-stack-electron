// What the shell gives the page, typed in one place. Import from here; never
// read `window` for it anywhere else.
//
// The page reaches the shell through one function, `ask(door, method, args)`,
// and the doors it may name are the list in `shell/doors.json`, which the shell
// is held to by its own test. Every answer is `{ ok: true, value }` or
// `{ ok: false, refused }`, where `refused` is a sentence for a person.

import DOORS from '../shell/doors.json'
import { Sentence } from './feedback/sentence'
import { standInBridge } from './stand_in_bridge'

export type Answer<T> = { ok: true; value: T } | { ok: false; refused: string; code?: string }

export interface About {
  name: string
  version: string
  server: string | null
  platform: string
}

export type AccountState =
  | { state: 'off'; says: string }
  | { state: 'signed_out'; says?: string }
  | { state: 'waiting'; code: string }
  | { state: 'signed_in'; email: string }
  | { state: 'unknown'; says: string }

export interface UpdateState {
  state: 'off' | 'current' | 'looking' | 'available' | 'fetching' | 'ready' | 'installing' | 'failed'
  running: string
  newer: { version: string; size: number } | null
  fetched: number
  seen: number | null
  failed: { at: string; says: string } | null
  cannot: string | null
  waits: string | null
}

export interface Settings {
  scheme: 'system' | 'light' | 'dark'
  fetchUpdates: boolean
  installAtQuit: boolean
}

export interface DocumentFile {
  id: string
  name: string
}

export type Kept = { state: 'none' } | { state: 'kept'; document: unknown } | { state: 'unread' }

/** What the shell tells the page with nothing asked. */
export type Told =
  | { about: 'account'; value: AccountState }
  | { about: 'updates'; value: UpdateState }
  | { about: 'settings'; value: Settings }
  | { about: 'ask'; value: string }
  | { about: 'link'; value: { open: string } }

export interface Bridge {
  ask(door: string, method: string, args: unknown[], askedBy?: string): Promise<Answer<unknown>>
  on(listener: (told: Told) => void): () => void
}

export interface Shell {
  app: {
    about(): Promise<Answer<About>>
    unsaved(now: boolean): Promise<Answer<boolean>>
    openOutside(address: string): Promise<Answer<boolean>>
  }
  account: {
    state(): Promise<Answer<AccountState>>
    start(): Promise<Answer<AccountState>>
    openAgain(): Promise<Answer<AccountState>>
    cancel(): Promise<Answer<AccountState>>
    signOut(): Promise<Answer<AccountState>>
  }
  documents: {
    open(): Promise<Answer<(DocumentFile & { document: unknown }) | null>>
    save(id: string | null, document: unknown, name: string): Promise<Answer<DocumentFile | null>>
  }
  recovery: {
    keep(document: unknown): Promise<Answer<boolean>>
    take(): Promise<Answer<Kept>>
    drop(): Promise<Answer<boolean>>
  }
  settings: {
    read(): Promise<Answer<Settings>>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Answer<Settings>>
  }
  updates: {
    state(): Promise<Answer<UpdateState>>
    check(): Promise<Answer<UpdateState>>
    download(): Promise<Answer<UpdateState>>
    restart(): Promise<Answer<UpdateState>>
  }
  on(listener: (told: Told) => void): () => void
}

/** A typed shell over a bridge. With `askedBy`, every ask says an agent made it, so it is never the person's press. */
export function shellOver(bridge: Bridge, askedBy?: string): Shell {
  const doors = Object.fromEntries(
    Object.entries(DOORS).map(([door, methods]) => [
      door,
      Object.fromEntries(methods.map((method) => [method, (...args: unknown[]) => bridge.ask(door, method, args, askedBy)])),
    ]),
  )
  return { ...doors, on: (listener: (told: Told) => void) => bridge.on(listener) } as unknown as Shell
}

declare global {
  interface Window {
    shell?: Bridge
  }
}

let bridge: Bridge | null = null

/** The bridge the page runs on: the shell's in the app, a stand-in in a browser and in tests. */
export function theBridge(): Bridge {
  bridge ??= window.shell ?? standInBridge()
  return bridge
}

/** For tests: run the page on this bridge. */
export function useBridge(next: Bridge | null) {
  bridge = next
}

/** The shell as the person's own page asks it. */
export const shell = (): Shell => shellOver(theBridge())

/** The shell as an agent's tool asks it: nothing it asks counts as the person's press. */
export const shellFor = (agent: string): Shell => shellOver(theBridge(), agent)

/** The value of an answer, or the sentence of its refusal thrown as an error a caller can say. */
export class RefusedByShell extends Sentence {}
export function valueOf<T>(answer: Answer<T>): T {
  if (!answer.ok) throw new RefusedByShell(answer.refused)
  return answer.value
}
