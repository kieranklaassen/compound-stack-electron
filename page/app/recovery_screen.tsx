// Work that was kept from a launch that ended without a save is offered before
// anything else: Recover, or Discard. Both are the person's own press. Discard
// asks first, in its own place.

import { useEffect, useRef } from 'react'

import { AskFirst } from '../feedback/ask_first'
import { Said, usePressed } from '../feedback/said'
import { Button } from '../kit/button'
import { type Kept, shell, valueOf } from '../shell'
import { createStore, useStore } from '../store'
import { newPoster, type Poster, posterIssue } from './document'
import { place } from './editor'
import { KEPT_FROM_LAST_TIME, KEPT_UNREAD } from './words'

/** The kept work that waits for an answer, or null. */
export const waiting = createStore<Kept | null>(null)

/** Ask the shell once, at launch, whether work was kept. */
export async function lookForKept() {
  const answer = await shell().recovery.take()
  if (answer.ok && answer.value.state !== 'none') waiting.set(answer.value)
}

export function RecoveryScreen() {
  const kept = useStore(waiting)
  const pressed = usePressed()
  const recover = useRef<HTMLButtonElement>(null)
  useEffect(() => recover.current?.focus(), [kept])
  if (!kept || kept.state === 'none') return null

  const readable = kept.state === 'kept' && posterIssue(kept.document) === null

  return (
    <div className="sheet-back">
      <div className="sheet narrow" role="alertdialog" aria-modal="true" aria-label="Kept work">
        <h1>Your work was kept</h1>
        <p>{readable ? KEPT_FROM_LAST_TIME : KEPT_UNREAD}</p>
        <div className="row">
          {readable ? (
            <Button
              action="recover_document"
              tone="main"
              ref={recover}
              onPress={() => {
                // Recovered work is unsaved: it has no file until it is saved.
                place((kept as { document: Poster }).document, null, { savedAs: newPoster() })
                waiting.set(null)
              }}
            >
              Recover
            </Button>
          ) : (
            <Button action="recover_document" ref={recover} onPress={() => waiting.set(null)}>
              Continue
            </Button>
          )}
          {readable && (
            <AskFirst
              action="discard_kept"
              label="Discard…"
              question="Throw the kept work away?"
              answer="Discard"
              answerAction="discard_kept_answer"
              onAnswer={() =>
                void pressed.run(async () => {
                  valueOf(await shell().recovery.drop())
                  waiting.set(null)
                })
              }
            />
          )}
        </div>
        <Said said={pressed.said} busy={pressed.busy} working="Discarding…" />
      </div>
    </div>
  )
}
