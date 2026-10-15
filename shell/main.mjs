// The shell. This is the only file that imports Electron: everything it decides
// is asked of a small module beside it that knows no Electron and has a Node
// test. Keep it that way. What belongs here is wiring: the window, the scheme,
// the one IPC channel, the menu, the dialogs and the quit.

import { readFileSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, safeStorage, session, shell } from 'electron'

import { Account } from './account.mjs'
import { LINK_SCHEME, linkAmong, linkOf } from './app-link.mjs'
import { assemble } from './assemble.mjs'
import { dialogPlace } from './dialog-place.mjs'
import { Documents, EXTENSION } from './documents.mjs'
import { Kept } from './kept.mjs'
import { menuOf } from './menu.mjs'
import { opensOutside, staysInTheWindow } from './navigation.mjs'
import { CSP, fileFor, PAGE_URL, SCHEME } from './page-scheme.mjs'
import { PageWatch } from './page-watch.mjs'
import { answerOf, leaving, QUIT_BUTTONS, quitWhenDone } from './quit.mjs'
import { Recovery } from './recovery.mjs'
import { ask, NO_SERVER, serverOf } from './server.mjs'
import { settled, SETTING_DEFAULTS } from './settings.mjs'
import { clearUpdates, fetchUpdate } from './update-fetch.mjs'
import { handsFor } from './update-hands.mjs'
import { CANNOT, exchange, placeOf, prepare, sweep } from './update-install.mjs'
import { lookForUpdate } from './update-look.mjs'
import { lookTimes, Updater } from './updater.mjs'
import { Vault } from './vault.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const meta = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

// The harness is the launch tests' word (test/e2e). It keeps the app's files in
// a folder the test made and puts stand-ins where a real launch touches the
// system. A packaged app never reads it.
const harness = !app.isPackaged && process.env.COMPOUND_HARNESS === '1'
if (harness && process.env.COMPOUND_USER_DATA) app.setPath('userData', process.env.COMPOUND_USER_DATA)

// A packaged build is set to its server when it is built. A checkout reads the
// environment, so `APP_SERVER=http://localhost:3000 npm run dev` talks to a
// Rails app on this machine.
const server = serverOf(app.isPackaged ? meta.appServer : process.env.APP_SERVER)
const pageRoot = join(here, '..', 'page', 'dist')
const kept = (name) => join(app.getPath('userData'), name)

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }])

if (!app.requestSingleInstanceLock()) app.quit()

let window = null
let unsaved = false
let closing = false
let savedWaiters = []
const pageWatch = new PageWatch()

const tell = (about, value) => {
  if (window && !window.isDestroyed()) window.webContents.send('shell:tell', { about, value })
}

// ---- Dialogs. Three call sites, and each asks one rule where it stands. ----

function dialogWindow() {
  const there = Boolean(window && !window.isDestroyed())
  const place = dialogPlace({ window: { there, minimized: there && window.isMinimized(), visible: there && window.isVisible() } })
  for (const step of place.ready) window[step]()
  if (place.ready.length > 0) app.focus({ steal: true })
  return place.parent ? window : undefined
}

async function pick() {
  const parent = dialogWindow()
  const options = { properties: ['openFile'], filters: [{ name: 'Documents', extensions: [EXTENSION] }] }
  const { canceled, filePaths } = await (parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options))
  return canceled ? null : (filePaths[0] ?? null)
}

async function pickToSave(name) {
  const parent = dialogWindow()
  const options = { defaultPath: `${name}.${EXTENSION}`, filters: [{ name: 'Documents', extensions: [EXTENSION] }] }
  const { canceled, filePath } = await (parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options))
  return canceled ? null : (filePath ?? null)
}

async function askDialog(options) {
  const parent = dialogWindow()
  const { response } = await (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options))
  return response
}

// ---- The parts. ----

const settingsKept = new Kept(kept('settings.json'), { defaults: SETTING_DEFAULTS })
const settings = {
  kept: settingsKept,
  changed: (next) => {
    nativeTheme.themeSource = next.scheme
    tell('settings', next)
  },
}

