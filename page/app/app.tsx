import { useEffect } from 'react'

import { NoticesView } from '../feedback/notices_view'
import { HelpCard } from '../help/card'
import { watchHelp } from '../help/watch'
import { watchHeldPresses } from '../kit/held_press'
import { listenForKeys } from '../keys/listen'
import { useStore } from '../store'
import { linkFollowed } from './actions'
import { runCommand } from './commands'
import { keepShellTold } from './keeper'
import { Inspector, Preview } from './poster'
import { lookForKept, RecoveryScreen } from './recovery_screen'
import { about, followShell, settings } from './session'
import { SettingsSheet } from './settings_sheet'
import { TitleBar } from './title_bar'
import { view } from './view'

const isMac = () => {
  const platform = about.get()?.platform
  return platform && platform !== 'browser' ? platform === 'darwin' : /mac/i.test(navigator.platform)
}

export function App() {
  const now = useStore(view)
  const scheme = useStore(settings).scheme
  useStore(about)
  const mac = isMac()

  // One set of listeners for the whole window, each put away when the app goes.
  useEffect(() => {
    const stops = [
      followShell(runCommand, linkFollowed),
      keepShellTold(),
      watchHelp({ mode: () => view.get().helpMode }),
      watchHeldPresses(),
      listenForKeys(runCommand, isMac),
    ]
    void lookForKept()
    return () => stops.forEach((stop) => stop())
  }, [])

  // The scheme is the shell's to set for the whole window; the page only marks a choice that is not the system's.
  useEffect(() => {
    if (scheme === 'system') delete document.documentElement.dataset.scheme
    else document.documentElement.dataset.scheme = scheme
  }, [scheme])

  return (
    <div className="app" data-help-mode={now.helpMode || undefined}>
      <TitleBar mac={mac} />
      <main className="work">
        <Preview />
        <Inspector />
      </main>
      {now.sheet === 'settings' && <SettingsSheet />}
      <RecoveryScreen />
      <HelpCard mac={mac} />
      <NoticesView />
    </div>
  )
}
