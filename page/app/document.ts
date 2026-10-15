// The document of the example app: a poster with a title and three numbers.
// It is small on purpose. What matters is the shape around it: plain data,
// one check that says what a document has to be, and changes that are plain
// functions, so a control, a key and an agent's tool all make the same change.

export interface Poster {
  title: string
  size: number
  opacity: number
  turn: number
}

export type NumberKey = 'size' | 'opacity' | 'turn'

export interface NumberField {
  label: string
  unit: string
  min: number
  max: number
  step: number
}

/** Each number of a poster, with its bounds stated once: the field, the drag, the tool's schema and the check read them here. */
export const NUMBERS: Record<NumberKey, NumberField> = {
  size: { label: 'Size', unit: 'pt', min: 8, max: 200, step: 1 },
  opacity: { label: 'Opacity', unit: '%', min: 0, max: 100, step: 1 },
  turn: { label: 'Turn', unit: '°', min: -180, max: 180, step: 1 },
}

export const TITLE_MOST = 80

export const newPoster = (): Poster => ({ title: 'Compound', size: 64, opacity: 100, turn: 0 })

/** What is wrong with a value as a poster, as a sentence, or null. A file that is opened and a recovered document are both put to this. */
export function posterIssue(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return 'That is not a document.'
  const poster = value as Record<string, unknown>
  if (typeof poster.title !== 'string' || poster.title.length > TITLE_MOST) return `The title is text of at most ${TITLE_MOST} characters.`
  for (const [key, field] of Object.entries(NUMBERS)) {
    const number = poster[key]
    if (typeof number !== 'number' || !Number.isFinite(number) || number < field.min || number > field.max) return rangeSays(key as NumberKey)
  }
  return null
}

export const rangeSays = (key: NumberKey) => {
  const field = NUMBERS[key]
  return `${field.label} is a number from ${field.min} to ${field.max}.`
}

/** The number a typed text means for a field, or null where it means none. A drag and the typed field share this. */
export function parseNumber(text: string, key: NumberKey): number | null {
  const cleaned = text.trim().replace(NUMBERS[key].unit, '').replace(',', '.').trim()
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null
  const number = Number(cleaned)
  const { min, max } = NUMBERS[key]
  return number >= min && number <= max ? number : null
}

export const shown = (number: number) => String(Math.round(number * 10) / 10)
