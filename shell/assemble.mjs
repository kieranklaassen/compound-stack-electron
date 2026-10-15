// Every door a page can reach, in one place. `main.mjs` hands in the parts it
// made; a Node test hands in fakes and reads the list, which must be the one
// written in `shell/doors.json` (the page's typed bridge is held to the same
// file by its own test).

import { accountDoor } from './account.mjs'
import { documentsDoor } from './documents.mjs'
import { Doors, Refused } from './doors.mjs'
import { mustAsk, NOT_THE_PRESS } from './press.mjs'
import { settingsDoor } from './settings.mjs'
import { updateDoor } from './updater.mjs'

export function assemble({ account, documents, recovery, settings, updater, app, log }) {
  return new Doors({ log })
    .add('app', {
      about: () => app.about(),
      // The page says whether its document is unsaved, so a quit can ask.
      unsaved: ([unsaved]) => app.unsaved(unsaved === true),
      openOutside: ([address]) => app.openOutside(address),
    })
    .add('account', accountDoor(account))
    .add('documents', documentsDoor(documents, recovery))
    .add('recovery', {
      keep: ([document]) => recovery.keep(document),
      take: () => recovery.take(),
      // Throwing kept work away is the person's own press: no tool does it.
      drop: async (_args, who) => {
        if (mustAsk(who)) throw new Refused(NOT_THE_PRESS, 'recovery.not_the_press')
        await recovery.drop()
        return true
      },
    })
    .add('settings', settingsDoor(settings.kept, settings.changed))
    .add('updates', updateDoor(updater))
}
