import { describe, expect, it } from 'vitest'

import DOORS from '../shell/doors.json'
import { shellOver } from './shell'
import { standInBridge } from './stand_in_bridge'

describe('the bridge', () => {
  it('reaches every door the shell lists, and the stand-in answers each', async () => {
    const bridge = standInBridge()
    const shell = shellOver(bridge) as unknown as Record<string, Record<string, unknown>>
    for (const [door, methods] of Object.entries(DOORS)) {
      for (const method of methods) {
        expect(typeof shell[door]?.[method], `${door}.${method}`).toBe('function')
        const answer = await bridge.ask(door, method, [])
        expect(answer, `${door}.${method}`).not.toMatchObject({ code: 'no_such_door' })
      }
    }
  })

  it('refuses a door that is not on the list', async () => {
    expect(await standInBridge().ask('fs', 'readFile', ['/etc/passwd'])).toMatchObject({ ok: false })
  })

  it('names the agent on an ask a tool makes', async () => {
    const bridge = standInBridge()
    await shellOver(bridge, 'An agent').account.start()
    expect(bridge.standIn.asks[0]).toMatchObject({ askedBy: 'An agent' })
    expect(bridge.standIn.account.state).toBe('signed_out')
  })
})
