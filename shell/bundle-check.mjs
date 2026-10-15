// What a packaged app must hold, as a pure check over a listing of its files,
// so packaging stops on a bundle that would launch into a blank window. The
// package script lists the files and puts them to this.

export const NEEDS = [
  { file: 'shell/main.mjs', why: 'the shell' },
  { file: 'shell/preload.cjs', why: 'the bridge to the page' },
  { file: 'page/dist/index.html', why: 'the page' },
  { file: 'package.json', why: 'the version and the server the build is set to' },
]

/** Every problem of a bundle, as sentences. `files` are paths inside the app; `meta` is its package.json. */
export function bundleProblems({ files, meta }) {
  const have = new Set(files)
  const problems = NEEDS.filter(({ file }) => !have.has(file)).map(({ file, why }) => `The bundle has no ${file} (${why}).`)
  if (!files.some((file) => /^page\/dist\/assets\/.+\.js$/.test(file))) problems.push("The bundle has no script of the page's: run the page build first.")
  if (files.some((file) => file.startsWith('test/') || file.startsWith('docs/'))) problems.push('The bundle holds tests or docs: check the files list.')
  if (!/^\d+\.\d+\.\d+$/.test(meta?.version ?? '')) problems.push('The version is not three numbers, so no update could be compared with it.')
  if (meta?.appServer !== undefined && !/^https:\/\//.test(meta.appServer)) problems.push('A packaged build is set to an https server or to none.')
  return problems
}
