import { describe, expect, it } from 'vitest'

import { isClick, scrubbed } from './scrub'

const field = { min: 0, max: 100, step: 1 }

describe('the drag of a number field', () => {
  it.each([
    // start, dx, dy, fine, value
    [50, 0, 0, false, 50],
    [50, 20, 0, false, 60], // to the right is more: two pixels a step
    [50, 0, -20, false, 60], // up is more
    [50, 0, 20, false, 40], // down is less
    [50, -20, 0, false, 40],
    [50, 10, -10, false, 60], // both count
    [50, 20, 0, true, 51], // Shift: a tenth of a step
    [50, 1000, 0, false, 100], // it stops at the bounds
    [50, -1000, 0, false, 0],
  ])('from %d by (%d, %d), fine %s, gives %d', (start, dx, dy, fine, value) => {
    expect(scrubbed(start, dx, dy, field, fine)).toBe(value)
  })

  it('adds fine steps without the float showing', () => {
    expect(scrubbed(0, 6, 0, { min: 0, max: 10, step: 1 }, true)).toBe(0.3)
  })

  it('takes a press that moved less than three pixels for a click', () => {
    expect(isClick(2, 1)).toBe(true)
    expect(isClick(3, 0)).toBe(false)
  })
})
