// A number field: typed in, and dragged. Typing and dragging end in the same
// parser and the same action, so a drag needs no action, tool or row of its own.

import { useState } from 'react'

import { type NumberKey, NUMBERS, parseNumber, rangeSays, shown } from '../app/document'
import { beginGesture, letGo, setNumber } from '../app/editor'
import { brief } from '../feedback/notices'
import { useScrub } from './use_scrub'

export function NumberInput({ name, value, action }: { name: NumberKey; value: number; action: string }) {
  const field = NUMBERS[name]
  // While the field is typed in it shows the draft; otherwise the document's number.
  const [draft, setDraft] = useState<string | null>(null)
  const scrub = useScrub({
    field,
    value,
    begin: beginGesture,
    // A value a drag passes that is refused changes nothing and is not said.
    onScrub: (next, gesture) => void setNumber(name, next, { gesture }),
    end: letGo,
  })

  const commit = () => {
    if (draft === null) return
    setDraft(null)
    const number = parseNumber(draft, name)
    // What was typed and is no number of this field is said: the person asked for it.
    if (number === null) brief(rangeSays(name))
    else setNumber(name, number)
  }

  return (
    <label className="field">
      <span className="field-label">{field.label}</span>
      <input
        {...scrub}
        className="field-input number"
        data-action={action}
        data-help={name}
        inputMode="decimal"
        value={draft ?? `${shown(value)}${field.unit}`}
        onFocus={() => setDraft(shown(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(null)
            // After the draft is dropped, so the blur commits nothing.
            requestAnimationFrame(() => (event.target as HTMLInputElement).blur())
          }
        }}
      />
    </label>
  )
}
