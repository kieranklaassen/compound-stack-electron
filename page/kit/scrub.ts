// A number field is dragged as well as typed in. This is the arithmetic of the
// drag, stated once and pure, so its test is a table. The hook that hears the
// pointer is use_scrub.ts.
//
// Up or to the right is more. Two pixels are one step. Shift makes a step a
// tenth. A press that moves less than three pixels is no drag: it puts the
// cursor in the field to type, as a click always did.

export const PIXELS_A_STEP = 2
export const CLICK_WITHIN = 3
export const FINE = 0.1

export interface ScrubField {
  min: number
  max: number
  step: number
}

/** Whether a press that moved this far is still a click. */
export const isClick = (dx: number, dy: number) => Math.hypot(dx, dy) < CLICK_WITHIN

/** The value a drag of `dx`, `dy` pixels gives a field that stood at `start`. It stops at the bounds and says nothing of it. */
export function scrubbed(start: number, dx: number, dy: number, field: ScrubField, fine = false): number {
  const steps = Math.round((dx - dy) / PIXELS_A_STEP)
  const step = field.step * (fine ? FINE : 1)
  const value = start + steps * step
  // Rounded to the step's own decimals, so 0.1 added thirty times is 3 and not 3.0000000000000004.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const rounded = Number(value.toFixed(Math.min(decimals, 6)))
  return Math.min(field.max, Math.max(field.min, rounded))
}