const recovery = new Recovery(kept('recovery.json'))
const documents = new Documents({ pick, pickToSave })

const account = new Account({
  server,
  fetch: (address, options) => net.fetch(address, options),
  open: (address) => shell.openExternal(address),
  vault: new Vault(kept('account.json'), harness ? null : safeStorage),
  version: meta.version,
  changed: (state) => {
    tell('account', state)
    void updater.check()
  },
})

const BUSY = 'The update waits until the document is saved.'
const updatesFolder = kept('updates')
const updateNotes = new Kept(kept('update.json'))
const place = harness && process.env.COMPOUND_HARNESS_APP ? { app: process.env.COMPOUND_HARNESS_APP } : placeOf({ platform: process.platform, exePath: process.execPath, packaged: app.isPackaged })
const hands = handsFor({ platform: process.platform, packaged: app.isPackaged, harness: harness && Boolean(process.env.COMPOUND_HARNESS_APP) })

const updater = new Updater({
  running: meta.version,
  cannot: !server ? NO_SERVER : (place.cannot ?? (hands ? null : CANNOT.platform)),
  settings: async () => settled(await settingsKept.read()),
  busy: () => (unsaved ? BUSY : null),
  quit: () => app.quit(),
  changed: (state) => tell('updates', state),
  hands: {
    look: async () => {
      const token = await account.token()
      if (!token) return { signedOut: true }
      return lookForUpdate((path) => ask((address, options) => net.fetch(address, options), server, path, { token, version: meta.version }), { running: meta.version, server })
    },
    fetch: (update, progress) => fetchUpdate(update, updatesFolder, { fetch: (address, options) => net.fetch(address, options), progress }),
    prepare: (image, update) => prepare({ image, update, app: place.app, running: meta.version, bundleId: meta.appId }, hands),
    discard: (next) => rm(dirname(next), { recursive: true, force: true }),
    exchange: async (next) => {
      const exchanged = await exchange(place.app, next)
      // The app that ran is removed at the next launch, by the name noted here.
      if (exchanged.old) await updateNotes.write({ sweep: dirname(exchanged.old) })
      return exchanged
    },
    relaunch: () => app.relaunch(),
  },
})

const doors = assemble({
  account,
  documents,
  recovery,
  settings,
  updater,
  log: (line) => console.error(line),
  app: {
    about: () => ({ name: app.getName(), version: meta.version, server: server ? new URL(server).host : null, platform: process.platform }),
    unsaved: (now) => {
      unsaved = now
      if (!now) {
        for (const done of savedWaiters) done()
        savedWaiters = []
      }
      return true
    },
    openOutside: (address) => {
      if (!opensOutside(address, server)) return false
      void shell.openExternal(address)
      return true
    },
  },
})

// ---- The one channel. Only the app's own page, in the window's main frame. ----

ipcMain.handle('shell:ask', (event, asked, who) => {
  const frame = event.senderFrame
  const own = window && !window.isDestroyed() && frame === window.webContents.mainFrame && staysInTheWindow(frame.url)
  if (!own) return { ok: false, refused: 'That did not work.', code: 'not_the_page' }
  return doors.answer(asked, who)
})

// ---- Links to the app (compound://open/<id>). A link does what a button does, and no more. ----

let linkWaiting = null
function follow(link) {
  if (!link) return
  if (!window || window.isDestroyed() || window.webContents.isLoading()) linkWaiting = link
  else tell('link', link)
}
app.on('open-url', (event, address) => {
  event.preventDefault()
  follow(linkOf(address))
})
app.on('second-instance', (_event, argv) => {
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  follow(linkAmong(argv))
})

// ---- The window. ----

