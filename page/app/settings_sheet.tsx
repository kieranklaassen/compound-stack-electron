import { useEffect, useRef } from 'react'

import { Said, usePressed } from '../feedback/said'
import { Button } from '../kit/button'
import { Switch } from '../kit/switch'
import type { Settings } from '../shell'
import { useStore } from '../store'
import { cancelSignIn, checkForUpdates, downloadUpdate, openSignInAgain, restartToUpdate, setSetting, signIn, signOut } from './actions'
import { about, account, settings, updates } from './session'
import { setView } from './view'
import { accountSays, updateSays } from './words'

const SCHEMES: Array<{ value: Settings['scheme']; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function Account() {
  const who = useStore(account)
  const pressed = usePressed()
  const unusable = who.state === 'off' ? who.says : null
  return (
    <section className="section" aria-label="Account">
      <h2>Account</h2>
      {/* One line says how the account stands. It keeps its room in every state. */}
      <p className="status-line" role="status">
        {accountSays(who)}
      </p>
      {who.state === 'waiting' && <output className="code">{who.code}</output>}
      <div className="row">
        {who.state === 'waiting' ? (
          <>
            <Button action="open_sign_in_again" onPress={() => pressed.run(openSignInAgain)}>
              Open the browser again
            </Button>
            <Button action="cancel_sign_in" tone="quiet" onPress={() => pressed.run(() => cancelSignIn())}>
              Cancel
            </Button>
          </>
        ) : who.state === 'signed_in' ? (
          <Button action="sign_out" busy={pressed.busy} onPress={() => pressed.run(signOut)}>
            Sign out
          </Button>
        ) : (
          <Button action="sign_in" tone="main" off={unusable} busy={pressed.busy} onPress={() => pressed.run(async () => void (await signIn()))}>
            Sign in
          </Button>
        )}
        <Said said={pressed.said} />
      </div>
    </section>
  )
}

function Updates() {
  const state = useStore(updates)
  const now = useStore(settings)
  const version = useStore(about)?.version
  const pressed = usePressed()
  const line = updateSays(state)
  const working = state?.state === 'looking' || state?.state === 'fetching' || state?.state === 'installing'
  const off = state?.state === 'off' ? (state.cannot ?? 'This build does not update itself.') : null

  return (
    <section className="section" aria-label="Updates">
      <h2>Updates</h2>
      <p className="quiet-line">Version {version ?? '…'}</p>
      <div className="row">
        {/* The press, and what came of it beside it: the button is off while it looks, then the line says what was found and when. */}
        <Button action="check_for_updates" off={off} busy={working || pressed.busy} onPress={() => pressed.run(async () => void (await checkForUpdates()))}>
          Check for updates
        </Button>
        {state?.state === 'available' || (state?.state === 'failed' && state.newer) ? (
          <Button action="download_update" onPress={() => pressed.run(downloadUpdate)}>
            Download
          </Button>
        ) : null}
        {state?.state === 'ready' && (
          <Button action="restart_to_update" tone="main" off={state.waits} onPress={() => pressed.run(restartToUpdate)}>
            Restart to update
          </Button>
        )}
      </div>
      <p className="status-line" role="status" data-tone={pressed.said?.tone === 'bad' ? 'bad' : line.tone}>
        {pressed.said?.tone === 'bad' ? pressed.said.says : line.says}
      </p>
      <Switch action="set_fetch_updates" on={now.fetchUpdates} off={off} onChange={(next) => void setSetting('fetchUpdates', next)}>
        Download updates when they are found
      </Switch>
      <Switch action="set_install_at_quit" on={now.installAtQuit} off={off} onChange={(next) => void setSetting('installAtQuit', next)}>
        Install a downloaded update when I quit
      </Switch>
    </section>
  )
}

export function SettingsSheet() {
  const now = useStore(settings)
  const done = useRef<HTMLButtonElement>(null)
  // The keyboard lands on Done: Return there closes the sheet and changes nothing.
  useEffect(() => done.current?.focus(), [])

  return (
    <div className="sheet-back">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="sheet-head">
          <h1>Settings</h1>
          <Button action="close_settings" ref={done} onPress={() => setView({ sheet: null })}>
            Done
          </Button>
        </header>
        <section className="section" aria-label="Appearance">
          <h2>Appearance</h2>
          <div className="segments" role="group" aria-label="Appearance">
            {SCHEMES.map(({ value, label }) => (
              <Button key={value} action="set_scheme" help={value} pressed={now.scheme === value} onPress={() => void setSetting('scheme', value)}>
                {label}
              </Button>
            ))}
          </div>
        </section>
        <Account />
        <Updates />
      </div>
    </div>
  )
}
