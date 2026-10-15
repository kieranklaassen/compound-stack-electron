// The hands that touch macOS for an update. They are real only in a packaged
// app on a Mac outside the test harness. Under the harness they are stand-ins
// that note what they were asked, so no test, script or agent ever mounts a
// disk image, runs codesign or replaces an app.
//
// NOT RUN: the real hands were written without a Mac to hand and have not
// installed a build. Say so wherever the updater is described, until one has.

import { execFile } from 'node:child_process'
import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const LIMIT = { attach: 120_000, copy: 300_000, verify: 300_000, quick: 15_000 }

export const realHands = () => ({
  async attach(image) {
    const { stdout } = await run('/usr/bin/hdiutil', ['attach', image, '-nobrowse', '-readonly', '-noautoopen', '-plist'], { timeout: LIMIT.attach })
    const mount = /<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/.exec(stdout)?.[1]
    if (!mount) throw new Error('no mount point')
    return mount
  },
  detach: (mount) => run('/usr/bin/hdiutil', ['detach', mount, '-force'], { timeout: LIMIT.quick }),
  copy: (from, to) => run('/usr/bin/ditto', [from, to], { timeout: LIMIT.copy }),
  async info(app) {
    const plist = join(app, 'Contents', 'Info.plist')
    const read = async (key) => (await run('/usr/bin/plutil', ['-extract', key, 'raw', plist], { timeout: LIMIT.quick })).stdout.trim()
    return {
      bundleId: await read('CFBundleIdentifier'),
      version: await read('CFBundleShortVersionString'),
      minimumSystem: await read('LSMinimumSystemVersion').catch(() => null),
    }
  },
  async systemTakes(minimum) {
    if (!minimum) return true
    const { stdout } = await run('/usr/bin/sw_vers', ['-productVersion'], { timeout: LIMIT.quick })
    const [have, need] = [stdout.trim(), minimum].map((text) => text.split('.').map(Number))
    for (let part = 0; part < 3; part += 1) {
      if ((have[part] ?? 0) !== (need[part] ?? 0)) return (have[part] ?? 0) > (need[part] ?? 0)
    }
    return true
  },
  verify: (app) => run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { timeout: LIMIT.verify }).then(() => true, () => false),
  async team(app) {
    // codesign writes what it found to its standard error.
    const { stderr } = await run('/usr/bin/codesign', ['-dv', '--verbose=4', app], { timeout: LIMIT.quick }).catch((error) => ({ stderr: error.stderr ?? '' }))
    const team = /^TeamIdentifier=(.+)$/m.exec(stderr)?.[1]
    return team && team !== 'not set' ? team : null
  },
})

/** Stand-ins for the harness: they copy folders and say yes, and note every ask in `noted`. */
export function standInHands(noted = []) {
  const note = (what, ...args) => noted.push([what, ...args])
  return {
    noted,
    attach: async (image) => (note('attach', image), image.replace(/\.dmg$/, '.mount')),
    detach: async (mount) => void note('detach', mount),
    copy: async (from, to) => (note('copy', from, to), cp(from, to, { recursive: true })),
    info: async (app) => (note('info', app), JSON.parse(await (await import('node:fs/promises')).readFile(join(app, 'info.json'), 'utf8'))),
    systemTakes: async () => true,
    verify: async (app) => (note('verify', app), true),
    team: async () => null,
  }
}

/** Which hands a launch has: real ones only in a packaged Mac app outside the harness. */
export function handsFor({ platform, packaged, harness }) {
  if (harness) return standInHands()
  return platform === 'darwin' && packaged ? realHands() : null
}
