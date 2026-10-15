#!/usr/bin/env node
// `npm run dev`: builds the page, keeps building it as files change, and starts
// the app on it. The app loads the built page on its own scheme, exactly as a
// packaged build does, so what is developed is what ships. After a change,
// Develop > Reload (Cmd-R) loads the new page.
//
//   APP_SERVER=http://localhost:3000 npm run dev    talk to a Rails app on this machine

import { spawn } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bin = (name) => join(root, 'node_modules', '.bin', name)
const built = join(root, 'page', 'dist', 'index.html')

const vite = spawn(bin('vite'), ['build', '--watch', '--config', 'page/vite.config.ts'], { cwd: root, stdio: 'inherit' })

let app = null
const start = () => {
  if (app || !existsSync(built)) return
  app = spawn(bin('electron'), ['.'], { cwd: root, stdio: 'inherit', env: process.env })
  app.on('exit', (code) => {
    vite.kill()
    process.exit(code ?? 0)
  })
}

start()
if (!app) {
  const watcher = watch(join(root, 'page'), { recursive: true }, () => {
    start()
    if (app) watcher.close()
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    app?.kill()
    vite.kill()
  })
}
