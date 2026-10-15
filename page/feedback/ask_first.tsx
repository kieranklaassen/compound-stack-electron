// A press that cannot be undone asks first, in its own place, never in a dialog
// of the system's or the browser's. The control turns into the question: the
// sentence, then Keep where the control stood, then the button that answers.
// So the second click of a double click lands on Keep, and nothing is thrown
// away by a press nobody meant.

import { useEffect, useRef, useState } from 'react'

import { Button } from '../kit/button'

interface Props {
  /** The row of the control that asks. */
  action: string
  label: string
  question: string
  /** The answering button's words, e.g. "Discard". */
  answer: string
  /** Its own row: the answer is a control too. */
  answerAction: string
  keep?: string
  off?: string | null
  onAnswer(): void
}

export function AskFirst({ action, label, question, answer, answerAction, keep = 'Keep', off, onAnswer }: Props) {
  const [asking, setAsking] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!asking) return
    keepRef.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAsking(false)
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [asking])

  if (!asking) {
    return (
      <Button action={action} off={off} onPress={() => setAsking(true)}>
        {label}
      </Button>
    )
  }
  return (
    <span className="ask-first" role="group" aria-label={question}>
      <Button action={action} help="keep" ref={keepRef} onPress={() => setAsking(false)}>
        {keep}
      </Button>
      <span className="ask-first-question">{question}</span>
      <Button
        action={answerAction}
        tone="danger"
        onPress={(event) => {
          // The second click of a double click is no answer.
          if (event.detail > 1) return
          setAsking(false)
          onAnswer()
        }}
      >
        {answer}
      </Button>
    </span>
  )
}
