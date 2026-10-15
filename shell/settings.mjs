// Settings are the person's on this computer: never part of a document, and the
// same whichever document is open. The page reads and sets them through one
// door, and only the keys named here, each held to its own check.

import { Refused } from './doors.mjs'

export const SETTINGS = {
  scheme: { default: 'system', takes: (value) => ['system', 'light', 'dark'].includes(value) },
  fetchUpdates: { default: true, takes: (value) => typeof value === 'boolean' },
  installAtQuit: { default: true, takes: (value) => typeof value === 'boolean' },
}

export const SETTING_DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([key, { default: value }]) => [key, value]))

/** Only the known keys of `value`, each replaced by its default where it is not one the key takes. */
export function settled(value) {
  return Object.fromEntries(
    Object.entries(SETTINGS).map(([key, setting]) => [key, setting.takes(value?.[key]) ? value[key] : setting.default]),
  )
}

/** The settings door over a `Kept` file. `changed` is told the settings after each write. */
export function settingsDoor(kept, changed = () => {}) {
  return {
    read: async () => settled(await kept.read()),
    set: async ([key, value]) => {
      const setting = Object.hasOwn(SETTINGS, key) ? SETTINGS[key] : null
      if (!setting || !setting.takes(value)) throw new Refused('That is not a setting.', 'settings.unknown')
      const next = settled(await kept.write({ [key]: value }))
      changed(next)
      return next
    },
  }
}
