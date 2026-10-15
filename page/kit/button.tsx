// The one button. Three rules ride on it.
//
// It names its row (`data-action`), which is where its help, its key and its
// agent tool are found. It writes no tooltip of its own: no `title`.
//
// A control that cannot be used now is shown, turned off, and says why
// (`off`, drawn as `data-says` by the one help card). It is never hidden: a
// control that comes and goes teaches nobody where it is.
//
// It is turned off with `aria-disabled`, not `disabled`, so the pointer still
// reaches it and the card can say why.

import type { MouseEvent, ReactNode, Ref } from 'react'

interface Props {
  action: string
  /** Which part of the row this control is, where several controls share one. */
  help?: string
  /** Why it cannot be pressed now: one sentence. Null or absent when it can. */
  off?: string | null
  tone?: 'plain' | 'main' | 'danger' | 'quiet'
  pressed?: boolean
  busy?: boolean
  ref?: Ref<HTMLButtonElement>
  onPress(event: MouseEvent<HTMLButtonElement>): void
  children: ReactNode
}

export function Button({ action, help, off, tone = 'plain', pressed, busy = false, ref, onPress, children }: Props) {
  const isOff = Boolean(off) || busy
  return (
    <button
      ref={ref}
      type="button"
      className={`button ${tone}`}
      data-action={action}
      data-help={help}
      data-says={off || undefined}
      aria-disabled={isOff || undefined}
      aria-pressed={pressed}
      aria-busy={busy || undefined}
      onClick={(event) => {
        if (isOff) return
        onPress(event)
      }}
    >
      {children}
    </button>
  )
}
