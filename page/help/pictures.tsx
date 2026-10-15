// The help card's pictures. A row names one by a word, and this one module
// draws every word, from the theme's tokens: never a bitmap, a screenshot or a
// colour by number, so a picture is right in both schemes and is never stale.

import type { ReactNode } from 'react'

const frame = (children: ReactNode) => (
  <svg viewBox="0 0 288 96" width="288" height="96" role="img" aria-hidden="true" className="help-picture">
    <rect x="0.5" y="0.5" width="287" height="95" rx="7" fill="var(--surface-sunk)" stroke="var(--line)" />
    {children}
  </svg>
)

const field = (x: number, text: string, lit = false) => (
  <>
    <rect x={x} y="34" width="76" height="28" rx="5" fill="var(--surface)" stroke={lit ? 'var(--accent)' : 'var(--line)'} strokeWidth={lit ? 2 : 1} />
    <text x={x + 38} y="53" textAnchor="middle" fontSize="13" fill="var(--ink)">
      {text}
    </text>
  </>
)

export const PICTURES = {
  'drag-number': () =>
    frame(
      <>
        {field(40, '64pt')}
        <path d="M130 48h28m0 0-7-6m7 6-7 6" stroke="var(--ink-soft)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {field(172, '82pt', true)}
        <path d="M210 26v-10m0 0-5 5m5-5 5 5" stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>,
    ),
  'undo-step': () =>
    frame(
      <>
        {[0, 1, 2, 3].map((step) => (
          <rect key={step} x={56 + step * 46} y="38" width="34" height="20" rx="4" fill={step === 3 ? 'var(--accent-soft)' : 'var(--surface)'} stroke={step === 3 ? 'var(--accent)' : 'var(--line)'} />
        ))}
        <path d="M212 30c-10-12-34-12-44 0m0 0v-9m0 9h9" stroke="var(--ink-soft)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>,
    ),
  update: () =>
    frame(
      <>
        <rect x="108" y="22" width="72" height="52" rx="10" fill="var(--surface)" stroke="var(--line)" />
        <path d="M144 34v22m0 0-9-9m9 9 9-9" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M130 64h28" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  'ask-first': () =>
    frame(
      <>
        <rect x="24" y="34" width="60" height="28" rx="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        <text x="54" y="53" textAnchor="middle" fontSize="13" fill="var(--ink)">
          Keep
        </text>
        <text x="96" y="53" fontSize="13" fill="var(--ink-soft)">
          Throw it away?
        </text>
        <rect x="204" y="34" width="64" height="28" rx="5" fill="var(--surface)" stroke="var(--danger)" />
        <text x="236" y="53" textAnchor="middle" fontSize="13" fill="var(--danger)">
          Discard
        </text>
      </>,
    ),
} satisfies Record<string, () => ReactNode>

export type PictureName = keyof typeof PICTURES
