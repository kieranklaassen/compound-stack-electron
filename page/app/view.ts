// What the window shows: which sheet is open, whether Help mode is on. It is
// never part of the document and has no undo step. A control and an agent's
// tool both change it through `setView`.

import { createStore } from '../store'

export type Sheet = 'settings'
export interface View {
  sheet: Sheet | null
  helpMode: boolean
}

export const view = createStore<View>({ sheet: null, helpMode: false })

export function setView(changes: Partial<View>) {
  view.set((now) => {
    const next = { ...now, ...changes }
    return next.sheet === now.sheet && next.helpMode === now.helpMode ? now : next
  })
}
