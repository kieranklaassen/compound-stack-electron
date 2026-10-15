// Show me presses nothing. It opens what holds a control (through the view) and
// rings the control for a few seconds, so the person sees where it is. An agent
// points with it (`show_control`); it runs no action of the app.

import { rowOf } from '../agent/rows'
import { setView } from '../app/view'

export const RING_MS = 8_000

let ringed: { control: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null

function unring() {
  if (!ringed) return
  clearTimeout(ringed.timer)
  delete ringed.control.dataset.ringed
  ringed = null
}

/** Ring a control. False where there is no such row. The control is found once what holds it has been drawn. */
export function showControl(id: string, part?: string, doc: Document = document): boolean {
  const row = rowOf(id)
  if (!row) return false
  if (row.holder) setView({ sheet: row.holder })
  const find = () => doc.querySelector<HTMLElement>(part ? `[data-action="${CSS.escape(id)}"][data-help="${CSS.escape(part)}"]` : `[data-action="${CSS.escape(id)}"]`)
  const ring = () => {
    const control = find()
    if (!control) return
    unring()
    control.dataset.ringed = ''
    control.scrollIntoView?.({ block: 'nearest' })
    ringed = { control, timer: setTimeout(unring, RING_MS) }
  }
  // The holder is drawn on the next frame; a control already there is rung at once.
  if (find()) ring()
  else requestAnimationFrame(ring)
  return true
}
