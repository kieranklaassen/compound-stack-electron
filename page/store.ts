// A store is a value, a way to change it and a way to hear that it changed.
// Every piece of state the page keeps outside a component is one of these, so
// a control and an agent's tool read and change the same thing.

import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get(): T
  set(next: T | ((now: T) => T)): void
  subscribe(heard: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const hearers = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      const now = typeof next === 'function' ? (next as (now: T) => T)(value) : next
      // Setting what is already there tells nobody: an app that stands still does no work.
      if (Object.is(now, value)) return
      value = now
      for (const heard of hearers) heard()
    },
    subscribe(heard) {
      hearers.add(heard)
      return () => hearers.delete(heard)
    },
  }
}

export const useStore = <T>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get, store.get)
