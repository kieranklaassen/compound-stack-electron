// The token is sealed with the system's keychain where there is one, and kept in a file only the person reads otherwise.

import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { Vault } from '../../shell/vault.mjs'

const TOKEN = 'device-token-0123456789'

// A stand-in for Electron's safeStorage: it flips every byte, so the sealed text is not the token.
const flip = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0xff))
const fakeSafe = ({ available = true } = {}) => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) => flip(Buffer.from(text, 'utf8')),
  decryptString: (buffer) => flip(buffer).toString('utf8'),
})

let folder
let path
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'vault-'))
  path = join(folder, 'account.json')
})
afterEach(() => rm(folder, { recursive: true, force: true }))

test('with nothing kept it reads null', async () => {
  assert.equal(await new Vault(path).read(), null)
  assert.equal(await new Vault(path, fakeSafe()).read(), null)
})

test('with a keychain the token is sealed in the file and read back', async () => {
  const vault = new Vault(path, fakeSafe())
  await vault.write(TOKEN)
  const text = await readFile(path, 'utf8')
  assert.ok(!text.includes(TOKEN))
  assert.deepEqual(Object.keys(JSON.parse(text)), ['sealed'])
  assert.equal(await vault.read(), TOKEN)
  assert.equal(await new Vault(path, fakeSafe()).read(), TOKEN)
})

test('with no keychain the token is kept plain', async () => {
  for (const safe of [null, undefined, fakeSafe({ available: false }), {}]) {
    const vault = new Vault(path, safe)
    await vault.write(TOKEN)
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { plain: TOKEN })
    assert.equal(await vault.read(), TOKEN)
  }
})

test('the file is the only one in its folder and only the person can read it', { skip: process.platform === 'win32' }, async () => {
  await new Vault(path).write(TOKEN)
  assert.deepEqual(await readdir(folder), ['account.json'])
  assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test('a sealed token reads as null where there is no keychain, or the keychain cannot open it', async () => {
  await new Vault(path, fakeSafe()).write(TOKEN)
  assert.equal(await new Vault(path).read(), null)
  const broken = { ...fakeSafe(), decryptString: () => { throw new Error('keychain says no') } }
  assert.equal(await new Vault(path, broken).read(), null)
})

test('a plain token kept by a build without a keychain is still read by one with it', async () => {
  await new Vault(path).write(TOKEN)
  assert.equal(await new Vault(path, fakeSafe()).read(), TOKEN)
})

test('a file that is not the vault reads as null', async () => {
  for (const text of ['not json', 'null', '{}', '{"plain":7}', '{"sealed":7}', '[]']) {
    await writeFile(path, text)
    assert.equal(await new Vault(path, fakeSafe()).read(), null, text)
  }
})

test('forget removes the file, and forgetting twice is fine', async () => {
  const vault = new Vault(path)
  await vault.write(TOKEN)
  await vault.forget()
  assert.equal(await vault.read(), null)
  assert.deepEqual(await readdir(folder), [])
  await vault.forget()
})
