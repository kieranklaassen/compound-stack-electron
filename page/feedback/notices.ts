// Notices: what the app says that no press is waiting to hear. Two kinds.
//
// A brief one goes by itself after four seconds. A kept one stays until it is
// dismissed, and may carry one action (Undo is the usual one).
//
// What a press answered is not a notice: it is said where the press was
// (said.tsx). A notice is for what happened somewhere the person is not looking.

import { createStore } from '../store'

export const BRIEF_MS = 4_000
export const NOTICES_MOST = 3

export interface Notice {
  id: number
  text: string
  kept: boolean
  code?: string
  action?: { label: string; run: () => void }
}

export const notices = createStore<Notice[]>([])

let ids = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  notices.set((now) => now.filter((notice) => notice.id !== id))
}

function add(notice: Omit<Notice, 'id'>): number {
  const id = (ids += 1)
  // The same sentence is said once: a second one takes the first one's place.
  for (const old of notices.get().filter((other) => other.text === notice.text)) dismiss(old.id)
  for (const old of notices.get().slice(0, Math.max(0, notices.get().length + 1 - NOTICES_MOST))) dismiss(old.id)
  notices.set((now) => [...now, { ...notice, id }])
  return id
}

/** Say something that goes by itself. */
export function brief(text: string): number {
  const id = add({ text, kept: false })
  timers.set(id, setTimeout(() => dismiss(id), BRIEF_MS))
  return id
}

/** Say something that stays until it is dismissed, with at most one action. */
export const keep = (text: string, options: { code?: string; action?: Notice['action'] } = {}): number => add({ text, kept: true, ...options })
