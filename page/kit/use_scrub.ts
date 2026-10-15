// The drag of a number field. Spread what this returns on the input.
//
// A field that has the keyboard is being typed in and is not dragged. Otherwise
// a press is held back from focusing until it is known to be a click or a drag:
// a click focuses the field and selects its text, a drag changes the number and
// leaves the keyboard where it was.
//
// A whole drag is one undo step: the hook begins one gesture at the first move
// and hands its number to every change of that drag.

import { type PointerEvent as ReactPointerEvent, useRef } from 'react'

import { isClick, scrubbed, type ScrubField } from './scrub'

interface Options {
  field: ScrubField
  /** The number the field holds now. */
  value: number
  /** Begin a gesture; what it answers is handed to each `onScrub` of the drag. */
  begin(): number
  onScrub(value: number, gesture: number): void
  /** The drag was let go. */
  end(): void
}

interface Drag {
  pointer: number
  x: number
  y: number
  start: number
  gesture: number | null
  last: number
}

export function useScrub({ field, value, begin, onScrub, end }: Options) {
  const drag = useRef<Drag | null>(null)

  return {
    'data-scrub': '',
    onPointerDown(event: ReactPointerEvent<HTMLInputElement>) {
      const input = event.currentTarget
      if (event.button !== 0 || document.activeElement === input) return
      // Held back: whether this press focuses the field is decided when it is let go.
      event.preventDefault()
      input.setPointerCapture?.(event.pointerId)
      drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, start: value, gesture: null, last: value }
    },
    onPointerMove(event: ReactPointerEvent<HTMLInputElement>) {
      const now = drag.current
      if (!now || now.pointer !== event.pointerId) return
      const dx = event.clientX - now.x
      const dy = event.clientY - now.y
      if (now.gesture === null) {
        if (isClick(dx, dy)) return
        now.gesture = begin()
        event.currentTarget.dataset.scrubbing = ''
      }
      const next = scrubbed(now.start, dx, dy, field, event.shiftKey)
      // A move that lands on the number already there changes nothing and tells nobody.
      if (next === now.last) return
      now.last = next
      onScrub(next, now.gesture)
    },
    onPointerUp(event: ReactPointerEvent<HTMLInputElement>) {
      const now = drag.current
      if (!now || now.pointer !== event.pointerId) return
      drag.current = null
      const input = event.currentTarget
      input.releasePointerCapture?.(event.pointerId)
      delete input.dataset.scrubbing
      if (now.gesture === null) {
        input.focus()
        input.select()
      } else {
        end()
      }
    },
    onPointerCancel(event: ReactPointerEvent<HTMLInputElement>) {
      if (drag.current?.gesture != null) end()
      drag.current = null
      delete event.currentTarget.dataset.scrubbing
    },
  }
}
