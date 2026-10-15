// How a build is signed is decided from the environment, in one pure function,
// so a test reads every case and no identity is ever written in the repository.
//
//   nothing set                      -> ad hoc: no keychain is looked in
//   CSC_NAME                         -> signed with that Developer ID
//   CSC_NAME + one notarization set  -> signed and notarized
//
// A set that is half given is an error, said before anything is built: a build
// that quietly skipped notarization is found out by the first person who
// downloads it.

const SETS = [
  ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
  ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
  ['APPLE_KEYCHAIN_PROFILE'],
]

/** `{ kind: 'ad-hoc' | 'signed' | 'signed-notarized', identity?, notarize? }`, or `{ error }`. */
export function signingPlan(env) {
  const has = (name) => typeof env[name] === 'string' && env[name].trim() !== ''
  const identity = has('CSC_NAME') ? env.CSC_NAME.trim() : null
  const begun = SETS.filter((set) => set.some(has))
  const half = begun.find((set) => !set.every(has))
  if (half) return { error: `Notarization needs all of ${half.join(', ')}. Missing: ${half.filter((name) => !has(name)).join(', ')}.` }
  if (begun.length > 1) return { error: 'Give one way to notarize, not several.' }
  if (begun.length === 1 && !identity) return { error: 'Notarization needs a signed build: set CSC_NAME too.' }
  if (!identity) return { kind: 'ad-hoc' }
  if (begun.length === 0) return { kind: 'signed', identity }
  return { kind: 'signed-notarized', identity, notarize: begun[0] }
}
