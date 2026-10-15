import { beforeEach, describe, expect, it } from 'vitest'

import { editor, startNew } from '../app/editor'
import { dismiss, notices } from '../feedback/notices'
import { type Bridge, useBridge } from '../shell'
import { type StandIn, standInBridge } from '../stand_in_bridge'
import { callLog } from './run'
import { pageAgent } from './tools'

let bridge: StandIn

beforeEach(() => {
  bridge = standInBridge()
  useBridge(bridge as Bridge)
  startNew()
  callLog.set([])
  for (const notice of notices.get()) dismiss(notice.id)
})

describe('the page’s tools', () => {
  it('change the document as its controls do, and say so with the way back', async () => {
    const result = await pageAgent.run('set_number', { field: 'size', value: 120 }, 'An agent')
    expect(result.ok).toBe(true)
    expect(editor.get().document.size).toBe(120)
    const [notice] = notices.get()
    expect(notice).toMatchObject({ text: 'An agent changed the poster.', kept: true })
    await pageAgent.run('run_notice_action', { id: notice!.id })
    expect(editor.get().document.size).toBe(64)
  })

  it('refuse in a sentence, and change nothing', async () => {
    expect(await pageAgent.run('set_number', { field: 'size', value: 9999 })).toEqual({ ok: false, refused: 'Size is a number from 8 to 200.' })
    expect(await pageAgent.run('set_number', { field: 'size' })).toEqual({ ok: false, refused: 'The argument “value” is needed.' })
    expect(await pageAgent.run('set_number', { field: 'size', value: 10, path: '/tmp' })).toEqual({ ok: false, refused: 'There is no argument “path”.' })
    expect(await pageAgent.run('no_such_tool', {})).toEqual({ ok: false, refused: 'There is no tool “no_such_tool”.' })
    expect(editor.get().document.size).toBe(64)
  })

  it('write every call in the log', async () => {
    await pageAgent.run('get_state', {})
    await pageAgent.run('set_title', { title: 'Hello' }, 'An agent')
    expect(callLog.get().map((call) => [call.tool, call.by, call.ok])).toEqual([
      ['get_state', 'agent', true],
      ['set_title', 'An agent', true],
    ])
  })

  it('ask the shell as an agent, so nothing they ask is the person’s press', async () => {
    await pageAgent.run('check_for_updates', {}, 'An agent')
    expect(bridge.standIn.asks.at(-1)).toMatchObject({ door: 'updates', method: 'check', askedBy: 'An agent' })
  })

  it('answer no address of the account and no place of a file', async () => {
    bridge.standIn.approve('person@example.com')
    const result = await pageAgent.run('get_state', {})
    expect(JSON.stringify(result)).not.toContain('person@example.com')
  })

  it('find a control by words, with the tool or why there is none', async () => {
    const result = await pageAgent.run('find_tools', { words: 'restart update' })
    expect(result.ok && result.value).toContainEqual(expect.objectContaining({ control: 'restart_to_update', tool: null }))
  })
})
