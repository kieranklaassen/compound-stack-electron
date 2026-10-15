import { beforeEach, describe, expect, it } from 'vitest'

import { beginGesture, change, editor, letGo, redo, setNumber, startNew, undo, unsaved } from './editor'

beforeEach(startNew)

describe('the editor', () => {
  it('makes a whole drag one undo step', () => {
    const gesture = beginGesture()
    for (const size of [65, 66, 67, 80]) setNumber('size', size, { gesture })
    letGo()
    expect(editor.get().undo).toHaveLength(1)
    undo()
    expect(editor.get().document.size).toBe(64)
    redo()
    expect(editor.get().document.size).toBe(80)
  })

  it('makes two drags two steps', () => {
    setNumber('size', 70, { gesture: beginGesture() })
    letGo()
    setNumber('size', 90, { gesture: beginGesture() })
    expect(editor.get().undo).toHaveLength(2)
  })

  it('never takes an agent’s change into the person’s gesture', () => {
    const gesture = beginGesture()
    setNumber('size', 70, { gesture })
    setNumber('size', 71, { by: 'an agent' })
    setNumber('size', 72, { gesture })
    expect(editor.get().undo).toHaveLength(3)
  })

  it('makes no step of a change that changes nothing', () => {
    change({ size: 64 })
    expect(editor.get().undo).toHaveLength(0)
    expect(unsaved()).toBe(false)
  })

  it('refuses what is no document, in a sentence, and changes nothing', () => {
    expect(setNumber('size', 9999)).toEqual({ ok: false, says: 'Size is a number from 8 to 200.' })
    expect(setNumber('size', Number.NaN).ok).toBe(false)
    expect(editor.get().document.size).toBe(64)
  })

  it('says there is nothing to undo', () => {
    expect(undo()).toEqual({ ok: false, says: 'There is nothing to undo.' })
  })
})
