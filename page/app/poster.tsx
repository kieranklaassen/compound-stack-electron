import { useState } from 'react'

import { NumberInput } from '../kit/number_field'
import { useStore } from '../store'
import { type NumberKey, NUMBERS, TITLE_MOST } from './document'
import { editor, setTitle } from './editor'

export function Preview() {
  const { document } = useStore(editor)
  return (
    <section className="preview" aria-label="Preview">
      <div className="poster">
        <span className="poster-title" style={{ fontSize: `${document.size}pt`, opacity: document.opacity / 100, transform: `rotate(${document.turn}deg)` }}>
          {document.title}
        </span>
      </div>
    </section>
  )
}

function TitleField({ value }: { value: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="field wide">
      <span className="field-label">Title</span>
      <input
        className="field-input"
        data-action="set_title"
        maxLength={TITLE_MOST}
        value={draft ?? value}
        onFocus={() => setDraft(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          // One undo step for what was typed, when the field is left.
          if (draft !== null) setTitle(draft)
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

export function Inspector() {
  const { document } = useStore(editor)
  return (
    <aside className="inspector" aria-label="Poster">
      <TitleField value={document.title} />
      {(Object.keys(NUMBERS) as NumberKey[]).map((name) => (
        <NumberInput key={name} name={name} value={document[name]} action="set_number" />
      ))}
      <p className="note">Rest the pointer on anything to learn what it does. Hold Option for more.</p>
    </aside>
  )
}
