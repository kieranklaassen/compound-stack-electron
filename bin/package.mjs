#!/usr/bin/env node
// `npm run package`: makes the app and its disk image in `dist/`.
//
// How the build is signed is decided from the environment (shell/signing.mjs):
// with nothing set it is signed ad hoc and no keychain is looked in. Never put
// an identity, a certificate or a notary credential in the repository.
//
//   APP_SERVER=https://app.example.com npm run package     the backend the build is set to
//   CSC_NAME="Developer ID Application: …" + one notarization set: see docs/distributing.md
//
// NOT RUN: this script was written without a Mac to hand. It has built nothing
// yet. Say so until a build it made has been opened on a Mac.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'electron-builder'

import { LINK_SCHEME } from '../shell/app-link.mjs'
import { bundleProblems } from '../shell/bundle-check.mjs'
import { signingPlan } from '../shell/signing.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const meta = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const stop = (lines) => {
  for (const line of [lines].flat()) console.error(line)
  process.exit(1)
}

const plan = signingPlan(process.env)
if (plan.error) stop(plan.error)

const appServer = process.env.APP_SERVER || undefined
const files = ['package.json', 'shell/**/*', 'page/dist/**/*', '!page/dist/**/*.map']

// What will be packed is checked before anything is built.
async function listed(folder) {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true })
  return entries.filter((entry) => entry.isFile()).map((entry) => relative(root, join(entry.parentPath, entry.name)).split('\\').join('/'))
}
const packed = ['package.json', ...(await listed(join(root, 'shell'))), ...(await listed(join(root, 'page', 'dist')).catch(() => []))]
const problems = bundleProblems({ files: packed, meta: { ...meta, appServer } })
if (problems.length > 0) stop(problems)

console.log(`Signing: ${plan.kind}${appServer ? `, server: ${new URL(appServer).host}` : ', no server'}`)

await build({
  projectDir: root,
  publish: 'never',
  config: {
    appId: meta.appId,
    productName: meta.productName,
    directories: { output: 'dist' },
    files,
    // The server the build talks to is written into the packed package.json.
    extraMetadata: { appServer },
    asar: true,
    protocols: [{ name: meta.productName, schemes: [LINK_SCHEME] }],
    // A packaged app cannot be run as plain Node, cannot be handed Node options and cannot be inspected.
    electronFuses: {
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      resetAdHocDarwinSignature: plan.kind === 'ad-hoc',
    },
    mac: {
      target: ['dmg'],
      category: 'public.app-category.productivity',
      hardenedRuntime: plan.kind !== 'ad-hoc',
      identity: plan.kind === 'ad-hoc' ? '-' : plan.identity,
      notarize: plan.kind === 'signed-notarized',
    },
    linux: { target: ['AppImage'] },
    win: { target: ['nsis'] },
  },
})