function openWindow() {
  window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17181a' : '#f6f5f2',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  })
  const contents = window.webContents

  // The window shows the app's own page and goes nowhere else.
  contents.on('will-navigate', (event, address) => {
    if (!staysInTheWindow(address)) event.preventDefault()
  })
  contents.setWindowOpenHandler(({ url }) => {
    if (opensOutside(url, server)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())

  contents.on('did-finish-load', () => {
    if (linkWaiting) tell('link', linkWaiting)
    linkWaiting = null
  })
  // A page that is loaded again holds ids that open nothing.
  contents.on('did-start-loading', () => documents.forget())

  // A page that died is loaded again, a few times, after what is held is written.
  contents.on('render-process-gone', async (_event, details) => {
    if (details.reason === 'clean-exit' || closing) return
    await recovery.flush()
    if (pageWatch.gone() === 'reload' && window && !window.isDestroyed()) contents.reload()
  })

  window.once('ready-to-show', () => {
    if (!harness || process.env.COMPOUND_HARNESS_SHOW === '1') window.show()
  })

  window.on('close', (event) => {
    if (closing) return
    if (leaving({ unsaved, canAsk: true }) === 'close') return
    event.preventDefault()
    void askBeforeLeaving()
  })
  window.on('closed', () => {
    window = null
  })
  window.on('blur', () => looks.left())
  window.on('focus', () => looks.cameBack())

  void window.loadURL(PAGE_URL)
}

async function askBeforeLeaving() {
  // What is held is written first: a crash while the question stands loses nothing.
  await recovery.flush()
  const answer = answerOf(
    await askDialog({
      type: 'question',
      message: 'Do you want to save the changes you made?',
      detail: "Your changes will be lost if you don't save them.",
      buttons: QUIT_BUTTONS,
      defaultId: 0,
      cancelId: 1,
    }),
  )
  if (answer === 'cancel') return
  if (answer === 'save') {
    const saved = new Promise((done) => savedWaiters.push(() => done(true)))
    tell('ask', 'save_document')
    // The save may show its own dialog; a cancel there leaves the document unsaved and the window open.
    const came = await Promise.race([saved, new Promise((done) => setTimeout(() => done(false), 120_000))])
    if (!came) return
  } else {
    await recovery.drop()
  }
  closing = true
  window?.close()
}

const looks = lookTimes({ check: () => updater.check() })

// ---- Launch. ----

app.whenReady().then(async () => {
  protocol.handle(SCHEME, async (request) => {
    const found = fileFor(pageRoot, request.url)
    if (!found) return new Response('', { status: 404 })
    try {
      return new Response(await readFile(found.file), {
        headers: { 'content-type': found.type, 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' },
      })
    } catch {
      return new Response('', { status: 404 })
    }
  })

  // The page is given nothing by default: no camera, no microphone, no place.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, answer) => answer(false))
  session.defaultSession.setPermissionCheckHandler(() => false)

  // Only a packaged build takes the scheme for the whole computer.
  if (app.isPackaged) app.setAsDefaultProtocolClient(LINK_SCHEME)

  const current = settled(await settingsKept.read())
  nativeTheme.themeSource = current.scheme

  const menu = menuOf({ name: app.getName(), mac: process.platform === 'darwin', dev: !app.isPackaged })
  const withClicks = (items) =>
    items.map((item) => ({
      ...item,
      ...(item.ask ? { click: () => tell('ask', item.ask) } : {}),
      ...(item.submenu ? { submenu: withClicks(item.submenu) } : {}),
    }))
  Menu.setApplicationMenu(Menu.buildFromTemplate(withClicks(menu)))

  // What the last update left beside the app goes now, and only under the updater's own name.
  const notes = await updateNotes.read()
  if (typeof notes.sweep === 'string' && (await sweep(notes.sweep).catch(() => false))) await updateNotes.write({ sweep: null })
  await clearUpdates(updatesFolder).catch(() => {})

  follow(linkAmong(process.argv))
  openWindow()
  await account.resume()
  looks.launched()

  app.on('activate', () => {
    if (!window) openWindow()
  })
})

app.on('window-all-closed', () => app.quit())

// A quit ends in time: what must be finished is finished here, with a limit,
// and only then is the quit handed on.
let lastDone = false
app.on('will-quit', (event) => {
  if (lastDone) return
  event.preventDefault()
  lastDone = true
  // The last things are done, so the app ends here: a second `quit` after a prevented
  // `will-quit` is not answered on every platform.
  void quitWhenDone([() => recovery.flush(), () => updater.atQuit()]).then(() => app.exit(0))
})
