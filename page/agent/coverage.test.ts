// The rules of the agent surface, held by reading the page's own source:
// every control names a row, every row is on a control and carries its help,
// every row has a tool or says why it has none, and no component writes help
// of its own.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { COMMANDS } from '../app/commands'
import { PICTURES } from '../help/pictures'
import { ROWS } from './rows'
import { PAGE_TOOLS } from './tools'

const PAGE = join(import.meta.dirname, '..')
const sources = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return entry.name === 'dist' ? [] : sources(path)
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : []
  })

const components = sources(PAGE).map((path) => ({ path, text: readFileSync(path, 'utf8') }))
const named = components.flatMap(({ path, text }) =>
  [...text.matchAll(/\b(?:data-action|action|answerAction)="([a-z_]+)"/g)].map((match) => ({ path, row: match[1]! })),
)

describe('coverage', () => {
  it('finds the controls', () => {
    expect(named.length).toBeGreaterThan(15)
  })

  it('has a row for every control', () => {
    const rows = new Set(ROWS.map((row) => row.id))
    expect(named.filter(({ row }) => !rows.has(row))).toEqual([])
  })

  it('has a control for every row', () => {
    const used = new Set(named.map(({ row }) => row))
    expect(ROWS.filter((row) => !used.has(row.id)).map((row) => row.id)).toEqual([])
  })

  it('names a row by a literal, so this test can read it', () => {
    // The kit's own elements and AskFirst pass a row through; everything else writes it out.
    for (const { path, text } of components) if (!path.includes('/kit/') && !path.endsWith('ask_first.tsx')) expect(text, path).not.toMatch(/\b(?:data-action|action|answerAction)=\{/)
  })

  it('gives every row, and every part, a name and what it does', () => {
    for (const row of ROWS) {
      for (const help of [row, ...Object.values(row.parts ?? {})]) {
        expect(help.name.split(' ').length, row.id).toBeLessThanOrEqual(4)
        expect(help.how.length, row.id).toBeGreaterThan(10)
        if (help.picture) expect(PICTURES, row.id).toHaveProperty(help.picture)
      }
    }
  })

  it('gives every row a tool there is, or the reason it has none', () => {
    const tools = new Set(PAGE_TOOLS.map((tool) => tool.name))
    for (const row of ROWS) {
      expect(Boolean(row.tool) !== Boolean(row.personOnly), `${row.id} has a tool or says why not, never both or neither`).toBe(true)
      if (row.tool) expect(tools, row.id).toContain(row.tool)
      if (row.command) expect(COMMANDS, row.id).toHaveProperty(row.command)
    }
  })

  it('writes no tooltip in a component: help is the row’s', () => {
    for (const { path, text } of components) expect(text, path).not.toMatch(/\btitle=/)
  })

  it('keeps every tool’s schema closed', () => {
    for (const tool of PAGE_TOOLS) {
      expect(tool.schema.additionalProperties, tool.name).toBe(false)
      expect(tool.description.length, tool.name).toBeGreaterThan(10)
      expect(Object.keys(tool.schema.properties).join(' '), tool.name).not.toMatch(/path|token|password|key/i)
    }
  })
})
