// The one card. It draws what the watch says is shown, from the row's own help:
// a tip (name and key) or the whole card. It writes no help of its own.

import { helpOf } from '../agent/rows'
import { keyShown } from '../keys/keys'
import { useStore } from '../store'
import { PICTURES } from './pictures'
import { helpShown } from './watch'

const CARD_WIDTH = 320
const GAP = 8

export function HelpCard({ mac }: { mac: boolean }) {
  const shown = useStore(helpShown)
  if (!shown) return null
  const help = helpOf(shown.row, shown.part)
  if (!help) return null
  const key = help.command ? keyShown(help.command, mac) : undefined
  const card = shown.level === 'card'
  const Picture = card && help.picture ? PICTURES[help.picture] : null

  // Under the control, or over it where there is no room under. Kept inside the window.
  const under = shown.rect.bottom < window.innerHeight * 0.6
  const left = Math.max(GAP, Math.min(shown.rect.left, window.innerWidth - CARD_WIDTH - GAP))
  const place = under ? { top: shown.rect.bottom + GAP, left } : { bottom: window.innerHeight - shown.rect.top + GAP, left }

  return (
    <div className="help-card" role="tooltip" data-level={shown.level} style={{ ...place, maxWidth: CARD_WIDTH }}>
      {Picture && <Picture />}
      <div className="help-head">
        <span className="help-name">{help.name}</span>
        {key && <kbd className="help-key">{key}</kbd>}
      </div>
      {shown.says && <p className="help-says">{shown.says}</p>}
      {card && (
        <>
          {help.first && (
            <p className="help-line">
              <span className="help-label">First</span> {help.first}
            </p>
          )}
          <p className="help-line">{help.how}</p>
          {help.after && (
            <p className="help-line">
              <span className="help-label">Next</span> {help.after}
            </p>
          )}
        </>
      )}
      {!card && shown.hint && <p className="help-hint">Hold {mac ? '⌥' : 'Alt'} for more</p>}
    </div>
  )
}
