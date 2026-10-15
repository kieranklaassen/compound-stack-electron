import { Said, usePressed } from '../feedback/said'
import { Button } from '../kit/button'
import { useStore } from '../store'
import { newDocument, openDocument, saveDocument } from './actions'
import { runCommand } from './commands'
import { editor, unsaved } from './editor'
import { account } from './session'
import { view } from './view'

export function TitleBar({ mac }: { mac: boolean }) {
  const state = useStore(editor)
  const now = useStore(view)
  const who = useStore(account)
  const pressed = usePressed()
  const edited = unsaved(state)

  return (
    <header className="title-bar" data-mac={mac || undefined}>
      <div className="title-name">
        <span className="title-file">{state.file?.name ?? 'Untitled'}</span>
        {/* The mark keeps its room, so the bar does not move when the first change is made. */}
        <span className="title-edited" aria-live="polite">
          {edited ? 'Edited' : ''}
        </span>
      </div>
      <div className="title-group" role="group" aria-label="Document">
        <Button action="new_document" tone="quiet" onPress={() => pressed.run(async () => newDocument())}>
          New
        </Button>
        <Button action="open_document" tone="quiet" onPress={() => pressed.run(() => openDocument())}>
          Open…
        </Button>
        <Button action="save_document" tone="main" busy={pressed.busy} onPress={() => pressed.run(() => saveDocument())}>
          Save
        </Button>
        <Said said={pressed.said} busy={pressed.busy} working="Saving…" />
      </div>
      <div className="title-group" role="group" aria-label="History">
        <Button action="undo" tone="quiet" off={state.undo.length === 0 ? 'There is nothing to undo.' : null} onPress={() => runCommand('undo')}>
          Undo
        </Button>
        <Button action="redo" tone="quiet" off={state.redo.length === 0 ? 'There is nothing to redo.' : null} onPress={() => runCommand('redo')}>
          Redo
        </Button>
      </div>
      <div className="title-group end">
        <Button action="help_mode" tone="quiet" pressed={now.helpMode} onPress={() => runCommand('help_mode')}>
          Help
        </Button>
        <Button action="open_settings" tone="quiet" onPress={() => runCommand('open_settings')}>
          {who.state === 'signed_in' ? who.email : 'Settings'}
        </Button>
      </div>
    </header>
  )
}
