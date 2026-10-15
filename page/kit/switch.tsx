import type { ReactNode } from 'react'

/** A switch: a button that is on or off, and says which. It names its row like any control. */
export function Switch({ action, on, off, onChange, children }: { action: string; on: boolean; off?: string | null; onChange(next: boolean): void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      data-action={action}
      data-says={off || undefined}
      aria-checked={on}
      aria-disabled={off ? true : undefined}
      onClick={() => {
        if (!off) onChange(!on)
      }}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span>{children}</span>
    </button>
  )
}
