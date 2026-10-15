// A press says what came of it where the press was. This is the whole of
// "refresh with feedback": the button is off and says what it is doing while it
// works, and then a sentence stands beside it saying what was found, good or
// bad. Nobody presses Check for updates and is left wondering whether anything
// happened.
//
// The line keeps its room while it says nothing, so no control moves when a
// sentence arrives.

import { useCallback, useRef, useState } from 'react'

import { Sentence } from './sentence'

export type Tone = 'plain' | 'good' | 'bad'
export interface Saying {
  says: string
  tone?: Tone
}

export interface Pressed {
  /** True from the press until its work has ended. */
  busy: boolean
  said: Saying | null
  /** Run the work of a press. What it answers, or the sentence of what it threw, is said. */
  run(work: () => Promise<Saying | string | null | void>): Promise<void>
  say(saying: Saying | string | null): void
}

const DID_NOT_WORK = 'That did not work.'

export function usePressed(): Pressed {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<Saying | null>(null)
  const under = useRef(false)
  const say = useCallback((saying: Saying | string | null) => setSaid(typeof saying === 'string' ? { says: saying } : saying), [])
  const run = useCallback(
    async (work: () => Promise<Saying | string | null | void>) => {
      // A second press while the first works is no press: one answer for one press.
      if (under.current) return
      under.current = true
      setBusy(true)
      setSaid(null)
      try {
        say((await work()) ?? null)
      } catch (error) {
        // Only a sentence written for a person is shown. An error's own words may hold a path or an address.
        say({ says: error instanceof Sentence ? error.message : DID_NOT_WORK, tone: 'bad' })
      } finally {
        under.current = false
        setBusy(false)
      }
    },
    [say],
  )
  return { busy, said, run, say }
}

/** The line a press's answer stands in. It keeps its room, and a screen reader hears it arrive. */
export function Said({ said, busy = false, working }: { said: Saying | null; busy?: boolean; working?: string }) {
  const text = busy ? (working ?? '') : (said?.says ?? '')
  return (
    <span className="said" role="status" data-tone={busy ? 'plain' : (said?.tone ?? 'plain')}>
      {text}
    </span>
  )
}
