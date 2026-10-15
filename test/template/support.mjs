// What the template's own tests share. No dependencies: the manifest is a small
// YAML file with one shape, so it is read with a pattern, not a YAML package.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const at = (...parts) => join(root, ...parts)
export const text = (...parts) => readFileSync(at(...parts), 'utf8')
export const there = (...parts) => existsSync(at(...parts))

export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** -1, 0 or 1 as version `a` is lower than, the same as or higher than `b`. */
export function compare(a, b) {
  const [left, right] = [a, b].map((version) => version.split('.').map(Number))
  for (let part = 0; part < 3; part += 1) {
    if (left[part] !== right[part]) return Math.sign(left[part] - right[part])
  }
  return 0
}

/** `{ version, modules }` of `.template-manifest.yml`: the version, and each module's name with the version it was adopted at. */
export function manifest() {
  const lines = text('.template-manifest.yml').split('\n')
  const version = lines.map((line) => /^template_version:\s*"([^"]*)"\s*$/.exec(line)?.[1]).find((found) => found !== undefined) ?? null
  const start = lines.findIndex((line) => /^modules:\s*$/.test(line))
  const modules = {}
  for (const line of start < 0 ? [] : lines.slice(start + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue
    const entry = /^  ([A-Za-z0-9_-]+):\s*"([^"]*)"\s*$/.exec(line)
    if (!entry) break
    modules[entry[1]] = entry[2]
  }
  return { version, modules }
}

/** The files of a folder that end in `ending`, sorted. Nothing where the folder is not there. */
export const filesOf = (folder, ending) => (there(folder) ? readdirSync(at(folder)).filter((name) => name.endsWith(ending)).sort() : [])

/** `{ fields, body }` of a file with YAML frontmatter of plain `key: value` lines, or null. */
export function frontmatter(source) {
  const found = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source)
  if (!found) return null
  const fields = {}
  for (const line of found[1].split('\n')) {
    const field = /^([a-z_]+):\s*(.*?)\s*(?:#.*)?$/.exec(line)
    if (field) fields[field[1]] = field[2].replace(/^"(.*)"$/, '$1')
  }
  return { fields, body: found[2] }
}

/** The items of a one-line YAML list, `[a, b]`. */
export const listOf = (value) => (/^\[(.*)\]$/.exec(value ?? '')?.[1] ?? '').split(',').map((item) => item.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean)
