// How a build is signed is decided from the environment, and a half-given set is an error.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { signingPlan } from '../../shell/signing.mjs'

const APPLE_ID = { APPLE_ID: 'someone@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh', APPLE_TEAM_ID: 'TEAM123456' }
const API_KEY = { APPLE_API_KEY: '/keys/key.p8', APPLE_API_KEY_ID: 'KEYID12345', APPLE_API_ISSUER: 'issuer-uuid' }
const PROFILE = { APPLE_KEYCHAIN_PROFILE: 'notary' }
const NAME = { CSC_NAME: 'Example Org (TEAM123456)' }

test('nothing set is ad hoc', () => {
  assert.deepEqual(signingPlan({}), { kind: 'ad-hoc' })
  assert.deepEqual(signingPlan({ PATH: '/usr/bin', HOME: '/home/someone' }), { kind: 'ad-hoc' })
})

test('an empty or blank variable is not set', () => {
  assert.deepEqual(signingPlan({ CSC_NAME: '', APPLE_ID: '  ', APPLE_KEYCHAIN_PROFILE: '' }), { kind: 'ad-hoc' })
})

test('CSC_NAME alone is signed, with the name trimmed', () => {
  assert.deepEqual(signingPlan(NAME), { kind: 'signed', identity: 'Example Org (TEAM123456)' })
  assert.deepEqual(signingPlan({ CSC_NAME: '  Example Org  ' }), { kind: 'signed', identity: 'Example Org' })
})

test('CSC_NAME with one whole set is signed and notarized with that set', () => {
  assert.deepEqual(signingPlan({ ...NAME, ...APPLE_ID }), { kind: 'signed-notarized', identity: NAME.CSC_NAME, notarize: Object.keys(APPLE_ID) })
  assert.deepEqual(signingPlan({ ...NAME, ...API_KEY }), { kind: 'signed-notarized', identity: NAME.CSC_NAME, notarize: Object.keys(API_KEY) })
  assert.deepEqual(signingPlan({ ...NAME, ...PROFILE }), { kind: 'signed-notarized', identity: NAME.CSC_NAME, notarize: ['APPLE_KEYCHAIN_PROFILE'] })
})

test('a half-given set is an error that names what is missing, with or without a name', () => {
  for (const set of [APPLE_ID, API_KEY]) {
    const names = Object.keys(set)
    for (const missing of names) {
      const env = { ...NAME, ...set }
      delete env[missing]
      const plan = signingPlan(env)
      assert.deepEqual(Object.keys(plan), ['error'])
      assert.equal(plan.error, `Notarization needs all of ${names.join(', ')}. Missing: ${missing}.`)
      delete env.CSC_NAME
      assert.equal(signingPlan(env).error, plan.error)
    }
  }
  assert.equal(signingPlan({ APPLE_ID: 'someone@example.com' }).error, 'Notarization needs all of APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID. Missing: APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.')
})

test('a half-given set is an error even beside a whole one', () => {
  assert.match(signingPlan({ ...NAME, ...PROFILE, APPLE_API_KEY: '/keys/key.p8' }).error, /^Notarization needs all of APPLE_API_KEY/)
})

test('two whole sets are an error', () => {
  assert.deepEqual(signingPlan({ ...NAME, ...APPLE_ID, ...API_KEY }), { error: 'Give one way to notarize, not several.' })
  assert.deepEqual(signingPlan({ ...NAME, ...APPLE_ID, ...PROFILE }), { error: 'Give one way to notarize, not several.' })
  assert.deepEqual(signingPlan({ ...APPLE_ID, ...API_KEY, ...PROFILE }), { error: 'Give one way to notarize, not several.' })
})

test('a whole set with no name is an error', () => {
  for (const set of [APPLE_ID, API_KEY, PROFILE]) assert.deepEqual(signingPlan(set), { error: 'Notarization needs a signed build: set CSC_NAME too.' })
})

test('no error holds a value of the environment', () => {
  const plan = signingPlan({ APPLE_ID: 'someone@example.com', APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh' })
  assert.doesNotMatch(plan.error, /someone@example\.com|abcd-efgh/)
})
